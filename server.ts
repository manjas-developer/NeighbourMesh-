import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL = 'gemini-4-hydrogen';
const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add a Gemini API key in Settings > Secrets to enable AI matching and extraction.'
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleApiError(res: Response, error: unknown, context: string): void {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  const status = errObj?.statusCode || errObj?.status || 500;
  const rawMessage = errObj?.message || `Unexpected error during ${context}.`;

  let friendlyMessage = rawMessage;
  if (rawMessage.includes('API_KEY_INVALID') || status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    friendlyMessage =
      'Gemini API key permission or validation failed. Please check your API key in Settings > Secrets.';
  } else if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    friendlyMessage =
      'Gemini API rate limit reached. Please wait a moment and try again, or select a higher-quota key in Settings > Secrets.';
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: friendlyMessage,
  });
}

interface CatalogSummary {
  id: string;
  title: string;
  category: string;
  description: string;
  zoneName: string;
  distanceKm: number;
  availability: string;
  isHub: boolean;
}

const app = express();
app.use(express.json({ limit: '12mb' }));

// 1. Semantic Need-to-Resource Matching + Intent Extraction + Trust & Safety Check
app.post('/api/match', async (req: Request, res: Response) => {
  try {
    const {
      query,
      userZoneName,
      radiusKm,
      minConfidence,
      catalog,
    } = req.body as {
      query?: string;
      userZoneName?: string;
      radiusKm?: number;
      minConfidence?: number;
      catalog?: CatalogSummary[];
    };

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ error: 'Please describe what you need or are looking for.' });
      return;
    }

    const items = Array.isArray(catalog) ? catalog : [];
    const maxRadius = typeof radiusKm === 'number' ? radiusKm : 2.0;
    const threshold = typeof minConfidence === 'number' ? minConfidence : 65;

    const nearbyItems = items.filter((item) => item.distanceKm <= maxRadius);
    const ai = getGeminiClient();

    const prompt = [
      `Resident request (fuzzy zone: ${userZoneName || 'Oakridge North'}, search radius: ${maxRadius} km):`,
      `"${query.trim()}"`,
      '',
      'Available neighborhood resources within radius:',
      JSON.stringify(nearbyItems, null, 2),
      '',
      'Tasks:',
      '1. Understand the practical human need behind the request, even when different keywords are used (e.g., "reach a high ceiling fan" semantically matches a "6-foot aluminum stepladder"; "tighten hinges" matches a "cordless drill").',
      '2. Run a trust & safety check: flag commercial spam, scams, illegal requests, or off-topic posts. Suggest a practical, privacy-preserving safe handoff protocol (never ask for exact home addresses in public threads; recommend porch pickup with confirmed window or public hub like Cedar Branch Library).',
      `3. Score each genuinely relevant resource from 0 to 100 based on semantic utility and proximity. Only include resources scoring >= ${threshold} unless none meet it (then return empty matches array and explain what is missing).`,
      '4. Order matches from highest score to lowest.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are NeighborMesh, a hyper-local civic mutual-aid coordinator. Return strict JSON matching the schema. Be practical, warm, concise, and privacy-first.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedIntent: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: 'Plain-language summary of the need.' },
                category: {
                  type: Type.STRING,
                  description: 'One of: Tool, Medical, Skill, Education, Care, Hub, General',
                },
                urgency: { type: Type.STRING, description: 'One of: Low, Moderate, High, Emergency' },
                timeWindow: { type: Type.STRING, description: 'Inferred timeframe such as Today afternoon or Flexible.' },
                inferredNeed: { type: Type.STRING, description: 'Specific tool, item, or skill that solves the need.' },
              },
              required: ['summary', 'category', 'urgency', 'timeWindow', 'inferredNeed'],
            },
            moderation: {
              type: Type.OBJECT,
              properties: {
                approved: { type: Type.BOOLEAN },
                statusLabel: { type: Type.STRING, description: 'Short label like Verified Local Need or Flagged Commercial Spam.' },
                reason: { type: Type.STRING },
                safeHandoffProtocol: { type: Type.STRING, description: 'Concrete peer-to-peer handoff recommendation.' },
              },
              required: ['approved', 'statusLabel', 'reason', 'safeHandoffProtocol'],
            },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  listingId: { type: Type.STRING },
                  confidence: { type: Type.INTEGER, description: '0-100 match confidence score.' },
                  semanticReason: {
                    type: Type.STRING,
                    description: 'Concise 1-sentence explanation connecting the request to this listing.',
                  },
                  handoffTip: {
                    type: Type.STRING,
                    description: 'Practical handoff or scheduling tip for this specific resource.',
                  },
                },
                required: ['listingId', 'confidence', 'semanticReason', 'handoffTip'],
              },
            },
            fallbackAdvice: {
              type: Type.STRING,
              description: 'Helpful next step if no high-confidence matches exist inside the chosen radius.',
            },
          },
          required: ['extractedIntent', 'moderation', 'matches', 'fallbackAdvice'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error) {
    handleApiError(res, error, 'semantic matching');
  }
});

// 2. Zero-Friction Conversational & Multimodal Vision Extraction (Tools/Skills or Issue)
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const {
      paragraph,
      zoneName,
      imageBase64,
      imageMimeType,
    } = req.body as {
      paragraph?: string;
      zoneName?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    const hasText = typeof paragraph === 'string' && paragraph.trim().length > 0;
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0 && typeof imageMimeType === 'string';

    if (!hasText && !hasImage) {
      res.status(400).json({ error: 'Provide a short description, a photo, or both to extract listings.' });
      return;
    }

    const ai = getGeminiClient();
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (hasImage && imageBase64 && imageMimeType) {
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: cleanBase64,
        },
      });
    }

    parts.push({
      text: [
        `Neighborhood fuzzy zone: ${zoneName || 'Oakridge North'}`,
        hasText ? `Resident note: "${paragraph?.trim()}"` : 'Analyze the attached photo carefully.',
        '',
        'Instructions:',
        '1. Check Trust & Safety first: detect commercial spam, phishing, crypto/loan ads, or unsafe items. Set moderation.approved=false if spam or unsafe.',
        '2. Determine whether the resident is offering shared household items/skills ("resources") OR reporting a neighborhood maintenance/safety issue ("issue").',
        '3. If offering items/skills, extract EVERY distinct item or skill mentioned or visible in the photo as a separate structured listing with clean title, category (Tool, Medical, Skill, Education, Care), clear 1-2 sentence description, availability window, and safe handoff protocol.',
        '4. If reporting a local issue (broken streetlight, leak, stray pet, blocked drain), populate detectedIssue with title, category, severity (Low, Moderate, High), summary, and recommended local coordinator.',
      ].join('\n'),
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are NeighborMesh intake extraction. Convert messy conversational paragraphs or photos into clean structured neighborhood resources or issue reports. Never invent street addresses.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedType: { type: Type.STRING, description: 'Either resources or issue' },
            moderation: {
              type: Type.OBJECT,
              properties: {
                approved: { type: Type.BOOLEAN },
                statusLabel: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['approved', 'statusLabel', 'reason'],
            },
            extractedListings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING, description: 'One of: Tool, Medical, Skill, Education, Care' },
                  description: { type: Type.STRING },
                  availability: { type: Type.STRING },
                  safeHandoff: { type: Type.STRING },
                  ownerName: { type: Type.STRING, description: 'First name if stated, otherwise Neighbor' },
                },
                required: ['title', 'category', 'description', 'availability', 'safeHandoff', 'ownerName'],
              },
            },
            detectedIssue: {
              type: Type.OBJECT,
              properties: {
                present: { type: Type.BOOLEAN },
                title: { type: Type.STRING },
                category: { type: Type.STRING, description: 'One of: Utilities, Safety, Pet Alert, Streets, Environment' },
                severity: { type: Type.STRING, description: 'One of: Low, Moderate, High' },
                summary: { type: Type.STRING },
                coordinator: { type: Type.STRING },
              },
              required: ['present', 'title', 'category', 'severity', 'summary', 'coordinator'],
            },
          },
          required: ['detectedType', 'moderation', 'extractedListings', 'detectedIssue'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error) {
    handleApiError(res, error, 'listing extraction');
  }
});

// 3. Community Pulse & Issue Triage from Raw Noisy Chat / Photo
app.post('/api/triage', async (req: Request, res: Response) => {
  try {
    const { rawChat, zoneName, imageBase64, imageMimeType } = req.body as {
      rawChat?: string;
      zoneName?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    const hasText = typeof rawChat === 'string' && rawChat.trim().length > 0;
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0 && typeof imageMimeType === 'string';

    if (!hasText && !hasImage) {
      res.status(400).json({ error: 'Paste neighborhood chat messages or attach an issue photo to triage.' });
      return;
    }

    const ai = getGeminiClient();
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (hasImage && imageBase64 && imageMimeType) {
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: cleanBase64,
        },
      });
    }

    parts.push({
      text: [
        `Default fuzzy zone: ${zoneName || 'Oakridge North'}`,
        hasText ? `Raw neighborhood messages (may contain multiple languages, duplicates, and spam):\n${rawChat?.trim()}` : 'Inspect the attached neighborhood issue photo.',
        '',
        'Deduplicate overlapping reports, filter out unrelated spam/ads, translate non-English reports into clear English summaries, assign severity (Low, Moderate, High), identify approximate affected fuzzy zone, and route each actionable cluster to the appropriate local coordinator (e.g., Ward 4 Water Liaison, Civic Lighting Desk, Community Pet Watch, RWA Maintenance Team).',
      ].join('\n'),
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are NeighborMesh Community Pulse triage. Synthesize chaotic multilingual neighborhood chatter into crisp, deduplicated civic action items.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filteredSpamCount: { type: Type.INTEGER },
            summaryHeadline: { type: Type.STRING },
            triagedIssues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING, description: 'Utilities, Safety, Pet Alert, Streets, or Environment' },
                  severity: { type: Type.STRING, description: 'Low, Moderate, or High' },
                  zoneName: { type: Type.STRING },
                  reportCount: { type: Type.INTEGER },
                  actionableSummary: { type: Type.STRING },
                  routedCoordinator: { type: Type.STRING },
                  recommendedAction: { type: Type.STRING },
                },
                required: [
                  'title',
                  'category',
                  'severity',
                  'zoneName',
                  'reportCount',
                  'actionableSummary',
                  'routedCoordinator',
                  'recommendedAction',
                ],
              },
            },
          },
          required: ['filteredSpamCount', 'summaryHeadline', 'triagedIssues'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error) {
    handleApiError(res, error, 'community pulse triage');
  }
});

// 4. Real-Time Multilingual Translation for Community Threads & Listings
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body as {
      text?: string;
      targetLanguage?: string;
    };

    if (!text || !targetLanguage) {
      res.status(400).json({ error: 'Provide text and targetLanguage for translation.' });
      return;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Translate the following neighborhood community message into ${targetLanguage}. Keep it natural, warm, and preserve all practical details (times, tool names, fuzzy zones). Return JSON.\n\nMessage:\n"${text}"`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            translatedText: { type: Type.STRING },
          },
          required: ['detectedLanguage', 'translatedText'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error) {
    handleApiError(res, error, 'translation');
  }
});

// 5. Offline-First SMS / WhatsApp Bridge Coordinator
app.post('/api/sms-bridge', async (req: Request, res: Response) => {
  try {
    const { message, catalog, emergencyAlerts } = req.body as {
      message?: string;
      catalog?: CatalogSummary[];
      emergencyAlerts?: Array<{ title: string; zoneName: string; action: string }>;
    };

    if (!message || message.trim().length < 2) {
      res.status(400).json({ error: 'Enter an SMS message to test the offline bridge.' });
      return;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        `Incoming resident SMS / WhatsApp message: "${message.trim()}"`,
        '',
        'Local Catalog:',
        JSON.stringify((catalog || []).slice(0, 14)),
        '',
        'Active Emergency Alerts:',
        JSON.stringify(emergencyAlerts || []),
        '',
        'Draft a concise, crystal-clear SMS reply (under 240 characters, plain text, no markdown, no exact street addresses—only fuzzy zone and safe pickup point or hub). Also extract the parsed SMS command type.',
      ].join('\n'),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are NeighborMesh Offline SMS Bridge for residents without smartphones or data access. Be calm, clear, and concise.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parsedIntent: { type: Type.STRING },
            smsReply: { type: Type.STRING },
            matchedZone: { type: Type.STRING },
          },
          required: ['parsedIntent', 'smsReply', 'matchedZone'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error) {
    handleApiError(res, error, 'SMS bridge');
  }
});

async function startServer(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NeighborMesh server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

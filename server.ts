import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
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

function handleApiError(res: Response, err: unknown, fallbackMsg: string) {
  console.error('[NeighborMesh API Error]', err);
  const message = err instanceof Error ? err.message : fallbackMsg;
  const status =
    message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
      ? 429
      : message.includes('403') || message.includes('PERMISSION_DENIED')
        ? 403
        : 500;
  res.status(status).json({ error: message || fallbackMsg });
}

interface MapSource {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

interface WebSource {
  title: string;
  uri: string;
}

function extractGroundingSources(response: unknown): {
  mapSources: MapSource[];
  webSources: WebSource[];
} {
  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
          maps?: {
            uri?: string;
            title?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ content?: string; text?: string }>;
            };
          };
        }>;
      };
    }>;
  };

  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const mapSources: MapSource[] = [];
  const webSources: WebSource[] = [];
  const seenMapUris = new Set<string>();
  const seenWebUris = new Set<string>();

  for (const chunk of chunks) {
    if (chunk.maps?.uri && !seenMapUris.has(chunk.maps.uri)) {
      seenMapUris.add(chunk.maps.uri);
      const snippets = (chunk.maps.placeAnswerSources?.reviewSnippets ?? [])
        .map((s) => s.content || s.text || '')
        .filter(Boolean);
      mapSources.push({
        title: chunk.maps.title || 'View on Google Maps',
        uri: chunk.maps.uri,
        reviewSnippets: snippets.length > 0 ? snippets : undefined,
      });
    }
    if (chunk.web?.uri && !seenWebUris.has(chunk.web.uri)) {
      seenWebUris.add(chunk.web.uri);
      webSources.push({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
      });
    }
  }

  return { mapSources, webSources };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  // Client configuration (Google Maps public browser key only — never expose GEMINI_API_KEY)
  app.get('/api/config', (_req: Request, res: Response) => {
    const googleMapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ googleMapsApiKey });
  });

  // 1. Audio Transcription using gemini-3.5-transcribe
  app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Missing audio data for transcription.' });
        return;
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this neighborhood voice note accurately into clean text. Preserve the original language if not English, and remove filler stutters only when unclear.',
            },
          ],
        },
      });

      const transcript = (response.text ?? '').trim();
      res.json({ transcript });
    } catch (err) {
      handleApiError(res, err, 'Unable to transcribe audio.');
    }
  });

  // 2. Multimodal Structured Post Extraction + Trust & Safety Moderation
  app.post('/api/ai/structure-post', async (req: Request, res: Response) => {
    try {
      const { text, imageBase64, imageMimeType } = req.body as {
        text?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!text?.trim() && !imageBase64) {
        res.status(400).json({ error: 'Provide text, voice transcript, or a photo.' });
        return;
      }

      const ai = getAI();
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType || 'image/jpeg',
            data: imageBase64,
          },
        });
      }

      parts.push({
        text: `Analyze this resident post (and optional photo) for NeighborMesh, a hyper-local mutual aid & community coordination network.
Convert it into clean structured data. Determine whether it is a Need (requesting help/item), Offer (sharing tool/skill/item), or Issue (neighborhood infrastructure, outage, safety, or stray animal alert).
Also perform a Trust & Safety check: flag obvious spam/commercial scams/unsafe requests, and provide 2-3 practical, human safe-handoff or resolution steps.

Resident input: "${(text || 'Analyze the uploaded photo and draft a neighborhood listing or issue report.').trim()}"`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Concise, clear human title under 65 characters.',
              },
              postType: {
                type: Type.STRING,
                description: 'Exactly one of: need, offer, issue',
              },
              category: {
                type: Type.STRING,
                description:
                  'One of: Tools & Hardware, Skills & Tutoring, Household & Garden, Care & Mobility, Civic Issue, Emergency Aid',
              },
              urgency: {
                type: Type.STRING,
                description: 'Exactly one of: low, medium, high, critical',
              },
              timeWindow: {
                type: Type.STRING,
                description: 'When needed or available, e.g. Today 4–7 PM, Weekends, Ongoing.',
              },
              cleanedDescription: {
                type: Type.STRING,
                description: 'Clear 1-2 sentence description incorporating photo details if present.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 semantic keywords/synonyms that help match different phrasings.',
              },
              approved: {
                type: Type.BOOLEAN,
                description: 'True if legitimate local mutual aid or civic report; false if spam, scam, or harmful.',
              },
              moderationNote: {
                type: Type.STRING,
                description: 'Short plain-language trust and relevance verification note.',
              },
              safeHandoffSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 3 brief practical safety/handoff recommendations for neighbors.',
              },
            },
            required: [
              'title',
              'postType',
              'category',
              'urgency',
              'timeWindow',
              'cleanedDescription',
              'tags',
              'approved',
              'moderationNote',
              'safeHandoffSteps',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err, 'Unable to structure post.');
    }
  });

  // 3. Semantic Need-to-Resource Matching (even across different keywords)
  app.post('/api/ai/semantic-match', async (req: Request, res: Response) => {
    try {
      const { query, listings } = req.body as {
        query?: string;
        listings?: Array<{
          id: string;
          title: string;
          description: string;
          category: string;
          type: string;
          zoneLabel: string;
          distanceKm?: number;
          tags: string[];
          authorName: string;
          availability: string;
        }>;
      };

      if (!query?.trim() || !Array.isArray(listings)) {
        res.status(400).json({ error: 'Query and neighborhood listings are required.' });
        return;
      }

      const ai = getAI();
      const catalogText = listings
        .map(
          (l) =>
            `ID: ${l.id} | Type: ${l.type} | Title: ${l.title} | Category: ${l.category} | Zone: ${l.zoneLabel} (${l.distanceKm ?? '?'} km) | Availability: ${l.availability} | Details: ${l.description} | Keywords: ${l.tags.join(', ')}`
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `A resident posted or searched for: "${query.trim()}"

Here is the current NeighborMesh neighborhood directory and active offers/resources:
${catalogText}

Perform semantic matching based on real-world functional intent, NOT just exact keyword overlap (for example, "reach a high ceiling fan" strongly matches a "6-foot aluminum stepladder", and "pipe dripping under kitchen sink" matches "basic plumbing help" or "adjustable wrench set").
Only include matches with genuine practical usefulness (confidence >= 0.55) to prevent notification fatigue. Rank up to 4 best matches.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intentSummary: {
                type: Type.STRING,
                description: 'One concise sentence summarizing what the resident actually needs.',
              },
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    listingId: { type: Type.STRING },
                    confidence: {
                      type: Type.NUMBER,
                      description: 'Relevance score from 0.55 to 0.99.',
                    },
                    whyItMatches: {
                      type: Type.STRING,
                      description: 'Clear 1-sentence explanation connecting the need to this item/skill.',
                    },
                    suggestedHandoffMessage: {
                      type: Type.STRING,
                      description: 'Friendly 1-sentence outreach note the resident can send to their neighbor.',
                    },
                  },
                  required: ['listingId', 'confidence', 'whyItMatches', 'suggestedHandoffMessage'],
                },
              },
            },
            required: ['intentSummary', 'matches'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err, 'Unable to run semantic matching.');
    }
  });

  // 4. Zero-Friction Paragraph Onboarding (extracts multiple tools & skills at once)
  app.post('/api/ai/batch-onboard', async (req: Request, res: Response) => {
    try {
      const { paragraph, authorName, zoneLabel } = req.body as {
        paragraph?: string;
        authorName?: string;
        zoneLabel?: string;
      };

      if (!paragraph?.trim()) {
        res.status(400).json({ error: 'Please write or speak a paragraph describing your tools or skills.' });
        return;
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract every distinct shareable household tool, equipment item, or skill from this neighbor's conversational introduction so they can be cataloged automatically in NeighborMesh without manual tagging.

Neighbor (${authorName || 'Resident'}, ${zoneLabel || 'Local Zone'}):
"${paragraph.trim()}"`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    kind: {
                      type: Type.STRING,
                      description: 'Either "tool" or "skill"',
                    },
                    category: {
                      type: Type.STRING,
                      description:
                        'One of: Tools & Hardware, Skills & Tutoring, Household & Garden, Care & Mobility',
                    },
                    description: { type: Type.STRING },
                    availability: { type: Type.STRING },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['title', 'kind', 'category', 'description', 'availability', 'tags'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err, 'Unable to catalog items from paragraph.');
    }
  });

  // 5. Real-Time Multilingual Translation (fast model: gemini-3.1-flash-lite)
  app.post('/api/ai/translate', async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body as {
        text?: string;
        targetLanguage?: string;
      };
      if (!text?.trim() || !targetLanguage?.trim()) {
        res.status(400).json({ error: 'Text and target language are required.' });
        return;
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Translate the following neighborhood community message naturally and accurately into ${targetLanguage}. Return ONLY the translated text without quotation marks or commentary.\n\n${text.trim()}`,
      });

      res.json({ translatedText: (response.text ?? '').trim() });
    } catch (err) {
      handleApiError(res, err, 'Unable to translate message.');
    }
  });

  // 6. Community Pulse & Issue Triage Summary
  app.post('/api/ai/triage-pulse', async (req: Request, res: Response) => {
    try {
      const { issues } = req.body as {
        issues?: Array<{
          id: string;
          title: string;
          description: string;
          zoneLabel: string;
          urgency: string;
          reportsCount?: number;
        }>;
      };

      if (!Array.isArray(issues) || issues.length === 0) {
        res.status(400).json({ error: 'No neighborhood issues provided.' });
        return;
      }

      const ai = getAI();
      const issuesText = issues
        .map(
          (i) =>
            `- [${i.urgency.toUpperCase()}] ${i.title} (${i.zoneLabel}, ${i.reportsCount ?? 1} resident reports): ${i.description}`
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are the NeighborMesh Community Pulse triage coordinator. Aggregate these neighborhood issue reports into a clear executive summary, cluster recurring themes, assign each cluster to the right local volunteer coordinator group (e.g., Utilities & Infrastructure Desk, Street Safety Lead, Animal Care Volunteers, RWA Maintenance Team), and list immediate next actions. Keep tone calm, factual, and civic.

Reported issues:
${issuesText}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              overallSummary: { type: Type.STRING },
              clusters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    theme: { type: Type.STRING },
                    severity: {
                      type: Type.STRING,
                      description: 'One of: low, medium, high, critical',
                    },
                    routedTo: { type: Type.STRING },
                    affectedZones: { type: Type.STRING },
                    recommendedAction: { type: Type.STRING },
                  },
                  required: ['theme', 'severity', 'routedTo', 'affectedZones', 'recommendedAction'],
                },
              },
            },
            required: ['headline', 'overallSummary', 'clusters'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err, 'Unable to generate triage summary.');
    }
  });

  // 7. Google Maps Grounding: Discover Real Nearby Community Hubs & Resources
  app.post('/api/ai/nearby-hubs', async (req: Request, res: Response) => {
    try {
      const { query, location } = req.body as {
        query?: string;
        location?: { lat: number; lng: number };
      };

      const lat = location?.lat ?? 37.7749;
      const lng = location?.lng ?? -122.4194;
      const prompt = query?.trim()
        ? `Find real, currently operating places near this neighborhood matching: "${query.trim()}". Focus on practical community resources (hardware stores, tool libraries, public libraries, community centers, pharmacies, or veterinary clinics). Provide a concise Markdown summary with hours/practical notes when available.`
        : 'Find real nearby community hubs, public libraries, hardware stores, and neighborhood clinics around this location that residents might need for mutual aid or household repairs. Provide a concise Markdown summary.';

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const { mapSources } = extractGroundingSources(response);
      res.json({
        text: (response.text ?? '').trim(),
        mapSources,
      });
    } catch (err) {
      handleApiError(res, err, 'Unable to fetch nearby community hubs from Google Maps.');
    }
  });

  // 8. Google Search Grounding: Live Local Civic Info & Repair / Advisory Lookup
  app.post('/api/ai/civic-search', async (req: Request, res: Response) => {
    try {
      const { query, areaName } = req.body as {
        query?: string;
        areaName?: string;
      };

      if (!query?.trim()) {
        res.status(400).json({ error: 'Please provide a question or civic topic to look up.' });
        return;
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are NeighborMesh's Civic Info Researcher assisting residents${areaName ? ` in or near ${areaName}` : ''}. Answer this community question using up-to-date verified web information, practical safety guidance, and official reporting channels where relevant. Keep it clear, concise, and well-structured in Markdown.\n\nQuestion: ${query.trim()}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const { webSources } = extractGroundingSources(response);
      res.json({
        text: (response.text ?? '').trim(),
        webSources,
      });
    } catch (err) {
      handleApiError(res, err, 'Unable to complete live web search.');
    }
  });

  // 9. Multi-Turn NeighborMesh Coordinator Chatbot (Community / Maps Grounding / Search Grounding)
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { history, message, mode, location, communityContext } = req.body as {
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        message?: string;
        mode?: 'community' | 'maps' | 'search';
        location?: { lat: number; lng: number };
        communityContext?: string;
      };

      if (!message?.trim()) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      const ai = getAI();
      const activeMode = mode || 'community';

      const baseInstruction = `You are the NeighborMesh Community Coordinator, a warm, practical, and privacy-conscious AI assistant for a hyper-local mutual aid platform.
Your role:
- Connect neighbors' requests with relevant tools, skills, and volunteers in the neighborhood directory even when keywords differ.
- Suggest safe peer-to-peer handoff protocols (public lobby/porch meetups, daylight pickup, fuzzy proximity zones—never reveal exact home addresses).
- Help residents draft clear requests, translate messages across languages, or triage neighborhood issues.
- For life-threatening emergencies, always remind residents to contact official emergency services (e.g., 911 / 112) first.
- Keep responses concise, grounded, and scannable in clean Markdown.

Current Neighborhood Snapshot:
${communityContext || 'Standard local directory active.'}`;

      const formattedHistory = (history ?? []).slice(-12).map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      }));

      if (activeMode === 'maps') {
        const lat = location?.lat ?? 37.7749;
        const lng = location?.lng ?? -122.4194;
        const contents = [
          ...formattedHistory,
          { role: 'user', parts: [{ text: message.trim() }] },
        ];
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction: baseInstruction,
            tools: [{ googleMaps: {} }],
            toolConfig: {
              retrievalConfig: {
                latLng: { latitude: lat, longitude: lng },
              },
            },
          },
        });
        const { mapSources } = extractGroundingSources(response);
        res.json({
          text: (response.text ?? '').trim(),
          mapSources,
          webSources: [],
        });
        return;
      }

      if (activeMode === 'search') {
        const contents = [
          ...formattedHistory,
          { role: 'user', parts: [{ text: message.trim() }] },
        ];
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction: baseInstruction,
            tools: [{ googleSearch: {} }],
          },
        });
        const { webSources } = extractGroundingSources(response);
        res.json({
          text: (response.text ?? '').trim(),
          mapSources: [],
          webSources,
        });
        return;
      }

      // Default: Multi-turn community coordination chat via ai.chats.create
      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        history: formattedHistory,
        config: {
          systemInstruction: baseInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const response = await chat.sendMessage({ message: message.trim() });
      res.json({
        text: (response.text ?? '').trim(),
        mapSources: [],
        webSources: [],
      });
    } catch (err) {
      handleApiError(res, err, 'Coordinator chat encountered an error.');
    }
  });

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NeighborMesh server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NeighborMesh server:', err);
  process.exit(1);
});

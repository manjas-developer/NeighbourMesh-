import type {
  ExtractApiResponse,
  LanguageOption,
  MatchApiResponse,
  TriageApiResponse,
} from '../types';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status}). Please try again.`);
  }
  return data;
}

export interface CatalogMatchPayload {
  id: string;
  title: string;
  category: string;
  description: string;
  zoneName: string;
  distanceKm: number;
  availability: string;
  isHub: boolean;
}

export function requestSemanticMatch(payload: {
  query: string;
  userZoneName: string;
  radiusKm: number;
  minConfidence: number;
  catalog: CatalogMatchPayload[];
}): Promise<MatchApiResponse> {
  return postJson<MatchApiResponse>('/api/match', payload);
}

export function requestListingExtraction(payload: {
  paragraph?: string;
  zoneName: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<ExtractApiResponse> {
  return postJson<ExtractApiResponse>('/api/extract', payload);
}

export function requestPulseTriage(payload: {
  rawChat?: string;
  zoneName: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<TriageApiResponse> {
  return postJson<TriageApiResponse>('/api/triage', payload);
}

export function requestTranslation(payload: {
  text: string;
  targetLanguage: LanguageOption;
}): Promise<{ detectedLanguage: string; translatedText: string }> {
  return postJson<{ detectedLanguage: string; translatedText: string }>('/api/translate', payload);
}

export function requestSmsBridge(payload: {
  message: string;
  catalog: CatalogMatchPayload[];
  emergencyAlerts: Array<{ title: string; zoneName: string; action: string }>;
}): Promise<{ parsedIntent: string; smsReply: string; matchedZone: string }> {
  return postJson<{ parsedIntent: string; smsReply: string; matchedZone: string }>(
    '/api/sms-bridge',
    payload
  );
}

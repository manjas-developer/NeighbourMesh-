import {
  BatchOnboardItem,
  ChatMode,
  LatLng,
  MapSource,
  MeshItem,
  SemanticMatchResponse,
  StructuredPostDraft,
  TriageReport,
  WebSource,
} from '../types/mesh';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed with status ${res.status}`
    );
  }
  return data as T;
}

export async function fetchAppConfig(): Promise<{ googleMapsApiKey: string }> {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (envKey) {
    return { googleMapsApiKey: envKey };
  }
  const res = await fetch('/api/config');
  if (!res.ok) {
    return { googleMapsApiKey: '' };
  }
  return (await res.json()) as { googleMapsApiKey: string };
}

export async function reverseGeocodeLocation(
  lat: number,
  lng: number
): Promise<{ label: string; formattedAddress: string }> {
  const res = await fetch(
    `/api/maps/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
      String(lng)
    )}`
  );
  if (res.status === 429) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  const data = (await res.json().catch(() => ({}))) as {
    label?: string;
    formattedAddress?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Unable to resolve neighborhood name.');
  }
  return {
    label: data.label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    formattedAddress: data.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<{ transcript: string }> {
  return postJson('/api/ai/transcribe', { audioBase64, mimeType });
}

export async function structurePost(payload: {
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<StructuredPostDraft> {
  return postJson('/api/ai/structure-post', payload);
}

export async function runSemanticMatch(
  query: string,
  listings: Array<{
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
  }>
): Promise<SemanticMatchResponse> {
  return postJson('/api/ai/semantic-match', { query, listings });
}

export async function batchOnboard(payload: {
  paragraph: string;
  authorName: string;
  zoneLabel: string;
}): Promise<{ items: BatchOnboardItem[] }> {
  return postJson('/api/ai/batch-onboard', payload);
}

export async function translateText(
  text: string,
  targetLanguage: string
): Promise<{ translatedText: string }> {
  return postJson('/api/ai/translate', { text, targetLanguage });
}

export async function triagePulse(issues: MeshItem[]): Promise<TriageReport> {
  return postJson('/api/ai/triage-pulse', {
    issues: issues.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      zoneLabel: i.zoneLabel,
      urgency: i.urgency,
      reportsCount: i.reportsCount ?? 1,
    })),
  });
}

export async function searchNearbyHubs(
  query: string,
  location: LatLng
): Promise<{ text: string; mapSources: MapSource[] }> {
  return postJson('/api/ai/nearby-hubs', { query, location });
}

export async function runCivicSearch(
  query: string,
  areaName?: string
): Promise<{ text: string; webSources: WebSource[] }> {
  return postJson('/api/ai/civic-search', { query, areaName });
}

export async function sendChatMessage(payload: {
  history: Array<{ role: 'user' | 'model'; text: string }>;
  message: string;
  mode: ChatMode;
  location: LatLng;
  communityContext: string;
}): Promise<{ text: string; mapSources: MapSource[]; webSources: WebSource[] }> {
  return postJson('/api/ai/chat', payload);
}

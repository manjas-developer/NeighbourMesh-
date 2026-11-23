export type PostType = 'need' | 'offer' | 'issue';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type NavSection = 'feed' | 'directory' | 'map' | 'pulse';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RealNearbyPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  location: LatLng;
  distanceKm: number;
  rating?: number;
  userRatingCount?: number;
  googleMapsURI?: string;
  businessStatus?: string;
  primaryType?: string;
}

export interface LiveLocationState {
  status: 'idle' | 'locating' | 'active' | 'manual' | 'error';
  isTracking: boolean;
  coords: LatLng | null;
  accuracyMeters: number | null;
  updatedAt: string | null;
  error: string | null;
}

export interface MeshItem {
  id: string;
  type: PostType;
  kind?: 'tool' | 'skill' | 'request' | 'issue';
  title: string;
  description: string;
  category: string;
  urgency: UrgencyLevel;
  authorName: string;
  authorRole: string;
  zoneLabel: string;
  /** Fuzzy proximity offset from the active neighborhood center (preserves exact home privacy) */
  offsetLat: number;
  offsetLng: number;
  /** Privacy zone radius in meters (e.g., 260m - 480m) */
  radiusMeters: number;
  availability: string;
  createdAtLabel: string;
  originalLanguage: string;
  tags: string[];
  imageUrl?: string;
  imageAlt?: string;
  safeHandoffSteps: string[];
  moderationNote: string;
  reportsCount?: number;
  isEmergencyRelevant?: boolean;
  claimedBy?: string;
  responsesCount: number;
}

export interface SemanticMatch {
  listingId: string;
  confidence: number;
  whyItMatches: string;
  suggestedHandoffMessage: string;
}

export interface SemanticMatchResponse {
  intentSummary: string;
  matches: SemanticMatch[];
}

export interface StructuredPostDraft {
  title: string;
  postType: PostType;
  category: string;
  urgency: UrgencyLevel;
  timeWindow: string;
  cleanedDescription: string;
  tags: string[];
  approved: boolean;
  moderationNote: string;
  safeHandoffSteps: string[];
}

export interface BatchOnboardItem {
  title: string;
  kind: 'tool' | 'skill';
  category: string;
  description: string;
  availability: string;
  tags: string[];
}

export interface TriageCluster {
  theme: string;
  severity: UrgencyLevel;
  routedTo: string;
  affectedZones: string;
  recommendedAction: string;
}

export interface TriageReport {
  headline: string;
  overallSummary: string;
  clusters: TriageCluster[];
}

export interface MapSource {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface WebSource {
  title: string;
  uri: string;
}

export type ChatMode = 'community' | 'maps' | 'search';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  mode: ChatMode;
  timestamp: string;
  mapSources?: MapSource[];
  webSources?: WebSource[];
}

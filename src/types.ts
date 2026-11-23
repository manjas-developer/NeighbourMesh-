export type AppView = 'match' | 'directory' | 'pulse' | 'quick-list' | 'emergency';

export type ResourceCategory = 'Tool' | 'Medical' | 'Skill' | 'Education' | 'Care' | 'Hub';

export type LanguageOption =
  | 'English'
  | 'Spanish'
  | 'Hindi'
  | 'Mandarin Chinese'
  | 'Tamil'
  | 'Arabic';

export interface NeighborhoodZone {
  id: string;
  name: string;
  approxRadiusMeters: number;
  hubLandmark: string;
  /** Normalized SVG coordinates (0-100) for fuzzy zone visualization */
  mapX: number;
  mapY: number;
  /** Approximate relative km offsets for realistic distance calculation */
  kmX: number;
  kmY: number;
}

export interface ThreadMessage {
  id: string;
  author: string;
  zoneName: string;
  timestamp: string;
  text: string;
  originalLanguage?: string;
}

export interface ResourceListing {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string;
  ownerName: string;
  ownerRole?: string;
  zoneId: string;
  availability: string;
  safeHandoff: string;
  isVerifiedHub?: boolean;
  borrowCount: number;
  imageUrl?: string;
  emergencyReady?: boolean;
  messages: ThreadMessage[];
}

export interface ExtractedIntent {
  summary: string;
  category: string;
  urgency: string;
  timeWindow: string;
  inferredNeed: string;
}

export interface ModerationResult {
  approved: boolean;
  statusLabel: string;
  reason: string;
  safeHandoffProtocol?: string;
}

export interface SemanticMatchItem {
  listingId: string;
  confidence: number;
  semanticReason: string;
  handoffTip: string;
}

export interface MatchApiResponse {
  extractedIntent: ExtractedIntent;
  moderation: ModerationResult;
  matches: SemanticMatchItem[];
  fallbackAdvice: string;
}

export interface ExtractedDraftListing {
  title: string;
  category: ResourceCategory;
  description: string;
  availability: string;
  safeHandoff: string;
  ownerName: string;
  selected?: boolean;
}

export interface ExtractApiResponse {
  detectedType: 'resources' | 'issue';
  moderation: {
    approved: boolean;
    statusLabel: string;
    reason: string;
  };
  extractedListings: ExtractedDraftListing[];
  detectedIssue?: {
    present: boolean;
    title: string;
    category: string;
    severity: 'Low' | 'Moderate' | 'High';
    summary: string;
    coordinator: string;
  };
}

export interface CommunityIssue {
  id: string;
  title: string;
  category: 'Utilities' | 'Safety' | 'Pet Alert' | 'Streets' | 'Environment';
  severity: 'Low' | 'Moderate' | 'High';
  status: 'Active Triage' | 'Coordinator Assigned' | 'Resolved';
  zoneId: string;
  reportCount: number;
  updatedAt: string;
  actionableSummary: string;
  routedCoordinator: string;
  recommendedAction: string;
  messages: ThreadMessage[];
}

export interface TriageApiResponse {
  filteredSpamCount: number;
  summaryHeadline: string;
  triagedIssues: Array<{
    title: string;
    category: 'Utilities' | 'Safety' | 'Pet Alert' | 'Streets' | 'Environment';
    severity: 'Low' | 'Moderate' | 'High';
    zoneName: string;
    reportCount: number;
    actionableSummary: string;
    routedCoordinator: string;
    recommendedAction: string;
  }>;
}

export interface EmergencyAlert {
  id: string;
  title: string;
  type: 'Power Outage' | 'Weather Advisory' | 'Blood Donor Request' | 'Medical Aid';
  severity: 'Urgent' | 'Advisory';
  zoneId: string;
  updatedAt: string;
  summary: string;
  coordinationHub: string;
  neededItems: string[];
  volunteersCheckedIn: number;
}

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ASSET_IMAGES,
  EXAMPLE_MATCH_PROMPTS,
  NEIGHBORHOOD_ZONES,
  formatDistance,
  getDistanceKm,
  getZoneById,
} from '../data/seedData';
import { requestSemanticMatch } from '../services/api';
import type { AppView, MatchApiResponse, ResourceListing } from '../types';
import { ProximityMap } from './ProximityMap';
import { SafeImage } from './SafeImage';

interface MatchViewProps {
  listings: ResourceListing[];
  issueCount: number;
  userZoneId: string;
  onChangeZone: (zoneId: string) => void;
  onOpenThread: (listing: ResourceListing) => void;
  onNavigate: (view: AppView) => void;
}

export function MatchView({
  listings,
  issueCount,
  userZoneId,
  onChangeZone,
  onOpenThread,
  onNavigate,
}: MatchViewProps) {
  const [query, setQuery] = useState(
    'Need something sturdy to reach a high ceiling fan and replace a bulb this afternoon'
  );
  const [radiusKm, setRadiusKm] = useState(1.5);
  const [minConfidence, setMinConfidence] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchApiResponse | null>(null);

  const userZone = getZoneById(userZoneId);

  const runMatch = async (overrideQuery?: string) => {
    const activeQuery = (overrideQuery ?? query).trim();
    if (!activeQuery) return;
    setLoading(true);
    setError(null);

    try {
      const catalogPayload = listings.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        zoneName: getZoneById(item.zoneId).name,
        distanceKm: getDistanceKm(userZoneId, item.zoneId),
        availability: item.availability,
        isHub: Boolean(item.isVerifiedHub),
      }));

      const data = await requestSemanticMatch({
        query: activeQuery,
        userZoneName: userZone.name,
        radiusKm,
        minConfidence,
        catalog: catalogPayload,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run semantic match right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runMatch();
  };

  const matchedListings = (result?.matches || [])
    .map((m) => {
      const listing = listings.find((item) => item.id === m.listingId);
      return listing ? { match: m, listing } : null;
    })
    .filter((entry): entry is { match: MatchApiResponse['matches'][number]; listing: ResourceListing } =>
      Boolean(entry)
    );

  const matchedZoneIds = matchedListings.map((entry) => entry.listing.zoneId);
  const verifiedHubCount = listings.filter((l) => l.isVerifiedHub).length;
  const totalBorrows = listings.reduce((sum, item) => sum + item.borrowCount, 0);

  return (
    <div className="space-y-12">
      {/* Section 1: Hero Split (items-stretch balanced 2-column) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch pt-2">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#155E4B]">
              Ward 4 Mutual Aid Network · Fuzzy-Zone Privacy Enabled
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 leading-[1.08]">
              Turn noisy neighborhood chat into calm, nearby help.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Ask for what you need in plain everyday words—even if you do not know the exact tool
              name. NeighborMesh matches your request with nearby tools, skills, and verified hubs
              without exposing exact street addresses.
            </p>
          </div>

          {/* Primary Interactive Semantic Need Matcher right in the hero */}
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div>
              <label
                htmlFor="semantic-need-input"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                What do you need help with today?
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="semantic-need-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe a need in plain language (any language works)..."
                    className="w-full pl-10 pr-4 py-3 text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#155E4B]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      Find Nearby Matches
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick example triggers */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Try an example:</span>
              {EXAMPLE_MATCH_PROMPTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setQuery(sample.query);
                    runMatch(sample.query);
                  }}
                  className="text-slate-700 hover:text-[#155E4B] underline decoration-slate-300 underline-offset-4 hover:decoration-[#155E4B] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div className="lg:col-span-5">
          <div className="relative h-72 sm:h-80 lg:h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <SafeImage
              src={ASSET_IMAGES.heroCommunity}
              alt="Neighbors sharing a toolbox across a sunlit residential porch walkway"
              className="w-full h-full object-cover"
              fallbackLabel="Oakridge Neighborhood Porch Sharing"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-5 text-white">
              <p className="text-xs font-medium text-white/85">
                Oakridge North · Verified Peer Lending
              </p>
              <p className="text-sm font-medium mt-0.5 leading-snug">
                Front-porch and public library handoffs keep borrowing friendly and private.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width 4-column neighborhood snapshot strip below hero split */}
      <section
        aria-label="Neighborhood overview metrics"
        className="grid grid-cols-2 lg:grid-cols-4 border-y border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white rounded-xl border"
      >
        <div className="p-5">
          <p className="text-xs text-slate-500">Shared Tools & Skills</p>
          <p className="text-2xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {listings.length}
          </p>
          <p className="text-xs text-slate-600 mt-1">Cataloged across 5 fuzzy zones</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Verified Borrow Handoffs</p>
          <p className="text-2xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {totalBorrows}
          </p>
          <p className="text-xs text-slate-600 mt-1">Completed within Ward 4</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Active Community Pulse</p>
          <p className="text-2xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {issueCount}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('pulse')}
            className="text-xs font-medium text-[#155E4B] hover:underline mt-1 cursor-pointer"
          >
            View triaged local issues
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Verified Civic Hubs</p>
          <p className="text-2xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {verifiedHubCount}
          </p>
          <p className="text-xs text-slate-600 mt-1">Tool library & branch cooling hub</p>
        </div>
      </section>

      {/* Section 2: Controls + Match Results + Fuzzy Proximity Map */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              Semantic Match & Proximity Filter
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Combine geographic radius zones with a confidence threshold to surface useful matches
              without notification fatigue.
            </p>
          </div>

          {/* Zone, Radius, and Relevance Threshold controls */}
          <div className="flex flex-wrap items-center gap-4 text-xs bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <label htmlFor="zone-select" className="text-slate-500 font-medium whitespace-nowrap">
                Your Zone
              </label>
              <select
                id="zone-select"
                value={userZoneId}
                onChange={(e) => onChangeZone(e.target.value)}
                className="border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-900 font-medium bg-slate-50 focus:outline-none focus:border-[#155E4B]"
              >
                {NEIGHBORHOOD_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="radius-select" className="text-slate-500 font-medium whitespace-nowrap">
                Radius
              </label>
              <select
                id="radius-select"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-900 font-mono tabular-nums bg-slate-50 focus:outline-none focus:border-[#155E4B]"
              >
                <option value={0.5}>0.5 km</option>
                <option value={1.0}>1.0 km</option>
                <option value={1.5}>1.5 km</option>
                <option value={2.5}>2.5 km</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="confidence-range" className="text-slate-500 font-medium whitespace-nowrap">
                Alert Threshold
              </label>
              <input
                id="confidence-range"
                type="range"
                min={50}
                max={90}
                step={5}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-20 accent-[#155E4B]"
              />
              <span className="font-mono tabular-nums font-medium text-slate-900 w-9">
                {minConfidence}%
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Semantic matching could not complete</p>
              <p className="text-red-800 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 cols: Semantic Match Output */}
          <div className="lg:col-span-7 space-y-5">
            {loading && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
                <div className="h-24 bg-slate-100 rounded-lg" />
                <div className="h-24 bg-slate-100 rounded-lg" />
              </div>
            )}

            {!loading && !result && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-slate-900">
                    Ready to match your request against {listings.length} local resources
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Click <span className="font-semibold text-slate-900">Find Nearby Matches</span>{' '}
                    above to run Gemini structured intent extraction, safety moderation, and
                    semantic proximity matching—or browse a few popular resources right near{' '}
                    {userZone.name} below.
                  </p>
                </div>

                <div className="divide-y divide-slate-200 border-t border-slate-200">
                  {listings.slice(0, 3).map((item) => {
                    const zone = getZoneById(item.zoneId);
                    const dist = getDistanceKm(userZoneId, item.zoneId);
                    return (
                      <div
                        key={item.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">
                            {item.category} · {zone.name} ·{' '}
                            <span className="font-mono tabular-nums">{formatDistance(dist)}</span>
                          </p>
                          <h4 className="text-sm font-semibold text-slate-950">{item.title}</h4>
                          <p className="text-xs text-slate-600 line-clamp-2 max-w-xl">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenThread(item)}
                          className="text-xs font-semibold text-[#155E4B] hover:text-[#0F4C3C] whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
                        >
                          Message Neighbor
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && result && (
              <div className="space-y-5">
                {/* Structured Intent & Trust Moderation Strip */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {result.moderation.approved ? (
                        <CheckCircle2 className="w-4 h-4 text-[#155E4B]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span>{result.moderation.statusLabel}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {result.extractedIntent.category} · Urgency: {result.extractedIntent.urgency} ·{' '}
                      {result.extractedIntent.timeWindow}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-medium">Inferred Practical Need</p>
                      <p className="text-sm font-semibold text-slate-950 mt-0.5">
                        {result.extractedIntent.inferredNeed}
                      </p>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {result.extractedIntent.summary}
                      </p>
                    </div>
                    <div className="sm:border-l sm:border-slate-100 sm:pl-4">
                      <p className="text-slate-500 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#155E4B]" />
                        Suggested Safe Handoff
                      </p>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {result.moderation.safeHandoffProtocol || result.moderation.reason}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Matched Resources List */}
                {!result.moderation.approved ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-900 space-y-1">
                    <p className="font-semibold">Post held by Trust & Safety moderation</p>
                    <p className="text-red-800">{result.moderation.reason}</p>
                  </div>
                ) : matchedListings.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                    <h3 className="text-base font-semibold text-slate-900">
                      No matches above {minConfidence}% within {radiusKm.toFixed(1)} km
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {result.fallbackAdvice}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRadiusKm(2.5);
                          setMinConfidence(55);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-[#155E4B] border border-[#155E4B]/30 hover:bg-[#155E4B]/5 rounded-lg cursor-pointer"
                      >
                        Expand radius to 2.5 km
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('directory')}
                        className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        Browse Full Directory
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Showing {matchedListings.length} high-confidence{' '}
                        {matchedListings.length === 1 ? 'match' : 'matches'} (≥{minConfidence}%
                        threshold)
                      </span>
                      <span>Sorted by semantic fit & proximity</span>
                    </div>

                    {matchedListings.map(({ match, listing }) => {
                      const zone = getZoneById(listing.zoneId);
                      const dist = getDistanceKm(userZoneId, listing.zoneId);

                      return (
                        <article
                          key={listing.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-500">
                                {listing.category} · {zone.name} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {formatDistance(dist)}
                                </span>
                                {listing.isVerifiedHub ? ' · Verified Community Hub' : ''}
                              </p>
                              <h3 className="text-lg font-semibold text-slate-950 mt-0.5">
                                {listing.title}
                              </h3>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono font-semibold tabular-nums text-[#155E4B]">
                                {match.confidence}% match
                              </p>
                              <p className="text-[11px] text-slate-500">{listing.ownerName}</p>
                            </div>
                          </div>

                          <p className="text-sm text-slate-800 leading-relaxed">
                            <span className="font-semibold text-slate-950">Why it matches:</span>{' '}
                            {match.semanticReason}
                          </p>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">Handoff & timing:</span>{' '}
                            {match.handoffTip} ({listing.availability})
                          </p>

                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-slate-500 font-mono tabular-nums">
                              Borrowed {listing.borrowCount} times in Ward 4
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenThread(listing)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Request Borrow & Translate
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 5 cols: Fuzzy Proximity Zone Map */}
          <div className="lg:col-span-5 space-y-5">
            <ProximityMap
              userZoneId={userZoneId}
              radiusKm={radiusKm}
              matchedZoneIds={matchedZoneIds}
              listings={listings}
              onSelectZone={onChangeZone}
            />

            {/* Editorial Capabilities Note */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                How NeighborMesh keeps mutual aid effortless
              </h3>
              <ol className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-900">01. Semantic Matching:</span>{' '}
                  Connects plain descriptions like “reach a high ceiling fan” to a neighbor’s
                  6-foot stepladder without rigid tags.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">02. Fuzzy Privacy Zones:</span>{' '}
                  Balances nearby relevance with resident safety by showing ~400m neighborhood
                  zones instead of house pins.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">03. Calm Signal Threshold:</span>{' '}
                  Notifies neighbors only when relevance exceeds your chosen threshold, preventing
                  group-chat burnout.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

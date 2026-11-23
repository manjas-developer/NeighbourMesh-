import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Info,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { CoordinatorChat, CoordinatorChatLauncher } from './components/CoordinatorChat';
import { DirectoryView } from './components/DirectoryView';
import { MeshCard } from './components/MeshCard';
import { NeighborhoodMap } from './components/NeighborhoodMap';
import { PostComposerModal } from './components/PostComposerModal';
import { PulseTriageView } from './components/PulseTriageView';
import { ResilientImage } from './components/ResilientImage';
import { VoiceRecorderButton } from './components/VoiceRecorderButton';
import {
  DEFAULT_NEIGHBORHOOD_CENTER,
  HERO_COMMUNITY_IMAGE,
  INITIAL_MESH_ITEMS,
  SUPPORTED_LANGUAGES,
  computeDistanceKm,
} from './data/initialNeighborhood';
import {
  fetchAppConfig,
  reverseGeocodeLocation,
  runSemanticMatch,
} from './services/api';
import {
  LatLng,
  LiveLocationState,
  MeshItem,
  NavSection,
  RealNearbyPlace,
  SemanticMatchResponse,
} from './types/mesh';

const STORAGE_KEY = 'neighbormesh_items_v1';

const DEMO_SEMANTIC_QUERIES = [
  'Need something to reach a high ceiling fan',
  'Kitchen sink faucet is dripping and needs a quick fix',
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('feed');
  const [items, setItems] = useState<MeshItem[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MeshItem[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MESH_ITEMS;
  });

  const [center, setCenter] = useState<LatLng>(DEFAULT_NEIGHBORHOOD_CENTER);
  const [areaLabel, setAreaLabel] = useState('Oakwood District');
  const [mapsApiKey, setMapsApiKey] = useState<string>('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Real-time current GPS tracking state (explicit revocable consent)
  const [liveLocation, setLiveLocation] = useState<LiveLocationState>({
    status: 'idle',
    isTracking: false,
    coords: null,
    accuracyMeters: null,
    updatedAt: null,
    error: null,
  });
  const watchIdRef = useRef<number | null>(null);
  const lastGeocodedCoordsRef = useRef<LatLng | null>(null);
  const hasLockedFixRef = useRef<boolean>(false);

  // Real nearby Google Maps Places synced from NeighborhoodMap
  const [realPlaces, setRealPlaces] = useState<RealNearbyPlace[]>([]);
  const [composerPreselectedPlace, setComposerPreselectedPlace] =
    useState<RealNearbyPlace | null>(null);

  // Workspace states
  const [feedFilter, setFeedFilter] = useState<'all' | 'need' | 'offer' | 'issue'>('all');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showPrototypeNotice, setShowPrototypeNotice] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Semantic Matcher states
  const [matchQuery, setMatchQuery] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<SemanticMatchResponse | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    fetchAppConfig()
      .then((cfg) => setMapsApiKey(cfg.googleMapsApiKey || ''))
      .catch(() => setMapsApiKey(''));
  }, []);

  // Listen for Tier 1 & Tier 2 Google Maps Platform Demo Key quota events
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  // Clean up geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const stopLiveTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    hasLockedFixRef.current = false;
    setLiveLocation((prev) => ({
      ...prev,
      status: prev.coords ? 'manual' : 'idle',
      isTracking: false,
      error: null,
    }));
    showToast('Live GPS location tracking paused.');
  }, [showToast]);

  const applyResolvedLocation = useCallback(
    (
      coords: LatLng,
      accuracyMeters: number | null,
      mode: 'active' | 'manual',
      forceCenter: boolean
    ) => {
      const updatedAt = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      hasLockedFixRef.current = true;
      setLiveLocation({
        status: mode,
        isTracking: mode === 'active',
        coords,
        accuracyMeters,
        updatedAt,
        error: null,
      });

      const prevGeo = lastGeocodedCoordsRef.current;
      const movedKm = prevGeo ? computeDistanceKm(prevGeo, coords) : 999;
      if (forceCenter || movedKm > 0.15) {
        lastGeocodedCoordsRef.current = coords;
        setCenter(coords);
        reverseGeocodeLocation(coords.lat, coords.lng)
          .then(({ label }) => {
            setAreaLabel(label);
            if (forceCenter) {
              showToast(`Location synced to ${label}.`);
            }
          })
          .catch(() => {
            const fallback = `Current Location (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`;
            setAreaLabel(fallback);
            if (forceCenter) {
              showToast('Current coordinates synced.');
            }
          });
      }
    },
    [showToast]
  );

  const formatGeoError = (err: GeolocationPositionError): string => {
    if (err.code === err.PERMISSION_DENIED) {
      if (err.message?.toLowerCase().includes('permissions policy')) {
        return 'Browser preview restricted automatic GPS access. Click "Set on Map" or search your neighborhood in the map bar to set your location.';
      }
      return 'Location access was blocked by your browser. Allow location permission in browser settings, or click "Set on Map" to pin your neighborhood.';
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      return 'Device location signal is currently unavailable. Check OS location services or use "Set on Map" / neighborhood search.';
    }
    if (err.code === err.TIMEOUT) {
      return 'Location request timed out. Try again or use "Set on Map" / neighborhood search.';
    }
    return err.message || 'Could not determine your current location.';
  };

  const startLiveTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLiveLocation((prev) => ({
        ...prev,
        status: 'error',
        isTracking: false,
        error: 'Geolocation is not supported in this browser. Use "Set on Map" or search your neighborhood instead.',
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Reset cached geocode point so clicking "Use Live Location" always recenters immediately
    lastGeocodedCoordsRef.current = null;
    hasLockedFixRef.current = false;

    setLiveLocation((prev) => ({
      ...prev,
      status: 'locating',
      isTracking: false,
      error: null,
    }));

    const beginWatch = () => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          applyResolvedLocation(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            pos.coords.accuracy,
            'active',
            !hasLockedFixRef.current
          );
        },
        (err) => {
          // Ignore transient watch timeouts once we already have a locked GPS fix
          if (hasLockedFixRef.current && err.code === err.TIMEOUT) {
            return;
          }
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          setLiveLocation((prev) => ({
            ...prev,
            status: prev.coords ? 'manual' : 'error',
            isTracking: false,
            error: formatGeoError(err),
          }));
        },
        {
          enableHighAccuracy: false,
          maximumAge: 20000,
          timeout: 25000,
        }
      );
    };

    // Step 1: Fast network/Wi-Fi/GPS initial fix (works reliably on desktop + mobile)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyResolvedLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          pos.coords.accuracy,
          'active',
          true
        );
        beginWatch();
      },
      (firstErr) => {
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          setLiveLocation((prev) => ({
            ...prev,
            status: 'error',
            isTracking: false,
            error: formatGeoError(firstErr),
          }));
          return;
        }
        // Retry once with cached/relaxed position before failing
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyResolvedLocation(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              pos.coords.accuracy,
              'active',
              true
            );
            beginWatch();
          },
          (retryErr) => {
            setLiveLocation((prev) => ({
              ...prev,
              status: 'error',
              isTracking: false,
              error: formatGeoError(retryErr),
            }));
          },
          {
            enableHighAccuracy: false,
            maximumAge: Infinity,
            timeout: 15000,
          }
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000,
      }
    );
  }, [applyResolvedLocation]);

  const handleSetManualLocation = useCallback(
    (coords: LatLng) => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastGeocodedCoordsRef.current = null;
      applyResolvedLocation(coords, 35, 'manual', true);
    },
    [applyResolvedLocation]
  );

  const handleRealPlacesLoaded = useCallback((places: RealNearbyPlace[]) => {
    setRealPlaces(places);
    // If reverse-geocode fell back to raw coordinates, enrich areaLabel from verified Google Place address
    if (places.length > 0) {
      setAreaLabel((prevLabel) => {
        if (
          !prevLabel.startsWith('Current Location (') &&
          !prevLabel.startsWith('Map Area (')
        ) {
          return prevLabel;
        }
        const addr = places[0].address;
        const segments = addr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (segments.length >= 3) {
          return `${segments[segments.length - 3]}, ${segments[segments.length - 2].replace(/\s+\d[\d-]*$/, '')}`;
        }
        if (segments.length === 2) {
          return segments[0];
        }
        return prevLabel;
      });
    }
  }, []);

  const handleToggleLiveTracking = useCallback(() => {
    if (liveLocation.status === 'active') {
      stopLiveTracking();
    } else if (liveLocation.status !== 'locating') {
      startLiveTracking();
    }
  }, [liveLocation.status, startLiveTracking, stopLiveTracking]);

  const handleManualCenterChange = useCallback(
    (newCenter: LatLng, label: string) => {
      setCenter(newCenter);
      setAreaLabel(label);
      // If user manually picks another neighborhood via Autocomplete or pan, resolve clean label if coordinate fallback
      if (label.startsWith('Map Area (')) {
        reverseGeocodeLocation(newCenter.lat, newCenter.lng)
          .then(({ label: resolved }) => setAreaLabel(resolved))
          .catch(() => {
            // keep coordinate label
          });
      }
      showToast(`Real-time map updated to ${label}.`);
    },
    [showToast]
  );

  const handleSemanticSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? matchQuery).trim();
    if (!q) return;
    setMatchQuery(q);
    setMatching(true);
    setMatchError(null);
    setActiveNav('feed');

    try {
      const offerPool = items.filter((i) => i.type === 'offer');
      const listingsPayload = offerPool.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        type: i.kind || i.type,
        zoneLabel: i.zoneLabel,
        distanceKm: computeDistanceKm(center, {
          lat: center.lat + i.offsetLat,
          lng: center.lng + i.offsetLng,
        }),
        tags: i.tags,
        authorName: i.authorName,
        availability: i.availability,
      }));

      const res = await runSemanticMatch(q, listingsPayload);
      setMatchResult(res);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Semantic matching failed.');
    } finally {
      setMatching(false);
    }
  };

  const handlePublishItem = (newItem: MeshItem, autoMatchQuery?: string) => {
    setItems((prev) => [newItem, ...prev]);
    setComposerPreselectedPlace(null);
    showToast(`Published "${newItem.title}" to ${newItem.zoneLabel}.`);
    if (autoMatchQuery) {
      handleSemanticSearch(autoMatchQuery);
    }
  };

  const handleBatchAddItems = (newItems: MeshItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    showToast(`Added ${newItems.length} resources to the neighborhood directory.`);
  };

  const handleActionTaken = (itemId: string, actionLabel: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (actionLabel === 'corroborate') {
          return {
            ...item,
            reportsCount: (item.reportsCount ?? 1) + 1,
            responsesCount: item.responsesCount + 1,
          };
        }
        return {
          ...item,
          responsesCount: item.responsesCount + 1,
        };
      })
    );
    showToast(
      actionLabel === 'corroborate'
        ? 'Report corroborated and routed to block coordinators.'
        : 'Safe handoff request sent to your neighbor.'
    );
  };

  const handleViewOnMap = (item: MeshItem) => {
    setHighlightedItemId(item.id);
    setActiveNav('map');
  };

  const handlePostWithPlace = (place: RealNearbyPlace) => {
    setComposerPreselectedPlace(place);
    setComposerOpen(true);
  };

  const filteredFeedItems = useMemo(() => {
    return items.filter((item) => {
      if (emergencyMode && !item.isEmergencyRelevant && item.urgency !== 'critical') {
        return false;
      }
      if (feedFilter !== 'all' && item.type !== feedFilter) return false;
      return true;
    });
  }, [items, feedFilter, emergencyMode]);

  const matchLookup = useMemo(() => {
    const record: Record<
      string,
      { confidence: number; whyItMatches: string; suggestedHandoffMessage: string }
    > = {};
    for (const m of matchResult?.matches ?? []) {
      record[m.listingId] = {
        confidence: m.confidence,
        whyItMatches: m.whyItMatches,
        suggestedHandoffMessage: m.suggestedHandoffMessage,
      };
    }
    return record;
  }, [matchResult]);

  const matchedItems = useMemo(() => {
    if (!matchResult?.matches?.length) return [];
    const byId: Record<string, MeshItem> = {};
    for (const item of items) byId[item.id] = item;
    return matchResult.matches
      .map((m) => ({ match: m, item: byId[m.listingId] }))
      .filter((entry): entry is { match: (typeof matchResult.matches)[number]; item: MeshItem } =>
        Boolean(entry.item)
      );
  }, [matchResult, items]);

  // Compact context snapshot passed to the multi-turn Coordinator Chatbot (includes live location + real nearby places)
  const communityContext = useMemo(() => {
    const neighborLines = items
      .slice(0, 12)
      .map(
        (i) =>
          `[${i.type.toUpperCase()}] ${i.title} by ${i.authorName} (${i.zoneLabel}, ${i.availability}) — ${i.description}`
      )
      .join('\n');

    const placeLines = realPlaces
      .slice(0, 8)
      .map(
        (p) =>
          `- ${p.name} (${p.category}, ${p.distanceKm.toFixed(2)} km, ${p.address})`
      )
      .join('\n');

    return `Active Neighborhood: ${areaLabel} (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})${
      liveLocation.isTracking ? ' [Live GPS Active]' : ''
    }\n\nNeighbor Listings:\n${neighborLines}${
      placeLines ? `\n\nReal Nearby Public Places (Google Maps):\n${placeLines}` : ''
    }`;
  }, [items, realPlaces, areaLabel, center.lat, center.lng, liveLocation.isTracking]);

  const offersCount = items.filter((i) => i.type === 'offer').length;
  const issuesCount = items.filter((i) => i.type === 'issue').length;
  const uniqueZonesCount = new Set(items.map((i) => i.zoneLabel)).size;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9F7] text-[#13201B]">
      {/* Demo Key Quota Banner (Section 8 Case A) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E4E7E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line display wordmark */}
          <button
            type="button"
            onClick={() => setActiveNav('feed')}
            className="font-display text-lg font-bold tracking-tight text-[#13201B] whitespace-nowrap shrink-0 cursor-pointer"
          >
            NeighborMesh
          </button>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {(
              [
                ['feed', 'Feed & Matches'],
                ['directory', 'Directory'],
                ['map', 'Community Map'],
                ['pulse', 'Pulse & Triage'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveNav(key)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === key
                    ? 'border-[#1B6B4A] text-[#13201B]'
                    : 'border-transparent text-[#52605A] hover:text-[#13201B]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setComposerPreselectedPlace(null);
                setComposerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Need / Offer</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden border-t border-[#E4E7E2] px-4 overflow-x-auto">
          <div className="flex items-center gap-5 py-2.5 text-xs font-medium">
            {(
              [
                ['feed', 'Feed & Matches'],
                ['directory', 'Directory'],
                ['map', 'Community Map'],
                ['pulse', 'Pulse & Triage'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveNav(key)}
                className={`whitespace-nowrap shrink-0 ${
                  activeNav === key ? 'text-[#1B6B4A] font-semibold' : 'text-[#52605A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Concept Prototype & API Notice */}
      {showPrototypeNotice && (
        <div
          role="note"
          className="bg-[#FEF9EE] border-b border-[#F2DFB6] text-[#78490A] px-4 py-2.5"
        >
          <div className="max-w-7xl mx-auto px-0 sm:px-2 lg:px-4 flex items-start sm:items-center justify-between gap-3 text-xs leading-relaxed">
            <div className="flex items-start sm:items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-[#B45309] mt-0.5 sm:mt-0" />
              <span>
                <strong className="font-semibold text-[#5C3606]">Concept Prototype Only:</strong>{' '}
                NeighborMesh is only an idea preview and not a complete app, so some AI features may not work due to API charges.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPrototypeNotice(false)}
              className="text-[#92580C] hover:text-[#5C3606] p-0.5 rounded transition-colors shrink-0"
              aria-label="Dismiss concept prototype notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Active Rapid Coordination Notice */}
      {emergencyMode && (
        <div className="bg-[#B91C1C] text-white px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>Rapid Coordination Mode Active:</strong> Prioritizing utility alerts, medical mobility aids, and urgent neighborhood needs. Call 911 / 112 for emergencies.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEmergencyMode(false)}
              className="underline font-medium whitespace-nowrap"
            >
              Return to standard view
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-[#13201B] text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/70 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activeNav === 'feed' && (
          <>
            {/* Live Current Location & Real Places Context Bar */}
            <section className="bg-white border border-[#E4E7E2] rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#13201B]">
                  {liveLocation.isTracking ? (
                    <Crosshair className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-[#1B6B4A]" />
                  )}
                  <span>{areaLabel}</span>
                </span>
                <span aria-hidden="true" className="text-[#52605A]">
                  ·
                </span>
                <span className="font-mono tabular-nums text-[#52605A]">
                  {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                </span>
                {liveLocation.isTracking && liveLocation.updatedAt && (
                  <>
                    <span aria-hidden="true" className="text-[#52605A]">
                      ·
                    </span>
                    <span className="text-[#1D4ED8] font-medium">
                      Live GPS synced {liveLocation.updatedAt}
                    </span>
                  </>
                )}
                {realPlaces.length > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#52605A]">
                      ·
                    </span>
                    <span className="text-[#1B6B4A] font-medium font-mono tabular-nums">
                      {realPlaces.length} real nearby places loaded
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleLiveTracking}
                  disabled={liveLocation.status === 'locating'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    liveLocation.status === 'active'
                      ? 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                      : liveLocation.status === 'locating'
                        ? 'bg-[#EEF1EC] text-[#52605A] cursor-wait'
                        : 'border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] hover:bg-[#EEF1EC]'
                  }`}
                >
                  {liveLocation.status === 'locating' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {liveLocation.status === 'locating'
                      ? 'Locating...'
                      : liveLocation.status === 'active'
                        ? 'Live GPS: On'
                        : 'Use Current Location'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav('map')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF] transition-colors whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#1B6B4A]" />
                  <span>Explore Live Map &amp; Places</span>
                </button>
              </div>
            </section>

            {liveLocation.error && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B45309] bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <span>{liveLocation.error}</span>
                <button
                  type="button"
                  onClick={() => setActiveNav('map')}
                  className="font-semibold text-[#13201B] underline whitespace-nowrap"
                >
                  Open Map to Pick Location
                </button>
              </div>
            )}

            {/* Editorial 2-Column Hero Split */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#52605A]">
                    {areaLabel} · Privacy-First Mutual Aid Network
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#13201B] leading-[1.15] max-w-xl">
                    Turn neighborhood chatter into local mutual aid.
                  </h1>
                  <p className="text-sm sm:text-base text-[#52605A] leading-relaxed max-w-xl">
                    Describe a household need in plain language or by voice. NeighborMesh matches your intent with nearby tools, skills, and real community hubs around your live location.
                  </p>
                </div>

                {/* Semantic Need-to-Resource Matcher */}
                <div className="space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSemanticSearch();
                    }}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#52605A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={matchQuery}
                        onChange={(e) => setMatchQuery(e.target.value)}
                        placeholder='Describe what you need (e.g. "reach a high ceiling fan")'
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A] min-h-[42px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <VoiceRecorderButton
                        label="Speak"
                        onTranscript={(text) => handleSemanticSearch(text)}
                        onError={(msg) => setMatchError(msg)}
                      />
                      <button
                        type="submit"
                        disabled={matching || !matchQuery.trim()}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
                      >
                        {matching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{matching ? 'Matching...' : 'Match Nearby'}</span>
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[#52605A]">Try semantic matching:</span>
                    {DEMO_SEMANTIC_QUERIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSemanticSearch(q)}
                        className="text-left text-[#1B6B4A] hover:underline"
                      >
                        &ldquo;{q}&rdquo;
                      </button>
                    ))}
                  </div>

                  {matchError && (
                    <p className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {matchError}
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-[#E4E7E2] min-h-[260px]">
                <ResilientImage
                  src={HERO_COMMUNITY_IMAGE}
                  alt="Neighborhood community library and wooden tool-sharing shed at golden hour"
                  className="w-full h-full lg:h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#13201B]/85 via-[#13201B]/25 to-transparent flex flex-col justify-end p-6 text-white">
                  <p className="text-xs text-white/80">
                    {areaLabel} · Tool Library &amp; Block Network
                  </p>
                  <p className="text-sm sm:text-base font-medium leading-snug mt-1">
                    Shared ladders, drills, mobility aids, and neighbor skills—searchable across {SUPPORTED_LANGUAGES.length} languages.
                  </p>
                </div>
              </div>
            </section>

            {/* Full-Width 4-Column Metric Strip */}
            <section
              aria-label="Neighborhood network summary"
              className="bg-white border border-[#E4E7E2] rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E4E7E2]"
            >
              <div className="p-5">
                <p className="text-xs text-[#52605A]">Shared Tools &amp; Skills</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#13201B] mt-1">
                  {offersCount}
                </p>
                <p className="text-xs text-[#52605A] mt-0.5">Ready for peer borrowing</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-[#52605A]">Fuzzy Privacy Zones</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#13201B] mt-1">
                  {uniqueZonesCount}
                </p>
                <p className="text-xs text-[#52605A] mt-0.5">250–450m address shield</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-[#52605A]">Open Civic Reports</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#13201B] mt-1">
                  {issuesCount}
                </p>
                <p className="text-xs text-[#52605A] mt-0.5">Clustered for block leads</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-[#52605A]">Live Translation</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#13201B] mt-1">
                  {SUPPORTED_LANGUAGES.length}
                </p>
                <p className="text-xs text-[#52605A] mt-0.5">Multilingual thread support</p>
              </div>
            </section>

            {/* Semantic Match Results Panel */}
            {matchResult && (
              <section className="bg-white border border-[#1B6B4A]/40 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E4E7E2]">
                  <div>
                    <p className="text-xs font-medium text-[#1B6B4A]">
                      Semantic Match Results · High-Confidence Threshold (&ge;55%)
                    </p>
                    <h2 className="text-lg font-semibold text-[#13201B] mt-0.5">
                      {matchResult.intentSummary}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchResult(null);
                      setMatchQuery('');
                    }}
                    className="text-xs text-[#52605A] hover:text-[#13201B] underline whitespace-nowrap"
                  >
                    Clear match results
                  </button>
                </div>

                {matchedItems.length === 0 ? (
                  <div className="py-4 text-sm text-[#52605A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span>
                      No high-confidence neighbor resource matched this request yet—keeping alerts quiet to prevent notification fatigue.
                    </span>
                    <button
                      type="button"
                      onClick={() => setComposerOpen(true)}
                      className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] whitespace-nowrap self-start"
                    >
                      Post Request to Neighbors
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchedItems.map(({ item, match }) => {
                      const dist = computeDistanceKm(center, {
                        lat: center.lat + item.offsetLat,
                        lng: center.lng + item.offsetLng,
                      });
                      return (
                        <MeshCard
                          key={`matched-${item.id}`}
                          item={item}
                          distanceKm={dist}
                          highlightMatch={match}
                          onActionTaken={handleActionTaken}
                          onViewOnMap={handleViewOnMap}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Neighborhood Feed Toolbar & Stream */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-[#EEF1EC] rounded-lg self-start">
                  {(
                    [
                      ['all', 'All Activity'],
                      ['need', 'Needs'],
                      ['offer', 'Offers'],
                      ['issue', 'Civic Issues'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFeedFilter(key)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        feedFilter === key
                          ? 'bg-white text-[#13201B] shadow-xs'
                          : 'text-[#52605A] hover:text-[#13201B]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEmergencyMode((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      emergencyMode
                        ? 'border-[#B91C1C] bg-red-50 text-[#B91C1C]'
                        : 'border-[#D4DBD1] bg-white text-[#52605A] hover:text-[#13201B]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {emergencyMode ? 'Rapid Coordination: On' : 'Rapid Coordination Mode'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF] transition-colors whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#1B6B4A]" />
                    <span>Open Coordinator Chat</span>
                  </button>
                </div>
              </div>

              {filteredFeedItems.length === 0 ? (
                <div className="bg-white border border-[#E4E7E2] rounded-xl p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-[#13201B]">
                    No neighborhood posts match the current filter
                  </p>
                  <p className="text-xs text-[#52605A]">
                    Switch filters or post a new need, tool share, or local issue.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedFilter('all');
                      setEmergencyMode(false);
                    }}
                    className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339]"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFeedItems.map((item) => {
                    const dist = computeDistanceKm(center, {
                      lat: center.lat + item.offsetLat,
                      lng: center.lng + item.offsetLng,
                    });
                    return (
                      <MeshCard
                        key={item.id}
                        item={item}
                        distanceKm={dist}
                        highlightMatch={matchLookup[item.id]}
                        isHighlighted={highlightedItemId === item.id}
                        onRunMatchForNeed={(needItem) =>
                          handleSemanticSearch(`${needItem.title}. ${needItem.description}`)
                        }
                        onActionTaken={handleActionTaken}
                        onViewOnMap={handleViewOnMap}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeNav === 'directory' && (
          <DirectoryView
            items={items}
            center={center}
            onAddItems={handleBatchAddItems}
            onActionTaken={handleActionTaken}
            onViewOnMap={handleViewOnMap}
          />
        )}

        {activeNav === 'map' && (
          <NeighborhoodMap
            apiKey={mapsApiKey}
            center={center}
            onCenterChange={handleManualCenterChange}
            areaLabel={areaLabel}
            items={items}
            onSelectItem={(item) => {
              setHighlightedItemId(item.id);
              setActiveNav('feed');
              setFeedFilter('all');
            }}
            emergencyMode={emergencyMode}
            liveLocation={liveLocation}
            onToggleLiveTracking={handleToggleLiveTracking}
            onSetManualLocation={handleSetManualLocation}
            realPlaces={realPlaces}
            onRealPlacesLoaded={handleRealPlacesLoaded}
            onPostWithPlace={handlePostWithPlace}
          />
        )}

        {activeNav === 'pulse' && (
          <PulseTriageView
            items={items}
            center={center}
            areaLabel={areaLabel}
            emergencyMode={emergencyMode}
            onToggleEmergencyMode={() => setEmergencyMode((v) => !v)}
            onActionTaken={handleActionTaken}
            onViewOnMap={handleViewOnMap}
          />
        )}
      </main>

      {/* Quiet Civic Footer */}
      <footer className="border-t border-[#E4E7E2] bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#52605A]">
          <div className="space-y-1">
            <div>
              <span className="font-semibold text-[#13201B]">NeighborMesh</span>
              <span aria-hidden="true"> · </span>
              <span>Hyper-local mutual aid &amp; community resource coordination</span>
            </div>
            <p className="text-[11px] text-[#78490A]">
              Concept prototype only — not a complete app; some AI features may not work due to API charges.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Fuzzy radius privacy zones active</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#13201B] underline underline-offset-2"
            >
              Google Maps End User Terms
            </a>
          </div>
        </div>
      </footer>

      {/* Modals & Floating Coordinator Chatbot */}
      <PostComposerModal
        isOpen={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setComposerPreselectedPlace(null);
        }}
        onPublish={handlePublishItem}
        center={center}
        areaLabel={areaLabel}
        liveLocation={liveLocation}
        onEnableLiveLocation={startLiveTracking}
        realPlaces={realPlaces}
        preselectedPlace={composerPreselectedPlace}
      />

      <CoordinatorChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        location={center}
        communityContext={communityContext}
      />

      <CoordinatorChatLauncher isOpen={chatOpen} onClick={() => setChatOpen(true)} />
    </div>
  );
}

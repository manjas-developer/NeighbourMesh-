/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  MapCameraChangedEvent,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import ReactMarkdown from 'react-markdown';
import {
  Building2,
  Compass,
  Crosshair,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { computeDistanceKm } from '../data/initialNeighborhood';
import { searchNearbyHubs } from '../services/api';
import {
  LatLng,
  LiveLocationState,
  MapSource,
  MeshItem,
  RealNearbyPlace,
} from '../types/mesh';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface NeighborhoodMapProps {
  apiKey: string;
  center: LatLng;
  onCenterChange: (center: LatLng, label: string) => void;
  areaLabel: string;
  items: MeshItem[];
  onSelectItem: (item: MeshItem) => void;
  emergencyMode: boolean;
  liveLocation: LiveLocationState;
  onToggleLiveTracking: () => void;
  onSetManualLocation: (coords: LatLng) => void;
  realPlaces: RealNearbyPlace[];
  onRealPlacesLoaded: (places: RealNearbyPlace[]) => void;
  onPostWithPlace: (place: RealNearbyPlace) => void;
}

type PlaceCategoryKey =
  | 'all'
  | 'hardware'
  | 'libraries'
  | 'health'
  | 'parks'
  | 'essentials';

const PLACE_CATEGORIES: Array<{
  key: PlaceCategoryKey;
  label: string;
  types: string[];
}> = [
  {
    key: 'all',
    label: 'All Real Places',
    types: [
      'hardware_store',
      'library',
      'community_center',
      'pharmacy',
      'park',
      'veterinary_care',
      'hospital',
      'supermarket',
      'local_government_office',
    ],
  },
  {
    key: 'hardware',
    label: 'Hardware & Tools',
    types: ['hardware_store', 'home_improvement_store'],
  },
  {
    key: 'libraries',
    label: 'Libraries & Hubs',
    types: ['library', 'community_center', 'school'],
  },
  {
    key: 'health',
    label: 'Health & Pharmacy',
    types: ['pharmacy', 'hospital', 'doctor'],
  },
  {
    key: 'parks',
    label: 'Parks & Civic',
    types: ['park', 'local_government_office', 'post_office'],
  },
  {
    key: 'essentials',
    label: 'Groceries & Pet',
    types: ['supermarket', 'grocery_store', 'veterinary_care'],
  },
];

const ZONE_COLORS: Record<MeshItem['type'], { fill: string; stroke: string; badgeBg: string }> = {
  offer: { fill: '#1B6B4A', stroke: '#145339', badgeBg: '#1B6B4A' },
  need: { fill: '#B45309', stroke: '#92400E', badgeBg: '#B45309' },
  issue: { fill: '#B91C1C', stroke: '#991B1B', badgeBg: '#B91C1C' },
};

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429')
  );
}

const FuzzyZoneCircle: React.FC<{
  center: LatLng;
  radius: number;
  type: MeshItem['type'];
  isSelected: boolean;
}> = ({ center, radius, type, isSelected }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Circle) return;
    const palette = ZONE_COLORS[type];
    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      fillColor: palette.fill,
      fillOpacity: isSelected ? 0.24 : 0.12,
      strokeColor: palette.stroke,
      strokeOpacity: isSelected ? 0.85 : 0.5,
      strokeWeight: isSelected ? 2 : 1.25,
      clickable: false,
    });
    return () => {
      circle.setMap(null);
    };
  }, [map, center.lat, center.lng, radius, type, isSelected]);

  return null;
};

const LiveLocationOverlay: React.FC<{
  coords: LatLng;
  accuracyMeters: number | null;
}> = ({ coords, accuracyMeters }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Circle) return;
    const circle = new google.maps.Circle({
      map,
      center: coords,
      radius: Math.min(Math.max(accuracyMeters ?? 45, 25), 350),
      fillColor: '#1D4ED8',
      fillOpacity: 0.14,
      strokeColor: '#1D4ED8',
      strokeOpacity: 0.45,
      strokeWeight: 1.5,
      clickable: false,
    });
    return () => {
      circle.setMap(null);
    };
  }, [map, coords.lat, coords.lng, accuracyMeters]);

  return (
    <AdvancedMarker
      position={coords}
      title="Your Live Current Location"
      zIndex={80}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D4ED8] text-white text-[11px] font-semibold shadow-md border-2 border-white whitespace-nowrap">
        <Crosshair className="w-3 h-3" />
        <span>You</span>
      </div>
    </AdvancedMarker>
  );
};

const ZoneMarkerWithInfo: React.FC<{
  item: MeshItem;
  position: LatLng;
  distanceKm: number;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onInspect: () => void;
}> = ({ item, position, distanceKm, isSelected, onSelect, onClose, onInspect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const palette = ZONE_COLORS[item.type];
  const shortKind = item.type === 'offer' ? 'Offer' : item.type === 'need' ? 'Need' : 'Issue';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={onSelect}
        title={`${item.title} (${item.zoneLabel})`}
        zIndex={isSelected ? 50 : item.urgency === 'critical' ? 35 : 15}
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white text-xs font-medium shadow-sm border border-white/80 cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: palette.badgeBg,
            transform: isSelected ? 'scale(1.07)' : 'scale(1)',
            transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span>{shortKind}</span>
          <span className="opacity-75">·</span>
          <span className="font-mono tabular-nums text-[11px]">{item.radiusMeters}m</span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={290}>
          <div className="p-1 text-[#13201B]">
            <p className="text-[11px] text-[#52605A] font-medium mb-1">
              {item.category} · {item.zoneLabel}
            </p>
            <h4 className="text-sm font-semibold text-[#13201B] leading-snug mb-1.5">
              {item.title}
            </h4>
            <p className="text-xs text-[#52605A] leading-relaxed mb-2.5 line-clamp-3">
              {item.description}
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E4E7E2]">
              <span className="text-[11px] font-mono tabular-nums text-[#52605A]">
                ~{distanceKm.toFixed(2)} km away
              </span>
              <button
                type="button"
                onClick={onInspect}
                className="px-2.5 py-1 text-xs font-medium bg-[#1B6B4A] text-white rounded hover:bg-[#145339] transition-colors whitespace-nowrap"
              >
                Open Details
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const RealPlaceMarkerWithInfo: React.FC<{
  place: RealNearbyPlace;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onUseAsMeetup: () => void;
}> = ({ place, isSelected, onSelect, onClose, onUseAsMeetup }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        onClick={onSelect}
        title={place.name}
        zIndex={isSelected ? 60 : 25}
      >
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shadow-sm border cursor-pointer whitespace-nowrap ${
            isSelected
              ? 'bg-[#13201B] text-white border-white'
              : 'bg-white text-[#13201B] border-[#1D4ED8]/50 hover:border-[#1D4ED8]'
          }`}
          style={{
            transform: isSelected ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Building2
            className={`w-3 h-3 shrink-0 ${isSelected ? 'text-white' : 'text-[#1D4ED8]'}`}
          />
          <span className="max-w-[130px] truncate">{place.name}</span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={300}>
          <div className="p-1 text-[#13201B] space-y-2">
            <div>
              <p className="text-[11px] text-[#52605A] font-medium">
                {place.category} ·{' '}
                <span className="font-mono tabular-nums">{place.distanceKm.toFixed(2)} km</span>
              </p>
              <h4 className="text-sm font-semibold text-[#13201B] leading-snug mt-0.5">
                {place.name}
              </h4>
              <p className="text-xs text-[#52605A] mt-0.5">{place.address}</p>
            </div>

            {typeof place.rating === 'number' && (
              <div className="flex items-center gap-1 text-xs text-[#13201B]">
                <Star className="w-3.5 h-3.5 text-[#B45309] fill-[#B45309]" />
                <span className="font-mono tabular-nums font-medium">
                  {place.rating.toFixed(1)}
                </span>
                {place.userRatingCount ? (
                  <span className="text-[#52605A] font-mono tabular-nums">
                    ({place.userRatingCount} reviews)
                  </span>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E4E7E2]">
              <button
                type="button"
                onClick={onUseAsMeetup}
                className="px-2.5 py-1 text-xs font-medium bg-[#1B6B4A] text-white rounded hover:bg-[#145339] transition-colors whitespace-nowrap"
              >
                Use as Meetup Spot
              </button>
              {place.googleMapsURI && (
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

/**
 * Modern Place Autocomplete using AutocompleteSuggestion + AutocompleteSessionToken + Place.fetchFields
 * (Zero legacy google.maps.places.Autocomplete)
 */
const PlaceAutocompleteBar: React.FC<{
  onLocationSelected: (coords: LatLng, label: string, viewport?: google.maps.LatLngBounds | null) => void;
}> = ({ onLocationSelected }) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }
      setLoading(true);
      try {
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
        setOpen(true);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, query]);

  const handleSelect = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    setOpen(false);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      if (place.location) {
        const coords: LatLng = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        const label =
          place.displayName ||
          place.formattedAddress ||
          suggestion.placePrediction.text.text;
        onLocationSelected(coords, label, place.viewport ?? null);
        setQuery(label);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      // CRITICAL: Reset session token after Place.fetchFields completes
      sessionTokenRef.current = null;
      setSuggestions([]);
    }
  };

  return (
    <div className="relative flex-1 min-w-[220px]">
      <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder="Jump to any neighborhood, street, or city..."
        aria-label="Search neighborhood or address"
        className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A] min-h-[38px]"
      />
      {loading && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A] absolute right-2.5 top-1/2 -translate-y-1/2" />
      )}
      {!loading && query && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setSuggestions([]);
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#52605A] hover:text-[#13201B]"
          aria-label="Clear location search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#D4DBD1] rounded-lg shadow-lg divide-y divide-[#E4E7E2] max-h-60 overflow-y-auto">
          {suggestions.map((sug, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => handleSelect(sug)}
                className="w-full text-left px-3 py-2.5 text-xs text-[#13201B] hover:bg-[#F1F4EF] flex items-center gap-2 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#1B6B4A] shrink-0" />
                <span className="truncate">{sug.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Real-Time Places API (New) Controller: runs Place.searchNearby & Place.searchByText
 * inside APIProvider and streams verified real Google Places onto the map.
 */
const LivePlacesEngine: React.FC<{
  searchCenter: LatLng;
  radiusMeters: number;
  categoryKey: PlaceCategoryKey;
  textQuery: string;
  triggerSeq: number;
  panTarget: LatLng | null;
  panSeq: number;
  fitViewport: google.maps.LatLngBounds | null;
  onPlacesChange: (places: RealNearbyPlace[]) => void;
  onLoadingChange: (loading: boolean) => void;
  onErrorChange: (error: string | null) => void;
}> = ({
  searchCenter,
  radiusMeters,
  categoryKey,
  textQuery,
  triggerSeq,
  panTarget,
  panSeq,
  fitViewport,
  onPlacesChange,
  onLoadingChange,
  onErrorChange,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  // Smoothly pan camera whenever active center, selected place, or recenter trigger updates
  useEffect(() => {
    if (!map) return;
    if (fitViewport) {
      map.fitBounds(fitViewport);
    } else if (panTarget) {
      map.panTo(panTarget);
    }
  }, [map, panTarget?.lat, panTarget?.lng, panSeq, fitViewport]);

  // Fetch real nearby places whenever center, radius, category, textQuery, or manual refresh updates
  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    const loadPlaces = async () => {
      onLoadingChange(true);
      onErrorChange(null);
      try {
        const fields = [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'primaryType',
          'primaryTypeDisplayName',
          'rating',
          'userRatingCount',
          'googleMapsURI',
          'businessStatus',
        ];

        let rawPlaces: google.maps.places.Place[] = [];

        if (textQuery.trim()) {
          const res = await placesLib.Place.searchByText({
            textQuery: textQuery.trim(),
            fields,
            locationBias: {
              center: searchCenter,
              radius: Math.min(Math.max(radiusMeters, 500), 15000),
            },
            maxResultCount: 16,
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          });
          rawPlaces = res.places ?? [];
        } else {
          const category =
            PLACE_CATEGORIES.find((c) => c.key === categoryKey) ?? PLACE_CATEGORIES[0];
          const res = await placesLib.Place.searchNearby({
            fields,
            locationRestriction: {
              center: searchCenter,
              radius: Math.min(Math.max(radiusMeters, 500), 15000),
            },
            includedPrimaryTypes: category.types,
            maxResultCount: 18,
            rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          });
          rawPlaces = res.places ?? [];
        }

        if (cancelled) return;

        const mapped: RealNearbyPlace[] = rawPlaces
          .filter((p) => Boolean(p.location))
          .map((p) => {
            const loc: LatLng = {
              lat: p.location!.lat(),
              lng: p.location!.lng(),
            };
            return {
              id: p.id,
              name: p.displayName || 'Nearby Place',
              category:
                p.primaryTypeDisplayName ||
                (p.primaryType ? p.primaryType.replace(/_/g, ' ') : 'Community Place'),
              address: p.formattedAddress || 'Address available on Google Maps',
              location: loc,
              distanceKm: computeDistanceKm(searchCenter, loc),
              rating: typeof p.rating === 'number' ? p.rating : undefined,
              userRatingCount:
                typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
              googleMapsURI: p.googleMapsURI || undefined,
              businessStatus: p.businessStatus || undefined,
              primaryType: p.primaryType || undefined,
            };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm);

        onPlacesChange(mapped);
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onErrorChange(
          err instanceof Error
            ? err.message
            : 'Unable to load nearby Google Maps places right now.'
        );
      } finally {
        if (!cancelled) {
          onLoadingChange(false);
        }
      }
    };

    loadPlaces();
    return () => {
      cancelled = true;
    };
  }, [
    placesLib,
    searchCenter.lat,
    searchCenter.lng,
    radiusMeters,
    categoryKey,
    textQuery,
    triggerSeq,
  ]);

  return null;
};

const MapLoadingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-[540px] lg:h-[620px] flex flex-col items-center justify-center bg-[#EEF1EC] border border-[#E4E7E2] rounded-xl p-6 text-center">
        <MapPin className="w-7 h-7 text-[#52605A] mb-2" />
        <h3 className="text-base font-semibold text-[#13201B]">Google Map could not load</h3>
        <p className="text-sm text-[#52605A] max-w-md mt-1">
          Verify your network connection or Google Maps API key restrictions. Fuzzy proximity listings remain available in the directory and feed.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export const NeighborhoodMap: React.FC<NeighborhoodMapProps> = ({
  apiKey,
  center,
  onCenterChange,
  areaLabel,
  items,
  onSelectItem,
  emergencyMode,
  liveLocation,
  onToggleLiveTracking,
  onSetManualLocation,
  realPlaces,
  onRealPlacesLoaded,
  onPostWithPlace,
}) => {
  const [radiusKm, setRadiusKm] = useState<number>(2.5);
  const [layerMode, setLayerMode] = useState<'both' | 'places' | 'neighbors'>('both');
  const [neighborTypeFilter, setNeighborTypeFilter] = useState<'all' | 'offer' | 'need' | 'issue'>(
    'all'
  );
  const [placeCategory, setPlaceCategory] = useState<PlaceCategoryKey>('all');
  const [placeTextInput, setPlaceTextInput] = useState('');
  const [activePlaceQuery, setActivePlaceQuery] = useState('');
  const [triggerSeq, setTriggerSeq] = useState(0);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [panTarget, setPanTarget] = useState<LatLng | null>(center);
  const [panSeq, setPanSeq] = useState(0);
  const [fitViewport, setFitViewport] = useState<google.maps.LatLngBounds | null>(null);
  const [cameraCenter, setCameraCenter] = useState<LatLng>(center);
  const [mapMovedAway, setMapMovedAway] = useState(false);
  const [pinLocationMode, setPinLocationMode] = useState(false);

  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Right sidebar mode: Live Map Places vs AI Maps Grounding
  const [sidebarTab, setSidebarTab] = useState<'places' | 'ai'>('places');
  const [hubQuery, setHubQuery] = useState('');
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubResult, setHubResult] = useState<{ text: string; mapSources: MapSource[] } | null>(
    null
  );

  // Keep map camera synchronized when center updates from Live GPS or parent
  useEffect(() => {
    setPanTarget(center);
    setPanSeq((s) => s + 1);
    setFitViewport(null);
    setMapMovedAway(false);
  }, [center.lat, center.lng]);

  const visibleNeighbors = useMemo(() => {
    if (layerMode === 'places') return [];
    return items
      .map((item) => {
        const position: LatLng = {
          lat: center.lat + item.offsetLat,
          lng: center.lng + item.offsetLng,
        };
        const distanceKm = computeDistanceKm(center, position);
        return { item, position, distanceKm };
      })
      .filter(({ item, distanceKm }) => {
        if (distanceKm > radiusKm) return false;
        if (emergencyMode && !item.isEmergencyRelevant && item.urgency !== 'critical') {
          return false;
        }
        if (neighborTypeFilter !== 'all' && item.type !== neighborTypeFilter) return false;
        return true;
      });
  }, [items, center, radiusKm, neighborTypeFilter, emergencyMode, layerMode]);

  const visibleRealPlaces = useMemo(() => {
    if (layerMode === 'neighbors') return [];
    return realPlaces;
  }, [realPlaces, layerMode]);

  const handleCameraChanged = useCallback(
    (ev: MapCameraChangedEvent) => {
      const next = ev.detail.center;
      if (!next) return;
      setCameraCenter(next);
      const drift = computeDistanceKm(center, next);
      if (drift > 0.35) {
        setMapMovedAway(true);
      }
    },
    [center]
  );

  const handleSearchThisArea = () => {
    setMapMovedAway(false);
    onCenterChange(
      cameraCenter,
      `Map Area (${cameraCenter.lat.toFixed(3)}, ${cameraCenter.lng.toFixed(3)})`
    );
    setTriggerSeq((s) => s + 1);
  };

  const handleSearchHubsAI = async (customQuery?: string) => {
    const q = (customQuery ?? hubQuery).trim();
    if (!q) return;
    setHubQuery(q);
    setSidebarTab('ai');
    setHubLoading(true);
    setHubError(null);
    try {
      const data = await searchNearbyHubs(q, center);
      setHubResult(data);
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setHubError(err instanceof Error ? err.message : 'Unable to search nearby places.');
    } finally {
      setHubLoading(false);
    }
  };

  const mapContent = (
    <div className="space-y-5">
      {/* Top Location & Live Tracking Control Bar */}
      <div className="bg-white border border-[#E4E7E2] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#13201B]">
              Real-Time Neighborhood Map &amp; Nearby Places
            </h2>
            <p className="text-xs sm:text-sm text-[#52605A] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1 text-[#13201B] font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#1B6B4A] shrink-0" />
                {areaLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-xs">
                {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
              </span>
              {liveLocation.status === 'active' && liveLocation.accuracyMeters ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#1D4ED8] font-medium font-mono tabular-nums text-xs">
                    Live GPS (±{Math.round(liveLocation.accuracyMeters)}m)
                  </span>
                </>
              ) : liveLocation.status === 'manual' ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#1B6B4A] font-medium text-xs">Pinned Location</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {apiKey && (
              <PlaceAutocompleteBar
                onLocationSelected={(coords, label, viewport) => {
                  onCenterChange(coords, label);
                  setFitViewport(viewport ?? null);
                  setPanTarget(coords);
                  setPanSeq((s) => s + 1);
                  setActivePlaceQuery('');
                  setPlaceTextInput('');
                  setTriggerSeq((s) => s + 1);
                }}
              />
            )}

            <button
              type="button"
              onClick={onToggleLiveTracking}
              disabled={liveLocation.status === 'locating'}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                liveLocation.status === 'active'
                  ? 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                  : liveLocation.status === 'locating'
                    ? 'bg-[#EEF1EC] text-[#52605A] cursor-wait'
                    : 'border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF]'
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
                    : 'Use Live Location'}
              </span>
            </button>

            {liveLocation.coords && (
              <button
                type="button"
                onClick={() => {
                  setFitViewport(null);
                  setPanTarget(liveLocation.coords);
                  setPanSeq((s) => s + 1);
                  setMapMovedAway(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
                title="Recenter map on your location"
              >
                <Crosshair className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Recenter</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPinLocationMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                pinLocationMode
                  ? 'border-[#1B6B4A] bg-[#1B6B4A] text-white'
                  : 'border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF]'
              }`}
              title="Click directly on the map to set your location"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{pinLocationMode ? 'Cancel Pinning' : 'Set on Map'}</span>
            </button>
          </div>
        </div>

        {liveLocation.error && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B45309] bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
            <span>{liveLocation.error}</span>
            <button
              type="button"
              onClick={() => setPinLocationMode(true)}
              className="font-semibold text-[#13201B] underline whitespace-nowrap"
            >
              Click map to set location manually
            </button>
          </div>
        )}

        {/* Layer, Category & Radius Controls */}
        <div className="pt-3.5 border-t border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#EEF1EC] rounded-lg">
              {(
                [
                  ['both', 'All Layers'],
                  ['places', `Real Places (${realPlaces.length})`],
                  ['neighbors', `Neighbor Zones (${visibleNeighbors.length})`],
                ] as const
              ).map(([key, lbl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLayerMode(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    layerMode === key
                      ? 'bg-white text-[#13201B] shadow-xs'
                      : 'text-[#52605A] hover:text-[#13201B]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {layerMode !== 'places' && (
              <select
                aria-label="Filter neighbor zone type"
                value={neighborTypeFilter}
                onChange={(e) =>
                  setNeighborTypeFilter(e.target.value as 'all' | 'offer' | 'need' | 'issue')
                }
                className="text-xs text-[#13201B] bg-white border border-[#D4DBD1] rounded-lg px-2.5 py-2 focus:outline-none focus:border-[#1B6B4A]"
              >
                <option value="all">All Neighbor Zones</option>
                <option value="offer">Tools &amp; Skills Only</option>
                <option value="need">Needs Only</option>
                <option value="issue">Civic Issues Only</option>
              </select>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#52605A] whitespace-nowrap">
            <span>Search Radius</span>
            <input
              type="range"
              min={0.5}
              max={5.0}
              step={0.5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-24 accent-[#1B6B4A]"
            />
            <span className="font-mono tabular-nums text-[#13201B] font-medium w-12">
              {radiusKm.toFixed(1)} km
            </span>
          </label>
        </div>

        {/* Real Places Category Chips */}
        {layerMode !== 'neighbors' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {PLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setPlaceCategory(cat.key);
                  setActivePlaceQuery('');
                  setPlaceTextInput('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  placeCategory === cat.key && !activePlaceQuery
                    ? 'bg-[#13201B] text-white border-[#13201B]'
                    : 'bg-[#F8F9F7] text-[#52605A] border-[#E4E7E2] hover:text-[#13201B] hover:border-[#C5CFC2]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main 2-Column Interactive Map + Real Places & AI Grounding Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          {apiKey ? (
            <div className="relative rounded-xl overflow-hidden border border-[#E4E7E2] bg-white h-[540px] lg:h-[620px]">
              <MapLoadingGuard>
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={center}
                  defaultZoom={14}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  streetViewControl={false}
                  mapTypeControl={false}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%' }}
                  onCameraChanged={handleCameraChanged}
                  onClick={(ev) => {
                    if (pinLocationMode && ev.detail.latLng) {
                      const picked: LatLng = {
                        lat: ev.detail.latLng.lat,
                        lng: ev.detail.latLng.lng,
                      };
                      setPinLocationMode(false);
                      onSetManualLocation(picked);
                      setTriggerSeq((s) => s + 1);
                      return;
                    }
                    setSelectedZoneId(null);
                    setSelectedPlaceId(null);
                  }}
                >
                  <LivePlacesEngine
                    searchCenter={center}
                    radiusMeters={radiusKm * 1000}
                    categoryKey={placeCategory}
                    textQuery={activePlaceQuery}
                    triggerSeq={triggerSeq}
                    panTarget={panTarget}
                    panSeq={panSeq}
                    fitViewport={fitViewport}
                    onPlacesChange={onRealPlacesLoaded}
                    onLoadingChange={setPlacesLoading}
                    onErrorChange={setPlacesError}
                  />

                  {/* Live Current GPS Location Marker & Accuracy Circle */}
                  {liveLocation.coords && (
                    <LiveLocationOverlay
                      coords={liveLocation.coords}
                      accuracyMeters={liveLocation.accuracyMeters}
                    />
                  )}

                  {/* Privacy-First Fuzzy Neighbor Zones */}
                  {visibleNeighbors.map(({ item, position, distanceKm }) => (
                    <React.Fragment key={item.id}>
                      <FuzzyZoneCircle
                        center={position}
                        radius={item.radiusMeters}
                        type={item.type}
                        isSelected={selectedZoneId === item.id}
                      />
                      <ZoneMarkerWithInfo
                        item={item}
                        position={position}
                        distanceKm={distanceKm}
                        isSelected={selectedZoneId === item.id}
                        onSelect={() => {
                          setSelectedPlaceId(null);
                          setSelectedZoneId(item.id);
                        }}
                        onClose={() => setSelectedZoneId(null)}
                        onInspect={() => onSelectItem(item)}
                      />
                    </React.Fragment>
                  ))}

                  {/* Live Real Nearby Google Places Markers */}
                  {visibleRealPlaces.map((place) => (
                    <RealPlaceMarkerWithInfo
                      key={place.id}
                      place={place}
                      isSelected={selectedPlaceId === place.id}
                      onSelect={() => {
                        setSelectedZoneId(null);
                        setSelectedPlaceId(place.id);
                      }}
                      onClose={() => setSelectedPlaceId(null)}
                      onUseAsMeetup={() => onPostWithPlace(place)}
                    />
                  ))}
                </GoogleMap>
              </MapLoadingGuard>

              {/* Floating "Pin My Location" Instruction Banner */}
              {pinLocationMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
                  <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#1B6B4A] text-white shadow-lg whitespace-nowrap">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Click anywhere on the map to set your current location</span>
                  </div>
                </div>
              )}

              {/* Floating "Search This Area" Button when user pans map */}
              {!pinLocationMode && mapMovedAway && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    onClick={handleSearchThisArea}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#13201B] text-white shadow-lg hover:bg-[#1B6B4A] transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Search Real Places in This Area</span>
                  </button>
                </div>
              )}

              {/* Subtle loading pill on map while fetching live places */}
              {placesLoading && (
                <div className="absolute bottom-3 left-3 z-20 bg-white/95 border border-[#E4E7E2] rounded-lg px-3 py-1.5 text-xs text-[#13201B] shadow-sm flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
                  <span>Loading live nearby places...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[540px] lg:h-[620px] flex flex-col items-center justify-center bg-[#EEF1EC] border border-[#E4E7E2] rounded-xl p-6 text-center">
              <Compass className="w-7 h-7 text-[#52605A] mb-2" />
              <h3 className="text-base font-semibold text-[#13201B]">
                Google Maps API key unavailable
              </h3>
              <p className="text-sm text-[#52605A] max-w-md mt-1">
                Interactive real-time map tiles and Places search require a configured Google Maps API key.
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#52605A] px-1">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1D4ED8]" />
                Real Google Places &amp; Live GPS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1B6B4A]" />
                Neighbor Offers (Fuzzy Zone)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B45309]" />
                Needs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B91C1C]" />
                Civic Issues
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[#52605A]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1B6B4A]" />
              Exact home addresses stay hidden
            </span>
          </div>
        </div>

        {/* Right Sidebar: Live Map Places List + AI Maps Grounding */}
        <div className="lg:col-span-4 bg-white border border-[#E4E7E2] rounded-xl p-5 flex flex-col h-[540px] lg:h-[620px]">
          <div className="pb-3.5 border-b border-[#E4E7E2] space-y-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEF1EC] rounded-lg">
              <button
                type="button"
                onClick={() => setSidebarTab('places')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sidebarTab === 'places'
                    ? 'bg-white text-[#13201B] shadow-xs'
                    : 'text-[#52605A] hover:text-[#13201B]'
                }`}
              >
                Live Places ({realPlaces.length})
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('ai')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sidebarTab === 'ai'
                    ? 'bg-white text-[#13201B] shadow-xs'
                    : 'text-[#52605A] hover:text-[#13201B]'
                }`}
              >
                AI Maps Grounding
              </button>
            </div>

            {sidebarTab === 'places' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setActivePlaceQuery(placeTextInput.trim());
                  setTriggerSeq((s) => s + 1);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={placeTextInput}
                    onChange={(e) => setPlaceTextInput(e.target.value)}
                    placeholder="Search places on map (e.g. clinic, tool shop)..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
                  />
                </div>
                <VoiceRecorderButton
                  compact
                  onTranscript={(text) => {
                    setPlaceTextInput(text);
                    setActivePlaceQuery(text);
                    setTriggerSeq((s) => s + 1);
                  }}
                  onError={(msg) => setPlacesError(msg)}
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] transition-colors whitespace-nowrap min-h-[38px]"
                >
                  Search
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchHubsAI();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={hubQuery}
                    onChange={(e) => setHubQuery(e.target.value)}
                    placeholder="Ask AI about nearby hubs, hours..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
                  />
                </div>
                <VoiceRecorderButton
                  compact
                  onTranscript={(text) => handleSearchHubsAI(text)}
                  onError={(msg) => setHubError(msg)}
                />
                <button
                  type="submit"
                  disabled={hubLoading || !hubQuery.trim()}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-[#13201B] text-white hover:bg-[#1B6B4A] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[38px]"
                >
                  Ask
                </button>
              </form>
            )}
          </div>

          {/* Scrollable Sidebar Content */}
          <div className="flex-1 overflow-y-auto pt-3.5 space-y-3">
            {sidebarTab === 'places' ? (
              <>
                {activePlaceQuery && (
                  <div className="flex items-center justify-between text-xs text-[#52605A] pb-1">
                    <span>
                      Results for <strong className="text-[#13201B]">&ldquo;{activePlaceQuery}&rdquo;</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePlaceQuery('');
                        setPlaceTextInput('');
                      }}
                      className="text-[#1B6B4A] hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                )}

                {placesError && (
                  <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-3">
                    {placesError}
                  </div>
                )}

                {placesLoading && realPlaces.length === 0 && (
                  <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#52605A]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1B6B4A]" />
                    <span>Discovering real places around {areaLabel}...</span>
                  </div>
                )}

                {!placesLoading && realPlaces.length === 0 && !placesError && (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-sm font-medium text-[#13201B]">No places in this radius</p>
                    <p className="text-xs text-[#52605A]">
                      Increase the search radius slider or switch categories to load more real places.
                    </p>
                  </div>
                )}

                <ul className="space-y-2.5">
                  {realPlaces.map((place) => {
                    const selected = selectedPlaceId === place.id;
                    return (
                      <li
                        key={place.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          selected
                            ? 'border-[#1D4ED8] bg-[#1D4ED8]/5'
                            : 'border-[#E4E7E2] bg-[#F8F9F7]/70 hover:bg-white hover:border-[#C5CFC2]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedZoneId(null);
                            setSelectedPlaceId(place.id);
                            setFitViewport(null);
                            setPanTarget(place.location);
                            setPanSeq((s) => s + 1);
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-[#13201B] leading-snug">
                              {place.name}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-[#52605A] shrink-0">
                              {place.distanceKm.toFixed(2)} km
                            </span>
                          </div>
                          <p className="text-[11px] text-[#52605A] mt-0.5 capitalize">
                            {place.category}
                            {typeof place.rating === 'number'
                              ? ` · ${place.rating.toFixed(1)}★ (${place.userRatingCount ?? 0})`
                              : ''}
                          </p>
                          <p className="text-[11px] text-[#52605A] mt-1 line-clamp-1">
                            {place.address}
                          </p>
                        </button>

                        <div className="mt-2.5 pt-2 border-t border-[#E4E7E2] flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => onPostWithPlace(place)}
                            className="font-medium text-[#1B6B4A] hover:underline whitespace-nowrap"
                          >
                            Use as Meetup Spot
                          </button>
                          {place.googleMapsURI && (
                            <a
                              href={place.googleMapsURI}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline whitespace-nowrap"
                            >
                              <span>Directions</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Hardware & tool stores',
                    'Public libraries open now',
                    'Community centers',
                    '24-hour pharmacies',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSearchHubsAI(preset)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#EEF1EC] text-[#13201B] hover:bg-[#E1E7DE] transition-colors whitespace-nowrap"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {hubError && (
                  <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-3">
                    {hubError}
                  </div>
                )}

                {hubLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#52605A] py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1B6B4A]" />
                    <span>Querying Google Maps Grounding near {areaLabel}...</span>
                  </div>
                )}

                {!hubLoading && !hubResult && !hubError && (
                  <div className="py-6 text-center space-y-1.5">
                    <p className="text-sm font-medium text-[#13201B]">
                      Ask Gemini with Google Maps Grounding
                    </p>
                    <p className="text-xs text-[#52605A] leading-relaxed">
                      Get grounded recommendations, hours, and verified Google Maps links around your live location.
                    </p>
                  </div>
                )}

                {!hubLoading && hubResult && (
                  <div className="space-y-4">
                    <div className="nm-prose text-xs text-[#13201B]">
                      <ReactMarkdown>{hubResult.text}</ReactMarkdown>
                    </div>
                    {hubResult.mapSources.length > 0 && (
                      <div className="pt-3 border-t border-[#E4E7E2] space-y-2">
                        <h4 className="text-xs font-semibold text-[#13201B]">
                          Verified Google Maps Links
                        </h4>
                        <ul className="space-y-2">
                          {hubResult.mapSources.map((src, idx) => (
                            <li
                              key={`${src.uri}-${idx}`}
                              className="p-2.5 rounded-lg bg-[#F8F9F7] border border-[#E4E7E2]"
                            >
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-2 text-xs font-medium text-[#1B6B4A] hover:underline"
                              >
                                <span className="truncate">{src.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                              {src.reviewSnippets?.[0] && (
                                <p className="text-[11px] text-[#52605A] mt-1 line-clamp-2">
                                  &ldquo;{src.reviewSnippets[0]}&rdquo;
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!apiKey) {
    return mapContent;
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['marker', 'places']}
      language="en"
      region="US"
    >
      {mapContent}
    </APIProvider>
  );
};

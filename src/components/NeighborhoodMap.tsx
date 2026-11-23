/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import ReactMarkdown from 'react-markdown';
import {
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { computeDistanceKm } from '../data/initialNeighborhood';
import { searchNearbyHubs } from '../services/api';
import { LatLng, MapSource, MeshItem } from '../types/mesh';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface NeighborhoodMapProps {
  apiKey: string;
  center: LatLng;
  onCenterChange: (center: LatLng, label: string) => void;
  areaLabel: string;
  items: MeshItem[];
  onSelectItem: (item: MeshItem) => void;
  emergencyMode: boolean;
}

const ZONE_COLORS: Record<MeshItem['type'], { fill: string; stroke: string; badgeBg: string }> = {
  offer: { fill: '#1B6B4A', stroke: '#145339', badgeBg: '#1B6B4A' },
  need: { fill: '#B45309', stroke: '#92400E', badgeBg: '#B45309' },
  issue: { fill: '#B91C1C', stroke: '#991B1B', badgeBg: '#B91C1C' },
};

const FuzzyZoneCircle: React.FC<{
  center: LatLng;
  radius: number;
  type: MeshItem['type'];
  isSelected: boolean;
}> = ({ center, radius, type, isSelected }) => {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Circle) return;
    const palette = ZONE_COLORS[type];
    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      fillColor: palette.fill,
      fillOpacity: isSelected ? 0.24 : 0.13,
      strokeColor: palette.stroke,
      strokeOpacity: isSelected ? 0.85 : 0.55,
      strokeWeight: isSelected ? 2 : 1.25,
      clickable: false,
    });
    circleRef.current = circle;
    return () => {
      circle.setMap(null);
      circleRef.current = null;
    };
  }, [map, center.lat, center.lng, radius, type, isSelected]);

  return null;
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
        zIndex={isSelected ? 40 : item.urgency === 'critical' ? 30 : 10}
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
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={280}>
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

const MapCameraSync: React.FC<{ center: LatLng }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng]);
  return null;
};

const MapLoadingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-[520px] lg:h-[600px] flex flex-col items-center justify-center bg-[#EEF1EC] border border-[#E4E7E2] rounded-xl p-6 text-center">
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
}) => {
  const [radiusKm, setRadiusKm] = useState<number>(2.0);
  const [typeFilter, setTypeFilter] = useState<'all' | 'offer' | 'need' | 'issue'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Google Maps Grounding Hub Finder state
  const [hubQuery, setHubQuery] = useState('');
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubResult, setHubResult] = useState<{ text: string; mapSources: MapSource[] } | null>(
    null
  );

  const visibleItems = useMemo(() => {
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
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        return true;
      });
  }, [items, center, radiusKm, typeFilter, emergencyMode]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Browser geolocation is unavailable.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCenterChange(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          'Your Current Neighborhood'
        );
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message || 'Location permission was declined.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [onCenterChange]);

  const handleSearchHubs = async (customQuery?: string) => {
    const q = (customQuery ?? hubQuery).trim();
    if (!q) return;
    setHubQuery(q);
    setHubLoading(true);
    setHubError(null);
    try {
      const data = await searchNearbyHubs(q, center);
      setHubResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to search nearby places.';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setHubError(msg);
    } finally {
      setHubLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="bg-white border border-[#E4E7E2] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#13201B]">
            Fuzzy Proximity Map &amp; Local Hubs
          </h2>
          <p className="text-sm text-[#52605A] mt-0.5 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1B6B4A] shrink-0" />
            <span>
              Privacy zones hide exact home addresses by displaying 250–450m neighborhood circles around{' '}
              <strong className="font-medium text-[#13201B]">{areaLabel}</strong>.
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EEF1EC] rounded-lg">
            {(
              [
                ['all', 'All Zones'],
                ['offer', 'Offers'],
                ['need', 'Needs'],
                ['issue', 'Issues'],
              ] as const
            ).map(([key, lbl]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === key
                    ? 'bg-white text-[#13201B] shadow-xs'
                    : 'text-[#52605A] hover:text-[#13201B]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#52605A] whitespace-nowrap">
            <span>Radius</span>
            <input
              type="range"
              min={0.5}
              max={3.5}
              step={0.25}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-24 accent-[#1B6B4A]"
            />
            <span className="font-mono tabular-nums text-[#13201B] font-medium w-12">
              {radiusKm.toFixed(2)} km
            </span>
          </label>

          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#1B6B4A]" />
            )}
            <span>Use My Location</span>
          </button>
        </div>
      </div>

      {locationError && (
        <p className="text-xs text-[#B45309] bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          {locationError}
        </p>
      )}

      {/* Main 2-column Map + Grounded Local Hubs split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          {apiKey ? (
            <div className="relative rounded-xl overflow-hidden border border-[#E4E7E2] bg-white h-[520px] lg:h-[600px]">
              <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="US">
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
                    onClick={() => setSelectedId(null)}
                  >
                    <MapCameraSync center={center} />
                    {visibleItems.map(({ item, position, distanceKm }) => (
                      <React.Fragment key={item.id}>
                        <FuzzyZoneCircle
                          center={position}
                          radius={item.radiusMeters}
                          type={item.type}
                          isSelected={selectedId === item.id}
                        />
                        <ZoneMarkerWithInfo
                          item={item}
                          position={position}
                          distanceKm={distanceKm}
                          isSelected={selectedId === item.id}
                          onSelect={() => setSelectedId(item.id)}
                          onClose={() => setSelectedId(null)}
                          onInspect={() => onSelectItem(item)}
                        />
                      </React.Fragment>
                    ))}
                  </GoogleMap>
                </MapLoadingGuard>
              </APIProvider>
            </div>
          ) : (
            <div className="h-[520px] lg:h-[600px] flex flex-col items-center justify-center bg-[#EEF1EC] border border-[#E4E7E2] rounded-xl p-6 text-center">
              <Compass className="w-7 h-7 text-[#52605A] mb-2" />
              <h3 className="text-base font-semibold text-[#13201B]">
                Google Maps API key unavailable
              </h3>
              <p className="text-sm text-[#52605A] max-w-md mt-1">
                Interactive map tiles require a configured Google Maps API key. You can still browse all {visibleItems.length} neighborhood zones in the feed and directory.
              </p>
            </div>
          )}

          {/* Legend & count footer */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#52605A] px-1">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1B6B4A]" />
                Shared Tools &amp; Skills
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B45309]" />
                Neighbor Needs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B91C1C]" />
                Civic Issues &amp; Alerts
              </span>
            </div>
            <span className="font-mono tabular-nums">
              Showing {visibleItems.length} fuzzy zones within {radiusKm.toFixed(2)} km
            </span>
          </div>
        </div>

        {/* Right Panel: Live Google Maps Grounding Hub Discovery */}
        <div className="lg:col-span-4 bg-white border border-[#E4E7E2] rounded-xl p-5 flex flex-col h-[520px] lg:h-[600px]">
          <div className="pb-4 border-b border-[#E4E7E2]">
            <h3 className="text-base font-semibold text-[#13201B]">
              Nearby Community Hubs
            </h3>
            <p className="text-xs text-[#52605A] mt-1 leading-relaxed">
              Grounded live with Google Maps data around {areaLabel} to locate real public libraries, hardware stores, clinics, and mutual aid drop-off points.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchHubs();
              }}
              className="mt-3 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={hubQuery}
                  onChange={(e) => setHubQuery(e.target.value)}
                  placeholder="Find hardware stores, libraries..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
                />
              </div>
              <VoiceRecorderButton
                compact
                onTranscript={(text) => handleSearchHubs(text)}
                onError={(msg) => setHubError(msg)}
              />
              <button
                type="submit"
                disabled={hubLoading || !hubQuery.trim()}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
              >
                {hubLoading ? 'Finding...' : 'Find'}
              </button>
            </form>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                'Hardware & tool stores',
                'Public libraries',
                'Community centers',
                '24-hour pharmacies',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSearchHubs(preset)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#EEF1EC] text-[#13201B] hover:bg-[#E1E7DE] transition-colors whitespace-nowrap"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {hubError && (
              <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-3">
                {hubError}
              </div>
            )}

            {hubLoading && (
              <div className="flex items-center gap-2 text-xs text-[#52605A] py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[#1B6B4A]" />
                <span>Querying Google Maps Grounding near your location...</span>
              </div>
            )}

            {!hubLoading && !hubResult && !hubError && (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm font-medium text-[#13201B]">
                  Search real nearby places
                </p>
                <p className="text-xs text-[#52605A] max-w-xs mx-auto leading-relaxed">
                  Select a category above or speak a query to retrieve up-to-date Google Maps places, open hours, and direct map links.
                </p>
              </div>
            )}

            {!hubLoading && hubResult && (
              <>
                <div className="nm-prose text-xs text-[#13201B]">
                  <ReactMarkdown>{hubResult.text}</ReactMarkdown>
                </div>

                {hubResult.mapSources.length > 0 && (
                  <div className="pt-3 border-t border-[#E4E7E2] space-y-2">
                    <h4 className="text-xs font-semibold text-[#13201B]">
                      Verified Google Maps Places
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
                          {src.reviewSnippets && src.reviewSnippets.length > 0 && (
                            <p className="text-[11px] text-[#52605A] mt-1 line-clamp-2">
                              &ldquo;{src.reviewSnippets[0]}&rdquo;
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

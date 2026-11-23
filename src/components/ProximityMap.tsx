import { ShieldCheck } from 'lucide-react';
import { NEIGHBORHOOD_ZONES, getDistanceKm, getZoneById } from '../data/seedData';
import type { ResourceListing } from '../types';

interface ProximityMapProps {
  userZoneId: string;
  radiusKm: number;
  matchedZoneIds?: string[];
  listings: ResourceListing[];
  onSelectZone: (zoneId: string) => void;
}

export function ProximityMap({
  userZoneId,
  radiusKm,
  matchedZoneIds = [],
  listings,
  onSelectZone,
}: ProximityMapProps) {
  const userZone = getZoneById(userZoneId);

  // Scale radiusKm to SVG viewBox units (approx 22 SVG units per km)
  const radiusSvg = Math.min(46, Math.max(12, radiusKm * 22));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Fuzzy Proximity Zones
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Centered on {userZone.name} · {radiusKm.toFixed(1)} km radius
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
            ~{userZone.approxRadiusMeters}m fuzzing
          </span>
        </div>

        <div className="relative rounded-lg border border-slate-200 bg-[#F4F7F6] overflow-hidden">
          <svg
            viewBox="0 0 100 84"
            className="w-full h-auto block"
            role="img"
            aria-label={`Neighborhood fuzzy proximity map centered on ${userZone.name} with ${radiusKm} kilometer radius`}
          >
            {/* Subtle civic street grid */}
            <g stroke="#CBD5E1" strokeWidth="0.35" strokeDasharray="1.5 1.5">
              <line x1="0" y1="20" x2="100" y2="20" />
              <line x1="0" y1="42" x2="100" y2="42" />
              <line x1="0" y1="64" x2="100" y2="64" />
              <line x1="25" y1="0" x2="25" y2="84" />
              <line x1="50" y1="0" x2="50" y2="84" />
              <line x1="75" y1="0" x2="75" y2="84" />
            </g>

            {/* Decorative river contour */}
            <path
              d="M 55 84 Q 65 70 80 62 T 100 46"
              fill="none"
              stroke="#BFDBFE"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.7"
            />

            {/* Active search radius ring around user's fuzzy zone */}
            <circle
              cx={userZone.mapX}
              cy={userZone.mapY}
              r={radiusSvg}
              fill="#155E4B"
              fillOpacity="0.06"
              stroke="#155E4B"
              strokeWidth="0.6"
              strokeDasharray="2 1.5"
            />

            {/* Fuzzy neighborhood zones (no exact street pins) */}
            {NEIGHBORHOOD_ZONES.map((zone) => {
              const isUser = zone.id === userZoneId;
              const dist = getDistanceKm(userZoneId, zone.id);
              const inRadius = dist <= radiusKm;
              const isMatched = matchedZoneIds.includes(zone.id);
              const count = listings.filter((l) => l.zoneId === zone.id).length;

              return (
                <g
                  key={zone.id}
                  onClick={() => onSelectZone(zone.id)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${zone.name}, ${count} resources`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectZone(zone.id);
                    }
                  }}
                >
                  {/* Fuzzy zone coverage cloud */}
                  <circle
                    cx={zone.mapX}
                    cy={zone.mapY}
                    r={isMatched ? 10.5 : 8.5}
                    fill={
                      isUser
                        ? '#155E4B'
                        : isMatched
                          ? '#0D9488'
                          : inRadius
                            ? '#64748B'
                            : '#CBD5E1'
                    }
                    fillOpacity={isUser ? 0.22 : isMatched ? 0.24 : inRadius ? 0.14 : 0.12}
                    stroke={
                      isUser
                        ? '#155E4B'
                        : isMatched
                          ? '#0F766E'
                          : inRadius
                            ? '#64748B'
                            : '#94A3B8'
                    }
                    strokeWidth={isUser || isMatched ? '0.8' : '0.45'}
                  />

                  {/* Resource count inside fuzzy area */}
                  <text
                    x={zone.mapX}
                    y={zone.mapY + 1.2}
                    textAnchor="middle"
                    fontSize="3.4"
                    fontWeight="600"
                    fill={isUser || isMatched ? '#0F172A' : '#475569'}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {count}
                  </text>

                  {/* Zone label */}
                  <text
                    x={zone.mapX}
                    y={zone.mapY + 14}
                    textAnchor="middle"
                    fontSize="3.1"
                    fontWeight={isUser || isMatched ? '600' : '500'}
                    fill={isUser ? '#155E4B' : '#334155'}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-[#155E4B] shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-slate-800">Privacy by design:</span> Exact house
          addresses are never displayed. Click any zone circle above to switch your approximate
          neighborhood center.
        </p>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { computeDistanceKm } from '../data/initialNeighborhood';
import { runCivicSearch, triagePulse } from '../services/api';
import { LatLng, MeshItem, TriageReport, WebSource } from '../types/mesh';
import { MeshCard } from './MeshCard';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface PulseTriageViewProps {
  items: MeshItem[];
  center: LatLng;
  areaLabel: string;
  emergencyMode: boolean;
  onToggleEmergencyMode: () => void;
  onActionTaken: (itemId: string, actionLabel: string) => void;
  onViewOnMap: (item: MeshItem) => void;
}

const CIVIC_SEARCH_PRESETS = [
  'Safe steps during a residential water pressure drop or boil advisory',
  'How to report an unlit municipal streetlamp or crosswalk hazard',
  'Home backup power safety tips for medical CPAP devices during outages',
];

export const PulseTriageView: React.FC<PulseTriageViewProps> = ({
  items,
  center,
  areaLabel,
  emergencyMode,
  onToggleEmergencyMode,
  onActionTaken,
  onViewOnMap,
}) => {
  const issues = useMemo(
    () =>
      items.filter(
        (i) => i.type === 'issue' || i.urgency === 'critical' || i.isEmergencyRelevant
      ),
    [items]
  );

  // Triage AI Summary state
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageReport, setTriageReport] = useState<TriageReport | null>(null);

  // Live Google Search Grounding Civic Brief state
  const [civicQuery, setCivicQuery] = useState('');
  const [civicLoading, setCivicLoading] = useState(false);
  const [civicError, setCivicError] = useState<string | null>(null);
  const [civicResult, setCivicResult] = useState<{
    text: string;
    webSources: WebSource[];
  } | null>(null);

  const handleGenerateTriage = async () => {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const report = await triagePulse(issues);
      setTriageReport(report);
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Unable to run issue triage.');
    } finally {
      setTriageLoading(false);
    }
  };

  const handleCivicSearch = async (override?: string) => {
    const q = (override ?? civicQuery).trim();
    if (!q) return;
    setCivicQuery(q);
    setCivicLoading(true);
    setCivicError(null);
    try {
      const data = await runCivicSearch(q, areaLabel);
      setCivicResult(data);
    } catch (err) {
      setCivicError(err instanceof Error ? err.message : 'Unable to complete civic search.');
    } finally {
      setCivicLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Emergency Response Coordination Toggle Banner */}
      <section
        className={`rounded-xl border p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          emergencyMode
            ? 'bg-red-50/70 border-[#B91C1C]/35'
            : 'bg-white border-[#E4E7E2]'
        }`}
      >
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <ShieldAlert
              className={`w-4 h-4 shrink-0 ${
                emergencyMode ? 'text-[#B91C1C]' : 'text-[#B45309]'
              }`}
            />
            <h2 className="text-lg font-semibold text-[#13201B]">
              Community Pulse &amp; Rapid Coordination Mode
            </h2>
          </div>
          <p className="text-sm text-[#52605A] leading-relaxed">
            Cluster recurring neighborhood issues—water pressure drops, broken streetlights, lost pets, or power backup needs—and route them to block coordinators.
          </p>
          <p className="text-xs text-[#52605A]">
            <strong className="text-[#13201B]">Non-emergency notice:</strong> NeighborMesh assists peer-to-peer neighborhood coordination only. For life-threatening medical, fire, or safety emergencies, contact official emergency services (911 / 112) first.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleEmergencyMode}
          className={`px-4 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
            emergencyMode
              ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B]'
              : 'border border-[#B91C1C]/40 bg-white text-[#B91C1C] hover:bg-red-50'
          }`}
        >
          {emergencyMode ? 'Exit Rapid Coordination Mode' : 'Activate Rapid Coordination Mode'}
        </button>
      </section>

      {/* Two-Column Triage Engine + Google Search Grounding */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Issue Triage */}
        <section className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E7E2]">
            <div>
              <h3 className="text-base font-semibold text-[#13201B]">
                Automated Issue Triage &amp; Routing
              </h3>
              <p className="text-xs text-[#52605A] mt-0.5">
                Synthesizes {issues.length} active neighborhood reports into coordinator action briefs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateTriage}
              disabled={triageLoading || issues.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[38px]"
            >
              {triageLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{triageReport ? 'Refresh Triage Brief' : 'Generate Triage Brief'}</span>
            </button>
          </div>

          {triageError && (
            <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-3">
              {triageError}
            </div>
          )}

          {!triageReport && !triageLoading && (
            <div className="py-6 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-[#B45309] mx-auto" />
              <p className="text-sm font-medium text-[#13201B]">
                Ready to summarize {issues.length} open community reports
              </p>
              <p className="text-xs text-[#52605A] max-w-md mx-auto leading-relaxed">
                Click &ldquo;Generate Triage Brief&rdquo; to cluster duplicate alerts, prioritize severity, and route each issue to the right neighborhood lead.
              </p>
            </div>
          )}

          {triageLoading && (
            <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#52605A]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B6B4A]" />
              <span>Clustering resident alerts and routing coordinator tasks...</span>
            </div>
          )}

          {triageReport && !triageLoading && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-semibold text-[#13201B]">
                  {triageReport.headline}
                </h4>
                <p className="text-sm text-[#52605A] mt-1 leading-relaxed">
                  {triageReport.overallSummary}
                </p>
              </div>

              <div className="divide-y divide-[#E4E7E2] border-t border-[#E4E7E2]">
                {triageReport.clusters.map((cluster, idx) => (
                  <div key={`${cluster.theme}-${idx}`} className="py-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#13201B] text-sm">
                        {cluster.theme}
                      </span>
                      <span
                        className={`font-medium capitalize ${
                          cluster.severity === 'critical' || cluster.severity === 'high'
                            ? 'text-[#B91C1C]'
                            : cluster.severity === 'medium'
                              ? 'text-[#B45309]'
                              : 'text-[#1B6B4A]'
                        }`}
                      >
                        {cluster.severity} severity
                      </span>
                    </div>
                    <p className="text-xs text-[#52605A]">
                      Routed to <strong className="text-[#13201B]">{cluster.routedTo}</strong> ·{' '}
                      {cluster.affectedZones}
                    </p>
                    <p className="text-xs text-[#13201B] leading-relaxed">
                      Action: {cluster.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right: Google Search Grounding Civic Brief */}
        <section className="lg:col-span-5 bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-[#E4E7E2]">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#1B6B4A]" />
              <h3 className="text-base font-semibold text-[#13201B]">
                Live Civic &amp; Safety Research
              </h3>
            </div>
            <p className="text-xs text-[#52605A] mt-1 leading-relaxed">
              Grounded with real-time Google Search data for utility guidance, official municipal reporting steps, and household safety protocols.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCivicSearch();
              }}
              className="mt-3 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={civicQuery}
                  onChange={(e) => setCivicQuery(e.target.value)}
                  placeholder="Search utility guidance, 311 steps..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
                />
              </div>
              <VoiceRecorderButton
                compact
                onTranscript={(text) => handleCivicSearch(text)}
                onError={(msg) => setCivicError(msg)}
              />
              <button
                type="submit"
                disabled={civicLoading || !civicQuery.trim()}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#13201B] text-white hover:bg-[#1B6B4A] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[38px]"
              >
                Search
              </button>
            </form>

            <div className="mt-2.5 space-y-1.5">
              {CIVIC_SEARCH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleCivicSearch(preset)}
                  className="w-full text-left px-3 py-1.5 text-[11px] rounded-md bg-[#F8F9F7] border border-[#E4E7E2] text-[#13201B] hover:border-[#1B6B4A]/45 transition-colors truncate"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {civicError && (
            <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-3">
              {civicError}
            </div>
          )}

          {civicLoading && (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#52605A]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B6B4A]" />
              <span>Searching live web sources...</span>
            </div>
          )}

          {civicResult && !civicLoading && (
            <div className="space-y-4">
              <div className="nm-prose text-xs text-[#13201B]">
                <ReactMarkdown>{civicResult.text}</ReactMarkdown>
              </div>

              {civicResult.webSources.length > 0 && (
                <div className="pt-3 border-t border-[#E4E7E2] space-y-1.5">
                  <h4 className="text-xs font-semibold text-[#13201B]">Verified Web Sources</h4>
                  <ul className="space-y-1.5">
                    {civicResult.webSources.map((src, i) => (
                      <li key={`${src.uri}-${i}`}>
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#1B6B4A] hover:underline break-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>{src.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Active Issue & Priority Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#13201B]">
            Active Civic Reports &amp; Urgent Requests ({issues.length})
          </h3>
        </div>
        <div className="space-y-4">
          {issues.map((item) => {
            const dist = computeDistanceKm(center, {
              lat: center.lat + item.offsetLat,
              lng: center.lng + item.offsetLng,
            });
            return (
              <MeshCard
                key={item.id}
                item={item}
                distanceKm={dist}
                onActionTaken={onActionTaken}
                onViewOnMap={onViewOnMap}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

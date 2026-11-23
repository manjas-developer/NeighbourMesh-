import { useState } from 'react';
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { formatDistance, getDistanceKm, getZoneById } from '../data/seedData';
import { requestSmsBridge } from '../services/api';
import type { EmergencyAlert, ResourceListing } from '../types';

interface EmergencyViewProps {
  alerts: EmergencyAlert[];
  listings: ResourceListing[];
  userZoneId: string;
  onVolunteerCheckIn: (alertId: string) => void;
  onOpenThread: (listing: ResourceListing) => void;
}

interface SmsExchange {
  id: string;
  inbound: string;
  parsedIntent: string;
  reply: string;
  matchedZone: string;
  timestamp: string;
}

const SMS_SAMPLES = [
  'NEED POWER OAKRIDGE CPAP',
  'NEED LADDER CEDAR',
  'OFFER O-NEG BLOOD CEDAR',
];

export function EmergencyView({
  alerts,
  listings,
  userZoneId,
  onVolunteerCheckIn,
  onOpenThread,
}: EmergencyViewProps) {
  const [checkedInIds, setCheckedInIds] = useState<string[]>([]);
  const [smsInput, setSmsInput] = useState('NEED POWER OAKRIDGE CPAP');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsHistory, setSmsHistory] = useState<SmsExchange[]>([]);

  const emergencyResources = listings.filter((item) => item.emergencyReady);

  const handleCheckIn = (alertId: string) => {
    if (checkedInIds.includes(alertId)) return;
    setCheckedInIds((prev) => [...prev, alertId]);
    onVolunteerCheckIn(alertId);
  };

  const handleTestSms = async (e: React.FormEvent, overrideText?: string) => {
    e.preventDefault();
    const message = (overrideText ?? smsInput).trim();
    if (!message) return;

    setSmsLoading(true);
    setSmsError(null);

    try {
      const catalog = listings.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        zoneName: getZoneById(item.zoneId).name,
        distanceKm: getDistanceKm(userZoneId, item.zoneId),
        availability: item.availability,
        isHub: Boolean(item.isVerifiedHub),
      }));

      const alertSummaries = alerts.map((a) => ({
        title: a.title,
        zoneName: getZoneById(a.zoneId).name,
        action: a.coordinationHub,
      }));

      const res = await requestSmsBridge({
        message,
        catalog,
        emergencyAlerts: alertSummaries,
      });

      setSmsHistory((prev) => [
        {
          id: `sms-${Date.now()}`,
          inbound: message,
          parsedIntent: res.parsedIntent,
          reply: res.smsReply,
          matchedZone: res.matchedZone,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
      setSmsInput('');
    } catch (err) {
      setSmsError(err instanceof Error ? err.message : 'SMS bridge request failed.');
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* High-clarity Emergency Response Banner */}
      <section className="bg-red-950 text-white rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
            <ShieldAlert className="w-4 h-4" />
            <span>Emergency Response Mode · Ward 4 Rapid Coordination</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Rapid Local Support for Outages, Weather & Medical Needs
          </h1>
          <p className="text-sm text-red-100/90 leading-relaxed">
            Coordinate backup power, verified blood-donor requests, cooling centers, and
            offline-first SMS access for neighbors without reliable mobile data.
          </p>
        </div>
        <div className="border-t md:border-t-0 md:border-l border-red-800/80 pt-4 md:pt-0 md:pl-6 text-xs space-y-1 shrink-0">
          <p className="text-red-200 font-medium">Always call municipal emergency lines first</p>
          <p className="font-mono text-base font-semibold tabular-nums text-white">
            SMS Shortcode: 540-MESH
          </p>
          <p className="text-red-200/80">Works via standard SMS & WhatsApp Bridge</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 cols: Active Alerts + Ready Local Resources */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950">Active Rapid-Coordination Alerts</h2>
            {alerts.map((alert) => {
              const zone = getZoneById(alert.zoneId);
              const isCheckedIn = checkedInIds.includes(alert.id);

              return (
                <article
                  key={alert.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      {alert.type} · {zone.name} · {alert.updatedAt}
                    </span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        alert.severity === 'Urgent' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      {alert.severity}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-950 leading-snug">
                    {alert.title}
                  </h3>

                  <p className="text-sm text-slate-700 leading-relaxed">{alert.summary}</p>

                  <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                    <p>
                      <span className="font-semibold text-slate-900">Coordination Hub:</span>{' '}
                      {alert.coordinationHub}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Priority Needs:</span>{' '}
                      {alert.neededItems.join(' · ')}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      {alert.volunteersCheckedIn} verified neighbors checked in
                    </span>
                    <button
                      type="button"
                      disabled={isCheckedIn}
                      onClick={() => handleCheckIn(alert.id)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        isCheckedIn
                          ? 'bg-[#F4F8F6] text-[#155E4B] border border-[#155E4B]/25'
                          : 'bg-red-700 hover:bg-red-800 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isCheckedIn ? 'Checked In as Volunteer' : 'Check In to Help'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Emergency-Ready Backup Power, Medical & Shelter Resources */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950">
              Nearby Backup Power, Medical Gear & Open Hubs
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {emergencyResources.map((item) => {
                const zone = getZoneById(item.zoneId);
                const dist = getDistanceKm(userZoneId, item.zoneId);
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">
                        {item.category} · {zone.name} ·{' '}
                        <span className="font-mono tabular-nums">{formatDistance(dist)}</span>
                      </p>
                      <h3 className="text-sm font-semibold text-slate-950 flex items-center gap-1.5">
                        {item.isVerifiedHub && (
                          <Building2 className="w-4 h-4 text-[#155E4B] shrink-0" />
                        )}
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600">{item.safeHandoff}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenThread(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#155E4B] border border-[#155E4B]/30 hover:bg-[#155E4B]/5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Coordinate
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Offline-First SMS / WhatsApp Bridge */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#155E4B]">
              <Phone className="w-4 h-4" />
              <span>Offline-First SMS / WhatsApp Bridge</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-950">
              Test Low-Bandwidth Text Coordination
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Residents without smartphones or active mobile data can text simple requests to
              NeighborMesh. Gemini parses the SMS and replies with fuzzy-zone pickup info under 240
              characters.
            </p>
          </div>

          <form onSubmit={handleTestSms} className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {SMS_SAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={(e) => {
                    setSmsInput(sample);
                    handleTestSms(e, sample);
                  }}
                  className="font-mono text-[11px] px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:border-[#155E4B] text-slate-700 cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="Type an SMS (e.g., NEED POWER OAKRIDGE)"
                className="flex-1 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
              />
              <button
                type="submit"
                disabled={smsLoading || !smsInput.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {smsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send SMS
              </button>
            </div>
          </form>

          {smsError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {smsError}
            </div>
          )}

          {/* SMS Transcript */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {smsHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-lg">
                Send a sample SMS above to see how NeighborMesh responds on a basic feature phone.
              </p>
            ) : (
              smsHistory.map((ex) => (
                <div key={ex.id} className="space-y-2 text-xs">
                  <div className="flex justify-end">
                    <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 max-w-[85%] font-mono">
                      <p>{ex.inbound}</p>
                      <p className="text-[10px] text-slate-400 mt-1 text-right">{ex.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-[#F4F8F6] border border-[#155E4B]/25 text-slate-900 rounded-lg px-3.5 py-2.5 max-w-[92%] space-y-1">
                      <p className="text-[11px] font-semibold text-[#155E4B]">
                        NeighborMesh SMS · {ex.parsedIntent} ({ex.matchedZone})
                      </p>
                      <p className="leading-relaxed font-mono text-[11px] text-slate-800">
                        {ex.reply}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

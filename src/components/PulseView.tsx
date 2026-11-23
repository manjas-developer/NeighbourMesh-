import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Languages,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  NEIGHBORHOOD_ZONES,
  SAMPLE_NOISY_CHAT,
  SUPPORTED_LANGUAGES,
  getZoneById,
} from '../data/seedData';
import { requestPulseTriage, requestTranslation } from '../services/api';
import type { CommunityIssue, LanguageOption, TriageApiResponse } from '../types';

interface PulseViewProps {
  issues: CommunityIssue[];
  userZoneId: string;
  onAddTriagedIssues: (newIssues: CommunityIssue[]) => void;
  onAddIssueComment: (issueId: string, text: string, author: string) => void;
}

export function PulseView({
  issues,
  userZoneId,
  onAddTriagedIssues,
  onAddIssueComment,
}: PulseViewProps) {
  const [rawChat, setRawChat] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triagePreview, setTriagePreview] = useState<TriageApiResponse | null>(null);

  const [targetLang, setTargetLang] = useState<LanguageOption>('English');
  const [translations, setTranslations] = useState<
    Record<string, { text: string; detectedLanguage: string }>
  >({});
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [severityFilter, setSeverityFilter] = useState<'All' | 'High' | 'Moderate' | 'Low'>('All');

  const userZone = getZoneById(userZoneId);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setTriageError('Please select an image smaller than 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
        setImageMime(file.type || 'image/jpeg');
        setTriageError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawChat.trim() && !imagePreview) return;

    setTriageLoading(true);
    setTriageError(null);
    setTriagePreview(null);

    try {
      const data = await requestPulseTriage({
        rawChat: rawChat.trim() || undefined,
        zoneName: userZone.name,
        imageBase64: imagePreview || undefined,
        imageMimeType: imageMime || undefined,
      });
      setTriagePreview(data);
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Unable to triage chat messages.');
    } finally {
      setTriageLoading(false);
    }
  };

  const handlePublishTriaged = () => {
    if (!triagePreview || triagePreview.triagedIssues.length === 0) return;

    const created: CommunityIssue[] = triagePreview.triagedIssues.map((item, idx) => {
      const matchedZone =
        NEIGHBORHOOD_ZONES.find((z) =>
          z.name.toLowerCase().includes(item.zoneName.toLowerCase().split(' ')[0])
        ) || userZone;

      return {
        id: `iss-${Date.now()}-${idx}`,
        title: item.title,
        category: item.category,
        severity: item.severity,
        status: 'Coordinator Assigned',
        zoneId: matchedZone.id,
        reportCount: Math.max(1, item.reportCount),
        updatedAt: 'Just now',
        actionableSummary: item.actionableSummary,
        routedCoordinator: item.routedCoordinator,
        recommendedAction: item.recommendedAction,
        messages: [],
      };
    });

    onAddTriagedIssues(created);
    setTriagePreview(null);
    setRawChat('');
    setImagePreview(null);
    setImageMime(null);
  };

  const handleTranslateMessage = async (msgId: string, text: string) => {
    setTranslatingKey(msgId);
    try {
      const res = await requestTranslation({ text, targetLanguage: targetLang });
      setTranslations((prev) => ({
        ...prev,
        [msgId]: { text: res.translatedText, detectedLanguage: res.detectedLanguage },
      }));
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslatingKey(null);
    }
  };

  const filteredIssues = issues.filter(
    (issue) => severityFilter === 'All' || issue.severity === severityFilter
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#155E4B]">
            Community Pulse & Automated Issue Triage
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Neighborhood Issues & Coordinator Routing
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Recurring reports across multilingual chats are deduplicated into clear summaries and
            routed directly to local coordinators. Translate any neighbor update inline below.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Languages className="w-4 h-4 text-slate-500" />
          <label htmlFor="pulse-lang" className="text-xs text-slate-600 whitespace-nowrap">
            Thread language:
          </label>
          <select
            id="pulse-lang"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as LanguageOption)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-[#155E4B]"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main 7 cols: Active Triaged Issues */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter issues by severity"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(['All', 'High', 'Moderate', 'Low'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  role="tab"
                  aria-selected={severityFilter === sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    severityFilter === sev
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {sev === 'All' ? `All (${issues.length})` : `${sev} Priority`}
                </button>
              ))}
            </div>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
              No neighborhood issues match this priority filter right now.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredIssues.map((issue) => {
                const zone = getZoneById(issue.zoneId);
                const severityColor =
                  issue.severity === 'High'
                    ? 'text-red-700'
                    : issue.severity === 'Moderate'
                      ? 'text-amber-700'
                      : 'text-slate-600';

                return (
                  <article
                    key={issue.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">
                          {issue.category} · {zone.name} ·{' '}
                          <span className="font-mono tabular-nums">
                            {issue.reportCount} {issue.reportCount === 1 ? 'report' : 'reports'}
                          </span>{' '}
                          · {issue.updatedAt}
                        </span>
                        <span className={`font-semibold inline-flex items-center gap-1 ${severityColor}`}>
                          {issue.severity === 'High' ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {issue.severity} Priority · {issue.status}
                        </span>
                      </div>

                      <h2 className="text-lg font-semibold text-slate-950 leading-snug">
                        {issue.title}
                      </h2>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">
                      {issue.actionableSummary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <p className="text-slate-500 font-medium">Routed Coordinator</p>
                        <p className="text-slate-900 font-semibold mt-0.5">
                          {issue.routedCoordinator}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Recommended Resident Action</p>
                        <p className="text-slate-800 mt-0.5">{issue.recommendedAction}</p>
                      </div>
                    </div>

                    {/* Multilingual resident thread */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      {issue.messages.map((msg) => {
                        const translated = translations[msg.id];
                        const isTranslating = translatingKey === msg.id;

                        return (
                          <div
                            key={msg.id}
                            className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-slate-900">
                                {msg.author}{' '}
                                <span className="font-normal text-slate-500">
                                  · {msg.zoneName}
                                </span>
                              </span>
                              <span className="font-mono tabular-nums">{msg.timestamp}</span>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed">{msg.text}</p>
                            {translated && (
                              <div className="pt-1.5 border-t border-slate-200 text-sm text-[#155E4B]">
                                <span className="text-[11px] text-slate-500 block">
                                  Translated from {translated.detectedLanguage} to {targetLang}
                                </span>
                                {translated.text}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <span className="text-slate-400">
                                {msg.originalLanguage || 'Resident update'}
                              </span>
                              <button
                                type="button"
                                disabled={isTranslating}
                                onClick={() => handleTranslateMessage(msg.id, msg.text)}
                                className="font-medium text-[#155E4B] hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {isTranslating ? 'Translating...' : `Translate to ${targetLang}`}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Inline reply input */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const draft = (replyDrafts[issue.id] || '').trim();
                          if (!draft) return;
                          onAddIssueComment(issue.id, draft, 'You (Neighbor)');
                          setReplyDrafts((prev) => ({ ...prev, [issue.id]: '' }));
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={replyDrafts[issue.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [issue.id]: e.target.value }))
                          }
                          placeholder="Add an update in any language..."
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
                        />
                        <button
                          type="submit"
                          disabled={!(replyDrafts[issue.id] || '').trim()}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Post Update
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 cols: Raw Chat & Photo Triage Workbench */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-950">
              Triage Noisy Group Chat or Photo
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Paste raw multilingual messaging threads or upload a photo of a local issue. Gemini
              filters spam, groups duplicate reports, and routes each issue to the right ward
              coordinator.
            </p>
          </div>

          <form onSubmit={handleRunTriage} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="noisy-chat-input" className="text-xs font-semibold text-slate-800">
                  Raw Neighborhood Messages
                </label>
                <button
                  type="button"
                  onClick={() => setRawChat(SAMPLE_NOISY_CHAT)}
                  className="text-xs font-medium text-[#155E4B] hover:underline cursor-pointer"
                >
                  Load multilingual sample chat
                </button>
              </div>
              <textarea
                id="noisy-chat-input"
                rows={6}
                value={rawChat}
                onChange={(e) => setRawChat(e.target.value)}
                placeholder="Paste chat messages in English, Spanish, Hindi, Mandarin, etc..."
                className="w-full text-xs leading-relaxed border border-slate-200 rounded-lg p-3 bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
              />
            </div>

            {/* Optional photo upload (Multimodal Vision) */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-800">
                Optional Issue Photo (Multimodal Vision)
              </span>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-[#155E4B] hover:text-[#155E4B] transition-colors cursor-pointer bg-slate-50/50">
                <Camera className="w-4 h-4" />
                <span>{imagePreview ? 'Replace attached photo' : 'Upload photo of streetlight, leak, or hazard'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
              {imagePreview && (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-40">
                  <img
                    src={imagePreview}
                    alt="Uploaded neighborhood issue preview"
                    className="w-full h-36 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageMime(null);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 text-xs font-medium bg-slate-950/75 text-white rounded-md cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {triageError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {triageError}
              </div>
            )}

            <button
              type="submit"
              disabled={triageLoading || (!rawChat.trim() && !imagePreview)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {triageLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Summarizing & Routing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Triage & Route Issues
                </>
              )}
            </button>
          </form>

          {/* Triage Preview */}
          {triagePreview && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#155E4B]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{triagePreview.summaryHeadline}</span>
                </div>
                {triagePreview.filteredSpamCount > 0 && (
                  <span className="font-mono tabular-nums text-slate-500 shrink-0">
                    {triagePreview.filteredSpamCount} spam filtered
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {triagePreview.triagedIssues.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 text-xs"
                  >
                    <p className="text-slate-500">
                      {item.category} · {item.zoneName} · {item.severity} Priority ·{' '}
                      <span className="font-mono tabular-nums">{item.reportCount} reports</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="text-slate-700 leading-relaxed">{item.actionableSummary}</p>
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-800">Route to:</span>{' '}
                      {item.routedCoordinator}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePublishTriaged}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Publish {triagePreview.triagedIssues.length} Triaged{' '}
                {triagePreview.triagedIssues.length === 1 ? 'Issue' : 'Issues'} to Pulse
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

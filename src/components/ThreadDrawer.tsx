import { useState } from 'react';
import { Languages, Send, ShieldCheck, X } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  formatDistance,
  getDistanceKm,
  getZoneById,
} from '../data/seedData';
import { requestTranslation } from '../services/api';
import type { LanguageOption, ResourceListing } from '../types';

interface ThreadDrawerProps {
  listing: ResourceListing | null;
  userZoneId: string;
  onClose: () => void;
  onSendMessage: (listingId: string, text: string, authorName: string) => void;
}

export function ThreadDrawer({
  listing,
  userZoneId,
  onClose,
  onSendMessage,
}: ThreadDrawerProps) {
  const [replyText, setReplyText] = useState('');
  const [senderName, setSenderName] = useState('You (Neighbor)');
  const [targetLang, setTargetLang] = useState<LanguageOption>('English');
  const [translations, setTranslations] = useState<
    Record<string, { text: string; detectedLanguage: string; targetLanguage: string }>
  >({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [handoffConfirmed, setHandoffConfirmed] = useState(false);

  if (!listing) return null;

  const zone = getZoneById(listing.zoneId);
  const distKm = getDistanceKm(userZoneId, listing.zoneId);

  const handleTranslate = async (messageId: string, originalText: string) => {
    setTranslatingId(messageId);
    setTranslateError(null);
    try {
      const res = await requestTranslation({
        text: originalText,
        targetLanguage: targetLang,
      });
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          text: res.translatedText,
          detectedLanguage: res.detectedLanguage,
          targetLanguage: targetLang,
        },
      }));
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslatingId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSendMessage(listing.id, replyText.trim(), senderName.trim() || 'Neighbor');
    setReplyText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thread-drawer-title"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {listing.category} · {zone.name} · {formatDistance(distKm)}
            </p>
            <h2
              id="thread-drawer-title"
              className="text-lg font-semibold text-slate-950 mt-1"
            >
              {listing.title}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Shared by {listing.ownerName}
              {listing.ownerRole ? ` · ${listing.ownerRole}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close thread"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Resource details & safe handoff protocol */}
          <div className="space-y-3 pb-5 border-b border-slate-200">
            <p className="text-sm text-slate-700 leading-relaxed">{listing.description}</p>
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <span className="font-semibold text-slate-800">Availability:</span>{' '}
                {listing.availability}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Nearby Hub Landmark:</span>{' '}
                {zone.hubLandmark}
              </p>
            </div>

            <div className="mt-3 p-4 rounded-lg bg-[#F4F8F6] border border-[#155E4B]/20">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#155E4B] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">Recommended Safe Handoff Protocol</p>
                  <p className="leading-relaxed">{listing.safeHandoff}</p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={handoffConfirmed}
                      onChange={(e) => setHandoffConfirmed(e.target.checked)}
                      className="rounded border-slate-300 text-[#155E4B] focus:ring-[#155E4B]"
                    />
                    <span className="text-slate-800 font-medium">
                      I will coordinate via fuzzy zone / public handoff and confirm return time
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time translation control */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Neighbor Thread ({listing.messages.length})
            </h3>
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-slate-500" />
              <label htmlFor="drawer-lang" className="sr-only">
                Translate messages to
              </label>
              <select
                id="drawer-lang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as LanguageOption)}
                className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-[#155E4B]"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    Translate to {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {translateError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {translateError}
            </div>
          )}

          {/* Messages */}
          <div className="space-y-4">
            {listing.messages.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                No messages yet. Introduce yourself and suggest a pickup window below.
              </p>
            ) : (
              listing.messages.map((msg) => {
                const translated = translations[msg.id];
                const isLoading = translatingId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">
                        {msg.author}{' '}
                        <span className="font-normal text-slate-500">· {msg.zoneName}</span>
                      </span>
                      <span className="font-mono tabular-nums shrink-0">{msg.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{msg.text}</p>

                    {translated && (
                      <div className="pt-2 border-t border-slate-200 text-sm text-[#155E4B] space-y-1">
                        <p className="text-[11px] font-medium text-slate-500">
                          Translated from {translated.detectedLanguage} to {translated.targetLanguage}
                        </p>
                        <p className="leading-relaxed">{translated.text}</p>
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {msg.originalLanguage ? `Written in ${msg.originalLanguage}` : 'Community reply'}
                      </span>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleTranslate(msg.id, msg.text)}
                        className="text-xs font-medium text-[#155E4B] hover:underline disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {isLoading ? 'Translating...' : `Translate to ${targetLang}`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Compose reply */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-t border-slate-200 bg-white space-y-3"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="sender-name" className="text-xs text-slate-500 shrink-0">
              Your name:
            </label>
            <input
              id="sender-name"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#155E4B]"
              placeholder="First name"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write in any language (e.g., Could I borrow this around 6 PM?)"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#155E4B] hover:bg-[#0F4C3C] disabled:opacity-40 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

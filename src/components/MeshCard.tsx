import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Languages,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/initialNeighborhood';
import { translateText } from '../services/api';
import { MeshItem } from '../types/mesh';
import { ResilientImage } from './ResilientImage';

interface MeshCardProps {
  item: MeshItem;
  distanceKm: number;
  highlightMatch?: {
    confidence: number;
    whyItMatches: string;
    suggestedHandoffMessage: string;
  };
  onRunMatchForNeed?: (item: MeshItem) => void;
  onActionTaken: (itemId: string, actionLabel: string) => void;
  onViewOnMap?: (item: MeshItem) => void;
  isHighlighted?: boolean;
}

export const MeshCard: React.FC<MeshCardProps> = ({
  item,
  distanceKm,
  highlightMatch,
  onRunMatchForNeed,
  onActionTaken,
  onViewOnMap,
  isHighlighted = false,
}) => {
  const [showSafety, setShowSafety] = useState(false);
  const [targetLang, setTargetLang] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<{
    lang: string;
    title: string;
    description: string;
  } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectNote, setConnectNote] = useState(
    highlightMatch?.suggestedHandoffMessage ||
      `Hi ${item.authorName.split(' ')[0]}, I'm nearby in the neighborhood and would love to coordinate.`
  );
  const [actionDone, setActionDone] = useState(false);

  const handleTranslate = async (lang: string) => {
    setTargetLang(lang);
    if (!lang) {
      setTranslated(null);
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    try {
      const combined = `${item.title}\n---\n${item.description}`;
      const { translatedText } = await translateText(combined, lang);
      const [tTitle, ...rest] = translatedText.split(/\n---+\n/);
      setTranslated({
        lang,
        title: tTitle?.trim() || item.title,
        description: rest.join('\n').trim() || translatedText,
      });
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const typeText =
    item.type === 'offer'
      ? item.kind === 'skill'
        ? 'Skill Offer'
        : 'Shared Tool'
      : item.type === 'need'
        ? 'Neighbor Need'
        : 'Civic Report';

  const urgencyColor =
    item.urgency === 'critical'
      ? 'text-[#B91C1C] font-semibold'
      : item.urgency === 'high'
        ? 'text-[#B91C1C] font-medium'
        : item.urgency === 'medium'
          ? 'text-[#B45309] font-medium'
          : 'text-[#52605A]';

  const displayTitle = translated ? translated.title : item.title;
  const displayDesc = translated ? translated.description : item.description;

  return (
    <article
      className={`bg-white rounded-xl border transition-colors overflow-hidden ${
        isHighlighted || highlightMatch
          ? 'border-[#1B6B4A] ring-1 ring-[#1B6B4A]/20'
          : 'border-[#E4E7E2] hover:border-[#C5CFC2]'
      }`}
    >
      {/* Semantic Match Rationale Banner (only shown when matched) */}
      {highlightMatch && (
        <div className="px-5 py-2.5 bg-[#1B6B4A]/8 border-b border-[#1B6B4A]/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#13201B]">
            <strong className="font-semibold text-[#1B6B4A]">Semantic Match:</strong>{' '}
            {highlightMatch.whyItMatches}
          </span>
          <span className="font-mono tabular-nums text-[#1B6B4A] font-semibold whitespace-nowrap">
            {Math.round(highlightMatch.confidence * 100)}% relevance
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          {item.imageUrl && (
            <div className="sm:w-44 shrink-0 rounded-lg overflow-hidden border border-[#E4E7E2] bg-[#EEF1EC]">
              <ResilientImage
                src={item.imageUrl}
                alt={item.imageAlt || item.title}
                className="w-full h-40 sm:h-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              {/* Quiet unboxed metadata line */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#52605A]">
                <span className="font-medium text-[#13201B]">{typeText}</span>
                <span aria-hidden="true">·</span>
                <span>{item.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{distanceKm.toFixed(2)} km</span>
                <span aria-hidden="true">·</span>
                <span>{item.createdAtLabel}</span>
                {(item.urgency === 'high' || item.urgency === 'critical') && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={urgencyColor}>
                      {item.urgency === 'critical' ? 'Critical Priority' : 'High Urgency'}
                    </span>
                  </>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-[#13201B] mt-1.5 leading-snug">
                {displayTitle}
              </h3>

              <p className="text-sm text-[#52605A] mt-2 leading-relaxed">
                {displayDesc}
              </p>

              {translated && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#1B6B4A]">
                  <span>
                    Translated to {translated.lang} from {item.originalLanguage}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTranslated(null);
                      setTargetLang('');
                    }}
                    className="underline hover:text-[#145339]"
                  >
                    Show original
                  </button>
                </div>
              )}

              {translateError && (
                <p className="mt-2 text-xs text-[#B91C1C]">{translateError}</p>
              )}

              {/* Author & Fuzzy Zone line */}
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#52605A]">
                <span>
                  <strong className="font-medium text-[#13201B]">{item.authorName}</strong>{' '}
                  ({item.authorRole})
                </span>
                <span aria-hidden="true">·</span>
                <span>{item.zoneLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{item.availability}</span>
              </div>
            </div>

            {/* Action toolbar */}
            <div className="mt-4 pt-3.5 border-t border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.type === 'need' && onRunMatchForNeed && (
                  <button
                    type="button"
                    onClick={() => onRunMatchForNeed(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] transition-colors whitespace-nowrap min-h-[36px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Find Nearby Matches</span>
                  </button>
                )}

                {item.type === 'offer' && (
                  <button
                    type="button"
                    onClick={() => setShowConnectForm((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] ${
                      actionDone
                        ? 'bg-[#EEF1EC] text-[#1B6B4A]'
                        : 'bg-[#1B6B4A] text-white hover:bg-[#145339]'
                    }`}
                  >
                    {actionDone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Handoff Requested</span>
                      </>
                    ) : (
                      <span>Request Borrow / Connect</span>
                    )}
                  </button>
                )}

                {item.type === 'issue' && (
                  <button
                    type="button"
                    disabled={actionDone}
                    onClick={() => {
                      setActionDone(true);
                      onActionTaken(item.id, 'corroborate');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] ${
                      actionDone
                        ? 'bg-[#EEF1EC] text-[#1B6B4A]'
                        : 'border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF]'
                    }`}
                  >
                    {actionDone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Corroborated ({(item.reportsCount ?? 1) + 1})</span>
                      </>
                    ) : (
                      <span>Corroborate ({item.reportsCount ?? 1} reports)</span>
                    )}
                  </button>
                )}

                {onViewOnMap && (
                  <button
                    type="button"
                    onClick={() => onViewOnMap(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#52605A] hover:text-[#13201B] transition-colors whitespace-nowrap"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Zone Map</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSafety((s) => !s)}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#52605A] hover:text-[#13201B] transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1B6B4A]" />
                  <span>Safe Handoff</span>
                  {showSafety ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Real-time Multilingual Translation Control */}
              <div className="flex items-center gap-1.5">
                {translating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
                ) : (
                  <Languages className="w-3.5 h-3.5 text-[#52605A]" />
                )}
                <select
                  aria-label="Translate post language"
                  value={targetLang}
                  onChange={(e) => handleTranslate(e.target.value)}
                  disabled={translating}
                  className="text-xs text-[#52605A] bg-transparent border border-[#E4E7E2] rounded-md px-2 py-1 hover:border-[#C5CFC2] focus:outline-none focus:border-[#1B6B4A]"
                >
                  <option value="">
                    {item.originalLanguage !== 'English'
                      ? `Translate (${item.originalLanguage})`
                      : 'Translate'}
                  </option>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inline Connect / Borrow Handoff Form */}
            {showConnectForm && !actionDone && (
              <div className="mt-3.5 pt-3.5 border-t border-[#E4E7E2] space-y-2.5">
                <label className="block text-xs font-medium text-[#13201B]">
                  Send a safe-handoff message to {item.authorName}
                </label>
                <textarea
                  rows={2}
                  value={connectNote}
                  onChange={(e) => setConnectNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectForm(false)}
                    className="px-3 py-1.5 text-xs text-[#52605A] hover:text-[#13201B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionDone(true);
                      setShowConnectForm(false);
                      onActionTaken(item.id, 'connect');
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] whitespace-nowrap"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Safe Handoff Protocol */}
            {showSafety && (
              <div className="mt-3.5 pt-3.5 border-t border-[#E4E7E2] text-xs space-y-2">
                <p className="text-[#52605A]">
                  <strong className="text-[#13201B]">Verification:</strong> {item.moderationNote}
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[#52605A]">
                  {item.safeHandoffSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

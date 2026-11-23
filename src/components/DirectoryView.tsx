import React, { useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { computeDistanceKm } from '../data/initialNeighborhood';
import { batchOnboard } from '../services/api';
import { BatchOnboardItem, LatLng, MeshItem } from '../types/mesh';
import { MeshCard } from './MeshCard';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface DirectoryViewProps {
  items: MeshItem[];
  center: LatLng;
  onAddItems: (newItems: MeshItem[]) => void;
  onActionTaken: (itemId: string, actionLabel: string) => void;
  onViewOnMap: (item: MeshItem) => void;
}

const SAMPLE_PARAGRAPH =
  'In my garage I have a 25-foot heavy-duty extension cord, two folding camp chairs, and a tire inflator pump neighbors can borrow anytime. On Sunday afternoons I am also happy to help with bicycle flat-tire repairs or resume reviews for college students.';

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  items,
  center,
  onAddItems,
  onActionTaken,
  onViewOnMap,
}) => {
  const [filterKind, setFilterKind] = useState<'all' | 'tool' | 'skill' | 'care'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Zero-friction paragraph onboarding state
  const [paragraph, setParagraph] = useState('');
  const [authorName, setAuthorName] = useState('Jordan Lee');
  const [zoneLabel, setZoneLabel] = useState('North Oak Block (~300m zone)');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<BatchOnboardItem[]>([]);
  const [publishedSuccess, setPublishedSuccess] = useState<string | null>(null);

  const directoryItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (item.type !== 'offer') return false;
      if (filterKind === 'tool' && item.kind !== 'tool') return false;
      if (filterKind === 'skill' && item.kind !== 'skill') return false;
      if (filterKind === 'care' && item.category !== 'Care & Mobility') return false;
      if (q) {
        const hay = `${item.title} ${item.description} ${item.category} ${item.tags.join(' ')}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [items, filterKind, searchQuery]);

  const handleExtract = async () => {
    if (!paragraph.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setPublishedSuccess(null);
    try {
      const { items: parsed } = await batchOnboard({
        paragraph,
        authorName,
        zoneLabel,
      });
      setExtractedItems(parsed || []);
      if (!parsed || parsed.length === 0) {
        setExtractError('No distinct shareable tools or skills were detected. Try adding more detail.');
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Unable to catalog paragraph.');
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmCatalog = () => {
    if (extractedItems.length === 0) return;
    const now = Date.now();
    const converted: MeshItem[] = extractedItems.map((entry, idx) => ({
      id: `onboard-${now}-${idx}`,
      type: 'offer',
      kind: entry.kind,
      title: entry.title,
      description: entry.description,
      category: entry.category,
      urgency: 'low',
      authorName: authorName.trim() || 'Oakwood Resident',
      authorRole: 'Verified Neighbor',
      zoneLabel,
      offsetLat: 0.002 + (idx - 1) * 0.0014,
      offsetLng: -0.002 + (idx % 2 === 0 ? 0.002 : -0.0018),
      radiusMeters: 300,
      availability: entry.availability,
      createdAtLabel: 'Just now',
      originalLanguage: 'English',
      tags: entry.tags,
      safeHandoffSteps: [
        `Coordinate pickup within ${zoneLabel} at a public corner or porch.`,
        'Confirm borrow duration and condition inside the message thread.',
      ],
      moderationNote: 'Auto-cataloged via zero-friction onboarding · Fuzzy zone active',
      responsesCount: 0,
    }));

    onAddItems(converted);
    setPublishedSuccess(
      `Cataloged ${converted.length} ${converted.length === 1 ? 'resource' : 'resources'} into the neighborhood directory.`
    );
    setExtractedItems([]);
    setParagraph('');
  };

  return (
    <div className="space-y-8">
      {/* Zero-Friction Onboarding Section */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-[#E4E7E2]">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-[#13201B]">
              Zero-Friction Skill &amp; Tool Onboarding
            </h2>
            <p className="text-sm text-[#52605A] mt-1 leading-relaxed">
              List multiple household tools or skills in one conversational paragraph—or speak them aloud. Gemini parses, categorizes, and indexes every item without tedious forms.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setParagraph(SAMPLE_PARAGRAPH)}
            className="text-xs font-medium text-[#1B6B4A] hover:underline whitespace-nowrap shrink-0 self-start"
          >
            Fill example paragraph
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-3">
            <textarea
              rows={3}
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value)}
              placeholder='Describe what you can share: e.g., "I have a folding ladder, a multimeter, extra crutches, and I tutor high-school algebra on Thursdays..."'
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <VoiceRecorderButton
                label="Speak Inventory"
                onTranscript={(text) =>
                  setParagraph((prev) => (prev ? `${prev} ${text}` : text))
                }
                onError={(msg) => setExtractError(msg)}
              />
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || !paragraph.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[40px]"
              >
                {extracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{extracting ? 'Extracting Resources...' : 'Extract & Catalog Automatically'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-[#13201B]">Resident Name</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#13201B]">Fuzzy Privacy Zone</span>
              <select
                value={zoneLabel}
                onChange={(e) => setZoneLabel(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
              >
                <option value="North Oak Block (~300m zone)">North Oak Block (~300m zone)</option>
                <option value="Maple Crossing (~280m zone)">Maple Crossing (~280m zone)</option>
                <option value="Cedar Park Sector (~350m zone)">Cedar Park Sector (~350m zone)</option>
                <option value="Library Commons (~260m zone)">Library Commons (~260m zone)</option>
              </select>
            </label>
          </div>
        </div>

        {extractError && (
          <p className="mt-4 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {extractError}
          </p>
        )}

        {publishedSuccess && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[#1B6B4A] bg-[#1B6B4A]/8 border border-[#1B6B4A]/20 rounded-lg px-3.5 py-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{publishedSuccess}</span>
          </div>
        )}

        {/* Preview of Extracted Batch */}
        {extractedItems.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[#E4E7E2] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#13201B]">
                Detected {extractedItems.length} Shareable{' '}
                {extractedItems.length === 1 ? 'Item' : 'Items'}
              </h3>
              <button
                type="button"
                onClick={handleConfirmCatalog}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#13201B] text-white hover:bg-[#1B6B4A] transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add All to Directory</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E4E7E2] text-[#52605A]">
                    <th className="py-2 pr-4 font-medium">Resource</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Category</th>
                    <th className="py-2 font-medium">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7E2]">
                  {extractedItems.map((entry, i) => (
                    <tr key={`${entry.title}-${i}`}>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-[#13201B] block">{entry.title}</span>
                        <span className="text-[#52605A]">{entry.description}</span>
                      </td>
                      <td className="py-2.5 pr-4 capitalize text-[#13201B]">{entry.kind}</td>
                      <td className="py-2.5 pr-4 text-[#52605A]">{entry.category}</td>
                      <td className="py-2.5 text-[#52605A] whitespace-nowrap">{entry.availability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Directory List & Filter Controls */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EEF1EC] rounded-lg self-start">
            {(
              [
                ['all', 'All Shared'],
                ['tool', 'Tools'],
                ['skill', 'Skills'],
                ['care', 'Care & Mobility'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterKind(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterKind === key
                    ? 'bg-white text-[#13201B] shadow-xs'
                    : 'text-[#52605A] hover:text-[#13201B]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-[#52605A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tools, skills, or zones..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] focus:outline-none focus:border-[#1B6B4A]"
            />
          </div>
        </div>

        {directoryItems.length === 0 ? (
          <div className="bg-white border border-[#E4E7E2] rounded-xl p-10 text-center">
            <p className="text-sm font-medium text-[#13201B]">No matching resources in this filter</p>
            <p className="text-xs text-[#52605A] mt-1">
              Clear your search filter or add a new tool/skill using the onboarding box above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {directoryItems.map((item) => {
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
        )}
      </section>
    </div>
  );
};

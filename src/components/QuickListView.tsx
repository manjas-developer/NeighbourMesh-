import { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  NEIGHBORHOOD_ZONES,
  SAMPLE_CONVERSATIONAL_LISTING,
  SAMPLE_SPAM_TEST,
  getZoneById,
} from '../data/seedData';
import { requestListingExtraction } from '../services/api';
import type {
  AppView,
  CommunityIssue,
  ExtractApiResponse,
  ExtractedDraftListing,
  ResourceListing,
} from '../types';

interface QuickListViewProps {
  userZoneId: string;
  onChangeZone: (zoneId: string) => void;
  onPublishListings: (newListings: ResourceListing[]) => void;
  onPublishIssue: (issue: CommunityIssue) => void;
  onNavigate: (view: AppView) => void;
}

export function QuickListView({
  userZoneId,
  onChangeZone,
  onPublishListings,
  onPublishIssue,
  onNavigate,
}: QuickListViewProps) {
  const [paragraph, setParagraph] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractApiResponse | null>(null);
  const [drafts, setDrafts] = useState<ExtractedDraftListing[]>([]);
  const [publishedBanner, setPublishedBanner] = useState<string | null>(null);

  const userZone = getZoneById(userZoneId);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError('Please upload an image under 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
        setImageMime(file.type || 'image/jpeg');
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paragraph.trim() && !imagePreview) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPublishedBanner(null);

    try {
      const data = await requestListingExtraction({
        paragraph: paragraph.trim() || undefined,
        zoneName: userZone.name,
        imageBase64: imagePreview || undefined,
        imageMimeType: imageMime || undefined,
      });
      setResult(data);
      setDrafts(
        (data.extractedListings || []).map((item) => ({
          ...item,
          selected: true,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extract structured listings.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDraft = (index: number) => {
    setDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handlePublishSelected = () => {
    const chosen = drafts.filter((d) => d.selected);
    if (chosen.length === 0) return;

    const newListings: ResourceListing[] = chosen.map((item, idx) => ({
      id: `res-user-${Date.now()}-${idx}`,
      title: item.title,
      category: item.category,
      description: item.description,
      ownerName: item.ownerName || 'Neighbor',
      ownerRole: `Verified ${userZone.name} Resident`,
      zoneId: userZoneId,
      availability: item.availability,
      safeHandoff: item.safeHandoff,
      borrowCount: 0,
      imageUrl: imagePreview && chosen.length === 1 ? imagePreview : undefined,
      messages: [],
    }));

    onPublishListings(newListings);
    setPublishedBanner(
      `Published ${newListings.length} ${newListings.length === 1 ? 'listing' : 'listings'} to ${userZone.name}.`
    );
    setResult(null);
    setDrafts([]);
    setParagraph('');
    setImagePreview(null);
    setImageMime(null);
  };

  const handlePublishDetectedIssue = () => {
    if (!result?.detectedIssue?.present) return;
    const iss = result.detectedIssue;
    const newIssue: CommunityIssue = {
      id: `iss-user-${Date.now()}`,
      title: iss.title,
      category: (iss.category as CommunityIssue['category']) || 'Streets',
      severity: iss.severity || 'Moderate',
      status: 'Coordinator Assigned',
      zoneId: userZoneId,
      reportCount: 1,
      updatedAt: 'Just now',
      actionableSummary: iss.summary,
      routedCoordinator: iss.coordinator,
      recommendedAction: 'Monitor thread for local coordinator updates.',
      messages: [],
    };
    onPublishIssue(newIssue);
    setPublishedBanner(`Routed "${iss.title}" to Community Pulse.`);
    setResult(null);
    setParagraph('');
    setImagePreview(null);
    setImageMime(null);
  };

  const selectedCount = drafts.filter((d) => d.selected).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200 space-y-1.5">
        <p className="text-xs font-medium text-[#155E4B]">
          Zero-Friction Conversational & Photo Onboarding
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          List Multiple Tools or Skills in One Paragraph
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Skip manual forms and tagging. Type a casual note—or snap a photo of a household tool or
          neighborhood issue—and Gemini extracts clean, safety-checked listings ready for your fuzzy
          neighborhood zone.
        </p>
      </div>

      {publishedBanner && (
        <div className="p-4 rounded-xl bg-[#F4F8F6] border border-[#155E4B]/25 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-medium text-[#155E4B]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{publishedBanner}</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onNavigate('directory')}
              className="text-[#155E4B] hover:underline cursor-pointer"
            >
              View in Directory
            </button>
            <button
              type="button"
              onClick={() => onNavigate('match')}
              className="text-slate-700 hover:underline cursor-pointer"
            >
              Test in Semantic Matcher
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 6 cols: Input Form */}
        <form
          onSubmit={handleExtract}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="quick-zone" className="text-xs font-semibold text-slate-800">
              Your Fuzzy Neighborhood Zone (exact street address stays private)
            </label>
            <select
              id="quick-zone"
              value={userZoneId}
              onChange={(e) => onChangeZone(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-[#155E4B]"
            >
              {NEIGHBORHOOD_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} (~{z.approxRadiusMeters}m)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="conversational-input" className="text-sm font-semibold text-slate-900">
                Describe what you can share (or report)
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setParagraph(SAMPLE_CONVERSATIONAL_LISTING)}
                  className="font-medium text-[#155E4B] hover:underline cursor-pointer"
                >
                  Try multi-item sample
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setParagraph(SAMPLE_SPAM_TEST)}
                  className="font-medium text-slate-600 hover:text-red-700 hover:underline cursor-pointer"
                >
                  Test spam filter
                </button>
              </div>
            </div>
            <textarea
              id="conversational-input"
              rows={6}
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value)}
              placeholder="Example: Hi neighbors, I'm Anita. I have a wet/dry shop vac, an 8-foot folding table, and I can help with tax forms on Sunday mornings..."
              className="w-full text-sm leading-relaxed border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
            />
          </div>

          {/* Multimodal Photo Upload */}
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              Or snap / upload a photo (Multimodal Vision)
            </span>
            <label className="flex items-center justify-center gap-2.5 px-4 py-4 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-[#155E4B] hover:text-[#155E4B] transition-colors cursor-pointer bg-slate-50/40">
              <Camera className="w-4 h-4" />
              <span>
                {imagePreview
                  ? 'Replace uploaded photo'
                  : 'Upload photo of a tool, appliance, textbook, or street issue'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </label>

            {imagePreview && (
              <div className="relative rounded-lg overflow-hidden border border-slate-200">
                <img
                  src={imagePreview}
                  alt="Uploaded resource preview"
                  className="w-full h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageMime(null);
                  }}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1 text-xs font-medium bg-slate-950/80 text-white rounded-md cursor-pointer"
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!paragraph.trim() && !imagePreview)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Extracting Structured Listings...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Extract & Check Safety
              </>
            )}
          </button>
        </form>

        {/* Right 6 cols: Structured Output & Moderation Preview */}
        <div className="lg:col-span-6 space-y-5">
          {!result && !loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-950">
                What happens when you click Extract
              </h2>
              <ol className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-900">01. Trust & Safety Screening:</span>{' '}
                  Commercial spam, off-topic ads, and unsafe items are automatically filtered out
                  before reaching neighbors.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">02. Automatic Splitting:</span> A
                  single conversational paragraph listing three tools and one skill is separated
                  into four clean, searchable cards.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">03. Safe Handoff Guidance:</span>{' '}
                  Each extracted listing receives a privacy-conscious porch or public-hub handoff
                  protocol tailored to {userZone.name}.
                </li>
              </ol>
            </div>
          )}

          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-20 bg-slate-100 rounded-lg" />
              <div className="h-20 bg-slate-100 rounded-lg" />
            </div>
          )}

          {result && !loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              {/* Moderation verdict */}
              <div
                className={`p-4 rounded-lg border flex items-start gap-3 text-sm ${
                  result.moderation.approved
                    ? 'bg-[#F4F8F6] border-[#155E4B]/20 text-slate-800'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {result.moderation.approved ? (
                  <ShieldCheck className="w-5 h-5 text-[#155E4B] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{result.moderation.statusLabel}</p>
                  <p className="text-xs mt-0.5 leading-relaxed opacity-90">
                    {result.moderation.reason}
                  </p>
                </div>
              </div>

              {/* Extracted Resource Listings */}
              {result.moderation.approved && drafts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-950">
                      Extracted Listings ({drafts.length})
                    </h2>
                    <span className="text-xs text-slate-500">Uncheck any item to skip</span>
                  </div>

                  <div className="space-y-3">
                    {drafts.map((item, idx) => (
                      <label
                        key={`${item.title}-${idx}`}
                        className={`block p-4 rounded-lg border transition-colors cursor-pointer ${
                          item.selected
                            ? 'border-[#155E4B]/40 bg-slate-50/70'
                            : 'border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(item.selected)}
                            onChange={() => toggleDraft(idx)}
                            className="mt-1 rounded border-slate-300 text-[#155E4B] focus:ring-[#155E4B]"
                          />
                          <div className="space-y-1 flex-1">
                            <p className="text-xs text-slate-500">
                              {item.category} · {userZone.name} · {item.ownerName}
                            </p>
                            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {item.description}
                            </p>
                            <p className="text-xs text-slate-500 pt-1">
                              Availability: {item.availability} · Handoff: {item.safeHandoff}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handlePublishSelected}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Publish {selectedCount} {selectedCount === 1 ? 'Listing' : 'Listings'} to
                    Directory
                  </button>
                </div>
              )}

              {/* Detected Issue Report */}
              {result.moderation.approved && result.detectedIssue?.present && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <h2 className="text-base font-semibold text-slate-950">
                    Neighborhood Issue Detected
                  </h2>
                  <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1.5 text-xs">
                    <p className="text-amber-800 font-semibold">
                      {result.detectedIssue.category} · {result.detectedIssue.severity} Priority ·{' '}
                      {userZone.name}
                    </p>
                    <p className="text-sm font-semibold text-slate-950">
                      {result.detectedIssue.title}
                    </p>
                    <p className="text-slate-700 leading-relaxed">{result.detectedIssue.summary}</p>
                    <p className="text-slate-700">
                      <span className="font-semibold">Suggested Coordinator:</span>{' '}
                      {result.detectedIssue.coordinator}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePublishDetectedIssue}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg cursor-pointer"
                  >
                    Route Issue to Community Pulse
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

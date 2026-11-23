import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { structurePost } from '../services/api';
import {
  LatLng,
  LiveLocationState,
  MeshItem,
  RealNearbyPlace,
  StructuredPostDraft,
} from '../types/mesh';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (item: MeshItem, autoMatchQuery?: string) => void;
  center: LatLng;
  areaLabel: string;
  liveLocation: LiveLocationState;
  onEnableLiveLocation: () => void;
  realPlaces: RealNearbyPlace[];
  preselectedPlace?: RealNearbyPlace | null;
}

export const PostComposerModal: React.FC<PostComposerModalProps> = ({
  isOpen,
  onClose,
  onPublish,
  center,
  areaLabel,
  liveLocation,
  onEnableLiveLocation,
  realPlaces,
  preselectedPlace,
}) => {
  const [rawText, setRawText] = useState('');
  const [authorName, setAuthorName] = useState('Jordan Lee');
  const [selectedLocationValue, setSelectedLocationValue] = useState<string>('current-zone');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [photoMime, setPhotoMime] = useState<string | undefined>(undefined);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<StructuredPostDraft | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && preselectedPlace) {
      setSelectedLocationValue(`place:${preselectedPlace.id}`);
    } else if (isOpen && !preselectedPlace) {
      setSelectedLocationValue('current-zone');
    }
  }, [isOpen, preselectedPlace]);

  if (!isOpen) return null;

  const chosenRealPlace =
    selectedLocationValue.startsWith('place:')
      ? realPlaces.find((p) => `place:${p.id}` === selectedLocationValue) ??
        (preselectedPlace && `place:${preselectedPlace.id}` === selectedLocationValue
          ? preselectedPlace
          : null)
      : null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError('Please choose an image smaller than 6 MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setPhotoPreview(dataUrl);
      const commaIdx = dataUrl.indexOf(',');
      setPhotoBase64(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : undefined);
      setPhotoMime(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!rawText.trim() && !photoBase64) {
      setError('Describe your need/offer, record a voice note, or attach a photo first.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const structured = await structurePost({
        text: rawText,
        imageBase64: photoBase64,
        imageMimeType: photoMime,
      });
      setDraft(structured);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze post.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmPublish = () => {
    if (!draft || !draft.approved) return;

    let zoneLabel = `${areaLabel} (~300m fuzzy zone)`;
    let offsetLat = (Math.random() - 0.5) * 0.0024;
    let offsetLng = (Math.random() - 0.5) * 0.0024;
    let radiusMeters = 300;
    const handoffSteps = [...draft.safeHandoffSteps];

    if (chosenRealPlace) {
      zoneLabel = `Near ${chosenRealPlace.name} (${chosenRealPlace.category})`;
      offsetLat = chosenRealPlace.location.lat - center.lat;
      offsetLng = chosenRealPlace.location.lng - center.lng;
      radiusMeters = 250;
      handoffSteps.unshift(
        `Public meetup spot: ${chosenRealPlace.name} (${chosenRealPlace.address}).`
      );
    } else if (liveLocation.coords) {
      zoneLabel = `${areaLabel} · Live GPS Zone (~300m)`;
      offsetLat = liveLocation.coords.lat - center.lat + (Math.random() - 0.5) * 0.0012;
      offsetLng = liveLocation.coords.lng - center.lng + (Math.random() - 0.5) * 0.0012;
      radiusMeters = 300;
    }

    const newItem: MeshItem = {
      id: `mesh-${Date.now()}`,
      type: draft.postType,
      kind:
        draft.postType === 'offer'
          ? draft.category.includes('Skill')
            ? 'skill'
            : 'tool'
          : draft.postType === 'issue'
            ? 'issue'
            : 'request',
      title: draft.title,
      description: draft.cleanedDescription,
      category: draft.category,
      urgency: draft.urgency,
      authorName: authorName.trim() || 'Resident',
      authorRole: liveLocation.isTracking ? 'Verified Live Neighbor' : 'Verified Neighbor',
      zoneLabel,
      offsetLat,
      offsetLng,
      radiusMeters,
      availability: draft.timeWindow,
      createdAtLabel: 'Just now',
      originalLanguage: 'English',
      tags: draft.tags,
      imageUrl: photoPreview || undefined,
      imageAlt: draft.title,
      safeHandoffSteps: handoffSteps,
      moderationNote: draft.moderationNote,
      reportsCount: draft.postType === 'issue' ? 1 : undefined,
      isEmergencyRelevant:
        draft.urgency === 'critical' || draft.category === 'Emergency Aid',
      responsesCount: 0,
    };

    onPublish(
      newItem,
      draft.postType === 'need' ? `${draft.title}. ${draft.cleanedDescription}` : undefined
    );

    setRawText('');
    setPhotoPreview(null);
    setPhotoBase64(undefined);
    setPhotoMime(undefined);
    setDraft(null);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#13201B]/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
    >
      <div className="bg-white border border-[#D4DBD1] rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7E2] flex items-center justify-between gap-4">
          <div>
            <h2 id="composer-title" className="text-lg font-semibold text-[#13201B]">
              Post a Need, Share a Resource, or Report an Issue
            </h2>
            <p className="text-xs text-[#52605A] mt-0.5">
              Anchored to your real neighborhood ({areaLabel}) or a nearby public meetup place—without exposing your street number.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#52605A] hover:text-[#13201B] hover:bg-[#EEF1EC] transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-[#13201B]">Your Name</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
              />
            </label>

            <div className="block">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#13201B]">
                  Live Zone or Safe Meetup Place
                </span>
                {!liveLocation.isTracking && (
                  <button
                    type="button"
                    onClick={onEnableLiveLocation}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Use GPS</span>
                  </button>
                )}
              </div>
              <select
                value={selectedLocationValue}
                onChange={(e) => setSelectedLocationValue(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] focus:bg-white focus:outline-none focus:border-[#1B6B4A]"
              >
                <option value="current-zone">
                  {liveLocation.isTracking
                    ? `${areaLabel} · Live GPS Fuzzy Zone (~300m)`
                    : `${areaLabel} (~300m Fuzzy Zone)`}
                </option>
                {preselectedPlace &&
                  !realPlaces.some((p) => p.id === preselectedPlace.id) && (
                    <option value={`place:${preselectedPlace.id}`}>
                      Meetup: {preselectedPlace.name} ({preselectedPlace.distanceKm.toFixed(1)} km)
                    </option>
                  )}
                {realPlaces.slice(0, 12).map((place) => (
                  <option key={place.id} value={`place:${place.id}`}>
                    Meetup: {place.name} ({place.distanceKm.toFixed(1)} km)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chosenRealPlace && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#1B6B4A]/8 border border-[#1B6B4A]/20 text-xs text-[#13201B]">
              <MapPin className="w-4 h-4 text-[#1B6B4A] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Public Safe Handoff Place:</span>{' '}
                {chosenRealPlace.name} · {chosenRealPlace.address}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-[#13201B]">
                What do you need, offer, or notice nearby?
              </span>
              <div className="flex items-center gap-2">
                <VoiceRecorderButton
                  label="Voice Input"
                  onTranscript={(text) =>
                    setRawText((prev) => (prev ? `${prev} ${text}` : text))
                  }
                  onError={(msg) => setError(msg)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] hover:bg-[#F1F4EF] transition-colors whitespace-nowrap min-h-[40px]"
                >
                  <Camera className="w-3.5 h-3.5 text-[#1B6B4A]" />
                  <span>{photoPreview ? 'Change Photo' : 'Add Photo'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='Example: "Need something tall to change a porch floodlight tonight" or "Sharing my folding hand truck and jumper cables this weekend"'
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A] resize-y"
            />
          </div>

          {photoPreview && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8F9F7] border border-[#E4E7E2]">
              <img
                src={photoPreview}
                alt="Uploaded item preview"
                className="w-16 h-16 rounded-md object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#13201B]">
                  Photo attached for Gemini Multimodal Vision
                </p>
                <p className="text-[11px] text-[#52605A]">
                  The tool, item condition, or neighborhood issue will be identified automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoBase64(undefined);
                  setPhotoMime(undefined);
                }}
                className="text-xs text-[#52605A] hover:text-[#B91C1C] px-2 py-1"
              >
                Remove
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || (!rawText.trim() && !photoBase64)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-[#13201B] text-white hover:bg-[#1B6B4A] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[40px]"
            >
              {analyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {analyzing ? 'Extracting Structure & Checking Safety...' : 'Analyze & Structure Post'}
              </span>
            </button>
          </div>

          {/* Structured Output Preview */}
          {draft && (
            <div className="border-t border-[#E4E7E2] pt-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#52605A]">
                    {draft.postType.toUpperCase()} · {draft.category} · Urgency:{' '}
                    <span className="font-medium text-[#13201B] capitalize">{draft.urgency}</span>
                    {' · '}
                    {draft.timeWindow}
                  </p>
                  <h3 className="text-base font-semibold text-[#13201B] mt-1">{draft.title}</h3>
                </div>
                {draft.approved ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1B6B4A] whitespace-nowrap">
                    <ShieldCheck className="w-4 h-4" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C] whitespace-nowrap">
                    <ShieldAlert className="w-4 h-4" />
                    Flagged
                  </span>
                )}
              </div>

              <p className="text-sm text-[#52605A] leading-relaxed">
                {draft.cleanedDescription}
              </p>

              <p className="text-xs text-[#52605A]">
                <strong className="text-[#13201B]">Trust &amp; Safety Check:</strong>{' '}
                {draft.moderationNote}
              </p>

              {draft.safeHandoffSteps.length > 0 && (
                <div className="bg-[#F8F9F7] border border-[#E4E7E2] rounded-lg p-3.5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#13201B]">
                    Suggested Safe Handoff Protocol
                  </p>
                  <ul className="space-y-1 text-xs text-[#52605A] list-disc pl-4">
                    {draft.safeHandoffSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E4E7E2] bg-[#F8F9F7] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#52605A] hover:text-[#13201B] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmPublish}
            disabled={!draft || !draft.approved}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-45 transition-colors whitespace-nowrap min-h-[40px]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {draft?.postType === 'need'
                ? 'Publish & Find Matches'
                : 'Publish to NeighborMesh'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

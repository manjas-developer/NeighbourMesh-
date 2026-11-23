import { useMemo, useState } from 'react';
import { Building2, MessageSquare, Plus, Search } from 'lucide-react';
import { formatDistance, getDistanceKm, getZoneById } from '../data/seedData';
import type { AppView, ResourceCategory, ResourceListing } from '../types';
import { SafeImage } from './SafeImage';

interface DirectoryViewProps {
  listings: ResourceListing[];
  userZoneId: string;
  onOpenThread: (listing: ResourceListing) => void;
  onNavigate: (view: AppView) => void;
}

const FILTER_OPTIONS: Array<{ id: 'All' | ResourceCategory; label: string }> = [
  { id: 'All', label: 'All Resources' },
  { id: 'Tool', label: 'Tools' },
  { id: 'Medical', label: 'Medical' },
  { id: 'Education', label: 'Tutoring & Books' },
  { id: 'Skill', label: 'Skills' },
  { id: 'Care', label: 'Elder Care' },
  { id: 'Hub', label: 'Community Hubs' },
];

export function DirectoryView({
  listings,
  userZoneId,
  onOpenThread,
  onNavigate,
}: DirectoryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ResourceCategory>('All');
  const [searchText, setSearchText] = useState('');
  const [maxRadius, setMaxRadius] = useState<number>(3.0);

  const userZone = getZoneById(userZoneId);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return listings
      .map((item) => ({
        item,
        distanceKm: getDistanceKm(userZoneId, item.zoneId),
      }))
      .filter(({ item, distanceKm }) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (distanceKm > maxRadius) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.ownerName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [listings, selectedCategory, searchText, maxRadius, userZoneId]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#155E4B]">
            Auto-Cataloged Skills, Tools & Verified Civic Hubs
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Smart Skill & Tool Directory
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Distances are calculated from your fuzzy zone ({userZone.name}). Every item includes a
            recommended peer handoff protocol and live thread translation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('quick-list')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Tools or Skills
        </button>
      </div>

      {/* Interactive Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter resources by category"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = selectedCategory === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Filter by keyword or neighbor..."
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#155E4B]"
            />
          </div>

          <select
            aria-label="Maximum fuzzy zone distance"
            value={maxRadius}
            onChange={(e) => setMaxRadius(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 font-mono tabular-nums focus:outline-none focus:border-[#155E4B]"
          >
            <option value={0.5}>Within 0.5 km</option>
            <option value={1.0}>Within 1.0 km</option>
            <option value={1.5}>Within 1.5 km</option>
            <option value={3.0}>All Ward 4 (3.0 km)</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-slate-500 font-mono tabular-nums">
        {filtered.length} {filtered.length === 1 ? 'listing' : 'listings'} available near{' '}
        {userZone.name}
      </div>

      {/* Directory Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            No matching tools or skills in this view
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Try expanding your fuzzy distance radius or use the Semantic Matcher to describe your
            need in plain language.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchText('');
                setMaxRadius(3.0);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => onNavigate('match')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg cursor-pointer"
            >
              Try Semantic Match
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(({ item, distanceKm }) => {
            const zone = getZoneById(item.zoneId);
            return (
              <article
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  {item.imageUrl && (
                    <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        fallbackLabel={item.title}
                      />
                    </div>
                  )}

                  <div className="p-5 space-y-2.5">
                    {/* Clean unboxed metadata (Zero-Pill Discipline) */}
                    <p className="text-xs text-slate-500">
                      {item.category} · {zone.name} ·{' '}
                      <span className="font-mono tabular-nums">{formatDistance(distanceKm)}</span>
                    </p>

                    <h2 className="text-lg font-semibold text-slate-950 leading-snug">
                      {item.title}
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>

                    <div className="pt-2 space-y-1 text-xs text-slate-600">
                      <p className="flex items-center gap-1.5">
                        {item.isVerifiedHub && (
                          <Building2 className="w-3.5 h-3.5 text-[#155E4B] shrink-0" />
                        )}
                        <span className="font-medium text-slate-800">{item.ownerName}</span>
                        {item.isVerifiedHub && (
                          <span className="text-[#155E4B] font-medium">· Verified Hub</span>
                        )}
                      </p>
                      <p className="text-slate-500">Available: {item.availability}</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {item.borrowCount} loans · {item.messages.length}{' '}
                    {item.messages.length === 1 ? 'note' : 'notes'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenThread(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#155E4B] hover:text-[#0F4C3C] cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Borrow / Connect
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

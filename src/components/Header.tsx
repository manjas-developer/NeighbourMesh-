import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { AppView } from '../types';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  urgentEmergencyCount: number;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'match', label: 'Match' },
  { id: 'directory', label: 'Directory' },
  { id: 'pulse', label: 'Community Pulse' },
  { id: 'quick-list', label: 'Quick List' },
  { id: 'emergency', label: 'Emergency' },
];

export function Header({ activeView, onNavigate, urgentEmergencyCount }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('match')}
          className="text-xl font-bold tracking-tight text-slate-900 hover:text-[#155E4B] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155E4B] rounded"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          NeighborMesh
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const isEmergency = item.id === 'emergency';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155E4B] rounded ${
                  isActive
                    ? isEmergency
                      ? 'text-red-700'
                      : 'text-slate-950'
                    : isEmergency && urgentEmergencyCount > 0
                      ? 'text-red-700/85 hover:text-red-800'
                      : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className={`absolute left-0 right-0 -bottom-[1px] h-[2px] ${
                      isEmergency ? 'bg-red-700' : 'bg-[#155E4B]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('quick-list')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155E4B]"
          >
            Share a Resource
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleSelect('quick-list')}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#155E4B] hover:bg-[#0F4C3C] rounded-lg transition-colors cursor-pointer"
            >
              Share a Resource
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

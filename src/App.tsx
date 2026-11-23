import { useEffect, useState } from 'react';
import {
  INITIAL_EMERGENCY_ALERTS,
  INITIAL_ISSUES,
  INITIAL_LISTINGS,
  getZoneById,
} from './data/seedData';
import type { AppView, CommunityIssue, EmergencyAlert, ResourceListing } from './types';
import { DirectoryView } from './components/DirectoryView';
import { EmergencyView } from './components/EmergencyView';
import { Header } from './components/Header';
import { MatchView } from './components/MatchView';
import { PulseView } from './components/PulseView';
import { QuickListView } from './components/QuickListView';
import { ThreadDrawer } from './components/ThreadDrawer';

const STORAGE_KEYS = {
  listings: 'neighbormesh_listings_v1',
  issues: 'neighbormesh_issues_v1',
  zone: 'neighbormesh_zone_v1',
};

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('match');
  const [userZoneId, setUserZoneId] = useState<string>(() =>
    loadSaved<string>(STORAGE_KEYS.zone, 'oakridge-north')
  );
  const [listings, setListings] = useState<ResourceListing[]>(() =>
    loadSaved<ResourceListing[]>(STORAGE_KEYS.listings, INITIAL_LISTINGS)
  );
  const [issues, setIssues] = useState<CommunityIssue[]>(() =>
    loadSaved<CommunityIssue[]>(STORAGE_KEYS.issues, INITIAL_ISSUES)
  );
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>(
    INITIAL_EMERGENCY_ALERTS
  );
  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.listings, JSON.stringify(listings));
    } catch {
      // Ignore storage quota errors
    }
  }, [listings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(issues));
    } catch {
      // Ignore storage quota errors
    }
  }, [issues]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.zone, JSON.stringify(userZoneId));
    } catch {
      // Ignore storage quota errors
    }
  }, [userZoneId]);

  const activeListing = listings.find((l) => l.id === activeListingId) || null;
  const urgentEmergencyCount = emergencyAlerts.filter((a) => a.severity === 'Urgent').length;

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendListingMessage = (listingId: string, text: string, authorName: string) => {
    const zone = getZoneById(userZoneId);
    setListings((prev) =>
      prev.map((item) => {
        if (item.id !== listingId) return item;
        return {
          ...item,
          messages: [
            ...item.messages,
            {
              id: `msg-${Date.now()}`,
              author: authorName,
              zoneName: zone.name,
              timestamp: 'Just now',
              text,
            },
          ],
        };
      })
    );
  };

  const handlePublishListings = (newListings: ResourceListing[]) => {
    setListings((prev) => [...newListings, ...prev]);
  };

  const handleAddTriagedIssues = (newIssues: CommunityIssue[]) => {
    setIssues((prev) => [...newIssues, ...prev]);
  };

  const handleAddIssueComment = (issueId: string, text: string, author: string) => {
    const zone = getZoneById(userZoneId);
    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id !== issueId) return iss;
        return {
          ...iss,
          updatedAt: 'Just now',
          messages: [
            ...iss.messages,
            {
              id: `im-${Date.now()}`,
              author,
              zoneName: zone.name,
              timestamp: 'Just now',
              text,
            },
          ],
        };
      })
    );
  };

  const handleVolunteerCheckIn = (alertId: string) => {
    setEmergencyAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? { ...alert, volunteersCheckedIn: alert.volunteersCheckedIn + 1 }
          : alert
      )
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <Header
        activeView={activeView}
        onNavigate={handleNavigate}
        urgentEmergencyCount={urgentEmergencyCount}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {activeView === 'match' && (
          <MatchView
            listings={listings}
            issueCount={issues.length}
            userZoneId={userZoneId}
            onChangeZone={setUserZoneId}
            onOpenThread={(listing) => setActiveListingId(listing.id)}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'directory' && (
          <DirectoryView
            listings={listings}
            userZoneId={userZoneId}
            onOpenThread={(listing) => setActiveListingId(listing.id)}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'pulse' && (
          <PulseView
            issues={issues}
            userZoneId={userZoneId}
            onAddTriagedIssues={handleAddTriagedIssues}
            onAddIssueComment={handleAddIssueComment}
          />
        )}

        {activeView === 'quick-list' && (
          <QuickListView
            userZoneId={userZoneId}
            onChangeZone={setUserZoneId}
            onPublishListings={handlePublishListings}
            onPublishIssue={(issue) => handleAddTriagedIssues([issue])}
            onNavigate={handleNavigate}
          />
        )}

        {activeView === 'emergency' && (
          <EmergencyView
            alerts={emergencyAlerts}
            listings={listings}
            userZoneId={userZoneId}
            onVolunteerCheckIn={handleVolunteerCheckIn}
            onOpenThread={(listing) => setActiveListingId(listing.id)}
          />
        )}
      </main>

      {/* Quiet Civic Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              NeighborMesh
            </p>
            <p>
              Hyper-local mutual aid coordination · Fuzzy-zone privacy · Ward 4 Community Network
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('match')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Semantic Match
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('directory')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Directory
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('pulse')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Community Pulse
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('emergency')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Emergency Mode
            </button>
          </div>
        </div>
      </footer>

      {/* Global Peer Thread & Translation Drawer */}
      <ThreadDrawer
        listing={activeListing}
        userZoneId={userZoneId}
        onClose={() => setActiveListingId(null)}
        onSendMessage={handleSendListingMessage}
      />
    </div>
  );
}

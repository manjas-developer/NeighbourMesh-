import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  Users,
  X,
} from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { ChatMessage, ChatMode, LatLng } from '../types/mesh';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface CoordinatorChatProps {
  isOpen: boolean;
  onClose: () => void;
  location: LatLng;
  communityContext: string;
}

const STARTER_PROMPTS: Array<{ label: string; prompt: string; mode: ChatMode }> = [
  {
    label: 'Match a high-reach tool',
    prompt: 'I need something stable to reach a high ceiling fan this evening. Who nearby can help?',
    mode: 'community',
  },
  {
    label: 'Find nearby tool shops',
    prompt: 'What hardware stores or public libraries are open near my neighborhood?',
    mode: 'maps',
  },
  {
    label: 'Water pressure advisory tips',
    prompt: 'What should residents do first during a sudden neighborhood water pressure drop?',
    mode: 'search',
  },
];

export const CoordinatorChat: React.FC<CoordinatorChatProps> = ({
  isOpen,
  onClose,
  location,
  communityContext,
}) => {
  const [mode, setMode] = useState<ChatMode>('community');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      mode: 'community',
      timestamp: 'Now',
      text: 'Hello — I am the **NeighborMesh Coordinator**. Ask me to match a household need with nearby tools and skills, check safe handoff guidelines, or switch to **Maps Grounding** or **Search Grounding** for real nearby places and live civic information.',
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (overrideText?: string, overrideMode?: ChatMode) => {
    const text = (overrideText ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!text || loading) return;

    if (overrideMode) setMode(overrideMode);
    setInput('');
    setError(null);

    const nowLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      mode: activeMode,
      timestamp: nowLabel,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setLoading(true);

    try {
      const result = await sendChatMessage({
        history: messages
          .filter((m) => m.id !== 'welcome-1')
          .map((m) => ({ role: m.role, text: m.text })),
        message: text,
        mode: activeMode,
        location,
        communityContext,
      });

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: result.text || 'I could not generate a response for that query.',
        mode: activeMode,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        mapSources: result.mapSources,
        webSources: result.webSources,
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach NeighborMesh Coordinator.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="NeighborMesh Coordinator Chat"
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[min(640px,calc(100vh-5rem))] bg-white border border-[#D4DBD1] rounded-xl shadow-xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#E4E7E2] bg-[#F8F9F7] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#13201B] truncate">
            NeighborMesh Coordinator
          </h3>
          <p className="text-[11px] text-[#52605A] truncate">
            Multi-turn assistant · Community, Maps &amp; Web Grounding
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[#52605A] hover:text-[#13201B] hover:bg-[#EEF1EC] transition-colors shrink-0"
          aria-label="Close Coordinator Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-2.5 border-b border-[#E4E7E2] bg-white">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#EEF1EC] rounded-lg">
          {(
            [
              ['community', 'Community', Users],
              ['maps', 'Maps Data', MapPin],
              ['search', 'Web Search', Globe],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === key
                  ? 'bg-white text-[#13201B] shadow-xs'
                  : 'text-[#52605A] hover:text-[#13201B]'
              }`}
            >
              <Icon className="w-3 h-3 shrink-0 text-[#1B6B4A]" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8F9F7]/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-[#52605A] mb-1 px-0.5">
              <span>{msg.role === 'user' ? 'You' : 'Coordinator'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {msg.mode === 'maps'
                  ? 'Google Maps'
                  : msg.mode === 'search'
                    ? 'Google Search'
                    : 'Directory'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1B6B4A] text-white'
                  : 'bg-white border border-[#E4E7E2] text-[#13201B]'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="nm-prose">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}

              {/* Mandatory Google Maps Grounding Links */}
              {msg.mapSources && msg.mapSources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#E4E7E2] space-y-1.5">
                  <p className="text-[11px] font-semibold text-[#52605A]">
                    Google Maps Sources
                  </p>
                  {msg.mapSources.map((src, i) => (
                    <div key={`${src.uri}-${i}`} className="text-[11px]">
                      <a
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#1B6B4A] font-medium hover:underline"
                      >
                        <span>{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      {src.reviewSnippets?.[0] && (
                        <p className="text-[#52605A] mt-0.5 line-clamp-2">
                          &ldquo;{src.reviewSnippets[0]}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Google Search Grounding Links */}
              {msg.webSources && msg.webSources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#E4E7E2] space-y-1">
                  <p className="text-[11px] font-semibold text-[#52605A]">
                    Web Sources
                  </p>
                  {msg.webSources.map((src, i) => (
                    <a
                      key={`${src.uri}-${i}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-[#1B6B4A] hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length === 1 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-[11px] font-medium text-[#52605A]">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSend(item.prompt, item.mode)}
                  className="text-left px-3 py-2 text-xs rounded-lg bg-white border border-[#E4E7E2] text-[#13201B] hover:border-[#1B6B4A]/50 hover:bg-[#F1F4EF] transition-colors"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-[11px] text-[#52605A] truncate mt-0.5">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#52605A] px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
            <span>
              {mode === 'maps'
                ? 'Checking Google Maps places...'
                : mode === 'search'
                  ? 'Searching live web sources...'
                  : 'Coordinating neighborhood match...'}
            </span>
          </div>
        )}

        {error && (
          <div className="text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-[#E4E7E2] bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'maps'
              ? 'Ask about nearby hardware stores, clinics...'
              : mode === 'search'
                ? 'Ask for live civic advisories or repair info...'
                : 'Ask Coordinator to match a need or skill...'
          }
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#D4DBD1] bg-[#F8F9F7] text-[#13201B] focus:bg-white focus:outline-none focus:border-[#1B6B4A] min-h-[38px]"
        />
        <VoiceRecorderButton
          compact
          onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
          onError={(msg) => setError(msg)}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-[#1B6B4A] text-white hover:bg-[#145339] disabled:opacity-50 transition-colors min-h-[38px] shrink-0"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};

export const CoordinatorChatLauncher: React.FC<{
  onClick: () => void;
  isOpen: boolean;
}> = ({ onClick, isOpen }) => {
  if (isOpen) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#13201B] text-white text-xs font-medium shadow-lg hover:bg-[#1B6B4A] transition-colors whitespace-nowrap min-h-[44px]"
    >
      <MessageSquare className="w-4 h-4" />
      <span>Ask Coordinator</span>
    </button>
  );
};

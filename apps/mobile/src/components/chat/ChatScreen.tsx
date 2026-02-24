'use client';

import { useRef, useEffect, ComponentPropsWithoutRef } from 'react';
import { Send, Square, ChevronRight, ChevronDown, Clock, ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { useState as useLocalState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToney } from '@/context/ToneyContext';
import DraftCard from './DraftCard';
import DraftFocusArea from './DraftFocusArea';
import DraftWin from './DraftWin';
import SessionNotesView from './SessionNotesView';
import type { RewireCardCategory, SuggestionLength } from '@toney/types';

// Custom markdown components for chat bubble styling
const markdownComponents = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="ml-4 mb-2 last:mb-0 space-y-1 list-disc" {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="ml-4 mb-2 last:mb-0 space-y-1 list-decimal" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm leading-relaxed" {...props} />,
};

// ── Parse [CARD:category]...[/CARD] and [FOCUS]...[/FOCUS] markers from message content ──

interface TextSegment {
  type: 'text';
  content: string;
}

interface CardSegment {
  type: 'card';
  category: RewireCardCategory;
  title: string;
  content: string;
}

interface FocusAreaSegment {
  type: 'focus_area';
  title: string;
  description: string;
}

interface WinSegment {
  type: 'win';
  text: string;
  focusAreaText?: string;
}

type MessageSegment = TextSegment | CardSegment | FocusAreaSegment | WinSegment;

const VALID_CATEGORIES = new Set<RewireCardCategory>(['reframe', 'truth', 'plan', 'practice', 'conversation_kit']);

/** Extract title from bold first line pattern, rest as content/description */
function extractTitleAndBody(body: string): { title: string; rest: string } {
  const lines = body.split('\n');
  if (lines.length === 0) return { title: body, rest: '' };
  const firstLine = lines[0].trim();
  const boldMatch = firstLine.match(/^\*\*(.+?)\*\*$/);
  if (boldMatch) {
    return { title: boldMatch[1], rest: lines.slice(1).join('\n').trim() };
  }
  return {
    title: firstLine.replace(/^\*\*/, '').replace(/\*\*$/, ''),
    rest: lines.slice(1).join('\n').trim(),
  };
}

function parseMessageContent(raw: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  // Combined regex: find the next [CARD:...], [FOCUS], or [WIN]/[WIN:focus=X] marker
  const markerRegex = /\[CARD:(\w+)\]([\s\S]*?)\[\/CARD\]|\[FOCUS\]([\s\S]*?)\[\/FOCUS\]|\[WIN(?::focus=([^\]]*))?\]([\s\S]*?)\[\/WIN\]|\[(REFRAME|TRUTH|PLAN|PRACTICE|CONVERSATION_KIT)\]([\s\S]*?)\[\/\6\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(raw)) !== null) {
    // Text before this marker
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }

    if (match[1] !== undefined) {
      // Card match: match[1] = category, match[2] = body
      const categoryRaw = match[1].toLowerCase() as RewireCardCategory;
      const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'reframe';
      const { title, rest } = extractTitleAndBody(match[2].trim());
      segments.push({ type: 'card', category, title, content: rest });
    } else if (match[3] !== undefined) {
      // Focus area match: match[3] = body
      const { title, rest } = extractTitleAndBody(match[3].trim());
      segments.push({ type: 'focus_area', title, description: rest });
    } else if (match[5] !== undefined) {
      // Win match: match[4] = optional focus area text, match[5] = win text
      segments.push({ type: 'win', text: match[5].trim(), focusAreaText: match[4]?.trim() || undefined });
    } else if (match[6] !== undefined) {
      // Hallucinated card syntax: [REFRAME]...[/REFRAME], [PRACTICE]...[/PRACTICE], etc.
      const categoryMap: Record<string, RewireCardCategory> = {
        reframe: 'reframe', truth: 'truth', plan: 'plan', practice: 'practice', conversation_kit: 'conversation_kit',
      };
      const category = categoryMap[match[6].toLowerCase()] || 'reframe';
      const { title, rest } = extractTitleAndBody(match[7].trim());
      segments.push({ type: 'card', category, title, content: rest });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last marker
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', content: text });
  }

  // If no markers found, return the whole thing as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content: raw });
  }

  return segments;
}

const lengthConfig: Record<SuggestionLength, { label: string; cssVar: string }> = {
  quick: { label: '~3 min', cssVar: '--length-quick' },
  medium: { label: '~8 min', cssVar: '--length-medium' },
  deep: { label: '~12 min', cssVar: '--length-deep' },
  standing: { label: 'Anytime', cssVar: '--length-standing' },
};

const lengthOrder: SuggestionLength[] = ['standing', 'quick', 'medium', 'deep'];

export default function ChatScreen() {
  const {
    messages,
    chatInput,
    setChatInput,
    isTyping,
    handleSendMessage,
    handleSaveCard,
    handleSaveFocusArea,
    handleAutoWin,
    currentSessionId,
    sessionHasCard,
    sessionStatus,
    sessionNotes,
    endSession,
    submitSessionFeedback,
    dismissSessionNotes,
    loadingChat,
    setActiveTab,
    isFirstSession,
    previousSessionMessages,
    previousSessionCollapsed,
    setPreviousSessionCollapsed,
    suggestions,
    seedingInProgress,
    openSession,
    simMode,
    buildApiUrl,
  } = useToney();

  const isSessionEnded = sessionStatus === 'completed' || sessionStatus === 'ending';
  const [generating, setGenerating] = useLocalState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Generate a simulated user message (sim mode only)
  const canGenerate = simMode && !!currentSessionId && !generating && !loadingChat;
  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await fetch(buildApiUrl(`/api/sim/suggest-message`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });
      if (res.ok) {
        const { text } = await res.json();
        if (text) {
          setChatInput(text);
          // Auto-expand textarea after React renders the new value
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.style.height = 'auto';
              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
            }
          });
        }
      }
    } catch (err) {
      console.error('Generate message failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // End Session visibility: always available during an active session.
  // Short sessions (0-2 user messages) are closed cheaply — no LLM calls.
  const showEndSession = sessionStatus === 'active' && messages.length > 0;

  const handleTogglePrevious = () => {
    setPreviousSessionCollapsed(!previousSessionCollapsed);
  };

  // ── Suggestion picker: show when no active session and not loading ──
  const sortedSuggestions = [...suggestions].sort(
    (a, b) => lengthOrder.indexOf(a.length) - lengthOrder.indexOf(b.length)
  );

  // Don't pass previousSessionId when session is already completed — nothing to close
  const previousIdForOpen = sessionStatus === 'completed' ? undefined : (currentSessionId ?? undefined);

  const handleSuggestionTap = (suggestionIndex: number) => {
    const original = suggestions.indexOf(sortedSuggestions[suggestionIndex]);
    openSession(previousIdForOpen, false, original);
  };

  const handleFreeChat = () => {
    openSession(previousIdForOpen, false);
  };

  const showSuggestionPicker = !loadingChat && messages.length === 0
    && previousSessionMessages.length === 0
    && (sessionStatus === 'completed' || sessionStatus === 'active');

  // ── Seeding in progress: show loading screen ──
  if (seedingInProgress) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-default backdrop-blur-lg z-10" style={{ backgroundColor: 'var(--nav-bg)' }}>
          <h1 className="text-lg font-bold text-primary">Chat with Toney</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-8 h-8 border-2 border-accent-subtle rounded-full animate-spin mb-4" style={{ borderTopColor: 'var(--color-accent)' }} />
          <p className="text-base font-medium text-primary mb-1">Getting to know you...</p>
          <p className="text-sm text-muted text-center">Preparing your first coaching sessions</p>
        </div>
      </div>
    );
  }

  // ── Suggestion picker screen ──
  if (showSuggestionPicker && !isTyping) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-default backdrop-blur-lg z-10" style={{ backgroundColor: 'var(--nav-bg)' }}>
          <h1 className="text-lg font-bold text-primary">Chat with Toney</h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 hide-scrollbar">
          {sortedSuggestions.length > 0 ? (
            <>
              {/* Featured suggestion */}
              <button
                onClick={() => handleSuggestionTap(0)}
                className="w-full rounded-2xl p-5 text-left mb-3"
                style={{ background: 'linear-gradient(135deg, var(--featured-from), var(--featured-to))' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Clock className="w-3 h-3" />
                    {lengthConfig[sortedSuggestions[0].length].label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white opacity-60" />
                </div>
                <p dir="auto" className="text-base font-semibold text-white leading-snug mb-1.5">
                  {sortedSuggestions[0].title}
                </p>
                <p dir="auto" className="text-sm text-white/75 leading-relaxed line-clamp-2">
                  {sortedSuggestions[0].teaser}
                </p>
              </button>

              {/* Remaining suggestions */}
              <div className="space-y-2">
                {sortedSuggestions.slice(1).map((s, i) => {
                  const cfg = lengthConfig[s.length];
                  return (
                    <button
                      key={i + 1}
                      onClick={() => handleSuggestionTap(i + 1)}
                      className="w-full bg-card border border-default rounded-xl px-4 py-3.5 text-left hover:border-accent-subtle transition-all flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p dir="auto" className="text-sm font-medium text-primary leading-snug">{s.title}</p>
                        <p dir="auto" className="text-xs text-muted mt-0.5">{s.teaser}</p>
                      </div>
                      <span className="flex-shrink-0 text-[11px] font-semibold" style={{ color: `var(${cfg.cssVar})` }}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Free conversation */}
              <button
                onClick={handleFreeChat}
                className="w-full mt-4 py-3 text-sm font-medium text-accent transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Or just start talking
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-secondary text-sm mb-4">What&apos;s on your mind with money?</p>
              <button
                onClick={handleFreeChat}
                className="bg-btn-primary text-btn-primary-text py-3 px-6 rounded-2xl text-sm font-semibold hover:bg-btn-primary-hover transition-all"
              >
                Start a Session
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header with session control button */}
      <div className="px-4 py-3 border-b border-default backdrop-blur-lg z-10 flex items-center justify-between" style={{ backgroundColor: 'var(--nav-bg)' }}>
        <h1 className="text-lg font-bold text-primary">Chat with Toney</h1>
        {showEndSession && (
          <button
            onClick={endSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-accent bg-accent-light hover:bg-accent-subtle active:scale-95 transition-all"
          >
            <Square className="w-3 h-3" />
            End Session
          </button>
        )}
        {sessionStatus === 'ending' && (
          <span className="text-xs text-muted font-medium">Wrapping up...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 hide-scrollbar">
        {/* Collapsible previous session messages */}
        {previousSessionMessages.length > 0 && (
          <div>
            <button
              onClick={handleTogglePrevious}
              className="flex items-center gap-3 py-2 my-2 w-full"
            >
              <div className="flex-1 h-px bg-default" />
              <span className="text-xs text-muted font-medium whitespace-nowrap flex items-center gap-1">
                {previousSessionCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Previous session
              </span>
              <div className="flex-1 h-px bg-default" />
            </button>

            {!previousSessionCollapsed && (
              <div className="space-y-4 opacity-50">
                {previousSessionMessages.map((msg) => (
                  <div key={msg.id}>
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="w-10/12">
                        {msg.role === 'user' ? (
                          <div dir="auto" className="p-4 rounded-2xl text-sm leading-relaxed rounded-br-md whitespace-pre-line" style={{ backgroundColor: 'var(--chat-user-bg)', color: 'var(--chat-user-text)' }}>
                            {msg.content}
                          </div>
                        ) : (
                          <div dir="auto" className="p-4 rounded-2xl text-sm leading-relaxed rounded-bl-md" style={{ backgroundColor: 'var(--chat-coach-bg)', color: 'var(--chat-coach-text)' }}>
                            <ReactMarkdown components={markdownComponents}>
                              {msg.content.replace(/\[CARD:\w+\]([\s\S]*?)\[\/CARD\]/g, '$1').replace(/\[FOCUS\]([\s\S]*?)\[\/FOCUS\]/g, '$1').replace(/\[WIN(?::focus=[^\]]*?)?\]([\s\S]*?)\[\/WIN\]/g, '$1').replace(/\[(REFRAME|TRUTH|PLAN|PRACTICE|CONVERSATION_KIT)\]([\s\S]*?)\[\/\1\]/gi, '$2').replace(/\s*\[LANG:[a-z]{2,5}\]\s*$/, '')}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading state — Toney is preparing the session */}
        {messages.length === 0 && previousSessionMessages.length === 0 && (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '300ms' }} />
                </div>
              </div>
              <p className="text-sm text-muted">Toney is preparing your session...</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'divider' ? (
              /* ── Session divider ── */
              <div className="flex items-center gap-3 py-2 my-2">
                <div className="flex-1 h-px bg-default" />
                <span className="text-xs text-muted font-medium whitespace-nowrap">
                  Session ended — {msg.content}
                </span>
                <div className="flex-1 h-px bg-default" />
              </div>
            ) : (
              <>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="w-10/12">
                    {msg.role === 'user' ? (
                      <div dir="auto" className="p-4 rounded-2xl text-sm leading-relaxed rounded-br-md whitespace-pre-line" style={{ backgroundColor: 'var(--chat-user-bg)', color: 'var(--chat-user-text)' }}>
                        {msg.content}
                      </div>
                    ) : (
                      <>
                        {parseMessageContent(msg.content).map((segment, i) => {
                          if (segment.type === 'card') {
                            return (
                              <DraftCard
                                key={`${msg.id}-card-${i}`}
                                category={segment.category}
                                initialTitle={segment.title}
                                initialContent={segment.content}
                                onSave={(title, content, category) => handleSaveCard(title, content, category)}
                              />
                            );
                          }
                          if (segment.type === 'focus_area') {
                            return (
                              <DraftFocusArea
                                key={`${msg.id}-focus-${i}`}
                                initialTitle={segment.title}
                                initialDescription={segment.description}
                                onSave={(text) => handleSaveFocusArea(text, currentSessionId)}
                              />
                            );
                          }
                          if (segment.type === 'win') {
                            return (
                              <DraftWin
                                key={`${msg.id}-win-${i}`}
                                text={segment.text}
                                onAutoSave={(text) => handleAutoWin(text, segment.focusAreaText)}
                              />
                            );
                          }
                          return (
                            <div
                              key={`${msg.id}-text-${i}`}
                              dir="auto"
                              className="p-4 rounded-2xl text-sm leading-relaxed rounded-bl-md"
                              style={{ backgroundColor: 'var(--chat-coach-bg)', color: 'var(--chat-coach-text)' }}
                            >
                              <ReactMarkdown components={markdownComponents}>
                                {segment.content.replace(/\s*\[LANG:[a-z]{2,5}\]\s*$/, '')}
                              </ReactMarkdown>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {msg.role === 'assistant' && msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 ml-1">
                    {msg.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(reply)}
                        className="text-xs px-3 py-2 rounded-full transition-all active:scale-95"
                        style={{ backgroundColor: 'var(--chip-bg)', color: 'var(--chip-text)', border: '1px solid var(--chip-border)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chip-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--chip-bg)'; }}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {(isTyping || (loadingChat && messages.length > 0)) && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'var(--chat-coach-bg)' }}>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--loading-dot)', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input or post-session footer */}
      {!isSessionEnded ? (
        <div className="flex-shrink-0 px-4 py-3 border-t border-default bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-input rounded-2xl px-4 py-3">
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  // Auto-expand: reset height, then set to scrollHeight
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                    // Reset height after send
                    if (inputRef.current) {
                      inputRef.current.style.height = 'auto';
                    }
                  }
                }}
                placeholder="What's on your mind?"
                rows={1}
                className="w-full bg-transparent text-sm text-primary placeholder-muted resize-none outline-none"
                style={{ height: 20, maxHeight: 120 }}
              />
            </div>
            {simMode && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={canGenerate ? "Generate user message" : "Waiting for session..."}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  generating
                    ? 'bg-amber-100 text-amber-400 animate-pulse'
                    : !canGenerate
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-amber-50 text-amber-500 hover:bg-amber-100 active:scale-95'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleSendMessage()}
              disabled={!chatInput.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                chatInput.trim()
                  ? 'bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover active:scale-95'
                  : 'bg-btn-disabled text-btn-disabled-text'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-4 py-3 border-t border-default bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-center">
            <button
              onClick={() => setActiveTab('home')}
              className="text-sm text-muted hover:text-secondary transition-all"
            >
              Home
            </button>
          </div>
        </div>
      )}

      {/* Session notes overlay */}
      {sessionNotes && (
        <SessionNotesView notes={sessionNotes} onDismiss={dismissSessionNotes} onSubmitFeedback={submitSessionFeedback} />
      )}
    </div>
  );
}

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
  // Combined regex: find the next [CARD:...] or [FOCUS] marker
  const markerRegex = /\[CARD:(\w+)\]([\s\S]*?)\[\/CARD\]|\[FOCUS\]([\s\S]*?)\[\/FOCUS\]|\[WIN\]([\s\S]*?)\[\/WIN\]/g;
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
    } else if (match[4] !== undefined) {
      // Win match: match[4] = win text
      segments.push({ type: 'win', text: match[4].trim() });
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

const lengthConfig: Record<SuggestionLength, { label: string; color: string }> = {
  quick: { label: '~3 min', color: 'text-emerald-600' },
  medium: { label: '~8 min', color: 'text-blue-600' },
  deep: { label: '~12 min', color: 'text-purple-600' },
  standing: { label: 'Anytime', color: 'text-amber-600' },
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
    dismissSessionNotes,
    loadingChat,
    setActiveTab,
    isFirstSession,
    previousSessionMessages,
    previousSessionCollapsed,
    setPreviousSessionCollapsed,
    suggestions,
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

  // End Session visibility: card saved OR 20+ messages, never on first session unless card saved
  const nonDividerCount = messages.filter(m => m.role !== 'divider').length;
  const showEndSession = sessionStatus === 'active' && (
    sessionHasCard || (!isFirstSession && nonDividerCount >= 20)
  );

  const handleTogglePrevious = () => {
    setPreviousSessionCollapsed(!previousSessionCollapsed);
  };

  // ── Suggestion picker: show when no active session and not loading ──
  const sortedSuggestions = [...suggestions].sort(
    (a, b) => lengthOrder.indexOf(a.length) - lengthOrder.indexOf(b.length)
  );

  const handleSuggestionTap = (suggestionIndex: number) => {
    const original = suggestions.indexOf(sortedSuggestions[suggestionIndex]);
    openSession(currentSessionId ?? undefined, false, original);
  };

  const handleFreeChat = () => {
    openSession(currentSessionId ?? undefined, false);
  };

  const showSuggestionPicker = !loadingChat && messages.length === 0
    && previousSessionMessages.length === 0
    && (sessionStatus === 'completed' || sessionStatus === 'active');

  // ── Suggestion picker screen ──
  if (showSuggestionPicker && !isTyping) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg z-10">
          <h1 className="text-lg font-bold text-gray-900">Chat with Toney</h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 hide-scrollbar">
          {sortedSuggestions.length > 0 ? (
            <>
              {/* Featured suggestion */}
              <button
                onClick={() => handleSuggestionTap(0)}
                className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-left mb-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/20 text-white">
                    <Clock className="w-3 h-3" />
                    {lengthConfig[sortedSuggestions[0].length].label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white/60" />
                </div>
                <p className="text-base font-semibold text-white leading-snug mb-1.5">
                  {sortedSuggestions[0].title}
                </p>
                <p className="text-sm text-white/75 leading-relaxed line-clamp-2">
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
                      className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3.5 text-left hover:border-indigo-200 transition-all flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.teaser}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[11px] font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Free conversation */}
              <button
                onClick={handleFreeChat}
                className="w-full mt-4 py-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Or just start talking
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-500 text-sm mb-4">What&apos;s on your mind with money?</p>
              <button
                onClick={handleFreeChat}
                className="bg-indigo-600 text-white py-3 px-6 rounded-2xl text-sm font-semibold hover:bg-indigo-700 transition-all"
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
      <div className="px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg z-10 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Chat with Toney</h1>
        {showEndSession && (
          <button
            onClick={endSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all"
          >
            <Square className="w-3 h-3" />
            End Session
          </button>
        )}
        {sessionStatus === 'ending' && (
          <span className="text-xs text-gray-400 font-medium">Wrapping up...</span>
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
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap flex items-center gap-1">
                {previousSessionCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Previous session
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </button>

            {!previousSessionCollapsed && (
              <div className="space-y-4 opacity-50">
                {previousSessionMessages.map((msg) => (
                  <div key={msg.id}>
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="w-10/12">
                        {msg.role === 'user' ? (
                          <div className="p-4 rounded-2xl text-sm leading-relaxed bg-indigo-600 text-white rounded-br-md whitespace-pre-line">
                            {msg.content}
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl text-sm leading-relaxed bg-gray-100 text-gray-900 rounded-bl-md">
                            <ReactMarkdown components={markdownComponents}>
                              {msg.content.replace(/\[CARD:\w+\]([\s\S]*?)\[\/CARD\]/g, '$1').replace(/\[FOCUS\]([\s\S]*?)\[\/FOCUS\]/g, '$1').replace(/\[WIN\]([\s\S]*?)\[\/WIN\]/g, '$1')}
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
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <p className="text-sm text-gray-400">Toney is preparing your session...</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'divider' ? (
              /* ── Session divider ── */
              <div className="flex items-center gap-3 py-2 my-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                  Session ended — {msg.content}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            ) : (
              <>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="w-10/12">
                    {msg.role === 'user' ? (
                      <div className="p-4 rounded-2xl text-sm leading-relaxed bg-indigo-600 text-white rounded-br-md whitespace-pre-line">
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
                                onAutoSave={(text) => handleAutoWin(text)}
                              />
                            );
                          }
                          return (
                            <div
                              key={`${msg.id}-text-${i}`}
                              className="p-4 rounded-2xl text-sm leading-relaxed bg-gray-100 text-gray-900 rounded-bl-md"
                            >
                              <ReactMarkdown components={markdownComponents}>
                                {segment.content}
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
                        className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-2 rounded-full hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-95"
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
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input or post-session footer */}
      {!isSessionEnded ? (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-3">
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
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none"
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
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  : 'bg-gray-100 text-gray-300'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-center">
            <button
              onClick={() => setActiveTab('home')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-all"
            >
              Home
            </button>
          </div>
        </div>
      )}

      {/* Session notes overlay */}
      {sessionNotes && (
        <SessionNotesView notes={sessionNotes} onDismiss={dismissSessionNotes} />
      )}
    </div>
  );
}

'use client';

import { useRef, useEffect, ComponentPropsWithoutRef } from 'react';
import { Send, Square, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToney } from '@/context/ToneyContext';
import DraftCard from './DraftCard';
import SessionNotesView from './SessionNotesView';
import type { RewireCardCategory } from '@toney/types';

// Custom markdown components for chat bubble styling
const markdownComponents = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="ml-4 mb-2 last:mb-0 space-y-1 list-disc" {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="ml-4 mb-2 last:mb-0 space-y-1 list-decimal" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm leading-relaxed" {...props} />,
};

// ── Parse [CARD:category]...[/CARD] markers from message content ──

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

type MessageSegment = TextSegment | CardSegment;

const VALID_CATEGORIES = new Set<RewireCardCategory>(['reframe', 'truth', 'plan', 'practice', 'conversation_kit']);

function parseMessageContent(raw: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const cardRegex = /\[CARD:(\w+)\]([\s\S]*?)\[\/CARD\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(raw)) !== null) {
    // Text before this card
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }

    const categoryRaw = match[1].toLowerCase() as RewireCardCategory;
    const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'reframe';
    const cardBody = match[2].trim();

    // Extract title: first line starting with ** or plain first line
    let title = '';
    let content = cardBody;
    const lines = cardBody.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Check for **Title** pattern
      const boldMatch = firstLine.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        title = boldMatch[1];
        content = lines.slice(1).join('\n').trim();
      } else {
        // Use first line as title, rest as content
        title = firstLine.replace(/^\*\*/, '').replace(/\*\*$/, '');
        content = lines.slice(1).join('\n').trim();
      }
    }

    segments.push({ type: 'card', category, title, content });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last card
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', content: text });
  }

  // If no cards found, return the whole thing as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content: raw });
  }

  return segments;
}

export default function ChatScreen() {
  const {
    messages,
    chatInput,
    setChatInput,
    isTyping,
    handleSendMessage,
    handleSaveCard,
    sessionHasCard,
    sessionStatus,
    sessionNotes,
    endSession,
    dismissSessionNotes,
    startNewSession,
    loadingChat,
    setActiveTab,
  } = useToney();

  const isSessionEnded = sessionStatus === 'completed' || sessionStatus === 'ending';

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header with optional End Session button */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg z-10 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Chat with Toney</h1>
        {messages.filter(m => m.role !== 'divider').length >= 4 && sessionStatus === 'active' && (
          <button
            onClick={endSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 transition-all active:scale-95"
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
        {/* Loading state — Toney is preparing the session */}
        {messages.length === 0 && (
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

      {/* Input */}
      {!isSessionEnded ? (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="What's on your mind?"
                rows={1}
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none"
                style={{ minHeight: 20, maxHeight: 120 }}
              />
            </div>
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
        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 bg-gray-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={startNewSession}
              disabled={loadingChat}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
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

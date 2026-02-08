'use client';

import { useRef, useEffect, useState, useCallback, ComponentPropsWithoutRef } from 'react';
import { Send, Bookmark, BookmarkCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToney } from '@/context/ToneyContext';
import { useRewireCards } from '@/hooks/useRewireCards';
import SaveInsightSheet from './SaveInsightSheet';

// Custom markdown components for chat bubble styling
const markdownComponents = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="ml-4 mb-2 last:mb-0 space-y-1 list-disc" {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="ml-4 mb-2 last:mb-0 space-y-1 list-decimal" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm leading-relaxed" {...props} />,
};

function extractInsight(assistantContent: string, userContent?: string): string {
  const paragraphs = assistantContent.split('\n\n').filter(p => p.trim());
  if (paragraphs.length >= 2) {
    const validationStarters = ['i hear', 'that sounds', 'that\'s a really', 'ok,', 'okay'];
    const first = paragraphs[0].toLowerCase();
    const isValidation = validationStarters.some(s => first.startsWith(s));
    if (isValidation && paragraphs.length > 1) {
      return paragraphs.slice(1).join('\n\n').trim();
    }
  }
  return assistantContent.trim();
}

// ── Conversation starters for empty chat ──
const conversationStarters = [
  "Something's been on my mind about money...",
  "I want to understand why I do what I do with money",
  "I had a money moment today",
  "I want to talk about a money decision",
];

export default function ChatScreen() {
  const {
    messages,
    chatInput,
    setChatInput,
    isTyping,
    handleSendMessage,
    handleSaveInsight,
    loadingChat,
  } = useToney();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [saveSheetData, setSaveSheetData] = useState<{
    messageId: string;
    content: string;
  } | null>(null);
  const [lastSavedCardId, setLastSavedCardId] = useState<string | null>(null);
  const { setScore } = useRewireCards();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSaveClick = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    if (msg.saved) {
      handleSaveInsight(messageId);
      return;
    }
    const msgIndex = messages.findIndex(m => m.id === messageId);
    const precedingUserMsg = msgIndex > 0
      ? messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      : undefined;
    const extracted = extractInsight(msg.content, precedingUserMsg?.content);
    setSaveSheetData({ messageId, content: extracted });
  };

  const handleSheetSave = async (content: string, category: string) => {
    if (saveSheetData) {
      const cardId = await handleSaveInsight(saveSheetData.messageId, content, category);
      setLastSavedCardId(cardId);
    }
  };

  const handleSheetScore = useCallback(async (score: number) => {
    if (lastSavedCardId) {
      try {
        await setScore(lastSavedCardId, score);
      } catch { /* non-critical */ }
    }
  }, [lastSavedCardId, setScore]);

  const handleSheetClose = useCallback(() => {
    setSaveSheetData(null);
    setLastSavedCardId(null);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Simple header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg z-10">
        <h1 className="text-lg font-bold text-gray-900">Chat with Toney</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 hide-scrollbar">
        {loadingChat && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Empty state with conversation starters */}
        {!loadingChat && messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">{"\uD83D\uDCAC"}</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">What&apos;s on your mind?</h2>
            <p className="text-sm text-gray-500 mb-8 max-w-[280px]">
              Start a conversation about anything money-related. Toney&apos;s here to listen and coach.
            </p>
            <div className="w-full space-y-2">
              {conversationStarters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => handleSendMessage(starter)}
                  className="w-full text-left p-3.5 rounded-2xl border border-gray-100 bg-white text-sm text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all active:scale-[0.98]"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          // Find if this is the last assistant message
          const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;
          const isLastAssistant = msg.role === 'assistant' && msg.id === lastAssistantId;

          return (
          <div key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="w-10/12">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md whitespace-pre-line'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'assistant' && msg.canSave !== false && (
                  <button
                    onClick={() => handleSaveClick(msg.id)}
                    className={`mt-1.5 flex items-center gap-1.5 text-xs transition-all ${
                      msg.saved
                        ? 'text-indigo-600 font-medium'
                        : isLastAssistant
                          ? 'text-indigo-500 hover:text-indigo-700 font-medium'
                          : 'text-gray-300 hover:text-gray-500'
                    }`}
                  >
                    {msg.saved ? (
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Bookmark className={`${isLastAssistant ? 'w-4 h-4' : 'w-3 h-3'}`} />
                    )}
                    {msg.saved ? 'Saved to Rewire' : isLastAssistant ? 'Save insight' : ''}
                  </button>
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
          </div>
          );
        })}

        {isTyping && (
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

      {/* Save insight sheet */}
      {saveSheetData && (
        <SaveInsightSheet
          initialContent={saveSheetData.content}
          onSave={handleSheetSave}
          onClose={handleSheetClose}
          onScore={handleSheetScore}
        />
      )}
    </div>
  );
}

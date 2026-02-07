'use client';

import { useRef, useEffect, useState, ComponentPropsWithoutRef } from 'react';
import { Send, Bookmark, BookmarkCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToney } from '@/context/ToneyContext';
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
  // Pull out the actionable/insightful part, not the whole message
  const paragraphs = assistantContent.split('\n\n').filter(p => p.trim());

  // If there are multiple paragraphs, take the meatiest one (skip the validation opener)
  if (paragraphs.length >= 2) {
    // Skip the first paragraph if it's just validation ("I hear you", "That makes sense")
    const validationStarters = ['i hear', 'that sounds', 'that\'s a really', 'ok,', 'okay'];
    const first = paragraphs[0].toLowerCase();
    const isValidation = validationStarters.some(s => first.startsWith(s));

    if (isValidation && paragraphs.length > 1) {
      // Return the insight paragraphs (everything after the validation)
      return paragraphs.slice(1).join('\n\n').trim();
    }
  }

  return assistantContent.trim();
}

export default function ChatScreen() {
  const {
    messages,
    chatInput,
    setChatInput,
    isTyping,
    handleSendMessage,
    handleSaveInsight,
  } = useToney();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [saveSheetData, setSaveSheetData] = useState<{
    messageId: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSaveClick = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // If already saved, unsave it
    if (msg.saved) {
      handleSaveInsight(messageId);
      return;
    }

    // Find the user message that preceded this assistant message
    const msgIndex = messages.findIndex(m => m.id === messageId);
    const precedingUserMsg = msgIndex > 0
      ? messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      : undefined;

    // Extract the insight from the assistant message
    const extracted = extractInsight(msg.content, precedingUserMsg?.content);

    setSaveSheetData({ messageId, content: extracted });
  };

  const handleSheetSave = (content: string, category: string) => {
    if (saveSheetData) {
      handleSaveInsight(saveSheetData.messageId, content, category);
      setSaveSheetData(null);
    }
  };

  const handleQuickReply = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg">
            {"\u{1F499}"}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">Toney</div>
            <div className="text-xs text-gray-400">Your money coach</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 hide-scrollbar">
        {messages.map((msg) => (
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
                {/* Save button for assistant messages */}
                {msg.role === 'assistant' && msg.canSave !== false && (
                  <button
                    onClick={() => handleSaveClick(msg.id)}
                    className={`mt-1.5 flex items-center gap-1.5 text-xs transition-all ${
                      msg.saved ? 'text-indigo-600 font-medium' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {msg.saved ? (
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" />
                    )}
                    {msg.saved ? 'Saved to Rewire' : 'Save insight'}
                  </button>
                )}
              </div>
            </div>

            {/* Quick reply chips — shown below assistant messages that have them */}
            {msg.role === 'assistant' && msg.quickReplies && msg.quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 ml-1">
                {msg.quickReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(reply)}
                    className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-2 rounded-full hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-95"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

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
          onClose={() => setSaveSheetData(null)}
        />
      )}
    </div>
  );
}

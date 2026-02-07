'use client';

import { useRef, useEffect, useState, ComponentType, ComponentPropsWithoutRef } from 'react';
import { Send, Bookmark, BookmarkCheck, ChevronLeft, ChevronDown, Shield, MessageSquare, Clock, CreditCard, TrendingUp, Rocket, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToney } from '@/context/ToneyContext';
import { ALL_TOPICS, topicDetails, topicColor, TopicKey } from '@toney/constants';
import SaveInsightSheet from './SaveInsightSheet';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  Shield,
  MessageSquare,
  Clock,
  CreditCard,
  TrendingUp,
  Rocket,
  Target,
};

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

// ── Topic List View ──
function TopicListView() {
  const { selectTopic, topicConversations } = useToney();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
        <p className="text-sm text-gray-500 mt-1">Pick a topic to explore with Toney</p>
      </div>

      <div className="space-y-2.5">
        {ALL_TOPICS.map((key) => {
          const topic = topicDetails[key];
          const colors = topicColor(key);
          const Icon = iconMap[topic.icon];
          const hasConversation = !!topicConversations[key];

          return (
            <button
              key={key}
              onClick={() => selectTopic(key)}
              className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                hasConversation
                  ? `${colors.border} ${colors.bg} border-2`
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasConversation ? colors.accent : 'bg-gray-100'
                }`}>
                  {Icon && <Icon className={`w-5 h-5 ${hasConversation ? 'text-white' : 'text-gray-500'}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{topic.name}</div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{topic.description}</p>
                </div>
                {hasConversation && (
                  <span className={`text-xs font-medium ${colors.text}`}>Continue</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Active Chat View ──
function ActiveChatView() {
  const {
    messages,
    chatInput,
    setChatInput,
    isTyping,
    handleSendMessage,
    handleSaveInsight,
    activeTopic,
    leaveTopic,
    loadingTopic,
  } = useToney();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [saveSheetData, setSaveSheetData] = useState<{
    messageId: string;
    content: string;
  } | null>(null);
  const [showTopicSwitcher, setShowTopicSwitcher] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!activeTopic) return null;

  const topic = topicDetails[activeTopic];
  const colors = topicColor(activeTopic);
  const Icon = iconMap[topic.icon];

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

  const handleSheetSave = (content: string, category: string) => {
    if (saveSheetData) {
      handleSaveInsight(saveSheetData.messageId, content, category);
      setSaveSheetData(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat header with topic switcher */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={leaveTopic}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>

          <button
            onClick={() => setShowTopicSwitcher(!showTopicSwitcher)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} ${colors.text} transition-all`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span className="text-sm font-semibold">{topic.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTopicSwitcher ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Topic switcher dropdown */}
        {showTopicSwitcher && (
          <TopicSwitcherDropdown onClose={() => setShowTopicSwitcher(false)} />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 hide-scrollbar">
        {loadingTopic && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

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

// ── Topic Switcher Dropdown ──
function TopicSwitcherDropdown({ onClose }: { onClose: () => void }) {
  const { activeTopic, selectTopic, topicConversations } = useToney();

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      {ALL_TOPICS.map((key) => {
        const topic = topicDetails[key];
        const colors = topicColor(key);
        const Icon = iconMap[topic.icon];
        const isActive = key === activeTopic;
        const hasConversation = !!topicConversations[key];

        return (
          <button
            key={key}
            onClick={() => {
              if (!isActive) selectTopic(key);
              onClose();
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${
              isActive ? `${colors.bg}` : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isActive ? colors.accent : hasConversation ? colors.light : 'bg-gray-100'
            }`}>
              {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-white' : hasConversation ? colors.text : 'text-gray-400'}`} />}
            </div>
            <span className={`text-sm font-medium ${isActive ? colors.text : 'text-gray-700'}`}>
              {topic.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main ChatScreen ──
export default function ChatScreen() {
  const { activeTopic } = useToney();

  if (activeTopic) {
    return <ActiveChatView />;
  }

  return <TopicListView />;
}

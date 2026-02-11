'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Loader2, Sparkles } from 'lucide-react';
import MessageBubble from '@/components/MessageBubble';
import type { CardEvaluationSummary } from '@/lib/queries/simulator';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface SimulatorChatProps {
  runId: string;
  initialMessages: ChatMessage[];
  isActive: boolean;
  runStatus: string;
  mode: 'automated' | 'manual';
  isClone?: boolean;
  onRunComplete?: (evaluation: CardEvaluationSummary | null) => void;
}

export default function SimulatorChat({
  runId,
  initialMessages,
  isActive,
  runStatus,
  mode,
  isClone = false,
  onRunComplete,
}: SimulatorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState(runStatus);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const tickingRef = useRef(false);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ============================================================
  // Manual mode: auto-generate Coach greeting for clones
  // ============================================================

  useEffect(() => {
    if (isActive && mode === 'manual' && isClone && initialMessages.length === 0) {
      const generateGreeting = async () => {
        setTicking(true);
        try {
          const res = await fetch(`/api/simulator/run/${runId}/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (data.assistantMsg) {
            setMessages([{
              id: data.assistantMsg.id,
              role: 'assistant',
              content: data.assistantMsg.content,
              created_at: data.assistantMsg.created_at || new Date().toISOString(),
            }]);
          }
        } catch (err) {
          console.error('Failed to generate greeting:', err);
        } finally {
          setTicking(false);
        }
      };
      generateGreeting();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Automated mode: client-driven tick loop
  // ============================================================

  const runTickLoop = useCallback(async () => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    abortRef.current = false;
    setTicking(true);

    try {
      while (!abortRef.current) {
        const res = await fetch(`/api/simulator/run/${runId}/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Tick failed:', errorData);

          if (errorData.status && errorData.status !== 'running') {
            setStatus(errorData.status);
            break;
          }

          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        const data = await res.json();

        if (data.assistantMsg) {
          const newMessages: ChatMessage[] = [];

          if (data.userMsg) {
            newMessages.push({
              id: data.userMsg.id,
              role: 'user',
              content: data.userMsg.content,
              created_at: data.userMsg.created_at || new Date().toISOString(),
            });
          }

          newMessages.push({
            id: data.assistantMsg.id,
            role: 'assistant',
            content: data.assistantMsg.content,
            created_at: data.assistantMsg.created_at || new Date().toISOString(),
          });

          setMessages(prev => [...prev, ...newMessages]);
        }

        if (data.done) {
          setStatus('completed');
          window.location.reload();
          return;
        }
      }
    } catch (err) {
      console.error('Tick loop error:', err);
    } finally {
      setTicking(false);
      tickingRef.current = false;
    }
  }, [runId]);

  useEffect(() => {
    if (status === 'running' && mode === 'automated' && !tickingRef.current) {
      runTickLoop();
    }

    return () => {
      abortRef.current = true;
    };
  }, [status, mode, runTickLoop]);

  // ============================================================
  // Manual mode: generate suggestion + send
  // ============================================================

  const generateSuggestion = async () => {
    if (generating) return;
    setGenerating(true);

    try {
      const res = await fetch('/api/simulator/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });

      const data = await res.json();
      if (data.suggestion) {
        setInput(data.suggestion);
        // Focus the textarea so they can edit right away
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (err) {
      console.error('Failed to generate suggestion:', err);
    } finally {
      setGenerating(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/simulator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, userMessage }),
      });

      const data = await res.json();
      if (data.message) {
        const assistantMsg: ChatMessage = {
          id: data.message.id || `temp-${Date.now()}-a`,
          role: 'assistant',
          content: data.message.content,
          created_at: data.message.timestamp || new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const endConversation = async () => {
    setEnding(true);
    try {
      await fetch(`/api/simulator/run/${runId}/end`, { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Failed to end conversation:', err);
      setEnding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isRunning = status === 'running' && mode === 'automated';

  return (
    <div className="flex flex-col h-full">
      {/* Live indicator for automated runs */}
      {isRunning && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-medium text-blue-700">
            Simulation running — messages appear live ({messages.length} messages so far)
          </span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            createdAt={msg.created_at}
          />
        ))}

        {/* Typing indicator during automated runs */}
        {(isRunning && ticking) && (
          <div className="flex justify-start">
            <div className="bg-indigo-50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-indigo-50 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input (manual mode only) */}
      {isActive && mode === 'manual' && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          {/* Generate button */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={generateSuggestion}
              disabled={generating || sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Generate as persona
                </>
              )}
            </button>
            <span className="text-xs text-gray-400">
              AI generates a message as the persona — edit before sending
            </span>
          </div>

          {/* Input + send */}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type as the user or click Generate..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              disabled={sending}
              rows={input.split('\n').length > 3 ? 4 : input.length > 80 ? 3 : 2}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              onClick={endConversation}
              disabled={ending}
              className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              title="End conversation & evaluate"
            >
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Enter to send · Shift+Enter for new line · Stop to end and evaluate cards
          </p>
        </div>
      )}
    </div>
  );
}

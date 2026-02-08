'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import MessageBubble from '@/components/MessageBubble';
import CardBadge from '@/components/simulator/CardBadge';
import type { SimulatorMessage, CardEvaluationSummary } from '@/lib/queries/simulator';

interface SimulatorChatProps {
  runId: string;
  initialMessages: SimulatorMessage[];
  isActive: boolean;
  runStatus: string;
  mode: 'automated' | 'manual';
  onRunComplete?: (evaluation: CardEvaluationSummary | null) => void;
}

export default function SimulatorChat({
  runId,
  initialMessages,
  isActive,
  runStatus,
  mode,
  onRunComplete,
}: SimulatorChatProps) {
  const [messages, setMessages] = useState<SimulatorMessage[]>(initialMessages);
  const [status, setStatus] = useState(runStatus);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages during automated runs
  const poll = useCallback(async () => {
    if (status !== 'running' || mode !== 'automated') return;

    try {
      const lastTurn = messages.length > 0
        ? Math.max(...messages.map(m => m.turn_number))
        : -1;

      const res = await fetch(`/api/simulator/run/${runId}/poll?after=${lastTurn}`);
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = data.messages.filter((m: SimulatorMessage) => !existingIds.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      }

      if (data.status !== status) {
        setStatus(data.status);
        if (data.status === 'completed' || data.status === 'failed') {
          onRunComplete?.(data.card_evaluation ?? null);
          return; // Stop polling
        }
      }

      // Continue polling
      pollRef.current = setTimeout(poll, 1500);
    } catch (err) {
      console.error('Poll failed:', err);
      pollRef.current = setTimeout(poll, 3000);
    }
  }, [runId, messages, status, mode, onRunComplete]);

  useEffect(() => {
    if (status === 'running' && mode === 'automated') {
      pollRef.current = setTimeout(poll, 1500);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [status, mode, poll]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: SimulatorMessage = {
      id: `temp-${Date.now()}`,
      run_id: runId,
      role: 'user',
      content: userMessage,
      turn_number: messages.length,
      card_worthy: false,
      card_category: null,
      card_reason: null,
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
        const assistantMsg: SimulatorMessage = {
          id: `temp-${Date.now()}-a`,
          run_id: runId,
          role: 'assistant',
          content: data.message.content,
          turn_number: messages.length + 1,
          card_worthy: false,
          card_category: null,
          card_reason: null,
          created_at: new Date().toISOString(),
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

  const isRunning = status === 'running' && mode === 'automated';

  return (
    <div className="flex flex-col h-full">
      {/* Live indicator for automated runs */}
      {isRunning && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-medium text-blue-700">
            Simulation running — messages appear live
          </span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble
              role={msg.role}
              content={msg.content}
              createdAt={msg.created_at}
            />
            {msg.card_worthy && msg.card_category && (
              <div className={`mt-1 ${msg.role === 'assistant' ? 'ml-0 max-w-[75%]' : 'ml-auto max-w-[75%]'}`}>
                <CardBadge category={msg.card_category} reason={msg.card_reason} />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator during automated runs */}
        {isRunning && (
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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type as the user..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            Type as the simulated user. Click stop to end and evaluate cards.
          </p>
        </div>
      )}
    </div>
  );
}

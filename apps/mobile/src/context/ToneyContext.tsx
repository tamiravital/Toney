'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win, RewireCardCategory, SessionNotesOutput } from '@toney/types';
import { tensionDetails } from '@toney/constants';
import { questions } from '@toney/constants';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'questions';
type AppPhase = 'loading' | 'signed_out' | 'onboarding' | 'main';
type ActiveTab = 'home' | 'chat' | 'rewire' | 'wins';
type SessionStatus = 'active' | 'ending' | 'completed';

const VALID_TABS = new Set<ActiveTab>(['home', 'chat', 'rewire', 'wins']);

// localStorage helpers
function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Migrate old pattern-based localStorage to new tension system.
 * Maps: avoidance→avoid, fomo→chase, retail_therapy→numb, over_control→grip
 */
function migrateOldPattern(): IdentifiedTension | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('toney_pattern');
  if (!raw) return null;

  try {
    const old = JSON.parse(raw);
    if (old.primary) return old as IdentifiedTension;

    const typeMap: Record<string, TensionType> = {
      avoidance: 'avoid',
      fomo: 'chase',
      retail_therapy: 'numb',
      over_control: 'grip',
    };

    const newType = typeMap[old.type];
    if (!newType) return null;

    const tension: IdentifiedTension = {
      primary: newType,
      primaryScore: old.score || 5,
      primaryDetails: tensionDetails[newType],
    };

    saveJSON('toney_tension', tension);
    localStorage.removeItem('toney_pattern');
    return tension;
  } catch {
    return null;
  }
}

interface ToneyContextValue {
  // App phase
  appPhase: AppPhase;
  setAppPhase: (phase: AppPhase) => void;

  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  // Onboarding
  onboardingStep: OnboardingStep;
  setOnboardingStep: (step: OnboardingStep) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answers: Record<string, string>;
  identifiedTension: IdentifiedTension | null;
  handleAnswer: (questionId: string, value: string) => void;
  handleNextQuestion: () => void;
  handlePrevQuestion: () => void;
  whatBroughtYou: string;
  setWhatBroughtYou: (text: string) => void;
  emotionalWhy: string;
  setEmotionalWhy: (text: string) => void;

  // Style
  styleProfile: StyleProfile;
  setStyleProfile: (profile: StyleProfile) => void;
  tempStyle: StyleProfile;
  setTempStyle: (style: StyleProfile | ((prev: StyleProfile) => StyleProfile)) => void;

  // Chat — session-based (v2)
  currentSessionId: string | null;
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  handleSendMessage: (overrideText?: string) => void;
  handleSaveInsight: (messageId: string, editedContent?: string, category?: string) => Promise<string | null>;
  handleSaveCard: (title: string, content: string, category: RewireCardCategory) => Promise<void>;
  sessionHasCard: boolean;
  sessionStatus: SessionStatus;
  sessionNotes: SessionNotesOutput | null;
  endSession: () => Promise<void>;
  dismissSessionNotes: () => void;
  openSession: (previousSessionId?: string, preserveMessages?: boolean) => Promise<void>;
  startNewSession: () => Promise<void>;
  loadingChat: boolean;
  isFirstSession: boolean;
  previousSessionMessages: Message[];
  previousSessionCollapsed: boolean;
  setPreviousSessionCollapsed: (collapsed: boolean) => void;

  // Rewire
  savedInsights: Insight[];
  setSavedInsights: (insights: Insight[] | ((prev: Insight[]) => Insight[])) => void;
  updateInsight: (insightId: string, updates: { content?: string; category?: string }) => void;
  deleteInsight: (insightId: string) => void;

  // Wins
  wins: Win[];
  streak: number;
  handleLogWin: (text: string) => void;

  // Auth
  signIn: () => void;
  signOut: () => void;

  // Onboarding completion
  finishOnboarding: () => void;

  // Reset
  resetAll: () => void;
  retakeQuiz: () => void;
}

const ToneyContext = createContext<ToneyContextValue | null>(null);

const defaultStyle: StyleProfile = {
  tone: 5,
  depth: 'balanced',
  learningStyles: [],
};

export function ToneyProvider({ children }: { children: ReactNode }) {
  const [appPhase, setAppPhase] = useState<AppPhase>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showSettings, setShowSettings] = useState(false);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [identifiedTensionState, setIdentifiedTension] = useState<IdentifiedTension | null>(null);
  const [whatBroughtYou, setWhatBroughtYou] = useState('');
  const [emotionalWhy, setEmotionalWhy] = useState('');

  // Style
  const [styleProfile, setStyleProfile] = useState<StyleProfile>({ ...defaultStyle });
  const [tempStyle, setTempStyle] = useState<StyleProfile>({ ...defaultStyle });

  // Chat — session-based (v2, no topics)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sessionHasCard, setSessionHasCard] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('active');
  const [sessionNotes, setSessionNotes] = useState<SessionNotesOutput | null>(null);
  const [isFirstSession, setIsFirstSession] = useState(true); // safe default — hides End Session until hydration proves otherwise
  const [previousSessionMessages, setPreviousSessionMessages] = useState<Message[]>([]);
  const [previousSessionCollapsed, setPreviousSessionCollapsed] = useState(true);

  // Rewire
  const [savedInsights, setSavedInsights] = useState<Insight[]>([]);

  // Wins
  const [wins, setWins] = useState<Win[]>([]);
  const [streak, setStreak] = useState(0);

  // ── Hydrate from localStorage + check Supabase session on mount ──
  useEffect(() => {
    const hydrate = async () => {
      let isSignedIn = localStorage.getItem('toney_signed_in') === 'true';

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            isSignedIn = true;
            localStorage.setItem('toney_signed_in', 'true');
          } else {
            isSignedIn = false;
            localStorage.removeItem('toney_signed_in');
          }
        } catch {
          isSignedIn = false;
          localStorage.removeItem('toney_signed_in');
        }
      }

      if (!isSignedIn) {
        setAppPhase('signed_out');
        return;
      }

      let hasOnboarded = localStorage.getItem('toney_onboarded') === 'true';

      // If localStorage doesn't know about onboarding, check the Supabase profile
      if (!hasOnboarded && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('onboarding_completed, tension_type, secondary_tension_type, tension_score, tone, depth, learning_styles')
              .eq('id', user.id)
              .single();

            if (profile?.onboarding_completed) {
              hasOnboarded = true;
              localStorage.setItem('toney_onboarded', 'true');

              if (profile.tension_type) {
                const tension: IdentifiedTension = {
                  primary: profile.tension_type as TensionType,
                  primaryScore: profile.tension_score ?? 5,
                  primaryDetails: tensionDetails[profile.tension_type as TensionType],
                  ...(profile.secondary_tension_type && {
                    secondary: profile.secondary_tension_type as TensionType,
                    secondaryDetails: tensionDetails[profile.secondary_tension_type as TensionType],
                  }),
                };
                saveJSON('toney_tension', tension);
                setIdentifiedTension(tension);
              }
              if (profile.tone || profile.depth || profile.learning_styles) {
                const style: StyleProfile = {
                  tone: profile.tone ?? defaultStyle.tone,
                  depth: (profile.depth as StyleProfile['depth']) ?? defaultStyle.depth,
                  learningStyles: (profile.learning_styles as StyleProfile['learningStyles']) ?? defaultStyle.learningStyles,
                };
                saveJSON('toney_style', style);
                setStyleProfile(style);
                setTempStyle(style);
              }
            }
          }
        } catch {
          // Profile check failed — fall through to onboarding
        }
      }

      // Load local state
      let savedTension = loadJSON<IdentifiedTension | null>('toney_tension', null);
      if (!savedTension) {
        savedTension = migrateOldPattern();
      }

      const savedStyle = loadJSON<StyleProfile>('toney_style', defaultStyle);
      const savedInsightsData = loadJSON<Insight[]>('toney_insights', []);
      const savedWins = loadJSON<Win[]>('toney_wins', []);
      const savedStreak = loadJSON<number>('toney_streak', 0);

      if (savedTension) setIdentifiedTension(savedTension);
      if (savedStyle) {
        setStyleProfile(savedStyle);
        setTempStyle(savedStyle);
      }
      if (savedInsightsData.length > 0) setSavedInsights(savedInsightsData);
      if (savedWins.length > 0) setWins(savedWins);
      if (savedStreak) setStreak(savedStreak);

      // Restore most recent active conversation from Supabase
      if (hasOnboarded && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const [{ data: recentSession }, { count: sessionCount }] = await Promise.all([
              supabase
                .from('sessions')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
              supabase
                .from('sessions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id),
            ]);

            setIsFirstSession((sessionCount || 0) <= 1);

            if (recentSession) {
              setCurrentSessionId(recentSession.id);

              // Get last message timestamp for boundary detection
              const { data: lastMsg } = await supabase
                .from('messages')
                .select('created_at')
                .eq('session_id', recentSession.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (lastMsg) {
                lastMessageTimestampRef.current = lastMsg.created_at;
              }
            }
          }
        } catch {
          // Non-critical — session will be created on first message
        }
      }

      // Hydrate rewire cards from Supabase (covers migrated + server-side cards)
      if (hasOnboarded && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: dbCards } = await supabase
              .from('rewire_cards')
              .select('id, title, content, category, created_at, is_focus, graduated_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (dbCards && dbCards.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const insights: Insight[] = dbCards.map((card: any) => ({
                id: card.id,
                content: card.content,
                category: card.category as Insight['category'],
                savedAt: new Date(card.created_at),
                fromChat: true,
                tags: [],
                is_focus: card.is_focus || false,
                graduated_at: card.graduated_at || null,
              }));
              setSavedInsights(insights);
              saveJSON('toney_insights', insights);
            }
          }
        } catch {
          // Non-critical — localStorage insights still available
        }
      }

      if (hasOnboarded) {
        setAppPhase('main');
        // Parse URL hash for navigation
        const hash = window.location.hash.replace('#', '');
        if (VALID_TABS.has(hash as ActiveTab)) {
          setActiveTab(hash as ActiveTab);
        } else {
          setActiveTab('home');
        }
      } else {
        setAppPhase('onboarding');
      }
    };

    hydrate();
  }, []);

  // ── Persist key state changes to localStorage ──
  useEffect(() => {
    if (appPhase === 'loading' || appPhase === 'signed_out') return;
    saveJSON('toney_insights', savedInsights);
  }, [savedInsights, appPhase]);

  useEffect(() => {
    if (appPhase === 'loading' || appPhase === 'signed_out') return;
    saveJSON('toney_wins', wins);
  }, [wins, appPhase]);

  useEffect(() => {
    if (appPhase === 'loading' || appPhase === 'signed_out') return;
    saveJSON('toney_streak', streak);
  }, [streak, appPhase]);

  useEffect(() => {
    if (appPhase === 'loading' || appPhase === 'signed_out') return;
    saveJSON('toney_style', styleProfile);
  }, [styleProfile, appPhase]);

  useEffect(() => {
    if (identifiedTensionState) {
      saveJSON('toney_tension', identifiedTensionState);
    }
  }, [identifiedTensionState]);

  // ── URL Hash Navigation ──

  // Sync activeTab → URL hash
  useEffect(() => {
    if (appPhase !== 'main') return;
    if (showSettings) return;
    const targetHash = activeTab;
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash !== targetHash) {
      window.history.pushState(null, '', `#${targetHash}`);
    }
  }, [activeTab, appPhase, showSettings]);

  // Sync URL hash → activeTab (browser back/forward)
  useEffect(() => {
    if (appPhase !== 'main') return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'settings') {
        if (!showSettings) setShowSettings(true);
      } else if (VALID_TABS.has(hash as ActiveTab)) {
        if (showSettings) setShowSettings(false);
        if (hash !== activeTab) setActiveTab(hash as ActiveTab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [appPhase, activeTab, showSettings]);

  // Clear hash when leaving main phase
  useEffect(() => {
    if (appPhase !== 'main' && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [appPhase]);

  // Sync showSettings → URL hash
  useEffect(() => {
    if (appPhase !== 'main') return;
    if (showSettings) {
      window.history.pushState(null, '', '#settings');
    } else {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash === 'settings') {
        window.history.pushState(null, '', `#${activeTab}`);
      }
    }
  }, [showSettings, appPhase, activeTab]);

  // ── Load messages when currentSessionId changes ──
  useEffect(() => {
    if (appPhase !== 'main') return;

    // Skip reload if we're doing an inline session open (messages are being streamed in)
    if (skipMessageLoadRef.current) {
      skipMessageLoadRef.current = false;
      return;
    }

    setSessionHasCard(false);
    setSessionNotes(null);
    setPreviousSessionMessages([]);
    setPreviousSessionCollapsed(true);
    if (!currentSessionId) {
      setSessionStatus('active');
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      if (!isSupabaseConfigured()) return;
      setLoadingChat(true);
      try {
        const supabase = createClient();
        const [{ data: dbMessages }, { count: cardCount }, { data: sessionData }] = await Promise.all([
          supabase
            .from('messages')
            .select('id, role, content, created_at')
            .eq('session_id', currentSessionId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('rewire_cards')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', currentSessionId),
          supabase
            .from('sessions')
            .select('session_status')
            .eq('id', currentSessionId)
            .single(),
        ]);

        if (cardCount && cardCount > 0) {
          setSessionHasCard(true);
        }

        // Restore session status (e.g. if user refreshes after ending)
        if (sessionData?.session_status === 'completed') {
          setSessionStatus('completed');
        } else {
          setSessionStatus('active');
        }

        if (dbMessages && dbMessages.length > 0) {
          setMessages(dbMessages.reverse().map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.created_at),
            canSave: m.role === 'assistant',
            saved: false,
          })));
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoadingChat(false);
      }
    };

    loadMessages();
  }, [currentSessionId, appPhase]);

  // ── Handlers ──

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      setOnboardingStep('welcome');
    }
  }, [currentQuestionIndex]);

  const handleSendMessage = useCallback(async (overrideText?: string) => {
    const text = overrideText || chatInput;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    if (isSupabaseConfigured()) {
      try {
        const sessId = sessionIdRef.current;

        // Session should already exist via auto-open
        if (!sessId) {
          console.error('[Toney] No session ID — auto-open may not have fired');
          setIsTyping(false);
          return;
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.content,
            sessionId: sessId,
          }),
        });

        // Check if response is streaming (SSE) or JSON fallback
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
          // Streaming response — progressively render
          const streamingMsgId = `msg-streaming-${Date.now()}`;

          // Add empty assistant message that will be filled progressively
          const streamingMsg: Message = {
            id: streamingMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            canSave: true,
            saved: false,
          };
          setMessages(prev => [...prev, streamingMsg]);
          setIsTyping(false); // Hide typing dots — text is streaming in

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'delta') {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === streamingMsgId
                        ? { ...m, content: m.content + event.text }
                        : m
                    )
                  );
                } else if (event.type === 'done') {
                  // Update message ID to the saved DB ID
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === streamingMsgId
                        ? { ...m, id: event.id }
                        : m
                    )
                  );
                } else if (event.type === 'error') {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === streamingMsgId
                        ? { ...m, content: event.text, canSave: false }
                        : m
                    )
                  );
                }
              } catch { /* skip malformed SSE events */ }
            }
          }
          return;
        } else {
          // JSON fallback (error responses)
          const data = await res.json();
          if (data.message) {
            const toneyMsg: Message = {
              id: data.message.id || `msg-${Date.now() + 1}`,
              role: 'assistant',
              content: data.message.content,
              timestamp: new Date(data.message.timestamp || Date.now()),
              canSave: data.message.canSave ?? true,
              saved: false,
            };
            setMessages(prev => [...prev, toneyMsg]);
            setIsTyping(false);
            return;
          }
        }
      } catch (err) {
        console.error('[Toney] Chat API failed:', err);
      }
    }

    // API failed — show error
    setMessages(prev => [...prev, {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant' as const,
      content: "I'm having trouble connecting right now. Give me a moment and try again?",
      timestamp: new Date(),
      canSave: false,
      saved: false,
    }]);
    setIsTyping(false);
  }, [chatInput]);

  const handleSaveInsight = useCallback(async (messageId: string, editedContent?: string, category?: string): Promise<string | null> => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, saved: !m.saved } : m))
    );
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.saved) {
      setSavedInsights(prev => [
        ...prev,
        {
          id: `insight-${Date.now()}`,
          content: editedContent || msg.content,
          category: (category as Insight['category']) || undefined,
          savedAt: new Date(),
          fromChat: true,
          tags: [identifiedTensionState?.primary ? `tends to ${identifiedTensionState.primary}` : 'Insight'],
        },
      ]);

      // Also save to Supabase
      if (isSupabaseConfigured()) {
        // Build trigger_context from recent messages leading to this card
        const msgIndex = messages.findIndex(m => m.id === messageId);
        const recentMessages = messages.slice(Math.max(0, msgIndex - 5), msgIndex + 1);
        const triggerContext = recentMessages
          .map(m => `${m.role === 'user' ? 'User' : 'Toney'}: ${m.content.substring(0, 150)}`)
          .join('\n');

        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data } = await supabase.from('rewire_cards').insert({
              user_id: user.id,
              source_message_id: messageId.startsWith('msg-') ? null : messageId,
              category: category || 'reframe',
              title: (editedContent || msg.content).substring(0, 80),
              content: editedContent || msg.content,
              tension_type: identifiedTensionState?.primary || null,
              auto_generated: false,
              trigger_context: triggerContext || null,
            }).select('id').single();
            return data?.id || null;
          }
        } catch { /* non-critical */ }
      }
    } else if (msg) {
      setSavedInsights(prev => prev.filter(i => i.content !== msg.content));
    }
    return null;
  }, [messages, identifiedTensionState]);

  const handleSaveCard = useCallback(async (title: string, content: string, category: RewireCardCategory) => {
    // Add to local state
    const newInsight: Insight = {
      id: `insight-${Date.now()}`,
      content,
      category,
      savedAt: new Date(),
      fromChat: true,
      tags: [identifiedTensionState?.primary ? `tends to ${identifiedTensionState.primary}` : 'Insight'],
    };
    setSavedInsights(prev => [newInsight, ...prev]);
    setSessionHasCard(true);

    // Save to Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('rewire_cards').insert({
            user_id: user.id,
            category,
            title,
            content,
            tension_type: identifiedTensionState?.primary || null,
            auto_generated: false,
            prescribed_by: 'coach',
            session_id: currentSessionId || null,
          });
        }
      } catch { /* non-critical */ }
    }
  }, [identifiedTensionState, currentSessionId]);

  const endSession = useCallback(async () => {
    if (!currentSessionId || sessionStatus !== 'active') return;
    setSessionStatus('ending');

    try {
      const res = await fetch('/api/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      const data = await res.json();

      if (data.sessionNotes) {
        setSessionNotes(data.sessionNotes as SessionNotesOutput);
      }

      setSessionStatus('completed');
    } catch {
      // If session close fails, revert to active
      setSessionStatus('active');
    }
  }, [currentSessionId, sessionStatus]);

  const dismissSessionNotes = useCallback(() => {
    setSessionNotes(null);
  }, []);

  const openSession = useCallback(async (previousSessionId?: string, preserveMessages?: boolean) => {
    if (!isSupabaseConfigured()) return;

    setLoadingChat(true);
    setSessionHasCard(false);
    setSessionStatus('active');
    setSessionNotes(null);

    // When preserving messages, capture current messages as previous session (collapsed)
    if (preserveMessages) {
      skipMessageLoadRef.current = true;
      const currentNonDividerMessages = messages.filter(m => m.role !== 'divider');
      setPreviousSessionMessages(currentNonDividerMessages);
      setPreviousSessionCollapsed(true);
      setMessages([]);
    } else {
      setPreviousSessionMessages([]);
      setMessages([]);
    }

    try {
      const res = await fetch('/api/session/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(previousSessionId && { previousSessionId }),
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Streaming response — progressively render opening message
        const streamingMsgId = `msg-opening-${Date.now()}`;
        let sessionIdReceived = false;

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'session') {
                setCurrentSessionId(event.sessionId);
                sessionIdRef.current = event.sessionId;
                sessionIdReceived = true;
                setIsFirstSession(false);
              } else if (event.type === 'delta') {
                if (!sessionIdReceived) continue;
                // Hide loading state on first text chunk
                setLoadingChat(false);
                setMessages(prev => {
                  const existing = prev.find(m => m.id === streamingMsgId);
                  if (existing) {
                    return prev.map(m =>
                      m.id === streamingMsgId
                        ? { ...m, content: m.content + event.text }
                        : m
                    );
                  } else {
                    return [...prev, {
                      id: streamingMsgId,
                      role: 'assistant' as const,
                      content: event.text,
                      timestamp: new Date(),
                      canSave: false,
                      saved: false,
                    }];
                  }
                });
              } else if (event.type === 'done') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === streamingMsgId
                      ? { ...m, id: event.id }
                      : m
                  )
                );
              } else if (event.type === 'error') {
                setLoadingChat(false);
                setMessages(prev => [...prev, {
                  id: streamingMsgId,
                  role: 'assistant',
                  content: event.text,
                  timestamp: new Date(),
                  canSave: false,
                  saved: false,
                }]);
              }
            } catch { /* skip malformed SSE events */ }
          }
        }
        setLoadingChat(false);
      } else {
        // JSON fallback (error responses)
        const data = await res.json();
        if (data.sessionId) {
          setCurrentSessionId(data.sessionId);
          sessionIdRef.current = data.sessionId;
        }
        if (data.message) {
          setMessages(prev => [...prev, {
            id: data.message.id || `msg-${Date.now()}`,
            role: 'assistant',
            content: data.message.content,
            timestamp: new Date(data.message.timestamp || Date.now()),
            canSave: false,
            saved: false,
          }]);
        }
        setLoadingChat(false);
      }
    } catch (err) {
      console.error('[Toney] Session open failed:', err);
      setLoadingChat(false);
    }
  }, []);

  // ── Auto-open session when user navigates to chat ──
  const sessionOpenedRef = useRef(false);
  const lastMessageTimestampRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const skipMessageLoadRef = useRef(false); // Skip message reload during inline session open

  const startNewSession = useCallback(async () => {
    const prevId = currentSessionId;
    sessionOpenedRef.current = true; // Prevent auto-open from firing
    // Open new session inline — preserve old messages with a divider
    await openSession(prevId || undefined, true);
  }, [currentSessionId, openSession]);

  // Keep sessionIdRef in sync with state
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    if (appPhase !== 'main') return;
    if (activeTab !== 'chat') {
      sessionOpenedRef.current = false;
      return;
    }
    if (loadingChat) return;
    if (sessionOpenedRef.current) return;
    if (sessionStatus !== 'active') return;

    // If we have messages, this is a live session — resume
    if (messages.length > 0) return;

    sessionOpenedRef.current = true;

    // Check if we need boundary detection
    if (currentSessionId && lastMessageTimestampRef.current) {
      const lastTime = new Date(lastMessageTimestampRef.current).getTime();
      const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

      if (hoursSince < 12) {
        // Within 12h — resume existing session (messages already loaded as empty = empty session, that's fine)
        return;
      }

      // >12h gap — close old session and open new one
      openSession(currentSessionId);
    } else {
      // No existing session or no timestamp — open fresh
      openSession();
    }
  }, [activeTab, appPhase, loadingChat, messages.length, sessionStatus, currentSessionId, openSession]);

  const updateInsight = useCallback((insightId: string, updates: { content?: string; category?: string }) => {
    setSavedInsights(prev =>
      prev.map(i =>
        i.id === insightId
          ? {
              ...i,
              ...(updates.content !== undefined && { content: updates.content }),
              ...(updates.category !== undefined && { category: updates.category as Insight['category'] }),
            }
          : i
      )
    );
  }, []);

  const deleteInsight = useCallback((insightId: string) => {
    setSavedInsights(prev => prev.filter(i => i.id !== insightId));
  }, []);

  const handleLogWin = useCallback((text: string) => {
    setWins(prev => [
      { id: `win-${Date.now()}`, text, date: new Date(), tension_type: identifiedTensionState?.primary },
      ...prev,
    ]);
    setStreak(prev => prev + 1);
  }, [identifiedTensionState]);

  const signIn = useCallback(() => {
    localStorage.setItem('toney_signed_in', 'true');
    const hasOnboarded = localStorage.getItem('toney_onboarded') === 'true';
    setOnboardingStep('welcome');
    if (hasOnboarded) {
      let savedTension = loadJSON<IdentifiedTension | null>('toney_tension', null);
      if (!savedTension) savedTension = migrateOldPattern();
      const savedStyle = loadJSON<StyleProfile>('toney_style', defaultStyle);
      const savedInsightsData = loadJSON<Insight[]>('toney_insights', []);
      const savedWins = loadJSON<Win[]>('toney_wins', []);
      const savedStreak = loadJSON<number>('toney_streak', 0);

      if (savedTension) setIdentifiedTension(savedTension);
      setStyleProfile(savedStyle);
      setTempStyle(savedStyle);
      setSavedInsights(savedInsightsData);
      setWins(savedWins);
      setStreak(savedStreak);
      setAppPhase('main');
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.has(hash as ActiveTab)) {
        setActiveTab(hash as ActiveTab);
      } else {
        setActiveTab('home');
      }
    } else {
      setAppPhase('onboarding');
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('toney_signed_in');
    setAppPhase('signed_out');
    setShowSettings(false);
  }, []);

  const finishOnboarding = useCallback(async () => {
    setStyleProfile({ ...defaultStyle });
    localStorage.setItem('toney_onboarded', 'true');

    // Extract goals from multi-select Q7 answer for what_brought_you
    let goalsText = '';
    const goalsAnswer = answers['goals'] || '';
    if (goalsAnswer) {
      const goalsQuestion = questions.find(q => q.id === 'goals');
      if (goalsQuestion) {
        const selectedValues = goalsAnswer.split(',').filter(Boolean);
        const selectedLabels = selectedValues.map(v => {
          const opt = goalsQuestion.options.find(o => o.value === v);
          return opt ? opt.label : v;
        });
        goalsText = selectedLabels.join('; ');
      }
    }

    // Save profile to Supabase — tension_type determined by Strategist at session open
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({
            onboarding_answers: answers,
            tone: defaultStyle.tone,
            depth: defaultStyle.depth,
            learning_styles: defaultStyle.learningStyles,
            onboarding_completed: true,
            ...(goalsText && { what_brought_you: goalsText }),
          }).eq('id', user.id);
        }
      } catch {
        // Supabase save failed — localStorage still has the data
      }
    }

    // Go to main app — straight to chat
    setAppPhase('main');
    setActiveTab('chat');
  }, [answers]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Last question — go straight to finish (goals are extracted in finishOnboarding from answers)
      finishOnboarding();
    }
  }, [currentQuestionIndex, finishOnboarding]);

  const resetAll = useCallback(() => {
    localStorage.removeItem('toney_signed_in');
    localStorage.removeItem('toney_onboarded');
    localStorage.removeItem('toney_pattern');
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_style');
    localStorage.removeItem('toney_insights');
    localStorage.removeItem('toney_wins');
    localStorage.removeItem('toney_streak');

    setAppPhase('signed_out');
    setOnboardingStep('welcome');
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIdentifiedTension(null);
    setWhatBroughtYou('');
    setEmotionalWhy('');
    setMessages([]);
    setSavedInsights([]);
    setWins([]);
    setStreak(0);
    setShowSettings(false);
    setStyleProfile({ ...defaultStyle });
    setTempStyle({ ...defaultStyle });
    setCurrentSessionId(null);
    setSessionHasCard(false);
    setSessionStatus('active');
    setSessionNotes(null);
    setIsFirstSession(true);
    setPreviousSessionMessages([]);
    setPreviousSessionCollapsed(true);
  }, []);

  const retakeQuiz = useCallback(() => {
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_onboarded');
    setOnboardingStep('welcome');
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIdentifiedTension(null);
    setWhatBroughtYou('');
    setEmotionalWhy('');
    setTempStyle({ ...defaultStyle });
    setShowSettings(false);
    setAppPhase('onboarding');
  }, []);

  return (
    <ToneyContext.Provider
      value={{
        appPhase,
        setAppPhase,
        activeTab,
        setActiveTab,
        showSettings,
        setShowSettings,
        onboardingStep,
        setOnboardingStep,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        answers,
        identifiedTension: identifiedTensionState,
        handleAnswer,
        handleNextQuestion,
        handlePrevQuestion,
        whatBroughtYou,
        setWhatBroughtYou,
        emotionalWhy,
        setEmotionalWhy,
        styleProfile,
        setStyleProfile,
        tempStyle,
        setTempStyle,
        currentSessionId,
        messages,
        setMessages,
        chatInput,
        setChatInput,
        isTyping,
        setIsTyping,
        handleSendMessage,
        handleSaveInsight,
        handleSaveCard,
        sessionHasCard,
        sessionStatus,
        sessionNotes,
        endSession,
        dismissSessionNotes,
        openSession,
        startNewSession,
        loadingChat,
        isFirstSession,
        previousSessionMessages,
        previousSessionCollapsed,
        setPreviousSessionCollapsed,
        savedInsights,
        setSavedInsights,
        updateInsight,
        deleteInsight,
        wins,
        streak,
        handleLogWin,
        signIn,
        signOut,
        finishOnboarding,
        resetAll,
        retakeQuiz,
      }}
    >
      {children}
    </ToneyContext.Provider>
  );
}

export function useToney() {
  const context = useContext(ToneyContext);
  if (!context) {
    throw new Error('useToney must be used within a ToneyProvider');
  }
  return context;
}

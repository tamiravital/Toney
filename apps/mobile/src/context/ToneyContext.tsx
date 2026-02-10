'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win, RewireCardCategory, SessionNotesOutput } from '@toney/types';
import { identifyTension, tensionDetails } from '@toney/constants';
import { questions } from '@toney/constants';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'story' | 'questions' | 'pattern';
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
  openSession: () => Promise<void>;
  loadingChat: boolean;

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
            const { data: recentSession } = await supabase
              .from('sessions')
              .select('id')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (recentSession) {
              setCurrentSessionId(recentSession.id);
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
    setSessionHasCard(false); // Reset card state for new session
    setSessionStatus('active');
    setSessionNotes(null);
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      if (!isSupabaseConfigured()) return;
      setLoadingChat(true);
      try {
        const supabase = createClient();
        const { data: dbMessages } = await supabase
          .from('messages')
          .select('id, role, content, created_at')
          .eq('session_id', currentSessionId)
          .order('created_at', { ascending: false })
          .limit(50);

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

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const tension = identifyTension(answers);
      setIdentifiedTension(tension);
      setOnboardingStep('pattern');
    }
  }, [currentQuestionIndex, answers]);

  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      setOnboardingStep('story');
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
        let sessId = currentSessionId;
        if (!sessId) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: sess } = await supabase
              .from('sessions')
              .insert({ user_id: user.id })
              .select('id')
              .single();
            if (sess) {
              sessId = sess.id;
              setCurrentSessionId(sess.id);
            }
          }
        }

        if (sessId) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userMsg.content,
              sessionId: sessId,
            }),
          });
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
  }, [chatInput, currentSessionId]);

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

  const openSession = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    setLoadingChat(true);
    setMessages([]);
    setSessionHasCard(false);
    setSessionStatus('active');
    setSessionNotes(null);

    try {
      const res = await fetch('/api/session/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (data.sessionId) {
        setCurrentSessionId(data.sessionId);
      }

      if (data.message) {
        const openingMsg: Message = {
          id: data.message.id || `msg-${Date.now()}`,
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date(data.message.timestamp || Date.now()),
          canSave: false,
          saved: false,
        };
        setMessages([openingMsg]);
      }
    } catch (err) {
      console.error('[Toney] Session open failed:', err);
    } finally {
      setLoadingChat(false);
    }
  }, []);

  // ── Auto-open session when user navigates to chat ──
  const sessionOpenedRef = useRef(false);

  useEffect(() => {
    if (appPhase !== 'main') return;
    if (activeTab !== 'chat') {
      // Reset when leaving chat, so next visit opens a new session if needed
      sessionOpenedRef.current = false;
      return;
    }
    // Don't open if still loading messages for an existing session
    if (loadingChat) return;
    // Don't open if we already have messages (existing session)
    if (messages.length > 0) return;
    // Don't open if we already fired openSession this visit
    if (sessionOpenedRef.current) return;
    // Don't open if session is ending/completed (user just ended a session)
    if (sessionStatus !== 'active') return;

    sessionOpenedRef.current = true;
    openSession();
  }, [activeTab, appPhase, loadingChat, messages.length, sessionStatus, openSession]);

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

    // Save profile to Supabase
    if (isSupabaseConfigured() && identifiedTensionState) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({
            tension_type: identifiedTensionState.primary,
            secondary_tension_type: identifiedTensionState.secondary || null,
            tension_score: identifiedTensionState.primaryScore,
            onboarding_answers: answers,
            tone: defaultStyle.tone,
            depth: defaultStyle.depth,
            learning_styles: defaultStyle.learningStyles,
            onboarding_completed: true,
            ...(whatBroughtYou && { what_brought_you: whatBroughtYou }),
            ...(emotionalWhy && { emotional_why: emotionalWhy }),
          }).eq('id', user.id);
        }
      } catch {
        // Supabase save failed — localStorage still has the data
      }
    }

    // Go to main app — home screen
    setAppPhase('main');
    setActiveTab('home');
  }, [identifiedTensionState, answers, whatBroughtYou, emotionalWhy]);

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
        loadingChat,
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

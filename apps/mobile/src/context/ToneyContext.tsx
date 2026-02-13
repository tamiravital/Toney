'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win, FocusArea, RewireCardCategory, SessionNotesOutput, SessionSuggestion } from '@toney/types';
import { tensionDetails } from '@toney/constants';
import { questions } from '@toney/constants';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'questions';
type AppPhase = 'loading' | 'signed_out' | 'onboarding' | 'main';
type ActiveTab = 'home' | 'chat' | 'rewire' | 'journey';
type SessionStatus = 'active' | 'ending' | 'completed';

const VALID_TABS = new Set<ActiveTab>(['home', 'chat', 'rewire', 'journey']);

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

  // Profile
  displayName: string | null;
  setDisplayName: (name: string | null) => void;
  understandingSnippet: string | null;

  // Session suggestions
  suggestions: SessionSuggestion[];

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
  openSession: (previousSessionId?: string, preserveMessages?: boolean, suggestionIndex?: number) => Promise<void>;
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
  handleAutoWin: (text: string) => void;
  deleteWin: (winId: string) => void;

  // Focus Areas
  focusAreas: FocusArea[];
  handleSaveFocusArea: (text: string, sessionId?: string | null) => Promise<void>;
  handleArchiveFocusArea: (focusAreaId: string) => Promise<void>;

  // Sim mode
  simMode: boolean;
  buildApiUrl: (path: string) => string;

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
  tone: 3,
  depth: 3,
  learningStyles: [],
};

export function ToneyProvider({ children }: { children: ReactNode }) {
  const [appPhase, setAppPhase] = useState<AppPhase>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(loadJSON<string | null>('toney_display_name', null));
  const [understandingSnippet, setUnderstandingSnippet] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([]);

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

  // Focus Areas
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);

  // Sim mode
  const [simMode, setSimMode] = useState(false);
  const simProfileIdRef = useRef<string | null>(null);
  const simSecretRef = useRef<string | null>(null);

  const buildApiUrl = useCallback((path: string) => {
    if (!simMode || !simProfileIdRef.current || !simSecretRef.current) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}sim=${simProfileIdRef.current}&simSecret=${simSecretRef.current}`;
  }, [simMode]);

  // ── Hydrate from localStorage + check Supabase session on mount ──
  useEffect(() => {
    const hydrate = async () => {
      // ── Sim mode detection ──
      const params = new URLSearchParams(window.location.search);
      const simId = params.get('sim');
      const secret = params.get('simSecret');

      if (simId && secret) {
        setSimMode(true);
        simProfileIdRef.current = simId === 'new' ? null : simId;
        simSecretRef.current = secret;

        if (simId === 'new') {
          // New sim user — create profile, start onboarding
          try {
            const res = await fetch(`/api/sim/create-profile?simSecret=${secret}`, { method: 'POST' });
            if (res.ok) {
              const { id } = await res.json();
              simProfileIdRef.current = id;
              window.history.replaceState(null, '', `?sim=${id}&simSecret=${secret}`);
            } else {
              console.error('[Sim] create-profile failed:', res.status, await res.text());
            }
          } catch (err) {
            console.error('[Sim] create-profile error:', err);
          }
          setAppPhase('onboarding');
          return;
        }

        // Existing sim user — hydrate from API
        try {
          const res = await fetch(`/api/sim/hydrate?sim=${simId}&simSecret=${secret}`);
          if (res.ok) {
            const data = await res.json();
            const p = data.profile;
            if (p) {
              if (p.display_name) setDisplayName(p.display_name);
              if (p.understanding_snippet) setUnderstandingSnippet(p.understanding_snippet);
              if (p.tension_type) {
                const tension: IdentifiedTension = {
                  primary: p.tension_type as TensionType,
                  primaryScore: 5,
                  primaryDetails: tensionDetails[p.tension_type as TensionType],
                  ...(p.secondary_tension_type && {
                    secondary: p.secondary_tension_type as TensionType,
                    secondaryDetails: tensionDetails[p.secondary_tension_type as TensionType],
                  }),
                };
                setIdentifiedTension(tension);
              }
              if (p.tone || p.depth || p.learning_styles) {
                const style: StyleProfile = {
                  tone: p.tone ?? defaultStyle.tone,
                  depth: p.depth ?? defaultStyle.depth,
                  learningStyles: (p.learning_styles as StyleProfile['learningStyles']) ?? defaultStyle.learningStyles,
                };
                setStyleProfile(style);
                setTempStyle(style);
              }
            }
            if (data.cards?.length > 0) setSavedInsights(data.cards);
            if (data.focusAreas?.length > 0) setFocusAreas(data.focusAreas);
            if (data.wins?.length > 0) setWins(data.wins);
            if (data.suggestions?.length > 0) setSuggestions(data.suggestions);
            if (data.recentSession) {
              setCurrentSessionId(data.recentSession.id);
              sessionIdRef.current = data.recentSession.id;
              if (data.recentSession.messages?.length > 0) {
                setMessages(data.recentSession.messages.map((m: { id: string; role: string; content: string; created_at: string }) => ({
                  id: m.id,
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                  timestamp: new Date(m.created_at),
                  canSave: m.role === 'assistant',
                  saved: false,
                })));
              }
              if (data.recentSession.status === 'completed') {
                setSessionStatus('completed');
              }
            }
            setIsFirstSession((data.sessionCount || 0) <= 1);
            if (data.lastMessageTime) {
              lastMessageTimestampRef.current = data.lastMessageTime;
            }
            if (p?.onboarding_completed) {
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
          }
        } catch (err) {
          console.error('[Sim] Hydrate failed:', err);
          setAppPhase('onboarding');
        }
        return;
      }

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
              .select('onboarding_completed, tension_type, secondary_tension_type, tone, depth, learning_styles, display_name, understanding_snippet')
              .eq('id', user.id)
              .single();

            if (profile?.onboarding_completed) {
              hasOnboarded = true;
              localStorage.setItem('toney_onboarded', 'true');

              if (profile.tension_type) {
                const tension: IdentifiedTension = {
                  primary: profile.tension_type as TensionType,
                  primaryScore: 5,
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
                  depth: profile.depth ?? defaultStyle.depth,
                  learningStyles: (profile.learning_styles as StyleProfile['learningStyles']) ?? defaultStyle.learningStyles,
                };
                saveJSON('toney_style', style);
                setStyleProfile(style);
                setTempStyle(style);
              }
              if (profile.understanding_snippet) {
                setUnderstandingSnippet(profile.understanding_snippet);
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
            // Fetch display name if not cached
            if (!loadJSON<string | null>('toney_display_name', null)) {
              const { data: nameRow } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', user.id)
                .single();
              if (nameRow?.display_name) {
                setDisplayName(nameRow.display_name);
                saveJSON('toney_display_name', nameRow.display_name);
              }
            }

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
              .select('id, title, content, category, created_at, is_focus')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (dbCards && dbCards.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const insights: Insight[] = dbCards.map((card: any) => ({
                id: card.id,
                title: card.title || undefined,
                content: card.content,
                category: card.category as Insight['category'],
                savedAt: new Date(card.created_at),
                fromChat: true,
                tags: [],
                is_focus: card.is_focus || false,
              }));
              setSavedInsights(insights);
              saveJSON('toney_insights', insights);
            }

            // Hydrate focus areas
            const { data: dbFocusAreas } = await supabase
              .from('focus_areas')
              .select('*')
              .eq('user_id', user.id)
              .is('archived_at', null)
              .order('created_at', { ascending: true });

            if (dbFocusAreas) {
              setFocusAreas(dbFocusAreas as FocusArea[]);
            }

            // Hydrate wins from Supabase
            try {
              const winsRes = await fetch(buildApiUrl('/api/wins'));
              if (winsRes.ok) {
                const dbWins = await winsRes.json();
                if (Array.isArray(dbWins) && dbWins.length > 0) {
                  setWins(dbWins.map((w: Win) => ({
                    ...w,
                    date: new Date(w.created_at || Date.now()),
                  })));
                  // Compute streak from win dates
                  const winDates = new Set(dbWins.map((w: Win) =>
                    new Date(w.created_at || Date.now()).toDateString()
                  ));
                  let streakCount = 0;
                  const today = new Date();
                  // Start from today or yesterday
                  let checkDate = new Date(today);
                  if (!winDates.has(checkDate.toDateString())) {
                    checkDate.setDate(checkDate.getDate() - 1);
                  }
                  while (winDates.has(checkDate.toDateString())) {
                    streakCount++;
                    checkDate.setDate(checkDate.getDate() - 1);
                  }
                  setStreak(streakCount);
                }
              }
            } catch {
              // Non-critical — localStorage wins still available
            }

            // Hydrate session suggestions
            try {
              const res = await fetch(buildApiUrl('/api/suggestions'));
              if (res.ok) {
                const { suggestions: s } = await res.json();
                if (Array.isArray(s) && s.length > 0) {
                  setSuggestions(s);
                }
              }
            } catch {
              // Non-critical
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

    // Mark messages as not-yet-loaded for this session change
    messagesLoadedRef.current = false;

    // Skip reload if we're doing an inline session open (messages are being streamed in)
    if (skipMessageLoadRef.current) {
      skipMessageLoadRef.current = false;
      messagesLoadedRef.current = true; // Inline open = messages already being streamed
      return;
    }

    setSessionHasCard(false);
    setSessionNotes(null);
    setPreviousSessionMessages([]);
    setPreviousSessionCollapsed(true);
    if (!currentSessionId) {
      setSessionStatus('active');
      setMessages([]);
      messagesLoadedRef.current = true; // No session = nothing to load
      return;
    }

    const loadMessages = async () => {
      if (simMode && simProfileIdRef.current && simSecretRef.current) {
        setLoadingChat(true);
        try {
          const res = await fetch(buildApiUrl(`/api/sim/session-data?sessionId=${currentSessionId}`));
          if (res.ok) {
            const data = await res.json();
            if (data.cardCount > 0) setSessionHasCard(true);
            const simCompleted = data.sessionStatus === 'completed';
            if (simCompleted) setSessionStatus('completed');
            else setSessionStatus('active');
            if (data.messages?.length > 0) {
              const mapped = data.messages.map((m: { id: string; role: string; content: string; created_at: string }) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: new Date(m.created_at),
                canSave: m.role === 'assistant',
                saved: false,
              }));
              if (simCompleted) {
                setMessages([]);
              } else {
                setMessages(mapped);
              }
            } else {
              setMessages([]);
            }
          }
        } catch { setMessages([]); }
        finally { setLoadingChat(false); messagesLoadedRef.current = true; }
        return;
      }
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
        const isCompleted = sessionData?.session_status === 'completed';
        if (isCompleted) {
          setSessionStatus('completed');
        } else {
          setSessionStatus('active');
        }

        if (dbMessages && dbMessages.length > 0) {
          const mapped = dbMessages.reverse().map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.created_at),
            canSave: m.role === 'assistant',
            saved: false,
          }));

          if (isCompleted) {
            // Completed session: don't fill messages (keeps suggestion picker visible).
            // Messages are available in Journey tab — no need to show stale chat.
            setMessages([]);
          } else {
            setMessages(mapped);
          }
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoadingChat(false);
        messagesLoadedRef.current = true;
      }
    };

    loadMessages();
  }, [currentSessionId, appPhase, simMode, buildApiUrl]);

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

    if (isSupabaseConfigured() || simMode) {
      try {
        const sessId = sessionIdRef.current;

        // Session should already exist via auto-open
        if (!sessId) {
          console.error('[Toney] No session ID — auto-open may not have fired');
          setIsTyping(false);
          return;
        }

        const res = await fetch(buildApiUrl('/api/chat'), {
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
          console.error('[Toney] Chat API returned JSON (non-streaming):', res.status, data);
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
  }, [chatInput, simMode, buildApiUrl]);

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

      // Sim mode: save via API
      if (simMode) {
        try {
          await fetch(buildApiUrl('/api/sim/save-card'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: (editedContent || msg.content).substring(0, 80),
              content: editedContent || msg.content,
              category: category || 'reframe',
              sessionId: currentSessionId,
            }),
          });
        } catch (err) { console.error('Sim save insight failed:', err); }
        return null;
      }

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
            const { data, error } = await supabase.from('rewire_cards').insert({
              user_id: user.id,
              source_message_id: messageId.startsWith('msg-') ? null : messageId,
              category: category || 'reframe',
              title: (editedContent || msg.content).substring(0, 80),
              content: editedContent || msg.content,
              auto_generated: false,
              trigger_context: triggerContext || null,
            }).select('id').single();
            if (error) console.error('Failed to save insight card:', error);
            return data?.id || null;
          }
        } catch (err) { console.error('Failed to save insight card:', err); }
      }
    } else if (msg) {
      setSavedInsights(prev => prev.filter(i => i.content !== msg.content));
    }
    return null;
  }, [messages, identifiedTensionState, simMode, buildApiUrl, currentSessionId]);

  const handleSaveCard = useCallback(async (title: string, content: string, category: RewireCardCategory) => {
    // Add to local state
    const newInsight: Insight = {
      id: `insight-${Date.now()}`,
      title,
      content,
      category,
      savedAt: new Date(),
      fromChat: true,
      tags: [],
    };
    setSavedInsights(prev => [newInsight, ...prev]);
    setSessionHasCard(true);

    // Sim mode: save via API
    if (simMode) {
      try {
        await fetch(buildApiUrl('/api/sim/save-card'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, category, sessionId: currentSessionId }),
        });
      } catch (err) { console.error('Sim save card failed:', err); }
      return;
    }

    // Save to Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from('rewire_cards').insert({
            user_id: user.id,
            category,
            title,
            content,
            auto_generated: false,
            session_id: currentSessionId || null,
          });
          if (error) console.error('Failed to save rewire card:', error);
        }
      } catch (err) { console.error('Failed to save rewire card:', err); }
    }
  }, [identifiedTensionState, currentSessionId, simMode, buildApiUrl]);

  const endSession = useCallback(async () => {
    if (!currentSessionId || sessionStatus !== 'active') return;
    setSessionStatus('ending');

    try {
      const res = await fetch(buildApiUrl('/api/session/close'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      if (!res.ok) {
        console.error('Session close failed:', res.status);
        setSessionStatus('active');
        return;
      }

      const data = await res.json();

      if (data.sessionNotes) {
        setSessionNotes(data.sessionNotes as SessionNotesOutput);
      }

      setSessionStatus('completed');
    } catch {
      // If session close fails, revert to active
      setSessionStatus('active');
    }
  }, [currentSessionId, sessionStatus, buildApiUrl]);

  const dismissSessionNotes = useCallback(() => {
    setSessionNotes(null);
  }, []);

  const openSession = useCallback(async (previousSessionId?: string, preserveMessages?: boolean, suggestionIndex?: number) => {
    if (!isSupabaseConfigured() && !simMode) return;
    if (openSessionInFlightRef.current) return; // Bug 2: Already opening a session
    openSessionInFlightRef.current = true;
    sessionOpenedRef.current = true; // Prevent auto-open from re-firing
    userInitiatedSessionRef.current = true; // Mark as user-initiated (not auto-open)
    openSessionFailedRef.current = false; // Clear any previous failure

    setLoadingChat(true);
    setSessionHasCard(false);
    setSessionStatus('active');
    setSessionNotes(null);

    // When preserving messages, capture current messages as previous session (collapsed)
    if (preserveMessages) {
      skipMessageLoadRef.current = true;
      const currentNonDividerMessages = messagesRef.current.filter(m => m.role !== 'divider'); // Bug 4: Read from ref, not stale closure
      setPreviousSessionMessages(currentNonDividerMessages);
      setPreviousSessionCollapsed(true);
      setMessages([]);
    } else {
      setPreviousSessionMessages([]);
      setMessages([]);
    }

    try {
      const res = await fetch(buildApiUrl('/api/session/open'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(previousSessionId && { previousSessionId }),
          ...(suggestionIndex != null && { suggestionIndex }),
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
      openSessionFailedRef.current = true; // Bug 3: Mark failure — prevents auto-retry on tab switch
      setMessages([{
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble starting a session right now. Please try again in a moment.",
        timestamp: new Date(),
        canSave: false,
        saved: false,
      }]);
      setLoadingChat(false);
    } finally {
      openSessionInFlightRef.current = false; // Bug 2: Release mutex
    }
  }, [simMode, buildApiUrl]);

  // ── Auto-open session when user navigates to chat ──
  const sessionOpenedRef = useRef(false);
  const lastMessageTimestampRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const skipMessageLoadRef = useRef(false); // Skip message reload during inline session open
  const messagesLoadedRef = useRef(false); // Bug 1: block auto-open until messages loaded
  const openSessionInFlightRef = useRef(false); // Bug 2: mutex for concurrent openSession calls
  const openSessionFailedRef = useRef(false); // Bug 3: prevent auto-retry after failure
  const messagesRef = useRef<Message[]>([]); // Bug 4: current messages for openSession closure
  const userInitiatedSessionRef = useRef(false); // Suppress auto-open when suggestion picker should show

  const startNewSession = useCallback(async () => {
    const prevId = currentSessionId;
    sessionOpenedRef.current = true; // Prevent auto-open from firing
    openSessionFailedRef.current = false; // Clear failure on manual retry
    // Open new session inline — preserve old messages with a divider
    await openSession(prevId || undefined, true);
  }, [currentSessionId, openSession]);

  // Keep sessionIdRef in sync with state
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Keep messagesRef in sync with state (Bug 4: avoids stale closure in openSession)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (appPhase !== 'main') return;
    if (activeTab !== 'chat') {
      // Only reset if no failure — prevents retry loop on tab return
      if (!openSessionFailedRef.current) {
        sessionOpenedRef.current = false;
        userInitiatedSessionRef.current = false;
      }
      return;
    }
    if (loadingChat) return;
    if (!messagesLoadedRef.current) return; // Wait for message loader to finish first
    if (openSessionFailedRef.current) return; // Don't auto-retry after failure
    if (sessionOpenedRef.current) return;
    if (sessionStatus !== 'active') return;

    // If suggestions exist, show picker first — don't auto-open unless user tapped a suggestion
    if (suggestions.length > 0 && !userInitiatedSessionRef.current) return;

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
  }, [activeTab, appPhase, loadingChat, messages.length, sessionStatus, currentSessionId, openSession, suggestions.length]);

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

  const handleLogWin = useCallback(async (text: string) => {
    const tempId = `win-${Date.now()}`;
    setWins(prev => [
      { id: tempId, text, date: new Date(), tension_type: identifiedTensionState?.primary, source: 'manual' },
      ...prev,
    ]);
    setStreak(prev => prev + 1);

    try {
      const res = await fetch(buildApiUrl('/api/wins'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          tensionType: identifiedTensionState?.primary || null,
          source: 'manual',
        }),
      });
      const data = await res.json();
      if (data.id) {
        setWins(prev => prev.map(w => w.id === tempId ? { ...w, id: data.id } : w));
      }
    } catch { /* non-critical — local state has the win */ }
  }, [identifiedTensionState, buildApiUrl]);

  const handleAutoWin = useCallback(async (text: string) => {
    const tempId = `win-${Date.now()}`;
    setWins(prev => [
      { id: tempId, text, date: new Date(), tension_type: identifiedTensionState?.primary, session_id: sessionIdRef.current, source: 'coach' },
      ...prev,
    ]);
    setStreak(prev => prev + 1);

    try {
      const res = await fetch(buildApiUrl('/api/wins'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          tensionType: identifiedTensionState?.primary || null,
          sessionId: sessionIdRef.current,
          source: 'coach',
        }),
      });
      const data = await res.json();
      if (data.id) {
        setWins(prev => prev.map(w => w.id === tempId ? { ...w, id: data.id } : w));
      }
    } catch { /* non-critical — local state has the win */ }
  }, [identifiedTensionState, buildApiUrl]);

  const deleteWin = useCallback(async (winId: string) => {
    setWins(prev => prev.filter(w => w.id !== winId));

    try {
      await fetch(buildApiUrl('/api/wins'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winId }),
      });
    } catch { /* non-critical */ }
  }, [buildApiUrl]);

  const handleSaveFocusArea = useCallback(async (text: string, sessionId?: string | null) => {
    // Optimistic local add
    const tempFocusArea: FocusArea = {
      id: `focus-${Date.now()}`,
      user_id: '',
      text,
      source: 'coach',
      session_id: sessionId || null,
      created_at: new Date().toISOString(),
    };
    setFocusAreas(prev => [...prev, tempFocusArea]);

    // Save to DB
    try {
      const res = await fetch(buildApiUrl('/api/focus-areas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', text, source: 'coach', sessionId: sessionId || null }),
      });
      const data = await res.json();
      if (data.id) {
        setFocusAreas(prev => prev.map(fa =>
          fa.id === tempFocusArea.id ? { ...fa, id: data.id, user_id: data.user_id } : fa
        ));
      }
    } catch { /* non-critical — local state has the focus area */ }
  }, [buildApiUrl]);

  const handleArchiveFocusArea = useCallback(async (focusAreaId: string) => {
    // Optimistic local remove
    setFocusAreas(prev => prev.filter(fa => fa.id !== focusAreaId));

    // Save to DB
    try {
      await fetch(buildApiUrl('/api/focus-areas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', focusAreaId }),
      });
    } catch { /* non-critical */ }
  }, [buildApiUrl]);

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

    // Extract goals from multi-select Q7 answer for what_brought_you (used by both sim and normal paths)
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

    if (simMode) {
      if (!simProfileIdRef.current || !simSecretRef.current) {
        console.error('[Sim] No profile ID — create-profile may have failed');
        setAppPhase('main');
        setActiveTab('chat');
        return;
      }
      // Save onboarding data via API (can't use browser Supabase for sim_ tables)
      // Save-onboarding MUST complete (seed reads from it), but seed runs in background
      // so the user transitions to chat immediately.
      try {
        const onboardRes = await fetch(buildApiUrl('/api/sim/save-onboarding'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers,
            tone: defaultStyle.tone,
            depth: defaultStyle.depth,
            learningStyles: defaultStyle.learningStyles,
            whatBroughtYou: goalsText || undefined,
          }),
        });
        if (!onboardRes.ok) {
          console.error('[Sim] save-onboarding failed:', onboardRes.status, await onboardRes.text().catch(() => ''));
        }
      } catch (err) {
        console.error('[Sim] save-onboarding threw:', err);
      }
      // Transition to chat immediately — session open will handle missing understanding
      setAppPhase('main');
      setActiveTab('chat');
      // Seed understanding in background (session open has legacy-user fallback for missing understanding)
      fetch(buildApiUrl('/api/seed'), { method: 'POST' }).then(async (seedRes) => {
        if (!seedRes.ok) {
          console.error('[Sim] seed failed:', seedRes.status, await seedRes.text().catch(() => ''));
          return;
        }
        const seedData = await seedRes.json();
        if (seedData.tensionType) {
          const tension: IdentifiedTension = {
            primary: seedData.tensionType as TensionType,
            primaryScore: 5,
            primaryDetails: tensionDetails[seedData.tensionType as TensionType],
            ...(seedData.secondaryTensionType && {
              secondary: seedData.secondaryTensionType as TensionType,
              secondaryDetails: tensionDetails[seedData.secondaryTensionType as TensionType],
            }),
          };
          setIdentifiedTension(tension);
        }
      }).catch(err => console.error('[Sim] seed threw:', err));
      return;
    }

    // Save profile to Supabase, then seed understanding
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

          // Seed understanding — determines tension + creates initial narrative
          try {
            const seedRes = await fetch(buildApiUrl('/api/seed'), { method: 'POST' });
            if (seedRes.ok) {
              const seedData = await seedRes.json();
              if (seedData.tensionType) {
                const tension: IdentifiedTension = {
                  primary: seedData.tensionType as TensionType,
                  primaryScore: 5,
                  primaryDetails: tensionDetails[seedData.tensionType as TensionType],
                  ...(seedData.secondaryTensionType && {
                    secondary: seedData.secondaryTensionType as TensionType,
                    secondaryDetails: tensionDetails[seedData.secondaryTensionType as TensionType],
                  }),
                };
                saveJSON('toney_tension', tension);
                setIdentifiedTension(tension);
              }
            }
          } catch {
            // Non-fatal — session open handles missing understanding
          }
        }
      } catch {
        // Supabase save failed — localStorage still has the data
      }
    }

    // Go to main app — straight to chat
    setAppPhase('main');
    setActiveTab('chat');
  }, [answers, simMode, buildApiUrl]);

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
    setFocusAreas([]);
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
        displayName,
        setDisplayName,
        understandingSnippet,
        suggestions,
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
        handleAutoWin,
        deleteWin,
        focusAreas,
        handleSaveFocusArea,
        handleArchiveFocusArea,
        simMode,
        buildApiUrl,
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

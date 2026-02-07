'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win } from '@toney/types';
import { identifyTension, tensionDetails } from '@toney/constants';
import { questions, TopicKey, ALL_TOPICS, topicDetails } from '@toney/constants';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'questions' | 'pattern' | 'style_intro' | 'style_quiz' | 'topic_picker';
type AppPhase = 'loading' | 'signed_out' | 'onboarding' | 'main';
type ActiveTab = 'home' | 'chat' | 'rewire' | 'wins';

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
  quizStep: number;
  setQuizStep: (step: number) => void;
  identifiedTension: IdentifiedTension | null;
  handleAnswer: (questionId: string, value: string) => void;
  handleNextQuestion: () => void;
  handlePrevQuestion: () => void;

  // Style
  styleProfile: StyleProfile;
  setStyleProfile: (profile: StyleProfile) => void;
  tempStyle: StyleProfile;
  setTempStyle: (style: StyleProfile | ((prev: StyleProfile) => StyleProfile)) => void;

  // Life context (onboarding)
  tempLifeContext: { lifeStage: string; incomeType: string; relationship: string; emotionalWhy: string };
  setTempLifeContext: (ctx: { lifeStage: string; incomeType: string; relationship: string; emotionalWhy: string } | ((prev: { lifeStage: string; incomeType: string; relationship: string; emotionalWhy: string }) => { lifeStage: string; incomeType: string; relationship: string; emotionalWhy: string })) => void;

  // Topics
  activeTopic: TopicKey | null;
  topicConversations: Record<string, string>; // topicKey -> conversationId
  selectTopic: (topicKey: TopicKey) => void;
  leaveTopic: () => void;

  // Chat
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  handleSendMessage: (overrideText?: string) => void;
  handleSaveInsight: (messageId: string, editedContent?: string, category?: string) => void;
  loadingTopic: boolean;

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
  finishOnboarding: (topicKey: TopicKey) => void;

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
  const [quizStep, setQuizStep] = useState(0);

  // Style
  const [styleProfile, setStyleProfile] = useState<StyleProfile>({ ...defaultStyle });
  const [tempStyle, setTempStyle] = useState<StyleProfile>({ ...defaultStyle });
  const [tempLifeContext, setTempLifeContext] = useState({ lifeStage: '', incomeType: '', relationship: '', emotionalWhy: '' });

  // Topics
  const [activeTopic, setActiveTopic] = useState<TopicKey | null>(null);
  const [topicConversations, setTopicConversations] = useState<Record<string, string>>({});

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingTopic, setLoadingTopic] = useState(false);

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

      // Restore topic conversations from Supabase
      if (hasOnboarded && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: topicConvs } = await supabase
              .from('conversations')
              .select('id, topic_key')
              .eq('user_id', user.id)
              .not('topic_key', 'is', null);

            if (topicConvs && topicConvs.length > 0) {
              const map: Record<string, string> = {};
              for (const conv of topicConvs) {
                if (conv.topic_key) map[conv.topic_key] = conv.id;
              }
              setTopicConversations(map);
            }
          }
        } catch {
          // Non-critical — topic conversations will be created on demand
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
              .select('id, title, content, category, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (dbCards && dbCards.length > 0) {
              const insights: Insight[] = dbCards.map(card => ({
                id: card.id,
                content: card.content,
                category: card.category as Insight['category'],
                savedAt: new Date(card.created_at),
                fromChat: true,
                tags: [],
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
        // Parse URL hash for topic-based navigation
        const hash = window.location.hash.replace('#', '');
        if (hash.startsWith('chat/')) {
          const topicKey = hash.replace('chat/', '') as TopicKey;
          if (ALL_TOPICS.includes(topicKey)) {
            setActiveTab('chat');
            setActiveTopic(topicKey);
          } else {
            setActiveTab('chat');
          }
        } else if (hash === 'chat') {
          setActiveTab('chat');
          // Restore last active topic so user lands in their last conversation
          const lastTopic = localStorage.getItem('toney_active_topic') as TopicKey | null;
          if (lastTopic && ALL_TOPICS.includes(lastTopic)) {
            setActiveTopic(lastTopic);
          }
        } else if (VALID_TABS.has(hash as ActiveTab)) {
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

  // Persist activeTopic to localStorage (only save, never remove — so Chat tab can restore it)
  useEffect(() => {
    if (appPhase === 'loading') return;
    if (activeTopic) {
      localStorage.setItem('toney_active_topic', activeTopic);
    }
  }, [activeTopic, appPhase]);

  // ── URL Hash Navigation ──

  // Sync activeTab + activeTopic → URL hash
  useEffect(() => {
    if (appPhase !== 'main') return;
    if (showSettings) return;
    const targetHash = activeTab === 'chat' && activeTopic
      ? `chat/${activeTopic}`
      : activeTab;
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash !== targetHash) {
      window.history.pushState(null, '', `#${targetHash}`);
    }
  }, [activeTab, activeTopic, appPhase, showSettings]);

  // Sync URL hash → activeTab + activeTopic (browser back/forward)
  useEffect(() => {
    if (appPhase !== 'main') return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'settings') {
        if (!showSettings) setShowSettings(true);
      } else if (hash.startsWith('chat/')) {
        const topicKey = hash.replace('chat/', '') as TopicKey;
        if (ALL_TOPICS.includes(topicKey)) {
          if (showSettings) setShowSettings(false);
          setActiveTab('chat');
          setActiveTopic(topicKey);
        }
      } else if (hash === 'chat') {
        if (showSettings) setShowSettings(false);
        setActiveTab('chat');
        // Restore last active topic
        const lastTopic = localStorage.getItem('toney_active_topic') as TopicKey | null;
        if (lastTopic && ALL_TOPICS.includes(lastTopic)) {
          setActiveTopic(lastTopic);
        } else {
          setActiveTopic(null);
        }
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
        const targetHash = activeTab === 'chat' && activeTopic
          ? `chat/${activeTopic}`
          : activeTab;
        window.history.pushState(null, '', `#${targetHash}`);
      }
    }
  }, [showSettings, appPhase, activeTab, activeTopic]);

  // ── Load messages when activeTopic changes ──
  useEffect(() => {
    if (appPhase !== 'main') return;
    if (!activeTopic) {
      setMessages([]);
      return;
    }

    const convId = topicConversations[activeTopic];
    if (!convId) {
      setMessages([]);
      return;
    }

    // Load last 50 messages for this topic conversation
    const loadMessages = async () => {
      if (!isSupabaseConfigured()) return;
      setLoadingTopic(true);
      try {
        const supabase = createClient();
        const { data: dbMessages } = await supabase
          .from('messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (dbMessages && dbMessages.length > 0) {
          // Filter out [TOPIC_OPENER] instructions that may have been saved
          const filtered = dbMessages.reverse().filter(m => !m.content.startsWith('[TOPIC_OPENER]'));
          setMessages(filtered.map(m => ({
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
        setLoadingTopic(false);
      }
    };

    loadMessages();
  }, [activeTopic, topicConversations, appPhase]);

  // ── Wrapped setActiveTab: restore last topic when switching to chat ──
  const setActiveTabWrapped = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'chat' && !activeTopic) {
      const lastTopic = localStorage.getItem('toney_active_topic') as TopicKey | null;
      if (lastTopic && ALL_TOPICS.includes(lastTopic)) {
        setActiveTopic(lastTopic);
      }
    }
  }, [activeTopic]);

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
    }
  }, [currentQuestionIndex]);

  // ── Topic selection ──
  const selectTopic = useCallback(async (topicKey: TopicKey) => {
    setActiveTopic(topicKey);
    setActiveTab('chat');

    // If conversation exists, messages will be loaded by the effect
    const existingConvId = topicConversations[topicKey];
    if (existingConvId) return;

    if (!isSupabaseConfigured()) return;

    setLoadingTopic(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create conversation for this topic
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, topic_key: topicKey })
        .select('id')
        .single();

      if (!conv) return;

      setTopicConversations(prev => ({ ...prev, [topicKey]: conv.id }));

      // Generate personalized first question via Claude
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[TOPIC_OPENER] The user just opened the "${topicDetails[topicKey].name}" topic for the first time. Generate a warm, personalized opening question that invites them to share what's on their mind about this topic. Keep it 2-3 sentences max.`,
          conversationId: conv.id,
          topicKey,
        }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages([{
          id: data.message.id || `msg-${Date.now()}`,
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date(data.message.timestamp || Date.now()),
          canSave: false,
          saved: false,
        }]);
      }
    } catch (err) {
      console.error('[Toney] Topic creation failed:', err);
    } finally {
      setLoadingTopic(false);
    }
  }, [topicConversations]);

  const leaveTopic = useCallback(() => {
    setActiveTopic(null);
    setMessages([]);
  }, []);

  const handleSendMessage = useCallback(async (overrideText?: string) => {
    const text = overrideText || chatInput;
    if (!text.trim() || !activeTopic) return;

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
        let convId = topicConversations[activeTopic];
        if (!convId) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: conv } = await supabase
              .from('conversations')
              .insert({ user_id: user.id, topic_key: activeTopic })
              .select('id')
              .single();
            if (conv) {
              convId = conv.id;
              setTopicConversations(prev => ({ ...prev, [activeTopic]: conv.id }));
            }
          }
        }

        if (convId) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userMsg.content,
              conversationId: convId,
              topicKey: activeTopic,
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
  }, [chatInput, activeTopic, topicConversations]);

  const handleSaveInsight = useCallback((messageId: string, editedContent?: string, category?: string) => {
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
      if (isSupabaseConfigured() && activeTopic) {
        const saveToDb = async () => {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('rewire_cards').insert({
                user_id: user.id,
                source_message_id: messageId.startsWith('msg-') ? null : messageId,
                category: category || 'reframe',
                title: (editedContent || msg.content).substring(0, 80),
                content: editedContent || msg.content,
                tension_type: identifiedTensionState?.primary || null,
                topic_key: activeTopic,
                auto_generated: false,
              });
            }
          } catch { /* non-critical */ }
        };
        saveToDb();
      }
    } else if (msg) {
      setSavedInsights(prev => prev.filter(i => i.content !== msg.content));
    }
  }, [messages, identifiedTensionState, activeTopic]);

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
    setOnboardingStep('questions');
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
      if (hash.startsWith('chat/')) {
        const topicKey = hash.replace('chat/', '') as TopicKey;
        if (ALL_TOPICS.includes(topicKey)) {
          setActiveTab('chat');
          setActiveTopic(topicKey);
        } else {
          setActiveTab('home');
        }
      } else if (VALID_TABS.has(hash as ActiveTab)) {
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

  const finishOnboarding = useCallback(async (topicKey: TopicKey) => {
    setStyleProfile({ ...tempStyle });
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
            tone: tempStyle.tone,
            depth: tempStyle.depth,
            learning_styles: tempStyle.learningStyles || [],
            onboarding_completed: true,
            ...(tempLifeContext.lifeStage && { life_stage: tempLifeContext.lifeStage }),
            ...(tempLifeContext.incomeType && { income_type: tempLifeContext.incomeType }),
            ...(tempLifeContext.relationship && { relationship_status: tempLifeContext.relationship }),
            ...(tempLifeContext.emotionalWhy && { emotional_why: tempLifeContext.emotionalWhy }),
          }).eq('id', user.id);
        }
      } catch {
        // Supabase save failed — localStorage still has the data
      }
    }

    // Go to main app and select the chosen topic
    setAppPhase('main');
    setActiveTopic(topicKey);
    setActiveTab('chat');

    // Create conversation and generate first question
    if (isSupabaseConfigured()) {
      setLoadingTopic(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if conversation already exists (e.g. from B44 migration)
          let convId = topicConversations[topicKey];

          if (!convId) {
            // Also check Supabase directly (migration may have created it)
            const { data: existingConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('user_id', user.id)
              .eq('topic_key', topicKey)
              .maybeSingle();

            if (existingConv) {
              convId = existingConv.id;
            }
          }

          if (!convId) {
            const { data: conv } = await supabase
              .from('conversations')
              .insert({ user_id: user.id, topic_key: topicKey })
              .select('id')
              .single();

            if (conv) {
              convId = conv.id;
            }
          }

          if (convId) {
            setTopicConversations(prev => ({ ...prev, [topicKey]: convId }));

            // Generate personalized first question
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `[TOPIC_OPENER] The user just completed onboarding and chose "${topicDetails[topicKey].name}" as their first topic. Generate a warm, personalized opening question that references what you know about them from their profile. Keep it 2-3 sentences max.`,
                conversationId: convId,
                topicKey,
              }),
            });

            const data = await res.json();
            if (data.message) {
              setMessages([{
                id: data.message.id || `msg-${Date.now()}`,
                role: 'assistant',
                content: data.message.content,
                timestamp: new Date(data.message.timestamp || Date.now()),
                canSave: false,
                saved: false,
              }]);
            }
          }
        }
      } catch (err) {
        console.error('[Toney] Onboarding topic creation failed:', err);
      } finally {
        setLoadingTopic(false);
      }
    }
  }, [tempStyle, identifiedTensionState, answers, tempLifeContext]);

  const resetAll = useCallback(() => {
    localStorage.removeItem('toney_signed_in');
    localStorage.removeItem('toney_onboarded');
    localStorage.removeItem('toney_pattern');
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_style');
    localStorage.removeItem('toney_insights');
    localStorage.removeItem('toney_wins');
    localStorage.removeItem('toney_streak');
    localStorage.removeItem('toney_active_topic');

    setAppPhase('signed_out');
    setOnboardingStep('questions');
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIdentifiedTension(null);
    setQuizStep(0);
    setMessages([]);
    setSavedInsights([]);
    setWins([]);
    setStreak(0);
    setShowSettings(false);
    setStyleProfile({ ...defaultStyle });
    setTempStyle({ ...defaultStyle });
    setTempLifeContext({ lifeStage: '', incomeType: '', relationship: '', emotionalWhy: '' });
    setActiveTopic(null);
    setTopicConversations({});
  }, []);

  const retakeQuiz = useCallback(() => {
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_onboarded');
    setOnboardingStep('questions');
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIdentifiedTension(null);
    setQuizStep(0);
    setTempStyle({ ...defaultStyle });
    setTempLifeContext({ lifeStage: '', incomeType: '', relationship: '', emotionalWhy: '' });
    setShowSettings(false);
    setAppPhase('onboarding');
  }, []);

  return (
    <ToneyContext.Provider
      value={{
        appPhase,
        setAppPhase,
        activeTab,
        setActiveTab: setActiveTabWrapped,
        showSettings,
        setShowSettings,
        onboardingStep,
        setOnboardingStep,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        answers,
        quizStep,
        setQuizStep,
        identifiedTension: identifiedTensionState,
        handleAnswer,
        handleNextQuestion,
        handlePrevQuestion,
        styleProfile,
        setStyleProfile,
        tempStyle,
        setTempStyle,
        tempLifeContext,
        setTempLifeContext,
        activeTopic,
        topicConversations,
        selectTopic,
        leaveTopic,
        messages,
        setMessages,
        chatInput,
        setChatInput,
        isTyping,
        setIsTyping,
        handleSendMessage,
        handleSaveInsight,
        loadingTopic,
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

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win } from '@/types';
import { identifyTension, tensionDetails } from '@/lib/constants/tensions';
import { questions } from '@/lib/constants/questions';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'questions' | 'pattern' | 'style_intro' | 'style_quiz';
type AppPhase = 'loading' | 'signed_out' | 'onboarding' | 'main';
type ActiveTab = 'home' | 'chat' | 'rewire' | 'wins';

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
    // If it's already a tension (has 'primary' key), no migration needed
    if (old.primary) return old as IdentifiedTension;

    // Old format had { type, score, details }
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

    // Save migrated data under new key and remove old
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

  // Chat
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  handleSendMessage: () => void;
  handleSaveInsight: (messageId: string, editedContent?: string, category?: string) => void;

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
}

const ToneyContext = createContext<ToneyContextValue | null>(null);

const defaultStyle: StyleProfile = {
  tone: 5,
  depth: 'balanced',
  learningStyles: [],
  checkInFrequency: 'few_times_week',
};

export function ToneyProvider({ children }: { children: ReactNode }) {
  // Start in 'loading' to check localStorage before rendering
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

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Rewire
  const [savedInsights, setSavedInsights] = useState<Insight[]>([]);

  // Wins
  const [wins, setWins] = useState<Win[]>([]);
  const [streak, setStreak] = useState(0);

  // Conversation tracking (for Supabase)
  const [conversationId, setConversationId] = useState<string | null>(null);

  // ── Hydrate from localStorage + check Supabase session on mount ──
  useEffect(() => {
    const hydrate = async () => {
      let isSignedIn = localStorage.getItem('toney_signed_in') === 'true';

      // If not signed in via localStorage, check for a Supabase session
      // (handles OAuth redirect flow where localStorage wasn't set yet)
      if (!isSignedIn && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            isSignedIn = true;
            localStorage.setItem('toney_signed_in', 'true');
          }
        } catch {
          // Supabase check failed — fall through to signed_out
        }
      }

      if (!isSignedIn) {
        setAppPhase('signed_out');
        return;
      }

      const hasOnboarded = localStorage.getItem('toney_onboarded') === 'true';

      // Try new tension key first, then migrate old pattern key
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

      // Restore conversation session — try to resume from localStorage + Supabase
      let restoredMessages = false;
      if (hasOnboarded && isSupabaseConfigured()) {
        const savedConvId = localStorage.getItem('toney_conversation_id');
        if (savedConvId) {
          try {
            const supabase = createClient();
            // Check if the conversation is still active (not ended, and has recent messages)
            const { data: conv } = await supabase
              .from('conversations')
              .select('id, ended_at')
              .eq('id', savedConvId)
              .single();

            if (conv && !conv.ended_at) {
              // Check if last message was within 2 hours
              const { data: lastMsg } = await supabase
                .from('messages')
                .select('created_at')
                .eq('conversation_id', savedConvId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
              const isRecent = lastMsg && new Date(lastMsg.created_at) > twoHoursAgo;

              if (isRecent) {
                // Resume this conversation — load messages from DB
                setConversationId(savedConvId);
                const { data: dbMessages } = await supabase
                  .from('messages')
                  .select('id, role, content, created_at')
                  .eq('conversation_id', savedConvId)
                  .order('created_at', { ascending: true })
                  .limit(50);

                if (dbMessages && dbMessages.length > 0) {
                  setMessages(dbMessages.map(m => ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                    canSave: m.role === 'assistant',
                    saved: false,
                  })));
                  restoredMessages = true;
                }
              } else {
                // Session expired — clear the stored ID
                localStorage.removeItem('toney_conversation_id');
              }
            } else {
              // Conversation ended or doesn't exist — clear
              localStorage.removeItem('toney_conversation_id');
            }
          } catch {
            // DB check failed — fall through to localStorage messages
            localStorage.removeItem('toney_conversation_id');
          }
        }
      }

      // Fall back to localStorage messages if we didn't restore from DB
      if (!restoredMessages) {
        const savedMessages = loadJSON<Message[]>('toney_messages', []);
        if (savedMessages.length > 0) setMessages(savedMessages);
      }

      if (hasOnboarded) {
        setAppPhase('main');
        setActiveTab('chat');
      } else {
        setAppPhase('onboarding');
      }
    };

    hydrate();
  }, []);

  // ── Persist key state changes to localStorage ──
  useEffect(() => {
    if (appPhase === 'loading' || appPhase === 'signed_out') return;
    saveJSON('toney_messages', messages);
  }, [messages, appPhase]);

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

  // Persist conversationId to localStorage
  useEffect(() => {
    if (appPhase === 'loading') return;
    if (conversationId) {
      localStorage.setItem('toney_conversation_id', conversationId);
    } else {
      localStorage.removeItem('toney_conversation_id');
    }
  }, [conversationId, appPhase]);

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

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    // If Supabase is configured, use the real Claude API
    if (isSupabaseConfigured()) {
      try {
        // Ensure we have a conversation
        let convId = conversationId;
        if (!convId) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: conv } = await supabase
              .from('conversations')
              .insert({ user_id: user.id })
              .select('id')
              .single();
            if (conv) {
              convId = conv.id;
              setConversationId(conv.id);
              localStorage.setItem('toney_conversation_id', conv.id);
            }
          }
        }

        if (convId) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg.content, conversationId: convId }),
          });
          const data = await res.json();

          // If the server created a new session (2hr gap), update our conversationId
          if (data.newConversationId) {
            setConversationId(data.newConversationId);
            localStorage.setItem('toney_conversation_id', data.newConversationId);
            // Clear old messages — we're in a new session
            setMessages([userMsg]);
          }

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
      } catch {
        // Fall through to simulated response
      }
    }

    // Fallback: simulated coaching responses (no diagnosis, only questions)
    setTimeout(() => {
      const responses = [
        "That's a really honest thing to share. I want to make sure I understand \u2014 what were you feeling right before that happened?",
        "I appreciate you telling me that. It sounds like there's something deeper going on underneath. Can you walk me through what that moment was actually like for you?",
        "That makes a lot of sense. I'm curious \u2014 when you think about that situation now, what comes up for you? Not what you think *should* come up, but what actually does.",
        "I hear you. And I don't think that's something to fix right away \u2014 I think it's something to understand first. What do you think is really driving that for you?",
        "Thank you for sharing that. I want to sit with this for a second because I think there's something important here. What does that moment tell you about what you actually need?",
      ];
      const toneyMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        canSave: true,
        saved: false,
      };
      setMessages(prev => [...prev, toneyMsg]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  }, [chatInput, conversationId]);

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
    } else if (msg) {
      // Unsaving — remove the insight
      setSavedInsights(prev => prev.filter(i => i.content !== msg.content));
    }
  }, [messages, identifiedTensionState]);

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
    // Skip the welcome screen — the sign-in screen already serves as welcome
    setOnboardingStep('questions');
    if (hasOnboarded) {
      // Restore state for returning user
      let savedTension = loadJSON<IdentifiedTension | null>('toney_tension', null);
      if (!savedTension) savedTension = migrateOldPattern();
      const savedStyle = loadJSON<StyleProfile>('toney_style', defaultStyle);
      const savedMessages = loadJSON<Message[]>('toney_messages', []);
      const savedInsightsData = loadJSON<Insight[]>('toney_insights', []);
      const savedWins = loadJSON<Win[]>('toney_wins', []);
      const savedStreak = loadJSON<number>('toney_streak', 0);

      if (savedTension) setIdentifiedTension(savedTension);
      setStyleProfile(savedStyle);
      setTempStyle(savedStyle);
      setMessages(savedMessages);
      setSavedInsights(savedInsightsData);
      setWins(savedWins);
      setStreak(savedStreak);
      setAppPhase('main');
      setActiveTab('chat');
    } else {
      setAppPhase('onboarding');
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('toney_signed_in');
    // Don't clear onboarding/profile data — keep it for when they sign back in
    setAppPhase('signed_out');
    setShowSettings(false);
  }, []);

  const finishOnboarding = useCallback(async () => {
    setStyleProfile({ ...tempStyle });
    localStorage.setItem('toney_onboarded', 'true');

    // Save to Supabase if configured
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

    const primary = identifiedTensionState?.primaryDetails;
    const secondary = identifiedTensionState?.secondaryDetails;

    // Build a natural welcome message — no labels
    let welcomeText = `Hey! I'm Toney \u{1F499}\n\n`;
    if (primary) {
      welcomeText += `${primary.description}\n\n`;
      welcomeText += `${primary.reframe}\n\n`;
    }
    if (secondary) {
      welcomeText += `I also notice that ${secondary.description.charAt(0).toLowerCase()}${secondary.description.slice(1)}\n\n`;
    }
    welcomeText += `Here are some things we can explore together \u2014 tap one to get started, or tell me what's on your mind:`;

    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: welcomeText,
        timestamp: new Date(),
        canSave: false,
        quickReplies: primary?.conversation_starters || [],
      },
    ]);
    setAppPhase('main');
    setActiveTab('chat');
  }, [tempStyle, identifiedTensionState, answers, tempLifeContext]);

  const resetAll = useCallback(() => {
    // Clear all localStorage
    localStorage.removeItem('toney_signed_in');
    localStorage.removeItem('toney_onboarded');
    localStorage.removeItem('toney_pattern');
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_style');
    localStorage.removeItem('toney_messages');
    localStorage.removeItem('toney_insights');
    localStorage.removeItem('toney_wins');
    localStorage.removeItem('toney_streak');
    localStorage.removeItem('toney_conversation_id');

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
    setConversationId(null);
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
        messages,
        setMessages,
        chatInput,
        setChatInput,
        isTyping,
        setIsTyping,
        handleSendMessage,
        handleSaveInsight,
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

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { IdentifiedTension, TensionType, StyleProfile, Message, Insight, Win } from '@toney/types';
import { identifyTension, tensionDetails } from '@toney/constants';
import { questions } from '@toney/constants';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

type OnboardingStep = 'welcome' | 'questions' | 'pattern' | 'style_intro' | 'style_quiz';
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
  handleSendMessage: (overrideText?: string) => void;
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
  retakeQuiz: () => void;
}

const ToneyContext = createContext<ToneyContextValue | null>(null);

/**
 * Context-aware fallback responses when the Claude API is unavailable.
 * Matches the user's message to a relevant response, avoids repeats.
 */
function getFallbackResponse(userMessage: string, previousMessages: Message[]): string {
  const msg = userMessage.toLowerCase();
  const usedResponses = new Set(
    previousMessages.filter(m => m.role === 'assistant').map(m => m.content)
  );

  // Detect explicit requests for help/plan/advice
  const wantsPlan = /\b(plan|steps|what should i|how do i|give me|help me|advice|strategy|what can i)\b/.test(msg);
  const feelsOverwhelmed = /\b(too (much|emotional|overwhelm|stressed)|can'?t handle|freaking out|panic|anxious|scared)\b/.test(msg);
  const expressesRegret = /\b(regret|mistake|shouldn'?t have|wish i|feel stupid|feel dumb|blew it|messed up)\b/.test(msg);
  const talksInvesting = /\b(invest|stock|crypto|trading|market|portfolio|buy in|jumped on|trending|ticker|shares)\b/.test(msg);
  const talksSpending = /\b(spend|bought|shopping|purchase|splurge|impulse|cart|order)\b/.test(msg);
  const talksSaving = /\b(save|saving|budget|frugal|cheap|can'?t afford|broke|tight)\b/.test(msg);
  const talksComparison = /\b(everyone|behind|ahead|friend|coworker|they all|compare|jealous|fomo|getting rich|except me|left out)\b/.test(msg);
  const talksAvoidance = /\b(avoid|don'?t look|ignore|pretend|head in sand|don'?t want to think|feels wrong|boring|don'?t care|whatever|doesn'?t matter)\b/.test(msg);
  const talksGiving = /\b(give|lend|loan|help (them|her|him|my)|can'?t say no|generous|family needs)\b/.test(msg);

  // Build a pool of contextually relevant responses
  const pool: string[] = [];

  if (wantsPlan && feelsOverwhelmed) {
    pool.push(
      "Ok, let's slow this down together. When everything feels like too much, the move is **shrink the problem**. What's the *one* money thing that's weighing on you most right now? Just one.",
      "I can hear the urgency in that. Here's what I'd suggest as a first step: **pick one thing you can control today.** Not the whole picture \u2014 just one corner of it. What feels most within reach?",
      "That emotional flood is real, and wanting a plan is actually a sign of strength. Let's start small: what's the **very next money moment** you'll face this week? We'll build from there.",
    );
  } else if (wantsPlan) {
    pool.push(
      "Let's build something you can actually use. First \u2014 what's the **specific situation** you want a plan for? The more concrete, the better I can help.",
      "I like that you're ready to do something different. Before we map it out, tell me: **what have you already tried?** I don't want to give you something that hasn't worked before.",
      "Absolutely. The best plans start tiny. What's **one thing** that, if you did it this week, would make you feel like you're moving in the right direction?",
    );
  } else if (feelsOverwhelmed) {
    pool.push(
      "That overwhelm makes total sense. **You don't have to figure it all out right now.** Can you tell me what specifically is feeling like too much?",
      "When money stress hits that hard, the first step isn't a strategy \u2014 it's a breath. You're here, you're talking about it. **That already matters.** What's the feeling underneath the overwhelm?",
      "The fact that you're naming it as *too emotional* tells me you're more aware than you think. Emotions aren't the enemy here \u2014 **they're data.** What triggered this one?",
    );
  } else if (expressesRegret && talksInvesting) {
    pool.push(
      "That regret is telling you something important. Can you walk me through **the moment you decided to jump in?** Not to judge it \u2014 I want to understand what you were feeling right before you pulled the trigger.",
      "Jumping on investments and then regretting it \u2014 there's usually a pattern to the pull. Was it a tip from someone? **A fear of missing out?** Something happening in your life that made you want to feel in control?",
      "That *act-then-regret* cycle is exhausting. I'm curious \u2014 in the moment you decide to invest, **what story are you telling yourself?** Not what you think logically, but what it *feels* like.",
    );
  } else if (talksAvoidance && talksInvesting) {
    pool.push(
      "That resistance to investing \u2014 it's worth paying attention to. Something about it *feels wrong* to you, and I'm curious what that's about. Is it the risk? The complexity? Something else?",
      "When you say investing feels wrong, what does *wrong* mean for you? Like it's not for people like you? Or more like it stirs something uncomfortable?",
    );
  } else if (talksInvesting) {
    pool.push(
      "Tell me more about the investing side of things. When you think about your money and investments, what comes up \u2014 *excitement, anxiety, pressure?* Something else?",
      "Investing can bring up a lot \u2014 the thrill, the fear, the what-ifs. What's your **relationship** with it feeling like right now?",
    );
  } else if (talksSpending) {
    pool.push(
      "The spending pattern you're describing \u2014 I want to understand it from the inside. **What does it feel like right before you make that purchase?** Not after, when the guilt hits. *Before.*",
      "There's usually something the spending is *doing for you* emotionally, even when it's hurting you financially. Any sense of what that might be?",
    );
  } else if (talksComparison) {
    pool.push(
      "That feeling of *everyone else being ahead* \u2014 it's one of the most painful money experiences there is. When you look at other people's lives, what specifically makes you feel behind?",
      "Comparison is a trap with no bottom. I'm curious: **if you couldn't see what anyone else was doing, what would \"enough\" look like for you?**",
    );
  } else if (talksAvoidance) {
    pool.push(
      "The not-looking thing \u2014 I want you to know that's actually **a really common way people protect themselves.** You're not broken for doing it. What would feel scary about looking?",
      "Avoiding money stuff takes real energy, even though it looks like *doing nothing.* When did you first start turning away from it?",
    );
  } else if (talksSaving) {
    pool.push(
      "The pressure around saving \u2014 is that coming from *inside you*, from people around you, or from looking at what you think you *should* have by now?",
      "Tell me about what saving **feels** like for you. For some people it's empowering, for others it feels like deprivation. Where do you land?",
    );
  } else if (talksGiving) {
    pool.push(
      "That pull to give \u2014 it comes from a good place, but it can also leave you **running on empty.** When was the last time someone asked for money and you said yes even though part of you didn't want to?",
      "Being generous is beautiful. But I'm curious \u2014 when you help others financially, **what happens to the part of you that also has needs?**",
    );
  } else {
    pool.push(
      "That's interesting \u2014 say more about that. What's the part that feels *most loaded* for you?",
      "I want to make sure I'm tracking. When you say that, **what's the feeling that comes with it?**",
      "Something about the way you said that feels important. Can you unpack it a bit?",
      "Let's stay with that for a second. What does that look like *in your day-to-day?*",
      "I'm picking up on something underneath what you're saying. **What would you say is the real issue here?**",
    );
  }

  // Filter out already-used responses
  const available = pool.filter(r => !usedResponses.has(r));
  if (available.length === 0) {
    // All contextual responses used — generate a dynamic follow-up
    return "I want to keep going with this. We've been circling something important \u2014 **what feels like the thing you most want to figure out right now?**";
  }

  return available[Math.floor(Math.random() * available.length)];
}

const defaultStyle: StyleProfile = {
  tone: 5,
  depth: 'balanced',
  learningStyles: [],
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

      // Always verify the Supabase session is alive — localStorage alone can't be trusted
      // (session may have expired even if localStorage flag is set)
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            isSignedIn = true;
            localStorage.setItem('toney_signed_in', 'true');
          } else {
            // Session expired or doesn't exist — clear stale flag
            isSignedIn = false;
            localStorage.removeItem('toney_signed_in');
          }
        } catch {
          // Supabase check failed — if we had a localStorage flag, clear it to be safe
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
      // (handles new browser / cleared cache where user already onboarded)
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

              // Restore profile data into localStorage so the app has it
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
        // Read URL hash to restore tab on refresh, default to chat
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        setActiveTab(VALID_TABS.has(hash) ? hash : 'chat');
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

  // ── URL Hash Navigation ──

  // Sync activeTab → URL hash (pushState so back/forward works)
  useEffect(() => {
    if (appPhase !== 'main') return;
    if (showSettings) return; // Settings has its own hash sync
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash !== activeTab) {
      window.history.pushState(null, '', `#${activeTab}`);
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

  // Clear hash when leaving main phase (sign out, retake quiz)
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
      // Restore tab hash when settings closes
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash === 'settings') {
        window.history.pushState(null, '', `#${activeTab}`);
      }
    }
  }, [showSettings, appPhase, activeTab]);

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

    // If Supabase is configured, use the real Claude API
    console.log('[Toney] Supabase configured:', isSupabaseConfigured());
    if (isSupabaseConfigured()) {
      try {
        // Ensure we have a conversation
        let convId = conversationId;
        if (!convId) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          console.log('[Toney] Auth user:', user?.id ?? 'NO USER');
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

        console.log('[Toney] Conversation ID:', convId ?? 'NONE');

        if (convId) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg.content, conversationId: convId }),
          });
          console.log('[Toney] API response status:', res.status);
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
      } catch (err) {
        console.error('[Toney] Chat API failed:', err);
      }
    }

    // API failed — show error instead of fake fallback
    setMessages(prev => [...prev, {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant' as const,
      content: '⚠️ API call failed — check browser console for details.',
      timestamp: new Date(),
      canSave: false,
      saved: false,
    }]);
    setIsTyping(false);
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
      // Read URL hash to restore tab, default to chat
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      setActiveTab(VALID_TABS.has(hash) ? hash : 'chat');
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

  const retakeQuiz = useCallback(() => {
    // Reset only onboarding state — keep auth, keep messages/insights/wins
    localStorage.removeItem('toney_tension');
    localStorage.removeItem('toney_onboarded');
    setOnboardingStep('questions'); // Skip welcome page
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

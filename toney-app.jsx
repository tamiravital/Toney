import { useState, useRef, useEffect } from "react";
import { Home, MessageCircle, Sparkles, Trophy, Settings, ArrowRight, ArrowLeft, Heart, TrendingUp, ShoppingBag, Lock, AlertCircle, CheckCircle, Send, Bookmark, BookmarkCheck, X, ChevronRight, Flame, RotateCcw, Zap, Brain, Eye, BookOpen, FlaskConical, Volume2, BarChart3, User } from "lucide-react";

// ============================================================
// TONEY — Mobile-First UX Shell
// ============================================================

const ToneyApp = () => {
  // ---- App-level state ----
  const [appPhase, setAppPhase] = useState("onboarding"); // "onboarding" | "main"
  const [activeTab, setActiveTab] = useState("home");
  const [showSettings, setShowSettings] = useState(false);

  // ---- Onboarding state ----
  const [onboardingStep, setOnboardingStep] = useState("welcome");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [identifiedPattern, setIdentifiedPattern] = useState(null);
  const [quizStep, setQuizStep] = useState(0);

  const [styleProfile, setStyleProfile] = useState({
    tone: 5,
    depth: "balanced",
    learningStyles: [],
    checkInFrequency: "few_times_week",
  });
  const [tempStyle, setTempStyle] = useState({ ...styleProfile });

  // ---- Chat state ----
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // ---- Rewire state ----
  const [savedInsights, setSavedInsights] = useState([
    // Example data — will be populated from chat
  ]);

  // ---- Wins state ----
  const [wins, setWins] = useState([]);
  const [streak, setStreak] = useState(0);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ============================================================
  // ONBOARDING DATA
  // ============================================================
  const questions = [
    {
      id: "checking_frequency",
      question: "How often do you check your bank balance?",
      options: [
        { value: "multiple_daily", label: "Multiple times a day", emoji: "😰" },
        { value: "daily", label: "Once a day", emoji: "🤔" },
        { value: "weekly", label: "A few times a week", emoji: "😌" },
        { value: "rarely", label: "Rarely or never", emoji: "🙈" },
      ],
    },
    {
      id: "spending_feeling",
      question: "When you spend over $100, how do you usually feel?",
      options: [
        { value: "guilt", label: "Guilty, even if I can afford it", emoji: "😔" },
        { value: "excited", label: "Excited now, regret later", emoji: "😅" },
        { value: "anxious", label: "Anxious about whether it's worth it", emoji: "😟" },
        { value: "fine", label: "Generally fine if it's planned", emoji: "😊" },
      ],
    },
    {
      id: "money_decisions",
      question: "When it comes to money decisions, you tend to…",
      options: [
        { value: "avoid", label: "Put them off as long as possible", emoji: "😬" },
        { value: "overthink", label: "Research endlessly, second-guess", emoji: "🤯" },
        { value: "impulsive", label: "Act quickly, worry later", emoji: "⚡" },
        { value: "deliberate", label: "Think it through and move forward", emoji: "✅" },
      ],
    },
    {
      id: "account_awareness",
      question: "How well do you know what’s in your accounts right now?",
      options: [
        { value: "exact", label: "I know the exact amounts", emoji: "📊" },
        { value: "rough", label: "I have a rough idea", emoji: "🤷" },
        { value: "scared", label: "I’m scared to look", emoji: "😨" },
        { value: "no_idea", label: "No idea at all", emoji: "🌫️" },
      ],
    },
    {
      id: "investing_behavior",
      question: "When the market dips, you typically…",
      options: [
        { value: "panic", label: "Panic and check constantly", emoji: "📉" },
        { value: "sell", label: "Feel tempted to sell", emoji: "🏃" },
        { value: "buy", label: "See it as a buying opportunity", emoji: "💎" },
        { value: "ignore", label: "Try to ignore it", emoji: "🙈" },
      ],
    },
    {
      id: "money_stress",
      question: "What’s your biggest money stress right now?",
      options: [
        { value: "overspending", label: "I spend more than I want to", emoji: "💸" },
        { value: "not_saving", label: "I’m not saving enough", emoji: "🏦" },
        { value: "fomo", label: "FOMO on investments", emoji: "📈" },
        { value: "control", label: "Feeling out of control", emoji: "🌀" },
      ],
    },
  ];

  const patternDetails = {
    avoidance: {
      name: "The Avoider",
      emoji: "🙈",
      description: "You tend to look away from money decisions and hope they resolve themselves",
      core_feeling: "Overwhelm and anxiety when facing financial reality",
      common_behaviors: [
        "Not opening bills or checking balances",
        "Putting off important financial decisions",
        "Feeling paralyzed when money comes up",
      ],
      impact: "Creates blind spots that lead to overdrafts, missed opportunities, and constant low-level anxiety.",
      first_step: "We'll start by making checking your money feel safe — just 30 seconds a day, no judgment.",
      color: "purple",
    },
    fomo: {
      name: "The FOMO Trader",
      emoji: "📈",
      description: "You’re driven by fear of missing out on the next big opportunity",
      core_feeling: "Anxiety about being left behind, excitement that quickly turns to regret",
      common_behaviors: [
        "Buying stocks/crypto when trending",
        "Panic-selling when things dip",
        "Impulsive decisions based on others",
      ],
      impact: "Leads to buying high, selling low, and constant stress about doing it right.",
      first_step: "We'll create a 24-hour rule for investment decisions and separate genuine opportunities from FOMO.",
      color: "blue",
    },
    retail_therapy: {
      name: "The Emotional Spender",
      emoji: "🛍️",
      description: "Shopping is how you process feelings — stress, boredom, celebration, sadness",
      core_feeling: "A rush of excitement when buying, followed by guilt or regret",
      common_behaviors: [
        "Shopping when stressed or bored",
        "Feeling guilty about purchases",
        "Items you never use, tags still on",
      ],
      impact: "Creates a cycle of temporary relief followed by shame, masking what you really feel.",
      first_step: "Before any purchase over $50, we'll pause and ask: 'What am I really feeling right now?'",
      color: "pink",
    },
    over_control: {
      name: "The Over-Controller",
      emoji: "📊",
      description: "You monitor every penny but it never feels like enough control",
      core_feeling: "Constant vigilance mixed with fear that one mistake will derail everything",
      common_behaviors: [
        "Checking balances multiple times daily",
        "Anxious even with healthy savings",
        "Struggling to spend on yourself",
      ],
      impact: "Keeps you in chronic stress and prevents you from enjoying the security you've built.",
      first_step: "We'll set up automated guardrails so you can relax control without losing security.",
      color: "emerald",
    },
  };

  // ============================================================
  // PATTERN IDENTIFICATION
  // ============================================================
  const identifyPattern = (responses) => {
    const patterns = { avoidance: 0, fomo: 0, retail_therapy: 0, over_control: 0 };

    if (responses.checking_frequency === "rarely") patterns.avoidance += 3;
    if (responses.checking_frequency === "multiple_daily") patterns.over_control += 2;
    if (responses.spending_feeling === "excited") patterns.retail_therapy += 2;
    if (responses.spending_feeling === "guilt") patterns.over_control += 2;
    if (responses.money_decisions === "avoid") patterns.avoidance += 3;
    if (responses.money_decisions === "impulsive") patterns.fomo += 2;
    if (responses.money_decisions === "overthink") patterns.over_control += 2;
    if (responses.account_awareness === "scared" || responses.account_awareness === "no_idea") patterns.avoidance += 2;
    if (responses.account_awareness === "exact") patterns.over_control += 1;
    if (responses.investing_behavior === "panic") patterns.fomo += 2;
    if (responses.investing_behavior === "sell") patterns.fomo += 3;
    if (responses.investing_behavior === "ignore") patterns.avoidance += 1;
    if (responses.money_stress === "overspending") patterns.retail_therapy += 2;
    if (responses.money_stress === "fomo") patterns.fomo += 3;
    if (responses.money_stress === "control") patterns.over_control += 2;

    const dominant = Object.entries(patterns).reduce((a, b) => (a[1] > b[1] ? a : b));
    return { type: dominant[0], score: dominant[1], details: patternDetails[dominant[0]] };
  };

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      const pattern = identifyPattern(answers);
      setIdentifiedPattern(pattern);
      setOnboardingStep("pattern");
    }
  };

  const finishOnboarding = () => {
    setStyleProfile(tempStyle);
    // Seed the chat with a welcome message from Toney
    setMessages([
      {
        id: 1,
        role: "assistant",
        content: `Hey! I’m Toney 💙\n\nI see you’re ${identifiedPattern.details.name}. That’s not a label — it’s a starting point. A lot of people share this pattern, and the fact that you’re here means you’re ready to work on it.\n\nWhat’s on your mind about money today?`,
        timestamp: new Date(),
        canSave: false,
      },
    ]);
    setAppPhase("main");
    setActiveTab("chat");
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg = {
      id: messages.length + 1,
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    // Simulate Toney response (will be replaced with real API call)
    setTimeout(() => {
      const responses = [
        `I hear you. That sounds like your ${identifiedPattern.details.name} pattern showing up. ${identifiedPattern.details.core_feeling.toLowerCase()}.\n\nLet me ask you this — what were you feeling right before that happened?`,
        `That’s a really honest thing to share. A lot of people with your pattern experience exactly this.\n\nHere’s what I notice: when you describe it, there’s a gap between what you *know* you should do and what you actually *feel* in the moment. That gap is where we do our work together.`,
        `OK, let’s break this down. Your ${identifiedPattern.details.name} pattern tends to kick in when ${identifiedPattern.type === 'avoidance' ? 'things feel overwhelming' : identifiedPattern.type === 'fomo' ? 'you see others making moves' : identifiedPattern.type === 'retail_therapy' ? 'emotions are running high' : 'you feel like you might lose control'}.\n\nHere’s one small thing you can try this week: ${identifiedPattern.details.first_step.toLowerCase()}`,
      ];
      const toneyMsg = {
        id: messages.length + 2,
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        canSave: true,
        saved: false,
      };
      setMessages((prev) => [...prev, toneyMsg]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleSaveInsight = (messageId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, saved: !m.saved } : m))
    );
    const msg = messages.find((m) => m.id === messageId);
    if (msg && !msg.saved) {
      setSavedInsights((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: msg.content,
          savedAt: new Date(),
          fromChat: true,
          tags: [identifiedPattern?.details?.name || "Insight"],
        },
      ]);
    } else {
      setSavedInsights((prev) => prev.filter((i) => i.content !== msg?.content));
    }
  };

  const handleLogWin = (text) => {
    setWins((prev) => [
      { id: Date.now(), text, date: new Date(), pattern: identifiedPattern?.type },
      ...prev,
    ]);
    setStreak((prev) => prev + 1);
  };

  // ============================================================
  // STYLE HELPERS
  // ============================================================
  const patternColor = (type) => {
    const colors = {
      avoidance: { bg: "bg-purple-50", text: "text-purple-700", accent: "bg-purple-600", light: "bg-purple-100", border: "border-purple-200" },
      fomo: { bg: "bg-blue-50", text: "text-blue-700", accent: "bg-blue-600", light: "bg-blue-100", border: "border-blue-200" },
      retail_therapy: { bg: "bg-pink-50", text: "text-pink-700", accent: "bg-pink-600", light: "bg-pink-100", border: "border-pink-200" },
      over_control: { bg: "bg-emerald-50", text: "text-emerald-700", accent: "bg-emerald-600", light: "bg-emerald-100", border: "border-emerald-200" },
    };
    return colors[type] || colors.avoidance;
  };

  // ============================================================
  // ONBOARDING SCREENS
  // ============================================================
  const OnboardingWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      <div className="text-6xl mb-6">💙</div>
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Toney</h1>
      <p className="text-xl text-gray-500 mb-10">Finally feel good about money</p>

      <div className="w-full space-y-4 mb-10">
        <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl text-left">
          <Heart className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Feelings-first</div>
            <div className="text-xs text-gray-500">Understand your money patterns</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-2xl text-left">
          <TrendingUp className="w-6 h-6 text-purple-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Real change</div>
            <div className="text-xs text-gray-500">Tiny tweaks, lasting results</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl text-left">
          <Lock className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Private & safe</div>
            <div className="text-xs text-gray-500">Your data, your control</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOnboardingStep("questions")}
        className="w-full bg-indigo-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Start Your Journey
        <ArrowRight className="w-5 h-5" />
      </button>
      <p className="text-xs text-gray-400 mt-4">Takes 2 minutes • No account needed</p>
    </div>
  );

  const OnboardingQuestions = () => {
    const q = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const hasAnswer = answers[q.id];

    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Question */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{q.question}</h2>

        {/* Options */}
        <div className="space-y-3 flex-1">
          {q.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleAnswer(q.id, option.value)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                answers[q.id] === option.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-gray-900 font-medium text-sm">{option.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Next */}
        <button
          onClick={handleNextQuestion}
          disabled={!hasAnswer}
          className={`w-full py-4 rounded-2xl font-semibold text-lg mt-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hasAnswer
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
          }`}
        >
          {currentQuestionIndex < questions.length - 1 ? "Next" : "See My Pattern"}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const OnboardingPattern = () => {
    if (!identifiedPattern) return null;
    const p = identifiedPattern.details;
    const colors = patternColor(identifiedPattern.type);

    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{p.emoji}</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">You’re {p.name}</h2>
          <p className="text-gray-500">{p.description}</p>
        </div>

        <div className="space-y-4 flex-1">
          <div className={`${colors.bg} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-gray-700" />
              <h3 className="font-semibold text-gray-900 text-sm">What you’re really feeling</h3>
            </div>
            <p className="text-gray-700 text-sm">{p.core_feeling}</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-gray-700" />
              <h3 className="font-semibold text-gray-900 text-sm">Common behaviors</h3>
            </div>
            <ul className="space-y-1.5">
              {p.common_behaviors.map((b, i) => (
                <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Your first step</h3>
            </div>
            <p className="text-gray-700 text-sm">{p.first_step}</p>
          </div>
        </div>

        <button
          onClick={() => setOnboardingStep("style_intro")}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg mt-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const OnboardingStyleIntro = () => (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      <div className="text-5xl mb-6">✨</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Personalize Toney</h2>
      <p className="text-gray-500 mb-2">
        A quick quiz so I can coach you the way that works best for you.
      </p>
      <p className="text-xs text-gray-400 mb-10">(Totally optional — I’ll learn as we go either way)</p>

      <div className="w-full space-y-3">
        <button
          onClick={() => {
            setQuizStep(1);
            setOnboardingStep("style_quiz");
          }}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Let’s Do This
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={finishOnboarding}
          className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );

  const OnboardingStyleQuiz = () => {
    const exampleMessages = {
      gentle: {
        emoji: "🤗",
        label: "Gentle",
        text: "That sounds really stressful. You’re not alone in feeling this way. Want to explore what was going on?",
      },
      balanced: {
        emoji: "💭",
        label: "Balanced",
        text: "I noticed the pattern. This seems connected to stress-spending. Want to talk about what happened?",
      },
      direct: {
        emoji: "🎯",
        label: "Direct",
        text: "You overspent by $200. Likely Thursday after work stress. Here’s what we’ll do differently.",
      },
    };

    const learningStyles = [
      { value: "analytical", label: "Data & patterns", emoji: "📊", icon: BarChart3 },
      { value: "somatic", label: "Feelings & body", emoji: "💭", icon: Heart },
      { value: "narrative", label: "Stories & examples", emoji: "📖", icon: BookOpen },
      { value: "experiential", label: "Things to try", emoji: "🔬", icon: FlaskConical },
    ];

    if (quizStep === 1) {
      return (
        <div className="flex flex-col min-h-full px-6 py-8">
          <div className="mb-6">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: "33%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">1 of 3</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">How should Toney talk to you?</h2>
          <p className="text-sm text-gray-500 mb-6">Pick the response that feels right:</p>

          <div className="space-y-3 flex-1">
            {Object.entries(exampleMessages).map(([key, msg]) => (
              <button
                key={key}
                onClick={() => {
                  const toneMap = { gentle: 3, balanced: 5, direct: 8 };
                  setTempStyle((prev) => ({ ...prev, tone: toneMap[key] }));
                  setQuizStep(2);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-indigo-200 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{msg.emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm mb-1">{msg.label}</div>
                    <p className="text-gray-600 text-xs leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (quizStep === 2) {
      return (
        <div className="flex flex-col min-h-full px-6 py-8">
          <div className="mb-6">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: "67%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">2 of 3</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">How do you learn best?</h2>
          <p className="text-sm text-gray-500 mb-6">Pick any that resonate:</p>

          <div className="space-y-3 flex-1">
            {learningStyles.map((ls) => {
              const isSelected = tempStyle.learningStyles.includes(ls.value);
              const Icon = ls.icon;
              return (
                <button
                  key={ls.value}
                  onClick={() => {
                    setTempStyle((prev) => ({
                      ...prev,
                      learningStyles: isSelected
                        ? prev.learningStyles.filter((s) => s !== ls.value)
                        : [...prev.learningStyles, ls.value],
                    }));
                  }}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] flex items-center gap-4 ${
                    isSelected ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-indigo-600" : "bg-gray-100"}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? "text-white" : "text-gray-500"}`} />
                  </div>
                  <span className="font-medium text-gray-900 text-sm flex-1">{ls.label}</span>
                  {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setQuizStep(3)}
            disabled={tempStyle.learningStyles.length === 0}
            className={`w-full py-4 rounded-2xl font-semibold text-lg mt-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              tempStyle.learningStyles.length > 0
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      );
    }

    if (quizStep === 3) {
      const depths = [
        { value: "surface", emoji: "⚡", label: "Quick tactics", desc: "Just help me fix the behavior" },
        { value: "balanced", emoji: "⚖️", label: "Balanced", desc: "Understanding + action" },
        { value: "deep", emoji: "🌊", label: "Deep exploration", desc: "Where this came from, and how to transform it" },
      ];
      return (
        <div className="flex flex-col min-h-full px-6 py-8">
          <div className="mb-6">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">3 of 3</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">How deep should we go?</h2>
          <p className="text-sm text-gray-500 mb-6">No right answer — just what feels right for you.</p>

          <div className="space-y-3 flex-1">
            {depths.map((d) => (
              <button
                key={d.value}
                onClick={() => setTempStyle((prev) => ({ ...prev, depth: d.value }))}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  tempStyle.depth === d.value
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{d.emoji}</span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{d.label}</div>
                    <div className="text-xs text-gray-500">{d.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={finishOnboarding}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg mt-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Start Coaching
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      );
    }
  };

  // ============================================================
  // MAIN APP SCREENS
  // ============================================================

  const HomeScreen = () => {
    const p = identifiedPattern?.details;
    const colors = identifiedPattern ? patternColor(identifiedPattern.type) : patternColor("avoidance");
    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    })();

    return (
      <div className="px-6 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gray-400 text-sm">{greeting}</p>
            <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Pattern card */}
        {p && (
          <div className={`${colors.bg} rounded-2xl p-5 mb-4`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{p.emoji}</span>
              <div>
                <div className="font-bold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">Your money pattern</div>
              </div>
            </div>
            <p className="text-sm text-gray-700">{p.first_step}</p>
          </div>
        )}

        {/* Streak */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">{streak} day streak</div>
                <div className="text-xs text-gray-400">Keep it going!</div>
              </div>
            </div>
            <div className="flex gap-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${i < streak ? "bg-orange-400" : "bg-gray-100"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setActiveTab("chat")}
            className="bg-indigo-600 text-white rounded-2xl p-5 text-left hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            <MessageCircle className="w-6 h-6 mb-3" />
            <div className="font-semibold text-sm">Talk to Toney</div>
            <div className="text-xs text-indigo-200 mt-1">Start a check-in</div>
          </button>
          <button
            onClick={() => setActiveTab("wins")}
            className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-gray-200 transition-all active:scale-[0.98]"
          >
            <Trophy className="w-6 h-6 text-amber-500 mb-3" />
            <div className="font-semibold text-gray-900 text-sm">Log a Win</div>
            <div className="text-xs text-gray-400 mt-1">{wins.length} wins so far</div>
          </button>
        </div>

        {/* Recent insights */}
        {savedInsights.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Recent Insights</h3>
              <button onClick={() => setActiveTab("rewire")} className="text-indigo-600 text-xs font-medium">
                See all
              </button>
            </div>
            <div className={`${colors.bg} rounded-2xl p-4`}>
              <p className="text-sm text-gray-700 line-clamp-3">
                {savedInsights[savedInsights.length - 1]?.content?.substring(0, 120)}...
              </p>
            </div>
          </div>
        )}

        {/* Daily prompt */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <p className="text-sm font-medium opacity-80 mb-1">Today’s prompt</p>
          <p className="text-lg font-semibold leading-snug mb-4">
            {identifiedPattern?.type === "avoidance"
              ? "Take 30 seconds to glance at your balance. Just look — no judgment."
              : identifiedPattern?.type === "fomo"
              ? "Before making any investment move today, wait 24 hours."
              : identifiedPattern?.type === "retail_therapy"
              ? "Next time you feel the urge to shop, name the feeling first."
              : "Give yourself permission to not check your balance until tonight."}
          </p>
          <button
            onClick={() => setActiveTab("chat")}
            className="bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
          >
            Talk about it
          </button>
        </div>
      </div>
    );
  };

  const ChatScreen = () => (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg">
            💙
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">Toney</div>
            <div className="text-xs text-gray-400">Your money coach</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`w-10/12 ${msg.role === "user" ? "" : ""}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-900 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
              {/* Save button for assistant messages */}
              {msg.role === "assistant" && msg.canSave !== false && (
                <button
                  onClick={() => handleSaveInsight(msg.id)}
                  className={`mt-1.5 flex items-center gap-1.5 text-xs transition-all ${
                    msg.saved ? "text-indigo-600 font-medium" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {msg.saved ? (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5" />
                  )}
                  {msg.saved ? "Saved to Rewire" : "Save insight"}
                </button>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white pb-24">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
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
            onClick={handleSendMessage}
            disabled={!chatInput.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              chatInput.trim()
                ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                : "bg-gray-100 text-gray-300"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const RewireScreen = () => (
    <div className="px-6 py-6 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Rewire</h1>
        <p className="text-sm text-gray-400">Your saved insights and cheat cards</p>
      </div>

      {savedInsights.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💡</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No insights saved yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            When Toney says something that clicks, tap the bookmark icon to save it here.
          </p>
          <button
            onClick={() => setActiveTab("chat")}
            className="bg-indigo-600 text-white py-3 px-6 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {savedInsights.map((insight) => (
            <div key={insight.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs text-gray-400">
                    {insight.savedAt ? new Date(insight.savedAt).toLocaleDateString() : ""}
                  </span>
                </div>
                {insight.tags?.map((tag) => (
                  <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">{insight.content}</p>
              <button
                onClick={() => {
                  setChatInput(`I want to revisit this insight: "${insight.content.substring(0, 80)}..."`);
                  setActiveTab("chat");
                }}
                className="flex items-center gap-1.5 text-indigo-600 text-xs font-semibold hover:text-indigo-700 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Continue in chat
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const WinsScreen = () => {
    const [newWin, setNewWin] = useState("");
    const [showInput, setShowInput] = useState(false);

    const suggestedWins = identifiedPattern
      ? {
          avoidance: [
            "Checked my balance without anxiety",
            "Opened a bill the day it arrived",
            "Had a money conversation",
          ],
          fomo: [
            "Waited 24 hours before investing",
            "Didn’t check portfolio during a dip",
            "Stuck to my plan despite FOMO",
          ],
          retail_therapy: [
            "Paused before an impulse buy",
            "Named my feeling instead of shopping",
            "Bought something guilt-free",
          ],
          over_control: [
            "Didn’t check balance for a full day",
            "Spent on something fun freely",
            "Trusted my automated savings",
          ],
        }[identifiedPattern.type] || []
      : [];

    return (
      <div className="px-6 py-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Wins</h1>
            <p className="text-sm text-gray-400">Every small win rewires your brain</p>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-600">{streak}</span>
          </div>
        </div>

        {/* Log a win */}
        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-sm mb-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Log a Win
          </button>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6">
            <textarea
              value={newWin}
              onChange={(e) => setNewWin(e.target.value)}
              placeholder="What pattern did you interrupt today?"
              rows={2}
              className="w-full text-sm text-gray-900 placeholder-gray-400 resize-none outline-none mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newWin.trim()) {
                    handleLogWin(newWin.trim());
                    setNewWin("");
                    setShowInput(false);
                  }
                }}
                disabled={!newWin.trim()}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-300 transition-all"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowInput(false);
                  setNewWin("");
                }}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Suggested wins */}
        {wins.length === 0 && suggestedWins.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Quick log for {identifiedPattern?.details?.name}
            </h3>
            <div className="space-y-2">
              {suggestedWins.map((sw, i) => (
                <button
                  key={i}
                  onClick={() => handleLogWin(sw)}
                  className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-100 rounded-xl text-left hover:bg-green-100 transition-all active:scale-[0.98]"
                >
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900">{sw}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Win history */}
        {wins.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your wins</h3>
            <div className="space-y-2">
              {wins.map((win) => (
                <div
                  key={win.id}
                  className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl"
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{win.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(win.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const SettingsOverlay = () => {
    const [localStyle, setLocalStyle] = useState({ ...styleProfile });

    return (
      <div className="absolute inset-0 bg-white z-50 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Pattern info */}
          {identifiedPattern && (
            <div className={`${patternColor(identifiedPattern.type).bg} rounded-2xl p-4 mb-6`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{identifiedPattern.details.emoji}</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{identifiedPattern.details.name}</div>
                  <div className="text-xs text-gray-500">Your pattern</div>
                </div>
              </div>
            </div>
          )}

          {/* Tone */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Communication Tone</h3>
            <input
              type="range"
              min="1"
              max="10"
              value={localStyle.tone}
              onChange={(e) => setLocalStyle((prev) => ({ ...prev, tone: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>Gentle</span>
              <span className="font-semibold text-indigo-600">
                {localStyle.tone <= 4 ? "Gentle" : localStyle.tone >= 7 ? "Direct" : "Balanced"}
              </span>
              <span>Direct</span>
            </div>
          </div>

          {/* Depth */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Coaching Depth</h3>
            <div className="space-y-2">
              {["surface", "balanced", "deep"].map((d) => (
                <button
                  key={d}
                  onClick={() => setLocalStyle((prev) => ({ ...prev, depth: d }))}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all text-sm ${
                    localStyle.depth === d
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <span className="font-medium text-gray-900 capitalize">{d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Check-in frequency */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Check-in Frequency</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "daily", label: "Daily" },
                { value: "few_times_week", label: "Few times/week" },
                { value: "weekly", label: "Weekly" },
                { value: "on_demand", label: "When I reach out" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setLocalStyle((prev) => ({ ...prev, checkInFrequency: f.value }))}
                  className={`p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    localStyle.checkInFrequency === f.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-100 text-gray-600 hover:border-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={() => {
              setStyleProfile(localStyle);
              setShowSettings(false);
            }}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            Save Changes
          </button>

          {/* Retake quiz */}
          <button
            onClick={() => {
              setAppPhase("onboarding");
              setOnboardingStep("welcome");
              setCurrentQuestionIndex(0);
              setAnswers({});
              setIdentifiedPattern(null);
              setQuizStep(0);
              setMessages([]);
              setSavedInsights([]);
              setWins([]);
              setStreak(0);
              setShowSettings(false);
            }}
            className="w-full mt-3 flex items-center justify-center gap-2 text-gray-500 text-sm font-medium py-3 hover:text-gray-700 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Retake pattern quiz
          </button>
        </div>
      </div>
    );
  };

  // ============================================================
  // BOTTOM TAB BAR
  // ============================================================
  const TabBar = () => {
    const tabs = [
      { id: "home", label: "Home", icon: Home },
      { id: "chat", label: "Chat", icon: MessageCircle },
      { id: "rewire", label: "Rewire", icon: Sparkles },
      { id: "wins", label: "Wins", icon: Trophy },
    ];

    return (
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 px-4 py-2 pb-3">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-1 px-4 transition-all ${
                  isActive ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN LAYOUT — PHONE FRAME
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      {/* Phone frame */}
      <div
        className="bg-white shadow-2xl overflow-hidden relative"
        style={{ width: 390, height: 844, borderRadius: "2.5rem", border: "8px solid #111827" }}
      >
        {/* Status bar / notch */}
        <div className="h-12 bg-white flex items-center justify-between px-8 pt-1">
          <span className="text-xs font-semibold text-gray-900">9:41</span>
          <div className="bg-gray-900 rounded-full" style={{ width: 80, height: 25 }} />
          <div className="flex gap-1">
            <div className="bg-gray-900 rounded-sm" style={{ width: 16, height: 10 }} />
          </div>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto relative bg-gray-50" style={{ height: "calc(100% - 48px)" }}>
          {appPhase === "onboarding" ? (
            <>
              {onboardingStep === "welcome" && <OnboardingWelcome />}
              {onboardingStep === "questions" && <OnboardingQuestions />}
              {onboardingStep === "pattern" && <OnboardingPattern />}
              {onboardingStep === "style_intro" && <OnboardingStyleIntro />}
              {onboardingStep === "style_quiz" && <OnboardingStyleQuiz />}
            </>
          ) : (
            <>
              {activeTab === "home" && <HomeScreen />}
              {activeTab === "chat" && <ChatScreen />}
              {activeTab === "rewire" && <RewireScreen />}
              {activeTab === "wins" && <WinsScreen />}
              {showSettings && <SettingsOverlay />}
              <TabBar />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToneyApp;
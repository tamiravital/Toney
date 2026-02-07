import { TensionType, TensionDetails, TensionColors, IdentifiedTension } from '@toney/types';

export const tensionDetails: Record<TensionType, TensionDetails> = {
  avoid: {
    verb: 'avoid',
    description: "When money comes up, you tend to look away. Not because you don't care, but because it triggers something uncomfortable \u2014 so your brain says \"don't look.\"",
    root_feelings: 'anxiety, shame, overwhelm',
    common_behaviors: [
      "Not opening bills or checking balances",
      "Putting off financial decisions until they become urgent",
      "Feeling paralyzed when money conversations come up",
    ],
    underlying_need: "Protection from overwhelm. Your brain learned that not looking means not hurting.",
    reframe: "Your avoidance isn't laziness \u2014 it's a sophisticated protection mechanism. The same sensitivity that makes money overwhelming also means you'll have deep insights once you feel safe enough to look.",
    first_step: "Just glance at your balance once today. That's it \u2014 5 seconds, no judgment, no action required.",
    conversation_starters: [
      "I haven't looked at my accounts in a while",
      "I know I should budget but I can't start",
      "Money conversations make me shut down",
      "I just got a bill I've been ignoring",
    ],
    color: 'purple',
  },
  worry: {
    verb: 'worry',
    description: "You're always watching, always calculating, but no amount of checking ever makes you feel truly safe with money.",
    root_feelings: 'fear, scarcity, hypervigilance',
    common_behaviors: [
      "Checking accounts multiple times a day",
      "Catastrophizing about financial what-ifs",
      "Difficulty sleeping because of money thoughts",
    ],
    underlying_need: "Certainty and safety. You're trying to prevent disaster by staying one step ahead.",
    reframe: "Your vigilance shows incredible financial awareness. The challenge isn't knowing your numbers \u2014 it's learning to trust that you're going to be OK.",
    first_step: "Next time you reach for your banking app, pause and ask: 'Am I checking because something changed, or because I'm anxious?'",
    conversation_starters: [
      "I check my accounts constantly but it never helps",
      "I can't stop running worst-case scenarios",
      "I have savings but I still don't feel safe",
      "My partner thinks I worry too much about money",
    ],
    color: 'sky',
  },
  chase: {
    verb: 'chase',
    description: "You're drawn to the next big opportunity \u2014 the rush of possibility, the fear of being left behind. Patience feels like losing.",
    root_feelings: 'inadequacy, need for excitement, fear of being left behind',
    common_behaviors: [
      "Jumping on trending investments without full research",
      "Difficulty holding long-term positions",
      "The thrill of risk feels more alive than safety",
    ],
    underlying_need: "To feel like you're winning and not falling behind. The chase makes the gap between where you are and where you want to be feel closeable.",
    reframe: "Your willingness to take action is a genuine strength. Most people are too scared to do anything. The work is learning when the excitement is real opportunity versus FOMO in disguise.",
    first_step: "Next time you feel the urge to make a money move, write down why. If reason #1 is 'everyone else is doing it,' wait 24 hours.",
    conversation_starters: [
      "I keep jumping on investments and regretting it",
      "I feel like everyone is getting rich except me",
      "Boring investing feels wrong to me",
      "I just saw something trending and want to buy in",
    ],
    color: 'blue',
  },
  perform: {
    verb: 'perform',
    description: "Money is how you show the world you're doing well \u2014 but the performance costs more than anyone sees.",
    root_feelings: 'low self-worth, need for external validation',
    common_behaviors: [
      "Spending to maintain an image that doesn't match reality",
      "Difficulty saying 'I can't afford that'",
      "Comparing your lifestyle to others constantly",
    ],
    underlying_need: "To feel worthy and respected. If people see you as successful, maybe you'll feel it too.",
    reframe: "The fact that you care about how you show up in the world is a social intelligence. The shift is from performing worth to feeling it from the inside.",
    first_step: "Think of the last purchase you made to impress someone. How did it feel 48 hours later?",
    conversation_starters: [
      "I spend money I don't have to keep up appearances",
      "I feel embarrassed when I can't afford what friends can",
      "I can't say no to expensive plans",
      "My social life looks better than my bank account",
    ],
    color: 'amber',
  },
  numb: {
    verb: 'numb',
    description: "When feelings get big, spending quiets them. It's not about the stuff \u2014 it's about the relief.",
    root_feelings: 'pain avoidance, emptiness, unmet emotional needs',
    common_behaviors: [
      "Shopping when stressed, bored, lonely, or sad",
      "Buying things that still have tags on them weeks later",
      "The rush of purchasing followed by guilt",
    ],
    underlying_need: "Comfort and relief. The dopamine hit from buying is real \u2014 it just doesn't solve the feeling underneath.",
    reframe: "You're not an 'overspender.' You're someone who found a way to cope with hard feelings. The spending isn't the problem \u2014 it's the last link in a chain that starts with an emotion you haven't had another way to process.",
    first_step: "Next time you feel the urge to buy something unplanned, pause 10 seconds and name the feeling. You don't have to stop \u2014 just name what's going on.",
    conversation_starters: [
      "I just bought something I didn't need and feel guilty",
      "Shopping is the only thing that helps when I'm stressed",
      "I want to stop impulse buying but I can't",
      "I know I'm spending emotionally but I don't know why",
    ],
    color: 'pink',
  },
  give: {
    verb: 'give',
    description: "You take care of everyone else's money needs before your own \u2014 and feel guilty when you don't.",
    root_feelings: 'guilt, people-pleasing, unworthiness',
    common_behaviors: [
      "Lending money you can't afford to lose",
      "Picking up the check even when you're struggling",
      "Feeling selfish when you spend on yourself",
    ],
    underlying_need: "To feel loved and needed. If you're the generous one, you have a place in people's lives.",
    reframe: "Your generosity is real and people love you for it. But you can't pour from an empty cup. Including yourself in the people you care for isn't selfish \u2014 it's sustainable.",
    first_step: "Next time someone asks you for money, give yourself 24 hours before responding. Notice what it feels like to not say yes immediately.",
    conversation_starters: [
      "I always lend money to family even when I can't afford it",
      "I feel guilty spending anything on myself",
      "I pick up every check and my savings shows it",
      "Someone asked me for money and I can't say no",
    ],
    color: 'teal',
  },
  grip: {
    verb: 'grip',
    description: "You've built real financial discipline \u2014 but the control has become its own kind of prison. No amount of saving ever feels like enough.",
    root_feelings: 'fear of loss, need for certainty, distrust',
    common_behaviors: [
      "Tracking every single dollar spent",
      "Anxiety about spending even with healthy savings",
      "Difficulty enjoying money on experiences or gifts",
    ],
    underlying_need: "To feel safe. If you control the money, you can prevent catastrophe. Letting go feels like inviting disaster.",
    reframe: "Your discipline is extraordinary \u2014 most people wish they had your level of financial control. The next level isn't more control. It's trusting that you've built enough safety to also enjoy your life.",
    first_step: "Spend $10 on something purely for enjoyment today. No tracking it, no logging it. Just let it go.",
    conversation_starters: [
      "I have money saved but I can't bring myself to spend it",
      "My partner says I'm too controlling with money",
      "I track every dollar and it's exhausting but I can't stop",
      "I know I should enjoy my money more but it feels wrong",
    ],
    color: 'emerald',
  },
};

export function tensionColor(type: TensionType | null | undefined): TensionColors {
  const colors: Record<TensionType, TensionColors> = {
    avoid:   { bg: 'bg-purple-50',  text: 'text-purple-700',  accent: 'bg-purple-600',  light: 'bg-purple-100',  border: 'border-purple-200' },
    worry:   { bg: 'bg-sky-50',     text: 'text-sky-700',     accent: 'bg-sky-600',     light: 'bg-sky-100',     border: 'border-sky-200' },
    chase:   { bg: 'bg-blue-50',    text: 'text-blue-700',    accent: 'bg-blue-600',    light: 'bg-blue-100',    border: 'border-blue-200' },
    perform: { bg: 'bg-amber-50',   text: 'text-amber-700',   accent: 'bg-amber-600',   light: 'bg-amber-100',   border: 'border-amber-200' },
    numb:    { bg: 'bg-pink-50',    text: 'text-pink-700',    accent: 'bg-pink-600',    light: 'bg-pink-100',    border: 'border-pink-200' },
    give:    { bg: 'bg-teal-50',    text: 'text-teal-700',    accent: 'bg-teal-600',    light: 'bg-teal-100',    border: 'border-teal-200' },
    grip:    { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'bg-emerald-600', light: 'bg-emerald-100', border: 'border-emerald-200' },
  };
  if (!type || !colors[type]) {
    return { bg: 'bg-gray-50', text: 'text-gray-700', accent: 'bg-gray-600', light: 'bg-gray-100', border: 'border-gray-200' };
  }
  return colors[type];
}

export function identifyTension(responses: Record<string, string>): IdentifiedTension {
  const scores: Record<TensionType, number> = { avoid: 0, worry: 0, chase: 0, perform: 0, numb: 0, give: 0, grip: 0 };

  // Q1: How do you relate to checking your bank balance?
  const check = responses.money_check;
  if (check === 'avoid_it') { scores.avoid += 3; }
  else if (check === 'obsess') { scores.worry += 2; scores.grip += 1; }
  else if (check === 'track_tight') { scores.grip += 3; }
  else if (check === 'only_when_needed') { scores.numb += 1; scores.avoid += 1; }

  // Q2: You get an unexpected $500. First instinct?
  const windfall = responses.unexpected_500;
  if (windfall === 'save_all') { scores.grip += 2; scores.worry += 1; }
  else if (windfall === 'treat_self') { scores.numb += 2; scores.perform += 1; }
  else if (windfall === 'invest_fast') { scores.chase += 3; }
  else if (windfall === 'help_others') { scores.give += 3; }
  else if (windfall === 'dont_think') { scores.avoid += 2; }

  // Q3: What triggers your money stress most?
  const trigger = responses.stress_trigger;
  if (trigger === 'falling_behind') { scores.chase += 2; scores.perform += 2; }
  else if (trigger === 'not_enough') { scores.worry += 3; }
  else if (trigger === 'cant_say_no') { scores.give += 3; }
  else if (trigger === 'losing_control') { scores.numb += 2; scores.avoid += 1; }
  else if (trigger === 'cant_enjoy') { scores.grip += 3; }

  // Q4: When friends suggest something expensive, you...
  const social = responses.social_money;
  if (social === 'say_yes_regret') { scores.perform += 1; scores.numb += 2; }
  else if (social === 'cover_others') { scores.give += 3; }
  else if (social === 'calculate') { scores.worry += 2; scores.grip += 1; }
  else if (social === 'avoid_plans') { scores.avoid += 3; }
  else if (social === 'go_big') { scores.perform += 1; scores.chase += 2; }

  // Q5: When you need to make a money decision, you tend to...
  const decide = responses.money_decisions;
  if (decide === 'postpone') { scores.avoid += 3; }
  else if (decide === 'overthink') { scores.worry += 2; scores.grip += 1; }
  else if (decide === 'act_fast') { scores.chase += 3; }
  else if (decide === 'ask_others') { scores.give += 2; }
  else if (decide === 'emotion_driven') { scores.numb += 2; }

  // Q6: If someone close to you described your money behavior, they'd say...
  const mirror = responses.money_identity;
  if (mirror === 'too_careful') { scores.grip += 3; }
  else if (mirror === 'too_generous') { scores.give += 3; }
  else if (mirror === 'head_in_sand') { scores.avoid += 3; }
  else if (mirror === 'always_stressed') { scores.worry += 3; }
  else if (mirror === 'big_spender') { scores.perform += 2; scores.numb += 1; scores.chase += 2; }

  // Q7: When you look at your recent purchases, what pattern do you notice?
  const purchases = responses.purchase_pattern;
  if (purchases === 'unopened') { scores.numb += 3; }
  else if (purchases === 'impressive') { scores.perform += 3; }
  else if (purchases === 'opportunities') { scores.chase += 3; }
  else if (purchases === 'for_others') { scores.give += 2; }
  else if (purchases === 'mostly_essentials') { scores.grip += 2; scores.avoid += 1; }

  // Sort to find primary and secondary
  const sorted = (Object.entries(scores) as [TensionType, number][]).sort((a, b) => b[1] - a[1]);
  const [primaryType, primaryScore] = sorted[0];
  const [secondaryType, secondaryScore] = sorted[1];

  const result: IdentifiedTension = {
    primary: primaryType,
    primaryScore,
    primaryDetails: tensionDetails[primaryType],
  };

  // Include secondary if it scores at least 40% of primary and is > 0
  if (secondaryScore >= primaryScore * 0.4 && secondaryScore > 0) {
    result.secondary = secondaryType;
    result.secondaryScore = secondaryScore;
    result.secondaryDetails = tensionDetails[secondaryType];
  }

  return result;
}

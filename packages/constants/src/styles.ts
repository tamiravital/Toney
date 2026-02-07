import { TensionType, DepthLevel, LearningStyle } from '@toney/types';

export interface ToneExample {
  emoji: string;
  label: string;
  text: string;
}

export const toneExamples: Record<string, ToneExample> = {
  gentle: {
    emoji: "\u{1F917}",
    label: "Gentle",
    text: "That sounds really stressful. You're not alone in feeling this way. Want to explore what was going on?",
  },
  balanced: {
    emoji: "\u{1F4AD}",
    label: "Balanced",
    text: "I noticed the pattern. This seems connected to stress-spending. Want to talk about what happened?",
  },
  direct: {
    emoji: "\u{1F3AF}",
    label: "Direct",
    text: "You overspent by $200. Likely Thursday after work stress. Here's what we'll do differently.",
  },
};

export const toneMap: Record<string, number> = {
  gentle: 3,
  balanced: 5,
  direct: 8,
};

export function toneLabel(tone: number): string {
  if (tone <= 4) return "Gentle";
  if (tone >= 7) return "Direct";
  return "Balanced";
}

export interface LearningStyleOption {
  value: LearningStyle;
  label: string;
  emoji: string;
  iconName: string;
}

export const learningStyleOptions: LearningStyleOption[] = [
  { value: "analytical", label: "Data & patterns", emoji: "\u{1F4CA}", iconName: "BarChart3" },
  { value: "somatic", label: "Feelings & body", emoji: "\u{1F4AD}", iconName: "Heart" },
  { value: "narrative", label: "Stories & examples", emoji: "\u{1F4D6}", iconName: "BookOpen" },
  { value: "experiential", label: "Things to try", emoji: "\u{1F52C}", iconName: "FlaskConical" },
];

export interface DepthOption {
  value: DepthLevel;
  emoji: string;
  label: string;
  desc: string;
}

export const depthOptions: DepthOption[] = [
  { value: "surface", emoji: "\u26A1", label: "Quick tactics", desc: "Just help me fix the behavior" },
  { value: "balanced", emoji: "\u2696\u{FE0F}", label: "Balanced", desc: "Understanding + action" },
  { value: "deep", emoji: "\u{1F30A}", label: "Deep exploration", desc: "Where this came from, and how to transform it" },
];

export const suggestedWins: Record<TensionType, string[]> = {
  avoid: [
    "Checked my balance without spiraling",
    "Opened a bill the day it arrived",
    "Had a money conversation I usually dodge",
  ],
  worry: [
    "Went a whole morning without checking my accounts",
    "Caught myself catastrophizing and took a breath",
    "Felt anxious about money and sat with it instead of checking",
  ],
  chase: [
    "Waited 24 hours before making an investment move",
    "Stayed with my plan when I saw something trending",
    "Researched before acting on a hot tip",
  ],
  perform: [
    "Said 'that's not in my budget' without shame",
    "Chose what I actually wanted instead of what looks good",
    "Skipped a purchase that was only for appearances",
  ],
  numb: [
    "Paused before an impulse buy and named the feeling",
    "Felt an urge to shop and did something else instead",
    "Bought something intentionally and enjoyed it guilt-free",
  ],
  give: [
    "Said no to a money request without guilt",
    "Spent on myself without feeling selfish",
    "Let someone else pick up the check",
  ],
  grip: [
    "Spent money on something fun without tracking it",
    "Went a full day without checking my budget",
    "Treated myself without needing to earn it first",
  ],
};

export const dailyPrompts: Record<TensionType, string> = {
  avoid: "Take 30 seconds to glance at your balance. Just look \u2014 no judgment, no action needed.",
  worry: "If you've already checked your accounts today, try not checking again until tonight.",
  chase: "Before making any money move today, ask yourself: is this strategy or excitement?",
  perform: "Notice if you're about to spend to impress someone. What would you choose just for you?",
  numb: "Next time you feel the pull to browse or buy, pause and name what you're actually feeling.",
  give: "Today, if someone asks for financial help, give yourself 24 hours before responding.",
  grip: "Spend $5 on something small that makes you happy. Don't log it.",
};

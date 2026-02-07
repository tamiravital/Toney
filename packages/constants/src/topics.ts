export type TopicKey =
  | 'enoughness_future_calm'
  | 'money_conversations'
  | 'avoidance_procrastination'
  | 'spending_awareness'
  | 'investments'
  | 'income_courage'
  | 'big_ticket_decisions';

export interface TopicDefinition {
  key: TopicKey;
  name: string;
  description: string;
  /** Long-form scope description injected into the system prompt to keep Claude on-topic */
  scope_guidance: string;
  /** Lucide icon name */
  icon: string;
  /** Tailwind color name (maps to topicColor) */
  color: string;
}

export const ALL_TOPICS: TopicKey[] = [
  'enoughness_future_calm',
  'money_conversations',
  'avoidance_procrastination',
  'spending_awareness',
  'investments',
  'income_courage',
  'big_ticket_decisions',
];

export const topicDetails: Record<TopicKey, TopicDefinition> = {
  enoughness_future_calm: {
    key: 'enoughness_future_calm',
    name: 'Enoughness & Future Calm',
    description: "Core beliefs about worth and safety — the anxiety about whether there's \"enough\" now and later.",
    scope_guidance: 'Anxious loops about whether there is enough now and later — safety, security, and the fear of sudden costs. Thoughts about emergency funds, retirement, job stability, and "what if something goes wrong" scenarios. Rumination, comparison with peers, and catastrophizing that leads to scanning balances or news for reassurance. Tension between wanting certainty and living with normal ups and downs. Worry that self-worth or identity is tied to how much you have saved. Early or significant money memories (how caretakers handled bills, scarcity, or windfalls). Family/cultural scripts about independence, sacrifice, or what it means to be "good with money." Money related feelings like guilt, shame, fear, anxiety, stress, envy, anger, frustration.',
    icon: 'Shield',
    color: 'sky',
  },
  money_conversations: {
    key: 'money_conversations',
    name: 'Money Conversations',
    description: 'Recurring tensions about fairness, boundaries, and expectations with partners, family, or friends.',
    scope_guidance: 'Recurring tensions with a partner, family member, roommate, or friend about who pays, what\'s fair, and what\'s okay to ask. Friction around splitting bills, being paid back, shared expenses (rent, utilities, groceries), or differing money styles and expectations. Stress about bringing up money, setting boundaries, saying "no," or naming discomfort when spending feels lopsided. Guilt, resentment, or avoidance after awkward talks or hidden purchases. Cultural or family scripts that make the conversation harder.',
    icon: 'MessageSquare',
    color: 'purple',
  },
  avoidance_procrastination: {
    key: 'avoidance_procrastination',
    name: 'Avoidance & Procrastination',
    description: 'Putting off money tasks (forms, bills, decisions) because they feel overwhelming or uncomfortable.',
    scope_guidance: 'Putting off money tasks because they feel heavy, confusing, shame-tinged, or endless. Unopened mail or emails, ignored statements, delayed taxes or forms, or postponing calls to service providers or the bank. Stopping before the first tiny step, perfectionism loops ("I need the perfect plan"), or decision fatigue that turns into doing nothing. Peaks of dread before due dates and short bursts of relief after avoiding — followed by more anxiety later.',
    icon: 'Clock',
    color: 'amber',
  },
  spending_awareness: {
    key: 'spending_awareness',
    name: 'Spending Awareness',
    description: 'Noticing you spend more than you intend — impulse buys or small treats that add up.',
    scope_guidance: 'Moments where spending drifts from intention: impulse buys, treats that add up, subscription creep, late-night checkout. Emotional or stress relief purchases, retail scrolling, or "it was on sale" rationalizations. Regret or second-guessing afterward; difficulty seeing patterns until the card statement arrives. Social pressure, boredom, or habit cues that nudge quick taps and swipes.',
    icon: 'CreditCard',
    color: 'pink',
  },
  investments: {
    key: 'investments',
    name: 'Investments',
    description: 'Emotions and unhelpful habits — chasing FOMO, panic-selling, or staying too safe — that make it hard to stick to a plan.',
    scope_guidance: 'Emotions and habits that make it hard to stick with a plan — FOMO, panic-selling, overtrading, or freezing in cash. Checking prices compulsively, chasing tips, or anchoring to a past high. Fear of losses, regret after moves, or confusion when markets swing. Hesitation to start investing at all, or whiplash between risk-seeking and risk-avoidant impulses.',
    icon: 'TrendingUp',
    color: 'emerald',
  },
  income_courage: {
    key: 'income_courage',
    name: 'Income & Courage',
    description: 'Asking, negotiating, and pricing with confidence — stating your number and handling "no."',
    scope_guidance: 'The inner friction of asking, negotiating, or pricing — stating your number and staying with it. Worry about rejection, conflict, or being seen as greedy; discounting to be liked or to "not make a fuss." Setting rates with clients, raising rates, salary conversations, or navigating offers and counter-offers. Tangles with self-worth, impostor feelings, or anchoring low because it feels safer.',
    icon: 'Rocket',
    color: 'blue',
  },
  big_ticket_decisions: {
    key: 'big_ticket_decisions',
    name: 'Big-Ticket Decisions',
    description: 'Major purchases or commitments (car, home, education, major trips) where stakes and emotions run high.',
    scope_guidance: 'High-stakes choices with emotional weight — car, home, education, major trips, or similar commitments. Pressure to decide quickly, conflicting advice, and fear of regret if the choice is wrong. Balancing practical constraints with values and timing; uncertainty about tradeoffs and "what matters most." Stress from long-term commitments and future obligations; voices from family or partners pulling in different directions.',
    icon: 'Target',
    color: 'orange',
  },
};

export interface TopicColors {
  bg: string;
  text: string;
  accent: string;
  light: string;
  border: string;
}

export function topicColor(key: TopicKey | null | undefined): TopicColors {
  const colors: Record<string, TopicColors> = {
    sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     accent: 'bg-sky-600',     light: 'bg-sky-100',     border: 'border-sky-200' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  accent: 'bg-purple-600',  light: 'bg-purple-100',  border: 'border-purple-200' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   accent: 'bg-amber-600',   light: 'bg-amber-100',   border: 'border-amber-200' },
    pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',    accent: 'bg-pink-600',    light: 'bg-pink-100',    border: 'border-pink-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'bg-emerald-600', light: 'bg-emerald-100', border: 'border-emerald-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    accent: 'bg-blue-600',    light: 'bg-blue-100',    border: 'border-blue-200' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  accent: 'bg-orange-600',  light: 'bg-orange-100',  border: 'border-orange-200' },
  };
  if (!key) return colors.sky;
  const def = topicDetails[key];
  return def ? colors[def.color] || colors.sky : colors.sky;
}

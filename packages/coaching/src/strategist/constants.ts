// ────────────────────────────────────────────
// Shared Strategist Constants
// ────────────────────────────────────────────
// Single source of truth for growth lenses and tension guidance.
// Used by planSession, reflectOnSession, and the monolithic Strategist.

export const GROWTH_LENS_NAMES = [
  'self_receiving',
  'earning_mindset',
  'money_identity',
  'money_relationships',
  'financial_awareness',
  'decision_confidence',
  'future_orientation',
] as const;

export type GrowthLensName = (typeof GROWTH_LENS_NAMES)[number];

export const GROWTH_LENSES_DESCRIPTION = `Growth lenses (use as a thinking framework, not rigid categories):
- Self-receiving — Can they spend on themselves without guilt? Can they accept gifts, compliments about money, rest?
- Earning mindset — Do they believe they can generate income? Can they ask for what they're worth?
- Money identity — Do they see themselves as someone who can have, make, or manage money?
- Money relationships — Can they have healthy money conversations with partners, family, friends?
- Financial awareness — Do they know their numbers? Are they engaged with their finances or avoiding them?
- Decision confidence — Can they make money decisions without spiraling, overanalyzing, or freezing?
- Future orientation — Can they plan without anxiety or avoidance? Do they trust that the future will be okay?`;

export const TENSION_GUIDANCE: Record<string, string> = {
  avoid: 'Start with tiny exposure, not comprehensive plans. Make money visible without triggering shutdown.',
  worry: 'Contain, don\'t expand. Give worries a time boundary. Demonstrate safety through evidence.',
  chase: 'Explore what the spending is replacing. The impulse serves a feeling — find it.',
  perform: 'Build trust before challenging the facade. The image is protective — don\'t rip it off.',
  numb: 'Re-engage gently. Body-based prompts to reconnect with money feelings.',
  give: 'Explore receiving, not just giving. Generosity often masks self-worth issues.',
  grip: 'Loosen through tiny permission-to-spend exercises. Control is safety — respect it.',
};

import Anthropic from '@anthropic-ai/sdk';
import { Profile, BehavioralIntel, RewireCard, CoachingBriefing } from '@toney/types';

// ────────────────────────────────────────────
// Session Planner — Pre-session strategy (Sonnet, temp=0.3)
// ────────────────────────────────────────────
// Runs at session open. Reads the person model (stored data) + recent
// session notes and produces a session strategy + assembled briefing.
// The "slow" sections (WHO THEY ARE, COACHING STYLE, etc.) come from
// stored behavioral_intel — NOT regenerated. The LLM only thinks about
// SESSION STRATEGY and JOURNEY NARRATIVE.
// Pure function — no DB, no Supabase. Reusable by mobile + simulator.

export interface SessionPlanInput {
  profile: Profile;
  behavioralIntel?: BehavioralIntel | null;
  /** Recent session notes as stored JSON strings (most recent first) */
  recentSessionNotes?: string[];
  /** User's toolkit cards */
  rewireCards?: RewireCard[];
  /** Previous briefing (for version number and continuity) */
  previousBriefing?: CoachingBriefing | null;
  /** True if this is the very first session (post-onboarding) */
  isFirstSession: boolean;
}

export interface SessionPlan {
  /** Full assembled briefing the Coach reads */
  briefing: string;
  /** One-sentence coaching thesis */
  hypothesis: string;
  /** What this session should accomplish */
  sessionStrategy: string;
  /** Updated journey narrative */
  journeyNarrative: string;
  /** Growth edge assessment */
  growthEdges: Record<string, unknown>;
}

// ────────────────────────────────────────────
// Growth Lenses (shared with monolithic strategist)
// ────────────────────────────────────────────

const GROWTH_LENSES = `Growth lenses:
- Self-receiving — spending on self, accepting gifts/rest
- Earning mindset — belief in ability to generate income, asking for worth
- Money identity — seeing self as someone who can have/make/manage money
- Money relationships — healthy money conversations with others
- Financial awareness — engaged with numbers vs avoiding
- Decision confidence — making money decisions without spiraling
- Future orientation — planning without anxiety, trusting the future`;

const TENSION_GUIDANCE: Record<string, string> = {
  avoid: 'Tiny exposure, not comprehensive plans. Make money visible without shutdown.',
  worry: 'Contain, don\'t expand. Time-boundary worries. Demonstrate safety through evidence.',
  chase: 'Explore what spending replaces. The impulse serves a feeling — find it.',
  perform: 'Build trust before challenging facade. The image is protective.',
  numb: 'Re-engage gently. Body-based prompts to reconnect with money feelings.',
  give: 'Explore receiving, not just giving. Generosity often masks self-worth.',
  grip: 'Tiny permission-to-spend exercises. Control is safety — respect it.',
};

// ────────────────────────────────────────────
// Assembled briefing sections from stored data
// ────────────────────────────────────────────

function buildWhoTheyAre(profile: Profile, intel: BehavioralIntel | null): string {
  const p = profile;
  const lines: string[] = [];
  lines.push(`Tension: ${p.tension_type || 'unknown'}${p.secondary_tension_type ? ` (secondary: ${p.secondary_tension_type})` : ''}`);
  lines.push(`Life stage: ${p.life_stage || 'unknown'}, Income: ${p.income_type || 'unknown'}, Relationship: ${p.relationship_status || 'unknown'}`);
  if (p.what_brought_you) lines.push(`What brought them to Toney: "${p.what_brought_you}"`);
  if (p.emotional_why) lines.push(`Emotional why (their words): "${p.emotional_why}"`);
  if (intel?.stage_of_change) lines.push(`Stage of change: ${intel.stage_of_change}`);
  return lines.join('\n');
}

function buildWhatWeKnow(intel: BehavioralIntel | null): string {
  if (!intel) return 'No behavioral intel yet — early in their journey.';

  const lines: string[] = [];
  if (intel.triggers?.length) lines.push(`Triggers: ${intel.triggers.join('; ')}`);
  if (intel.emotional_vocabulary) {
    const ev = intel.emotional_vocabulary;
    if (ev.used_words?.length) lines.push(`Words they use: ${ev.used_words.join(', ')}`);
    if (ev.avoided_words?.length) lines.push(`Words they avoid: ${ev.avoided_words.join(', ')}`);
    if (ev.deflection_phrases?.length) lines.push(`Deflection phrases: ${ev.deflection_phrases.join('; ')}`);
  }
  if (intel.resistance_patterns?.length) lines.push(`Resistance patterns: ${intel.resistance_patterns.join('; ')}`);
  if (intel.breakthroughs?.length) lines.push(`Breakthroughs: ${intel.breakthroughs.join('; ')}`);
  if (intel.coaching_notes?.length) lines.push(`Coaching notes: ${intel.coaching_notes.join('; ')}`);

  return lines.length > 0 ? lines.join('\n') : 'Minimal intel gathered so far.';
}

function buildToolkit(cards: RewireCard[]): string {
  if (!cards || cards.length === 0) return 'No cards in toolkit yet.';

  return cards.map(c => {
    let line = `- [${c.category}] "${c.title}"`;
    if (c.times_completed) line += ` — used ${c.times_completed}x`;
    if (c.graduated_at) line += ' (graduated)';
    return line;
  }).join('\n');
}

function buildCoachingStyle(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`Tone: ${profile.tone ?? 5}/10 (1=gentle, 10=direct)`);
  lines.push(`Depth: ${profile.depth || 'balanced'}`);
  if (profile.learning_styles?.length) lines.push(`Learning styles: ${profile.learning_styles.join(', ')}`);
  return lines.join('\n');
}

// ────────────────────────────────────────────
// The LLM call — SESSION STRATEGY only
// ────────────────────────────────────────────

const PLAN_SESSION_PROMPT = `You are the Strategist for Toney, an AI money coaching app. You're preparing the session strategy for the Coach.

You are NOT generating a full briefing. The stable sections (WHO THEY ARE, WHAT WE KNOW, TOOLKIT, COACHING STYLE) are assembled from stored data. Your job is to produce ONLY:

1. **SESSION STRATEGY** — What this session should accomplish. What to check in on from recent sessions. What reframes to seed. What to watch for. What NOT to push on. How to handle if they bring something urgent.

2. **HYPOTHESIS** — Your one-sentence coaching thesis for this person right now. Connect dots they haven't connected.

3. **JOURNEY NARRATIVE** — Where they are in their arc. 2-3 sentences. What's shifted, what's stabilizing, what's raw.

4. **GROWTH EDGES** — Which lenses are active/stabilizing/not ready.

## Output format (JSON only):

\`\`\`json
{
  "session_strategy": "2-4 sentences. Be specific — name what to do, what to check in on, what to avoid.",
  "hypothesis": "One sentence. The thing they haven't articulated yet.",
  "journey_narrative": "2-3 sentences. The arc of where they've been and where they're heading.",
  "growth_edges": { "active": ["lenses ready to stretch"], "stabilizing": ["settling in"], "not_ready": ["don't push"] }
}
\`\`\`

## Rules:
- Be specific and actionable. "Check in on last session's reframe about earning" not "Continue previous work."
- Reference session notes concretely — not "previous sessions showed progress" but "In last session they connected childhood scarcity to grip behavior."
- If there are no session notes yet, focus on onboarding data and create a strong opening hypothesis.
- Session strategy should feel like coaching supervision notes — a senior therapist telling a junior what to focus on.`;

export async function planSession(input: SessionPlanInput): Promise<SessionPlan> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const tensionType = input.profile.tension_type || 'unknown';
  const tensionGuidance = TENSION_GUIDANCE[tensionType] || 'Approach with curiosity.';

  // Build user message with all context for the LLM
  const sections: string[] = [];

  sections.push(`## Person Summary
${buildWhoTheyAre(input.profile, input.behavioralIntel || null)}

## Tension Guidance
${tensionGuidance}

## What We Know
${buildWhatWeKnow(input.behavioralIntel || null)}

## Their Toolkit
${buildToolkit(input.rewireCards || [])}

${GROWTH_LENSES}`);

  if (input.previousBriefing) {
    sections.push(`## Previous Session Plan
Hypothesis: ${input.previousBriefing.hypothesis || 'none'}
Strategy: ${input.previousBriefing.session_strategy || 'none'}
Journey: ${input.previousBriefing.journey_narrative || 'none'}`);
  }

  if (input.recentSessionNotes && input.recentSessionNotes.length > 0) {
    const notesLines = input.recentSessionNotes.map((n, i) =>
      `### Session ${input.recentSessionNotes!.length - i} (most recent first)\n${n}`
    );
    sections.push(`## Recent Session Notes\n${notesLines.join('\n\n')}`);
  }

  if (input.isFirstSession) {
    sections.push('\n## Note: This is the FIRST session. No previous sessions to reference. Focus on onboarding data and create a strong opening hypothesis.');
  }

  const userMessage = `Plan the next coaching session for this person.\n\n${sections.join('\n\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    temperature: 0.3,
    system: PLAN_SESSION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Parse failed — use defaults
  }

  const sessionStrategy = (parsed.session_strategy as string) || '';
  const hypothesis = (parsed.hypothesis as string) || '';
  const journeyNarrative = (parsed.journey_narrative as string) || '';
  const growthEdges = (parsed.growth_edges as Record<string, unknown>) || {};

  // ── Assemble the full briefing from stored data + fresh strategy ──
  const version = input.previousBriefing ? (input.previousBriefing.version + 1) : 1;

  const briefing = `COACH BRIEFING — Session ${version}

WHO THEY ARE:
${buildWhoTheyAre(input.profile, input.behavioralIntel || null)}

WHERE THEY ARE IN THEIR JOURNEY:
${journeyNarrative || 'Journey narrative not yet established.'}

WHAT WE KNOW:
${buildWhatWeKnow(input.behavioralIntel || null)}

THEIR TOOLKIT:
${buildToolkit(input.rewireCards || [])}

WHERE GROWTH IS AVAILABLE:
${formatGrowthEdges(growthEdges)}

SESSION STRATEGY:
${sessionStrategy || 'No specific strategy — follow the user\'s lead.'}

COACHING STYLE:
${buildCoachingStyle(input.profile)}`;

  return {
    briefing,
    hypothesis,
    sessionStrategy,
    journeyNarrative,
    growthEdges,
  };
}

function formatGrowthEdges(edges: Record<string, unknown>): string {
  if (!edges || Object.keys(edges).length === 0) return 'Growth edges not yet assessed.';

  const lines: string[] = [];
  const active = edges.active as string[] | undefined;
  const stabilizing = edges.stabilizing as string[] | undefined;
  const notReady = edges.not_ready as string[] | undefined;

  if (active?.length) lines.push(`Active (ready to stretch): ${active.join(', ')}`);
  if (stabilizing?.length) lines.push(`Stabilizing (settling in): ${stabilizing.join(', ')}`);
  if (notReady?.length) lines.push(`Not ready (don't push): ${notReady.join(', ')}`);

  return lines.length > 0 ? lines.join('\n') : 'Growth edges not yet assessed.';
}

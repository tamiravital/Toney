import Anthropic from '@anthropic-ai/sdk';
import { Profile, BehavioralIntel, Win, CoachMemory, RewireCard, CoachingBriefing, ObserverSignal } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

// ────────────────────────────────────────────
// Strategist — The coaching brain (Sonnet, temp=0.3)
// ────────────────────────────────────────────
// Runs between sessions. Produces a "Coach Briefing" —
// the narrative coaching document the Coach reads instead of raw data.
// Handles clinical sequencing, journey narrative, growth edges.
// Cards are co-created in-session by the Coach — the Strategist does NOT prescribe them.

export interface StrategistContext {
  profile: Profile;
  behavioralIntel?: BehavioralIntel | null;
  coachMemories?: CoachMemory[];
  wins?: Win[];
  rewireCards?: RewireCard[];
  previousBriefing?: CoachingBriefing | null;
  /** Session notes from recent completed sessions (replaces observerSignals) */
  previousSessionNotes?: string[];
  /** @deprecated Observer removed in v3. Kept for admin build compat. Ignored. */
  observerSignals?: ObserverSignal[];
  /** Full session transcript (for session_end analysis) */
  sessionTranscript?: { role: 'user' | 'assistant'; content: string }[];
  isFirstBriefing: boolean;
}

/** @deprecated Focus cards are now co-created in-session. Kept for admin build compat. */
export interface FocusCardPrescription {
  action: 'create_new' | 'set_existing' | 'keep_current' | 'graduate';
  card?: {
    category: string;
    title: string;
    content: string;
  };
  existing_card_id?: string;
  rationale: string;
}

export interface StrategistOutput {
  briefing_content: string;
  hypothesis: string;
  session_strategy: string;
  journey_narrative: string;
  growth_edges: Record<string, unknown>;
  /** Tension type determined by the Strategist from quiz answers */
  tension_type?: string | null;
  /** Secondary tension type */
  secondary_tension_type?: string | null;
  /** @deprecated Focus cards are now co-created in-session. Kept for admin build compat. */
  focus_card_prescription?: FocusCardPrescription;
  /** Intel updates to merge into behavioral_intel */
  intel_updates?: {
    triggers?: string[];
    breakthroughs?: string[];
    coaching_notes?: string[];
    resistance_patterns?: string[];
    stage_of_change?: string;
    emotional_vocabulary?: {
      used_words?: string[];
      avoided_words?: string[];
      deflection_phrases?: string[];
    };
  };
}

// ────────────────────────────────────────────
// Growth Lenses — thinking framework for the Strategist
// ────────────────────────────────────────────

const GROWTH_LENSES = `Growth lenses (use as a thinking framework, not rigid categories):
- Self-receiving — Can they spend on themselves without guilt? Can they accept gifts, compliments about money, rest?
- Earning mindset — Do they believe they can generate income? Can they ask for what they're worth?
- Money identity — Do they see themselves as someone who can have, make, or manage money?
- Money relationships — Can they have healthy money conversations with partners, family, friends?
- Financial awareness — Do they know their numbers? Are they engaged with their finances or avoiding them?
- Decision confidence — Can they make money decisions without spiraling, overanalyzing, or freezing?
- Future orientation — Can they plan without anxiety or avoidance? Do they trust that the future will be okay?`;

// ────────────────────────────────────────────
// Tension-specific coaching trajectories
// ────────────────────────────────────────────

const TENSION_GUIDANCE: Record<string, string> = {
  avoid: 'Start with tiny exposure, not comprehensive plans. Make money visible without triggering shutdown. Focus cards tend to be small Practices (check your balance once, just notice what you feel).',
  worry: 'Contain, don\'t expand. Give worries a time boundary. Demonstrate safety through evidence. Focus cards tend to be Rules (under $X, don\'t research — just pick one).',
  chase: 'Explore what the spending is replacing. The impulse serves a feeling — find it. Focus cards tend to be Reflexes (the 24-hour hold, 3 breaths before buying).',
  perform: 'Build trust before challenging the facade. The image is protective — don\'t rip it off. Focus cards tend to be Truths (a private reframe about worth vs appearance).',
  numb: 'Re-engage gently. Body-based prompts to reconnect with money feelings. Focus cards tend to be Practices (open your banking app, just look at the number, close it).',
  give: 'Explore receiving, not just giving. Generosity often masks self-worth issues. Focus cards tend to be experiential (spend $5 on yourself, not on someone else, and notice what you feel).',
  grip: 'Loosen through tiny permission-to-spend exercises. Control is safety — respect it. Focus cards tend to be Practices (buy the good version, not the cheapest).',
};

// ────────────────────────────────────────────
// Strategist prompts
// ────────────────────────────────────────────

function buildStrategistSystemPrompt(ctx: StrategistContext): string {
  const tensionType = ctx.profile.tension_type || null;
  const tensionGuidance = tensionType ? TENSION_GUIDANCE[tensionType] || '' : '';

  const tensionSection = tensionType
    ? `## This person's tension: ${tensionType}\n${tensionGuidance}`
    : `## Tension not yet determined
You must determine this person's primary money tension from their quiz answers. The 7 tension types are:
- **avoid** — money feels threatening, so they don't look
- **worry** — hyper-vigilant, no amount of checking feels safe
- **chase** — FOMO drives reactive money decisions
- **perform** — money is how they show the world they're OK
- **numb** — spending quiets big feelings, it's about the relief
- **give** — takes care of everyone else before themselves
- **grip** — real discipline, but the control has become a prison

Guidance per tension:
${Object.entries(TENSION_GUIDANCE).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

  return `You are the Strategist for Toney, an AI money coaching app. Your job is to produce a Coach Briefing — a narrative coaching document that tells the Coach exactly how to work with this person in their next session.

You are NOT the coach. You are the clinical intelligence behind the coach. Think of yourself as the supervisor who reviews session notes and prepares the next session's game plan.

## Your principles:

1. **Lead with a hypothesis, not questions.** Connect dots across the person's data that they haven't connected themselves. Your hypothesis should create a "how did you know that?" moment.

2. **Clinical sequencing — you decide what to work on.** The therapeutic progression is: Foundation → Trust → Awareness → Reframe → Practice → Identity → Integration. Different tensions start at different places. Don't let the user's stated goal override what they're ready for.

3. **The conversation IS the coaching.** The chat is where transformation happens. Cards are co-created between the Coach and user in-session. You do NOT prescribe cards. Your job is to prepare the Coach with context about what cards exist and what insights might be worth building toward next.

4. **Session-to-session continuity.** Reference previous breakthroughs, check on practices, use their own words. The coaching should feel like a relationship, not disconnected sessions.

${tensionSection}

${GROWTH_LENSES}

## Briefing format — produce this EXACTLY:

COACH BRIEFING — Session ${ctx.previousBriefing ? (ctx.previousBriefing.version + 1) : 1}

WHO THEY ARE:
[Tension type + secondary. Life context. Their goals (what would feel like progress). The key insight you formed by connecting dots across their quiz answers — the thing they haven't articulated yet.]

WHERE THEY ARE IN THEIR JOURNEY:
[Narrative of arc — not data points. What shifted since they started. What's stabilizing vs still raw. What they're ready for and what they're NOT ready for. Stage of change assessed from behavior, not self-report.]

WHAT WE KNOW:
[Triggers — specific situations, not categories. Their actual emotional vocabulary — words they use, words they avoid, phrases they deflect with. Resistance patterns — where coaching bounces off. Breakthroughs — aha moments that stuck. What coaching approaches work for them.]

THEIR TOOLKIT:
[What cards the user has co-created in recent sessions. Which ones seem to resonate (they revisit them, reference them). What types of insights have landed vs not. What kind of card might be worth co-creating next — but do NOT prescribe it. The Coach and user will create it together.]

WHERE GROWTH IS AVAILABLE:
[Which growth lenses are active — where the person is ready to stretch. Which have been touched and are stabilizing. Which are too raw to push on. What the next edge is.]

SESSION STRATEGY:
[What this session should accomplish. What to check in on. What the next edge is if the current work is landing. Specific reframes to seed. What to watch for (deflection patterns, resistance signals). What NOT to push on yet. How to handle if they bring something urgent that overrides the plan.]

COACHING STYLE:
[Tone, depth, learning style — from profile. How this person best receives insight. What language resonates vs what falls flat.]

## Also output these as JSON at the end (after the briefing):

\`\`\`json
{
  "tension_type": "primary tension (one of: avoid, worry, chase, perform, numb, give, grip)",
  "secondary_tension_type": "secondary tension or null",
  "hypothesis": "Your one-sentence coaching hypothesis for this person right now",
  "session_strategy": "What this session should accomplish in 1-2 sentences",
  "journey_narrative": "The story of this person's journey so far in 2-3 sentences",
  "growth_edges": { "active": ["which lenses are ready"], "stabilizing": ["which are settling"], "not_ready": ["which to avoid"] },
  "intel_updates": {
    "triggers": ["any new triggers identified"],
    "breakthroughs": ["any new breakthroughs"],
    "coaching_notes": ["any new coaching notes"],
    "resistance_patterns": ["any new resistance patterns"],
    "stage_of_change": "current stage if changed"
  }
}
\`\`\``;
}

function buildStrategistUserMessage(ctx: StrategistContext): string {
  const sections: string[] = [];

  // Profile data
  const p = ctx.profile;
  const readableAnswers = p.onboarding_answers
    ? formatAnswersReadable(p.onboarding_answers as Record<string, string>)
    : 'No quiz answers';

  sections.push(`## Profile Data
${p.tension_type ? `- Tension: ${p.tension_type}${p.secondary_tension_type ? ` (secondary: ${p.secondary_tension_type})` : ''}` : '- Tension: not yet determined — determine from quiz answers below'}
- Life stage: ${p.life_stage || 'unknown'}, Income: ${p.income_type || 'unknown'}, Relationship: ${p.relationship_status || 'unknown'}
- Tone: ${p.tone ?? 5}/10, Depth: ${p.depth || 'balanced'}, Learning styles: ${(p.learning_styles || []).join(', ') || 'none set'}
- What would feel like progress: "${p.what_brought_you || 'not provided'}"

## Quiz Answers
${readableAnswers}`);

  // Behavioral intel
  if (ctx.behavioralIntel) {
    const bi = ctx.behavioralIntel;
    sections.push(`## Behavioral Intel
- Triggers: ${bi.triggers?.length ? bi.triggers.join('; ') : 'none identified yet'}
- Emotional vocabulary: used=[${bi.emotional_vocabulary?.used_words?.join(', ') || ''}], avoided=[${bi.emotional_vocabulary?.avoided_words?.join(', ') || ''}], deflections=[${bi.emotional_vocabulary?.deflection_phrases?.join('; ') || ''}]
- Resistance: ${bi.resistance_patterns?.length ? bi.resistance_patterns.join('; ') : 'none identified'}
- Breakthroughs: ${bi.breakthroughs?.length ? bi.breakthroughs.join('; ') : 'none yet'}
- Coaching notes: ${bi.coaching_notes?.length ? bi.coaching_notes.join('; ') : 'none yet'}
- Stage of change: ${bi.stage_of_change || 'precontemplation'}
- Journey narrative: ${bi.journey_narrative || 'not yet written'}`);
  } else {
    sections.push('## Behavioral Intel\nNo behavioral intel yet — this is early in their journey.');
  }

  // Coach memories
  if (ctx.coachMemories && ctx.coachMemories.length > 0) {
    const memLines = ctx.coachMemories.map(m => `- [${m.importance}] ${m.content}`);
    sections.push(`## Coach Memories\n${memLines.join('\n')}`);
  }

  // Wins
  if (ctx.wins && ctx.wins.length > 0) {
    const winLines = ctx.wins.map(w => `- "${w.text}"`);
    sections.push(`## Recent Wins\n${winLines.join('\n')}`);
  }

  // Saved cards (toolkit)
  if (ctx.rewireCards && ctx.rewireCards.length > 0) {
    const cardLines = ctx.rewireCards.map(c => {
      let line = `- [${c.category}] "${c.title}"`;
      if (c.is_focus) line += ' (CURRENT FOCUS)';
      if (c.times_completed) line += ` — completed ${c.times_completed}x`;
      if (c.graduated_at) line += ' (graduated)';
      return line;
    });
    sections.push(`## Their Toolkit (Saved Cards)\n${cardLines.join('\n')}`);
  }

  // Previous briefing
  if (ctx.previousBriefing) {
    sections.push(`## Previous Briefing (v${ctx.previousBriefing.version})
Hypothesis: ${ctx.previousBriefing.hypothesis || 'none'}
Strategy: ${ctx.previousBriefing.session_strategy || 'none'}
Journey: ${ctx.previousBriefing.journey_narrative || 'none'}`);
  }

  // Session notes from recent completed sessions
  if (ctx.previousSessionNotes && ctx.previousSessionNotes.length > 0) {
    const notesLines = ctx.previousSessionNotes.map((n, i) =>
      `### Session ${ctx.previousSessionNotes!.length - i} (most recent first)\n${n}`
    );
    sections.push(`## Previous Session Notes\n${notesLines.join('\n\n')}`);
  }

  // Session transcript (for session_end analysis)
  if (ctx.sessionTranscript && ctx.sessionTranscript.length > 0) {
    const transcript = ctx.sessionTranscript
      .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
      .join('\n\n');
    sections.push(`## Session Transcript\n${transcript}`);
  }

  if (ctx.isFirstBriefing) {
    sections.push('\n## Note: This is the FIRST briefing for this person. There is no previous session to reference. Focus on connecting dots from their onboarding data and creating a strong opening hypothesis.');
  }

  return sections.join('\n\n');
}

// ────────────────────────────────────────────
// Main functions
// ────────────────────────────────────────────

export async function runStrategist(ctx: StrategistContext): Promise<StrategistOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = buildStrategistSystemPrompt(ctx);
  const userMessage = buildStrategistUserMessage(ctx);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse the response: briefing content is everything before the JSON block
  // JSON block is between ```json and ```
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const briefingContent = jsonMatch
    ? text.substring(0, text.indexOf('```json')).trim()
    : text.trim();

  let metadata: Record<string, unknown> = {};
  if (jsonMatch) {
    try {
      metadata = JSON.parse(jsonMatch[1]);
    } catch {
      // If JSON parse fails, use defaults
    }
  }

  return {
    briefing_content: briefingContent,
    hypothesis: (metadata.hypothesis as string) || '',
    session_strategy: (metadata.session_strategy as string) || '',
    journey_narrative: (metadata.journey_narrative as string) || '',
    growth_edges: (metadata.growth_edges as Record<string, unknown>) || {},
    tension_type: (metadata.tension_type as string) || null,
    secondary_tension_type: (metadata.secondary_tension_type as string) || null,
    intel_updates: metadata.intel_updates as StrategistOutput['intel_updates'],
  };
}

/**
 * Generates the initial briefing after onboarding — no session history available.
 * Only has profile data to work with. Creates the first hypothesis and opening strategy.
 */
export async function generateInitialBriefing(profile: Profile): Promise<StrategistOutput> {
  return runStrategist({
    profile,
    isFirstBriefing: true,
  });
}

import { Profile, BehavioralIntel, Win, CoachMemory, TensionType, LearningStyle, DepthLevel } from '@/types';
import { getSafetyRails } from './safetyRails';
import { getAwareMethod } from './awareMethod';
import { getTensionPrompt } from './tensionPrompts';
import { getTonePrompt } from './tonePrompts';
import { getDepthPrompt } from './depthPrompts';
import { getLearningStylePrompt } from './learningStylePrompts';
import { getBiasDetectionPrompt } from './biasDetection';
import { getStageMatchingPrompt } from './stageMatching';
import { getMotivationalInterviewingPrompt } from './motivationalInterviewing';
import { getFirstConversationPrompt } from './firstConversation';

interface PromptContext {
  profile: Profile;
  behavioralIntel?: BehavioralIntel | null;
  recentWins?: Win[];
  rewireCardTitles?: string[];
  coachMemories?: CoachMemory[];
  recentSummaries?: { summary: string; ended_at: string }[];
  isFirstConversation?: boolean;
  messageCount?: number;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const { profile, behavioralIntel, recentWins, rewireCardTitles, coachMemories, recentSummaries, isFirstConversation, messageCount } = ctx;

  const sections: string[] = [];

  // Identity
  sections.push(`You are Toney, an AI money coach. You help people understand and transform their emotional relationship with money. You are NOT a financial advisor — you are a behavioral coach who uses psychology, empathy, and motivational interviewing to help people change their money tensions.

IMPORTANT LANGUAGE RULES:
- NEVER use labels like "You're The Avoider" or "You're a Worrier"
- ALWAYS use verb-based language: "You tend to avoid" or "When money comes up, you tend to look away"
- The tension is a behavior they can change, not an identity they're stuck with
- Frame everything as "you tend to..." not "you are..."`);

  // Safety first
  sections.push(getSafetyRails());

  // Core method
  sections.push(getAwareMethod());

  // MI principles
  sections.push(getMotivationalInterviewingPrompt());

  // First conversation override
  if (isFirstConversation && profile.tension_type) {
    sections.push(getFirstConversationPrompt({
      tensionType: profile.tension_type as TensionType,
      secondaryTension: profile.secondary_tension_type as TensionType | undefined,
      onboardingAnswers: profile.onboarding_answers || {},
      tone: profile.tone,
      depth: profile.depth,
    }));
  }

  // Tension-specific coaching
  if (profile.tension_type) {
    sections.push(getTensionPrompt(
      profile.tension_type as TensionType,
      profile.secondary_tension_type as TensionType | undefined
    ));
  }

  // Tone
  sections.push(getTonePrompt(profile.tone));

  // Depth
  sections.push(getDepthPrompt(profile.depth as DepthLevel));

  // Learning styles
  if (profile.learning_styles && profile.learning_styles.length > 0) {
    sections.push(getLearningStylePrompt(profile.learning_styles as LearningStyle[]));
  }

  // Bias detection
  sections.push(getBiasDetectionPrompt());

  // Stage matching
  sections.push(getStageMatchingPrompt(behavioralIntel?.stage_of_change as any));

  // Behavioral intelligence — the living notebook
  // This is the heart of what makes Toney different: you remember, and you use
  // what you remember naturally — like a coach who genuinely knows this person.
  if (behavioralIntel) {
    const intelSection: string[] = [
      `YOUR NOTEBOOK ABOUT THIS PERSON:

You have a notebook about this person from past conversations. Use it naturally — reference their triggers, past breakthroughs, and emotional patterns as if you genuinely remember, not as data points.

When you notice something from their history showing up in the current conversation, name it gently: "This reminds me of what you shared last time about..."

Your coaching notes tell you what works with this person. Follow them.`
    ];

    if (behavioralIntel.triggers?.length) {
      intelSection.push(`Things that tend to set them off: ${behavioralIntel.triggers.join('; ')}`);
    }
    if (behavioralIntel.emotional_vocabulary) {
      const ev = behavioralIntel.emotional_vocabulary;
      if (ev.used_words?.length) {
        intelSection.push(`Words they naturally use (mirror these): ${ev.used_words.join(', ')}`);
      }
      if (ev.avoided_words?.length) {
        intelSection.push(`Words they shy away from (tread carefully): ${ev.avoided_words.join(', ')}`);
      }
      if (ev.deflection_phrases?.length) {
        intelSection.push(`When they say these things, there's usually something deeper underneath: ${ev.deflection_phrases.join('; ')}`);
      }
    }
    if (behavioralIntel.resistance_patterns?.length) {
      intelSection.push(`Where they tend to get stuck (don't push here — go around): ${behavioralIntel.resistance_patterns.join('; ')}`);
    }
    if (behavioralIntel.breakthroughs?.length) {
      intelSection.push(`Moments when something clicked for them (you can reference these): ${behavioralIntel.breakthroughs.join('; ')}`);
    }
    if (behavioralIntel.coaching_notes?.length) {
      intelSection.push(`What works with this person: ${behavioralIntel.coaching_notes.join('; ')}`);
    }

    if (intelSection.length > 1) {
      sections.push(intelSection.join('\n'));
    }
  }

  // Coach memories — specific facts, decisions, and life events you remember
  if (coachMemories && coachMemories.length > 0) {
    const importanceLabel = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
    const memoryLines = coachMemories.map(m => {
      const age = getTimeAgo(m.created_at);
      return `- [${importanceLabel[m.importance]}] ${m.content} (${age})`;
    });

    sections.push(`THINGS TO REMEMBER ABOUT THEIR LIFE RIGHT NOW:

These are specific facts about this person from previous sessions. Reference them naturally when relevant — as if you genuinely remember, not as a list you're reading from. HIGH importance items should inform your coaching approach. Don't bring up every memory — only when it's naturally relevant.

${memoryLines.join('\n')}`);
  }

  // Recent session summaries — what happened in past sessions
  if (recentSummaries && recentSummaries.length > 0) {
    const summaryLines = recentSummaries.map(s => {
      const age = getTimeAgo(s.ended_at);
      return `- ${age}: ${s.summary}`;
    });

    sections.push(`RECENT SESSIONS:

${summaryLines.join('\n')}`);
  }

  // Recent wins — weave these in naturally
  if (recentWins && recentWins.length > 0) {
    const winTexts = recentWins.slice(0, 5).map(w => `- "${w.text}" (${new Date(w.date).toLocaleDateString()})`);
    sections.push(`THINGS THEY'RE PROUD OF (celebrate naturally, don't list):\n${winTexts.join('\n')}`);
  }

  // Rewire cards — reference as their own insights
  if (rewireCardTitles && rewireCardTitles.length > 0) {
    sections.push(`INSIGHTS THEY'VE SAVED (these are breakthroughs they've had — reference as "remember when you realized..."):\n${rewireCardTitles.map(t => `- "${t}"`).join('\n')}`);
  }

  // Response format reminder
  sections.push(`
RESPONSE FORMAT:
- 2-4 short paragraphs maximum
- Conversational, natural tone
- End with EITHER a question OR one small action (NEVER both)
- No markdown formatting, no bullet points, no numbered lists
- No asterisks for emphasis — use plain language
- Write like you're texting a close friend who happens to understand psychology
- Keep it concise — respect their time
`.trim());

  return sections.join('\n\n---\n\n');
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
}

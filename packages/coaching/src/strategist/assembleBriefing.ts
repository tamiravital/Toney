import { Profile, RewireCard, Win, FocusArea, SessionSuggestion } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';
import { formatToolkit, formatWins, formatFocusAreas, formatCoachingStyle } from './formatters';

// ────────────────────────────────────────────
// Assemble Briefing Document — Pure Code, No LLM
// ────────────────────────────────────────────
// Replicates the briefing document format from prepareSession.ts,
// but uses pre-generated suggestion fields instead of LLM output.
//
// This is the key latency win: at session open, instead of calling
// prepareSession() (Sonnet, ~3-5s), we assemble the same document
// from the selected suggestion + fresh DB data (instant).
//
// The output format MUST match what prepareSession() produces
// (lines 201-236) — the Coach's system prompt builder reads it.

export interface AssembleBriefingInput {
  /** The understanding narrative from profiles.understanding */
  understanding: string;
  /** User profile (for coaching style + fallback data) */
  profile: Profile;
  /** The selected session suggestion */
  suggestion: SessionSuggestion;
  /** Current rewire cards */
  rewireCards?: RewireCard[];
  /** Recent wins */
  recentWins?: Win[];
  /** Active focus areas */
  activeFocusAreas?: FocusArea[];
}

export function assembleBriefingDocument(input: AssembleBriefingInput): string {
  const { understanding, profile, suggestion } = input;
  const sections: string[] = [];

  sections.push('COACH BRIEFING');

  // The understanding IS the person model
  if (understanding) {
    sections.push(`WHO THEY ARE AND WHERE THEY ARE:\n${understanding}`);
  } else {
    // Fallback for edge cases
    const readableAnswers = profile.onboarding_answers
      ? formatAnswersReadable(profile.onboarding_answers as Record<string, string>)
      : 'No quiz answers';
    sections.push(`WHAT THEY SHARED:\n${readableAnswers}${profile.what_brought_you ? `\nWhat would feel like progress: "${profile.what_brought_you}"` : ''}`);
  }

  // From the selected suggestion
  sections.push(`HYPOTHESIS:\n${suggestion.hypothesis || 'Follow their lead.'}`);
  sections.push(`LEVERAGE POINT:\n${suggestion.leveragePoint || 'Not yet identified.'}`);
  sections.push(`CURIOSITIES FOR THIS SESSION:\n${suggestion.curiosities || 'Follow their lead.'}`);

  if (input.rewireCards && input.rewireCards.length > 0) {
    sections.push(`THEIR TOOLKIT:\n${formatToolkit(input.rewireCards)}`);
  }

  if (input.recentWins && input.recentWins.length > 0) {
    sections.push(`RECENT WINS:\n${formatWins(input.recentWins)}`);
  }

  if (input.activeFocusAreas && input.activeFocusAreas.length > 0) {
    sections.push(`FOCUS AREAS:\n${formatFocusAreas(input.activeFocusAreas)}`);
  }

  sections.push(`COACHING STYLE:\n${formatCoachingStyle(profile)}`);

  return sections.join('\n\n');
}

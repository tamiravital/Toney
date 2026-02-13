import { Profile, RewireCard, Win, FocusArea } from '@toney/types';

// ────────────────────────────────────────────
// Shared formatting helpers for briefing assembly
// ────────────────────────────────────────────
// Used by: prepareSession.ts, assembleBriefing.ts, generateSuggestions.ts
// Extracted here to avoid duplication.

export function formatToolkit(cards: RewireCard[]): string {
  if (!cards || cards.length === 0) return 'No cards in toolkit yet.';
  return cards.map(c => {
    let line = `- [${c.category}] "${c.title}"`;
    if (c.times_completed) line += ` — used ${c.times_completed}x`;
    return line;
  }).join('\n');
}

export function formatWins(wins: Win[]): string {
  if (!wins || wins.length === 0) return 'No wins logged yet.';
  return wins.map(w => `- "${w.text}"`).join('\n');
}

export function formatFocusAreas(areas: FocusArea[]): string {
  if (!areas || areas.length === 0) return 'No focus areas set yet.';
  return areas.map(a => `- "${a.text}"`).join('\n');
}

export function formatCoachingStyle(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`Tone: ${profile.tone ?? 5}/10 (1=gentle, 10=direct)`);
  lines.push(`Depth: ${profile.depth || 'balanced'}`);
  if (profile.learning_styles?.length) lines.push(`Learning styles: ${profile.learning_styles.join(', ')}`);
  return lines.join('\n');
}

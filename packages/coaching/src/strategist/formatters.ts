import { Profile, RewireCard, Win, FocusArea } from '@toney/types';

// ────────────────────────────────────────────
// Shared formatting helpers for briefing assembly
// ────────────────────────────────────────────
// Used by: buildSystemPrompt(), evolveAndSuggest(), and the Coach prompt.
// Extracted here to avoid duplication.

export function formatToolkit(cards: RewireCard[]): string {
  if (!cards || cards.length === 0) return 'No cards in toolkit yet.';
  return cards.map(c => {
    let line = `- [${c.category}] "${c.title}"`;
    if (c.times_completed) line += ` — used ${c.times_completed}x`;
    return line;
  }).join('\n');
}

export function formatWins(wins: Win[], focusAreas?: FocusArea[]): string {
  if (!wins || wins.length === 0) return 'No wins logged yet.';

  const now = Date.now();
  const lines: string[] = [];

  // Header: count + velocity
  lines.push(`Total: ${wins.length} wins`);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = wins.filter(w => {
    const d = w.created_at ? new Date(w.created_at).getTime() : w.date ? new Date(w.date).getTime() : 0;
    return d >= weekAgo;
  }).length;
  if (thisWeek > 0) lines.push(`This week: ${thisWeek}`);

  // Helper: format a single win with relative date
  function formatSingleWin(w: Win): string {
    const d = w.created_at ? new Date(w.created_at) : w.date ? new Date(w.date) : null;
    let ago = '';
    if (d) {
      const days = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
      ago = days === 0 ? ' (today)' : days === 1 ? ' (yesterday)' : ` (${days}d ago)`;
    }
    return `- "${w.text}"${ago}`;
  }

  // Group by focus area if any wins have focus_area_id
  const linked = wins.filter(w => w.focus_area_id);
  const unlinked = wins.filter(w => !w.focus_area_id);

  if (linked.length > 0 && focusAreas && focusAreas.length > 0) {
    // Build focus area lookup
    const faMap = new Map(focusAreas.map(fa => [fa.id, fa.text]));
    const groups = new Map<string, Win[]>();

    for (const w of linked) {
      const faId = w.focus_area_id!;
      if (!groups.has(faId)) groups.set(faId, []);
      groups.get(faId)!.push(w);
    }

    lines.push('');
    for (const [faId, groupWins] of groups) {
      const faText = faMap.get(faId) || 'Unknown focus area';
      lines.push(`Focus area: "${faText}"`);
      for (const w of groupWins) {
        lines.push(`  ${formatSingleWin(w)}`);
      }
    }

    if (unlinked.length > 0) {
      lines.push('Unlinked:');
      for (const w of unlinked) {
        lines.push(formatSingleWin(w));
      }
    }
  } else {
    // No grouping — flat list
    lines.push('');
    for (const w of wins) {
      lines.push(formatSingleWin(w));
    }
  }

  return lines.join('\n');
}

export function formatFocusAreas(areas: FocusArea[]): string {
  if (!areas || areas.length === 0) return 'No focus areas set yet.';
  return areas.map(a => {
    let line = `- "${a.text}"`;
    if (a.reflections && a.reflections.length > 0) {
      const latest = a.reflections[a.reflections.length - 1];
      line += ` — Latest observation: ${latest.text}`;
    }
    return line;
  }).join('\n');
}

export function formatCoachingStyle(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`Tone: ${profile.tone ?? 3}/5 (1=gentle, 5=direct)`);
  lines.push(`Depth: ${profile.depth ?? 3}/5 (1=surface, 5=deep)`);
  if (profile.learning_styles?.length) lines.push(`Learning styles: ${profile.learning_styles.join(', ')}`);
  return lines.join('\n');
}

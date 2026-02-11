import { UserKnowledge } from '@toney/types';
import { SessionReflection } from './reflect';

// ────────────────────────────────────────────
// Knowledge Builder — Pure code, no LLM
// ────────────────────────────────────────────
// Takes a SessionReflection and produces individual UserKnowledge entries
// ready for insertion into the user_knowledge table.
// Also returns stage_of_change and growth_edges updates if they shifted.
// Handles dedup against existing knowledge (content+category match).
// Reusable by mobile app + admin simulator.

export interface KnowledgeUpdate {
  /** New user_knowledge entries to insert */
  newEntries: Omit<UserKnowledge, 'id' | 'user_id' | 'created_at'>[];
  /** Stage of change — only if it shifted this session. Saved to profiles.stage_of_change */
  stageOfChange?: string;
  /** Growth edges — only if any shifted. Saved to coaching_briefings at next session open */
  growthEdges?: Record<string, string[]>;
}

/**
 * Convert a SessionReflection into individual knowledge entries + metadata updates.
 * Deduplicates against existing knowledge — skips entries where identical content+category exists.
 * The caller inserts entries into user_knowledge and updates profiles/briefings as needed.
 */
export function buildKnowledgeUpdates(
  reflection: SessionReflection,
  sessionId: string,
  existingKnowledge: Pick<UserKnowledge, 'content' | 'category'>[] | null,
): KnowledgeUpdate {
  const existing = existingKnowledge || [];
  const entries: KnowledgeUpdate['newEntries'] = [];

  // ── Triggers ──
  for (const content of reflection.newTriggers) {
    if (!isDuplicate(existing, 'trigger', content)) {
      entries.push(makeEntry('trigger', content, sessionId, 'high'));
    }
  }

  // ── Breakthroughs ──
  for (const content of reflection.newBreakthroughs) {
    if (!isDuplicate(existing, 'breakthrough', content)) {
      entries.push(makeEntry('breakthrough', content, sessionId, 'high'));
    }
  }

  // ── Resistance patterns ──
  for (const content of reflection.newResistancePatterns) {
    if (!isDuplicate(existing, 'resistance', content)) {
      entries.push(makeEntry('resistance', content, sessionId, 'medium'));
    }
  }

  // ── Coaching notes ──
  for (const content of reflection.newCoachingNotes) {
    if (!isDuplicate(existing, 'coaching_note', content)) {
      entries.push(makeEntry('coaching_note', content, sessionId, 'medium'));
    }
  }

  // ── Emotional vocabulary (3 sub-arrays → vocabulary entries with tags) ──
  for (const word of reflection.emotionalVocabulary.newUsedWords) {
    if (!isDuplicate(existing, 'vocabulary', word)) {
      entries.push(makeEntry('vocabulary', word, sessionId, 'low', ['used_word']));
    }
  }
  for (const word of reflection.emotionalVocabulary.newAvoidedWords) {
    if (!isDuplicate(existing, 'vocabulary', word)) {
      entries.push(makeEntry('vocabulary', word, sessionId, 'low', ['avoided_word']));
    }
  }
  for (const phrase of reflection.emotionalVocabulary.newDeflectionPhrases) {
    if (!isDuplicate(existing, 'vocabulary', phrase)) {
      entries.push(makeEntry('vocabulary', phrase, sessionId, 'medium', ['deflection']));
    }
  }

  // ── Stage of change ──
  const update: KnowledgeUpdate = { newEntries: entries };

  if (reflection.stageOfChange) {
    update.stageOfChange = reflection.stageOfChange;
  }

  // ── Growth edges ──
  if (reflection.growthEdgeUpdates && Object.keys(reflection.growthEdgeUpdates).length > 0) {
    // We need existing growth edges to merge into — but the caller provides them
    // via the briefing's growth_edges field. For now, just pass through the per-lens updates
    // and let the caller merge with mergeGrowthEdges().
    update.growthEdges = mergeGrowthEdges({}, reflection.growthEdgeUpdates);
  }

  return update;
}

/**
 * Convert per-lens updates (Shape B) into bucket arrays (Shape A).
 * Existing: { active: ["self_receiving"], stabilizing: [], not_ready: ["future_orientation"] }
 * Updates:  { self_receiving: "stabilizing", earning_mindset: "active" }
 * Result:   { active: ["earning_mindset"], stabilizing: ["self_receiving"], not_ready: ["future_orientation"] }
 *
 * Also self-heals previously corrupted data — reads only bucket arrays,
 * ignores orphan per-lens keys from the old broken merge.
 */
export function mergeGrowthEdges(
  existing: Record<string, unknown>,
  updates: Record<string, string>,
): Record<string, string[]> {
  const active = new Set<string>((existing.active as string[]) || []);
  const stabilizing = new Set<string>((existing.stabilizing as string[]) || []);
  const notReady = new Set<string>((existing.not_ready as string[]) || []);

  for (const [lens, newStatus] of Object.entries(updates)) {
    // Remove from all buckets first
    active.delete(lens);
    stabilizing.delete(lens);
    notReady.delete(lens);

    // Add to target bucket
    if (newStatus === 'active') active.add(lens);
    else if (newStatus === 'stabilizing') stabilizing.add(lens);
    else if (newStatus === 'not_ready') notReady.add(lens);
  }

  return {
    active: [...active],
    stabilizing: [...stabilizing],
    not_ready: [...notReady],
  };
}

// ── Helpers ──

function makeEntry(
  category: UserKnowledge['category'],
  content: string,
  sessionId: string,
  importance: UserKnowledge['importance'],
  tags: string[] = [],
): Omit<UserKnowledge, 'id' | 'user_id' | 'created_at'> {
  return {
    session_id: sessionId,
    category,
    content,
    source: 'reflection' as const,
    importance,
    active: true,
    tags,
  };
}

/** Check if identical content+category already exists (case-insensitive) */
function isDuplicate(
  existing: Pick<UserKnowledge, 'content' | 'category'>[],
  category: string,
  content: string,
): boolean {
  const lower = content.toLowerCase().trim();
  return existing.some(
    e => e.category === category && e.content.toLowerCase().trim() === lower,
  );
}

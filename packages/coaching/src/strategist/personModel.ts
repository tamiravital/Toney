import { BehavioralIntel } from '@toney/types';
import { SessionReflection } from './reflect';

// ────────────────────────────────────────────
// Person Model Updater — Pure code, no LLM
// ────────────────────────────────────────────
// Takes current behavioral_intel + a SessionReflection and produces
// the merged update object ready to write to DB.
// Handles deduplication, array merging, and stage/growth updates.
// Reusable by mobile app + admin simulator.

export interface PersonModelUpdate {
  triggers?: string[];
  breakthroughs?: string[];
  resistance_patterns?: string[];
  coaching_notes?: string[];
  emotional_vocabulary?: {
    used_words: string[];
    avoided_words: string[];
    deflection_phrases: string[];
  };
  stage_of_change?: string;
  growth_edges?: Record<string, unknown>;
  last_strategist_run?: string;
}

/**
 * Merge a SessionReflection into the current behavioral_intel.
 * Returns a partial update object — only fields that changed.
 * The caller writes this to the DB.
 */
export function updatePersonModel(
  current: BehavioralIntel | null,
  reflection: SessionReflection,
): PersonModelUpdate {
  const update: PersonModelUpdate = {};

  // ── Array merges (append + deduplicate) ──

  if (reflection.newTriggers.length > 0) {
    const existing = current?.triggers || [];
    update.triggers = dedup([...existing, ...reflection.newTriggers]);
  }

  if (reflection.newBreakthroughs.length > 0) {
    const existing = current?.breakthroughs || [];
    update.breakthroughs = dedup([...existing, ...reflection.newBreakthroughs]);
  }

  if (reflection.newResistancePatterns.length > 0) {
    const existing = current?.resistance_patterns || [];
    update.resistance_patterns = dedup([...existing, ...reflection.newResistancePatterns]);
  }

  if (reflection.newCoachingNotes.length > 0) {
    const existing = current?.coaching_notes || [];
    update.coaching_notes = dedup([...existing, ...reflection.newCoachingNotes]);
  }

  // ── Emotional vocabulary merge ──
  const ev = reflection.emotionalVocabulary;
  if (ev.newUsedWords.length > 0 || ev.newAvoidedWords.length > 0 || ev.newDeflectionPhrases.length > 0) {
    const existingEv = current?.emotional_vocabulary || { used_words: [], avoided_words: [], deflection_phrases: [] };
    update.emotional_vocabulary = {
      used_words: dedup([...(existingEv.used_words || []), ...ev.newUsedWords]),
      avoided_words: dedup([...(existingEv.avoided_words || []), ...ev.newAvoidedWords]),
      deflection_phrases: dedup([...(existingEv.deflection_phrases || []), ...ev.newDeflectionPhrases]),
    };
  }

  // ── Stage of change (replace, not merge) ──
  if (reflection.stageOfChange) {
    update.stage_of_change = reflection.stageOfChange;
  }

  // ── Growth edges (merge with existing) ──
  if (reflection.growthEdgeUpdates && Object.keys(reflection.growthEdgeUpdates).length > 0) {
    const existingEdges = (current?.growth_edges || {}) as Record<string, unknown>;
    update.growth_edges = { ...existingEdges, ...reflection.growthEdgeUpdates };
  }

  // Timestamp
  update.last_strategist_run = new Date().toISOString();

  return update;
}

/** Deduplicate string array, case-insensitive, preserving first occurrence */
function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const lower = item.toLowerCase().trim();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

-- Migration 017: Drop legacy intel tables
-- behavioral_intel and coach_memories are fully replaced by user_knowledge.
-- sim_behavioral_intel and sim_coach_memories are their simulator mirrors.

-- Drop simulator tables first (no dependencies)
DROP TABLE IF EXISTS sim_behavioral_intel;
DROP TABLE IF EXISTS sim_coach_memories;

-- Drop production tables
DROP TABLE IF EXISTS coach_memories;
DROP TABLE IF EXISTS behavioral_intel;

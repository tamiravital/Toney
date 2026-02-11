-- ============================================================
-- Migration 016: Strategist Revamp + Data Model Redesign
-- ============================================================
-- 1. New user_knowledge table (replaces behavioral_intel + coach_memories)
-- 2. New sim_user_knowledge mirror
-- 3. stage_of_change moved to profiles
-- 4. coaching_briefings column updates (new Strategist outputs)
-- 5. Dead column cleanup across all tables
-- 6. Drop ghost insights table

-- ────────────────────────────────────────────
-- 1. New user_knowledge table
-- ────────────────────────────────────────────

CREATE TABLE user_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'reflection',
  importance TEXT NOT NULL DEFAULT 'medium',
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_knowledge_user_active ON user_knowledge(user_id) WHERE active = true;
CREATE INDEX idx_user_knowledge_category ON user_knowledge(user_id, category);

ALTER TABLE user_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own knowledge"
  ON user_knowledge FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge"
  ON user_knowledge FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge"
  ON user_knowledge FOR UPDATE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- 2. Sim mirror: sim_user_knowledge
-- ────────────────────────────────────────────

CREATE TABLE sim_user_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'reflection',
  importance TEXT NOT NULL DEFAULT 'medium',
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sim_user_knowledge_user_active ON sim_user_knowledge(user_id) WHERE active = true;

-- ────────────────────────────────────────────
-- 3. Move stage_of_change to profiles
-- ────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stage_of_change TEXT DEFAULT 'precontemplation';
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS stage_of_change TEXT DEFAULT 'precontemplation';

-- ────────────────────────────────────────────
-- 4. Update coaching_briefings columns
-- ────────────────────────────────────────────

-- Add new Strategist output columns
ALTER TABLE coaching_briefings ADD COLUMN IF NOT EXISTS leverage_point TEXT;
ALTER TABLE coaching_briefings ADD COLUMN IF NOT EXISTS curiosities TEXT;
ALTER TABLE coaching_briefings ADD COLUMN IF NOT EXISTS tension_narrative TEXT;

-- Drop replaced/dead columns
ALTER TABLE coaching_briefings DROP COLUMN IF EXISTS session_strategy;
ALTER TABLE coaching_briefings DROP COLUMN IF EXISTS journey_narrative;
ALTER TABLE coaching_briefings DROP COLUMN IF EXISTS prescribed_focus_card_id;

-- Same for sim
ALTER TABLE sim_coaching_briefings ADD COLUMN IF NOT EXISTS leverage_point TEXT;
ALTER TABLE sim_coaching_briefings ADD COLUMN IF NOT EXISTS curiosities TEXT;
ALTER TABLE sim_coaching_briefings ADD COLUMN IF NOT EXISTS tension_narrative TEXT;
ALTER TABLE sim_coaching_briefings DROP COLUMN IF EXISTS session_strategy;
ALTER TABLE sim_coaching_briefings DROP COLUMN IF EXISTS journey_narrative;
ALTER TABLE sim_coaching_briefings DROP COLUMN IF EXISTS prescribed_focus_card_id;

-- ────────────────────────────────────────────
-- 5. Dead column cleanup
-- ────────────────────────────────────────────

-- profiles: tension_score never written after v2
ALTER TABLE profiles DROP COLUMN IF EXISTS tension_score;
ALTER TABLE sim_profiles DROP COLUMN IF EXISTS tension_score;

-- sessions: summary never populated, session_number never written
ALTER TABLE sessions DROP COLUMN IF EXISTS summary;
ALTER TABLE sessions DROP COLUMN IF EXISTS session_number;

-- rewire_cards: focus card system incomplete — dead columns
ALTER TABLE rewire_cards DROP COLUMN IF EXISTS focus_set_at;
ALTER TABLE rewire_cards DROP COLUMN IF EXISTS graduated_at;
ALTER TABLE rewire_cards DROP COLUMN IF EXISTS prescribed_by;

-- Fix sim_coach_memories importance type mismatch (INTEGER in sim, TEXT in prod)
ALTER TABLE sim_coach_memories ALTER COLUMN importance TYPE TEXT USING importance::TEXT;

-- ────────────────────────────────────────────
-- 6. Drop ghost table
-- ────────────────────────────────────────────

DROP TABLE IF EXISTS insights;

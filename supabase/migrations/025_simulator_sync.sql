-- Migration 025: Sync sim_ tables with current production schema
-- Adds missing tables (sim_focus_areas, sim_session_suggestions)
-- and missing columns on existing sim tables.
-- No RLS — admin service role only.

-- ============================================================
-- New table: sim_focus_areas (mirrors focus_areas from migration 019)
-- ============================================================

CREATE TABLE IF NOT EXISTS sim_focus_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'onboarding',
  session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_focus_areas_user_active ON sim_focus_areas(user_id) WHERE archived_at IS NULL;

-- ============================================================
-- New table: sim_session_suggestions (mirrors session_suggestions from migration 020)
-- ============================================================

CREATE TABLE IF NOT EXISTS sim_session_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  suggestions JSONB NOT NULL,
  generated_after_session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_session_suggestions_user ON sim_session_suggestions(user_id, created_at DESC);

-- ============================================================
-- Missing columns on sim_sessions
-- ============================================================

ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS session_notes TEXT;

-- ============================================================
-- Missing columns on sim_profiles
-- ============================================================

ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS what_brought_you TEXT;
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS understanding_snippet TEXT;

-- ============================================================
-- Missing columns on sim_rewire_cards
-- ============================================================

ALTER TABLE sim_rewire_cards ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL;

-- ============================================================
-- Missing columns on sim_wins
-- ============================================================

ALTER TABLE sim_wins ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL;
ALTER TABLE sim_wins ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

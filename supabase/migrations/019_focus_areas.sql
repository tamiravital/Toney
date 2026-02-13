-- Migration 019: Focus Areas
-- First-class focus area entities — ongoing intentions the user is working toward.
-- Sources: onboarding Q7, Coach suggestions in chat, manual (future).
-- No completion lifecycle — archive when no longer relevant.

CREATE TABLE focus_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'onboarding',  -- 'onboarding' | 'coach' | 'user'
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active focus areas (most common query)
CREATE INDEX idx_focus_areas_user_active ON focus_areas(user_id) WHERE archived_at IS NULL;
-- All focus areas for a user (Journey tab, admin)
CREATE INDEX idx_focus_areas_user_all ON focus_areas(user_id, created_at DESC);

ALTER TABLE focus_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own focus areas"
  ON focus_areas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus areas"
  ON focus_areas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus areas"
  ON focus_areas FOR UPDATE
  USING (auth.uid() = user_id);

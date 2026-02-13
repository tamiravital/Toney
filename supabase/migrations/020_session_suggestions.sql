-- Migration 020: Session Suggestions
-- Pre-generated personalized session suggestions.
-- Generated at session close (after evolveUnderstanding + generateSessionNotes).
-- Consumed at session open to skip prepareSession() LLM call.
-- Replaced wholesale each time new suggestions are generated.

CREATE TABLE session_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestions JSONB NOT NULL,        -- array of SessionSuggestion objects
  generated_after_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Most common query: latest suggestions for a user
CREATE INDEX idx_session_suggestions_user ON session_suggestions(user_id, created_at DESC);

ALTER TABLE session_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own suggestions"
  ON session_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestions"
  ON session_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

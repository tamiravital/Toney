-- Migration 021: Add session_id and source to wins table
-- Enables: wins linked to sessions (auto-generated from coaching), win deletion from Journey

-- Link wins to sessions (nullable — manual wins have no session)
ALTER TABLE wins ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Track win source: 'manual' (user-logged) or 'coach' (auto-generated in chat)
-- DEFAULT 'manual' backfills existing wins automatically
ALTER TABLE wins ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Index for joining wins to sessions
CREATE INDEX IF NOT EXISTS idx_wins_session_id ON wins(session_id);

-- Allow users to delete their own wins (missing from migration 001)
CREATE POLICY "Users can delete own wins" ON wins FOR DELETE USING (auth.uid() = user_id);

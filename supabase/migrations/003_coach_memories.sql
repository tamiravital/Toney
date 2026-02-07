-- ============================================================
-- Toney — Coach Memories + Session Summaries
-- ============================================================
-- Run this in Supabase SQL Editor after 001 and 002 migrations.
-- This adds the "coach's notebook" — persistent memories across sessions.

-- Coach memories: facts, decisions, life events Toney remembers
CREATE TABLE IF NOT EXISTS coach_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'decision', 'life_event', 'commitment', 'topic')),
  content TEXT NOT NULL,
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_coach_memories_user_active ON coach_memories(user_id) WHERE active = TRUE;
CREATE INDEX idx_coach_memories_user_type ON coach_memories(user_id, memory_type);
CREATE INDEX idx_coach_memories_created_at ON coach_memories(created_at DESC);

-- RLS
ALTER TABLE coach_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
  ON coach_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON coach_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
  ON coach_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON coach_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Also allow service role to insert/update (for API routes)
-- Service role bypasses RLS by default, so no extra policy needed.

-- ============================================================
-- Add summary column to conversations if not exists
-- (The column exists in schema but was never populated)
-- ============================================================
-- conversations.summary already exists from 001_initial_schema.sql
-- No schema change needed — we just start using it.

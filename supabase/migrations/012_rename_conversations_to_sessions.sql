-- ============================================================
-- Migration 012: Rename conversations → sessions + v1 cleanup
-- ============================================================
-- NOTE: Table rename (conversations → sessions) and column rename
-- (messages.conversation_id → session_id) already applied.
-- This script handles everything else.

-- ── Production indexes: drop old, create new ──
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_started_at;
DROP INDEX IF EXISTS idx_conversations_user_topic;
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- ── Production RLS policies: drop old names, create with new names ──
DROP POLICY IF EXISTS "Users can view own conversations" ON sessions;
DROP POLICY IF EXISTS "Users can insert own conversations" ON sessions;
DROP POLICY IF EXISTS "Users can update own conversations" ON sessions;

CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON sessions FOR UPDATE USING (auth.uid() = user_id);

-- ── Simulator: Rename sim_conversations → sim_sessions ──
ALTER TABLE sim_conversations RENAME TO sim_sessions;
ALTER TABLE sim_messages RENAME COLUMN conversation_id TO session_id;
ALTER TABLE sim_runs RENAME COLUMN conversation_id TO session_id;

-- Simulator indexes: drop old, create new
DROP INDEX IF EXISTS idx_sim_conversations_user;
CREATE INDEX IF NOT EXISTS idx_sim_sessions_user ON sim_sessions(user_id, created_at DESC);

-- Also rename the sim_messages index that references conversation
DROP INDEX IF EXISTS idx_sim_messages_convo;
CREATE INDEX IF NOT EXISTS idx_sim_messages_session ON sim_messages(session_id, created_at);

-- ── Drop v1 dead columns (production) ──
ALTER TABLE profiles DROP COLUMN IF EXISTS pattern_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS pattern_score;
ALTER TABLE sessions DROP COLUMN IF EXISTS topic_key;
ALTER TABLE rewire_cards DROP COLUMN IF EXISTS pattern_type;
ALTER TABLE rewire_cards DROP COLUMN IF EXISTS topic_key;
ALTER TABLE wins DROP COLUMN IF EXISTS pattern_type;

-- ── Drop v1 dead columns (simulator) ──
ALTER TABLE sim_runs DROP COLUMN IF EXISTS topic_key;
ALTER TABLE sim_runs DROP COLUMN IF EXISTS engine_version;

-- ── Drop unused table ──
DROP TABLE IF EXISTS beta_analytics;

-- Conversation Simulator Tables
-- These tables are completely isolated from production user data.
-- Only accessed via admin service role key (no RLS needed).

-- Simulator personas (coaching profile configurations for testing)
CREATE TABLE simulator_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  profile_config JSONB NOT NULL,
  behavioral_intel_config JSONB,
  user_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simulator runs (conversation sessions)
CREATE TABLE simulator_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES simulator_personas(id) ON DELETE CASCADE,
  topic_key TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('automated', 'manual')),
  num_turns INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  system_prompt_used TEXT,
  card_evaluation JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_simulator_runs_status ON simulator_runs(status);
CREATE INDEX idx_simulator_runs_created ON simulator_runs(created_at DESC);
CREATE INDEX idx_simulator_runs_persona ON simulator_runs(persona_id);

-- Simulator messages (conversation content)
CREATE TABLE simulator_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES simulator_runs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  card_worthy BOOLEAN DEFAULT FALSE,
  card_category TEXT,
  card_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_simulator_messages_run ON simulator_messages(run_id, turn_number);

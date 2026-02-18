-- LLM usage tracking: token counts per API call
-- Used for cost monitoring in admin dashboard

CREATE TABLE llm_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  call_site TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_creation_input_tokens INTEGER DEFAULT 0,
  cache_read_input_tokens INTEGER DEFAULT 0
);

CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Users can insert their own usage rows (written by API routes on their behalf)
CREATE POLICY "Users can insert own usage" ON llm_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Simulator equivalent (no FK to auth.users)
CREATE TABLE sim_llm_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES sim_sessions(id) ON DELETE SET NULL,
  call_site TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_creation_input_tokens INTEGER DEFAULT 0,
  cache_read_input_tokens INTEGER DEFAULT 0
);

CREATE INDEX idx_sim_llm_usage_user_id ON sim_llm_usage(user_id);

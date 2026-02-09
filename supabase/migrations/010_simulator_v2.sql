-- Simulator v2: Isolated sim_* tables for full coaching engine testing
-- These tables mirror the production schema but are completely isolated.
-- No RLS — admin service role only.

-- ============================================================
-- Simulator profiles (mirrors profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  tension_type TEXT,
  secondary_tension_type TEXT,
  tension_score JSONB,
  tone INTEGER DEFAULT 5,
  depth TEXT DEFAULT 'balanced',
  learning_styles TEXT[] DEFAULT '{}',
  life_stage TEXT,
  income_type TEXT,
  relationship_status TEXT,
  emotional_why TEXT,
  onboarding_answers JSONB,
  onboarding_completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Simulator conversations (mirrors conversations)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  message_count INTEGER DEFAULT 0,
  session_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_conversations_user ON sim_conversations(user_id, created_at DESC);

-- ============================================================
-- Simulator messages (mirrors messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES sim_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_messages_convo ON sim_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sim_messages_user ON sim_messages(user_id, created_at DESC);

-- ============================================================
-- Simulator behavioral intel (mirrors behavioral_intel)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_behavioral_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  triggers TEXT[] DEFAULT '{}',
  emotional_vocabulary JSONB DEFAULT '{}',
  resistance_patterns TEXT[] DEFAULT '{}',
  breakthroughs TEXT[] DEFAULT '{}',
  coaching_notes TEXT[] DEFAULT '{}',
  stage_of_change TEXT DEFAULT 'precontemplation',
  journey_narrative TEXT,
  growth_edges JSONB DEFAULT '{}',
  last_strategist_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- Simulator coaching briefings (mirrors coaching_briefings)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_coaching_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sim_conversations(id) ON DELETE SET NULL,
  briefing_content TEXT NOT NULL,
  hypothesis TEXT,
  session_strategy TEXT,
  journey_narrative TEXT,
  growth_edges JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_briefings_user ON sim_coaching_briefings(user_id, created_at DESC);

-- ============================================================
-- Simulator observer signals (mirrors observer_signals)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_observer_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sim_conversations(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  content TEXT NOT NULL,
  urgency_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_observer_signals_user ON sim_observer_signals(user_id, session_id);

-- ============================================================
-- Simulator coach memories (mirrors coach_memories)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_coach_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Simulator rewire cards (mirrors rewire_cards)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_rewire_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES sim_conversations(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_focus BOOLEAN DEFAULT FALSE,
  auto_generated BOOLEAN DEFAULT FALSE,
  graduated_at TIMESTAMPTZ,
  times_completed INTEGER DEFAULT 0,
  prescribed_by TEXT,
  focus_set_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Simulator wins (mirrors wins)
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sim_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  text TEXT,
  tension_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Link existing simulator tables to new sim_* tables
-- ============================================================

-- Personas now link to sim_profiles
ALTER TABLE simulator_personas
  ADD COLUMN IF NOT EXISTS sim_profile_id UUID REFERENCES sim_profiles(id) ON DELETE SET NULL;

-- Runs now link to sim_conversations and track engine version
ALTER TABLE simulator_runs
  ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES sim_conversations(id) ON DELETE SET NULL;

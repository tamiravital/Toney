-- ============================================================
-- Toney — Coaching Engine v2
-- ============================================================
-- Adds: coaching_briefings, observer_signals tables
-- Alters: rewire_cards (Focus card), conversations (sessions),
--         behavioral_intel (journey + growth tracking)
-- Run after 007_card_categories_v2.sql

-- ============================================================
-- NEW TABLE: coaching_briefings
-- ============================================================
-- The Strategist's output — what the Coach reads instead of raw data.
-- One briefing per session boundary. Latest briefing = active coaching context.

CREATE TABLE IF NOT EXISTS coaching_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  briefing_content TEXT NOT NULL,
  hypothesis TEXT,
  session_strategy TEXT,
  journey_narrative TEXT,
  prescribed_focus_card_id UUID REFERENCES rewire_cards(id) ON DELETE SET NULL,
  growth_edges JSONB DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coaching_briefings_user_id ON coaching_briefings(user_id);
CREATE INDEX idx_coaching_briefings_user_latest ON coaching_briefings(user_id, created_at DESC);
CREATE INDEX idx_coaching_briefings_session_id ON coaching_briefings(session_id);

ALTER TABLE coaching_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefings"
  ON coaching_briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own briefings"
  ON coaching_briefings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own briefings"
  ON coaching_briefings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- NEW TABLE: observer_signals
-- ============================================================
-- Per-turn lightweight analysis from the Observer (Haiku).
-- Detects deflections, breakthroughs, emotional signals in real-time.

CREATE TABLE IF NOT EXISTS observer_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('deflection', 'breakthrough', 'emotional', 'practice_checkin', 'topic_shift')),
  content TEXT NOT NULL,
  urgency_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_observer_signals_user_id ON observer_signals(user_id);
CREATE INDEX idx_observer_signals_session_id ON observer_signals(session_id);
CREATE INDEX idx_observer_signals_urgent ON observer_signals(user_id) WHERE urgency_flag = TRUE;
CREATE INDEX idx_observer_signals_created_at ON observer_signals(created_at DESC);

ALTER TABLE observer_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
  ON observer_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
  ON observer_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ALTER: rewire_cards — Focus card support
-- ============================================================
-- Focus card: one active card per user, with completion tracking.
-- Lifecycle: created → set as Focus → tracked daily → graduated to toolkit.

ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS is_focus BOOLEAN DEFAULT FALSE;
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS focus_set_at TIMESTAMPTZ;
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS times_completed INTEGER DEFAULT 0;
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ;
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS prescribed_by TEXT DEFAULT 'user' CHECK (prescribed_by IN ('coach', 'strategist', 'user'));

-- Only one Focus card per user at a time
CREATE UNIQUE INDEX idx_rewire_cards_one_focus_per_user
  ON rewire_cards(user_id) WHERE is_focus = TRUE;

-- ============================================================
-- ALTER: conversations — Session model
-- ============================================================
-- Sessions replace topics. Time-bounded, not topic-bounded.

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_number INTEGER;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_notes TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active' CHECK (session_status IN ('active', 'completed', 'abandoned'));

-- ============================================================
-- ALTER: behavioral_intel — Journey + growth tracking
-- ============================================================
-- The Strategist writes the journey narrative and tracks growth edges.

ALTER TABLE behavioral_intel ADD COLUMN IF NOT EXISTS journey_narrative TEXT;
ALTER TABLE behavioral_intel ADD COLUMN IF NOT EXISTS growth_edges JSONB DEFAULT '{}'::jsonb;
ALTER TABLE behavioral_intel ADD COLUMN IF NOT EXISTS last_strategist_run TIMESTAMPTZ;

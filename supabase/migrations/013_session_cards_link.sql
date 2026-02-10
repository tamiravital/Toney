-- Migration 013: Link cards to sessions
-- Each card is co-created in a specific session. Multiple cards per session.

ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);
ALTER TABLE sim_rewire_cards ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sim_sessions(id);
/Users/tamiravital/Toney/supabase/migrations/014_onboarding_v2.sql
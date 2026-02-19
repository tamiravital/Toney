-- Enable RLS on all sim_* tables and llm_usage tables.
-- These tables are accessed ONLY via the service role key (admin dashboard + API routes),
-- which bypasses RLS. Enabling RLS with no policies = blanket deny for anon/authenticated roles.

ALTER TABLE sim_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_rewire_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_user_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_focus_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_session_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_llm_usage ENABLE ROW LEVEL SECURITY;

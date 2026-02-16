-- Migration 032: Enable session deletion for auto-close cleanup
-- Allows deleting empty/minimal sessions during deferred and manual close.

-- ── Production ──

-- Sessions: users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Fix bare FK on rewire_cards.session_id (migration 013 omitted ON DELETE clause,
-- which defaults to RESTRICT and would block session deletion).
ALTER TABLE rewire_cards DROP CONSTRAINT IF EXISTS rewire_cards_session_id_fkey;
ALTER TABLE rewire_cards
  ADD CONSTRAINT rewire_cards_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- ── Simulator ──
-- Sim tables have no RLS (service role), but same bare FK issue exists.

ALTER TABLE sim_rewire_cards DROP CONSTRAINT IF EXISTS sim_rewire_cards_session_id_fkey;
ALTER TABLE sim_rewire_cards
  ADD CONSTRAINT sim_rewire_cards_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sim_sessions(id) ON DELETE SET NULL;

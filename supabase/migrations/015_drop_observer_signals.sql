-- Migration 015: Drop observer_signals tables
-- Observer agent was killed in v3. These tables are unused.
-- Production observer_signals was never written to after v3.
-- sim_observer_signals was only used by the outdated simulator.

DROP TABLE IF EXISTS sim_observer_signals;
DROP TABLE IF EXISTS observer_signals;

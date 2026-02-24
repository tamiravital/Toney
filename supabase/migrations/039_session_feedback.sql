-- Session feedback columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_feedback_emoji TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_feedback_text TEXT;

-- Mirror for simulator
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS session_feedback_emoji TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS session_feedback_text TEXT;

-- Add is_beta flag to profiles for feature gating (theme picker, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_beta boolean NOT NULL DEFAULT false;

-- Mirror table
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS is_beta boolean NOT NULL DEFAULT false;

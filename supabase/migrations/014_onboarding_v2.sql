-- Migration 014: Add what_brought_you field for onboarding v2
-- Captures the user's specific current money situation in their own words

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS what_brought_you TEXT;

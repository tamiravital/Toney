-- Migration: Rename pattern columns to tension columns
-- This migrates the 4-pattern system to the 7-tension system

-- 1. Add new tension columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tension_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_tension_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tension_score integer;

-- 2. Migrate existing pattern data to tension data
UPDATE profiles SET
  tension_type = CASE pattern_type
    WHEN 'avoidance' THEN 'avoid'
    WHEN 'fomo' THEN 'chase'
    WHEN 'retail_therapy' THEN 'numb'
    WHEN 'over_control' THEN 'grip'
    ELSE pattern_type
  END,
  tension_score = pattern_score
WHERE pattern_type IS NOT NULL;

-- 3. Add tension_type column to wins (if it doesn't exist)
ALTER TABLE wins ADD COLUMN IF NOT EXISTS tension_type text;

-- 4. Migrate wins pattern_type to tension_type
UPDATE wins SET
  tension_type = CASE pattern_type
    WHEN 'avoidance' THEN 'avoid'
    WHEN 'fomo' THEN 'chase'
    WHEN 'retail_therapy' THEN 'numb'
    WHEN 'over_control' THEN 'grip'
    ELSE pattern_type
  END
WHERE pattern_type IS NOT NULL AND tension_type IS NULL;

-- 5. Add tension_type column to rewire_cards (if it doesn't exist)
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS tension_type text;

-- 6. Migrate rewire_cards pattern_type to tension_type
UPDATE rewire_cards SET
  tension_type = CASE pattern_type
    WHEN 'avoidance' THEN 'avoid'
    WHEN 'fomo' THEN 'chase'
    WHEN 'retail_therapy' THEN 'numb'
    WHEN 'over_control' THEN 'grip'
    ELSE pattern_type
  END
WHERE pattern_type IS NOT NULL AND tension_type IS NULL;

-- Note: We keep the old pattern_type columns for backward compatibility.
-- They can be dropped in a future migration after confirming all data is migrated.

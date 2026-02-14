-- Toney — Tone & Depth Scale Changes (idempotent)
-- Tone: 1-10 → 1-5 (remap existing values)
-- Depth: TEXT enum → INTEGER 1-5 (surface=1, balanced=3, deep=5)

-- ============================================================
-- 1. Remap tone values from 1-10 to 1-5
-- ============================================================

-- Only remap if any tone > 5 (means still on 1-10 scale)
UPDATE profiles SET tone = CEIL(tone::float / 2)::int WHERE tone IS NOT NULL AND tone > 5;
UPDATE sim_profiles SET tone = CEIL(tone::float / 2)::int WHERE tone IS NOT NULL AND tone > 5;

-- Update constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tone_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tone_check CHECK (tone >= 1 AND tone <= 5);

-- Update default
ALTER TABLE profiles ALTER COLUMN tone SET DEFAULT 3;
ALTER TABLE sim_profiles ALTER COLUMN tone SET DEFAULT 3;

-- ============================================================
-- 2. Convert depth from TEXT to INTEGER
-- ============================================================

-- profiles
DO $$
BEGIN
  -- Only convert if depth is still a text column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'depth' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE profiles ADD COLUMN depth_num INTEGER DEFAULT 3;
    UPDATE profiles SET depth_num = CASE depth
      WHEN 'surface' THEN 1
      WHEN 'balanced' THEN 3
      WHEN 'deep' THEN 5
      ELSE 3
    END;
    ALTER TABLE profiles DROP COLUMN depth;
    ALTER TABLE profiles RENAME COLUMN depth_num TO depth;
  END IF;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_depth_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_depth_check CHECK (depth >= 1 AND depth <= 5);

-- sim_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sim_profiles' AND column_name = 'depth' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE sim_profiles ADD COLUMN depth_num INTEGER DEFAULT 3;
    UPDATE sim_profiles SET depth_num = CASE depth
      WHEN 'surface' THEN 1
      WHEN 'balanced' THEN 3
      WHEN 'deep' THEN 5
      ELSE 3
    END;
    ALTER TABLE sim_profiles DROP COLUMN depth;
    ALTER TABLE sim_profiles RENAME COLUMN depth_num TO depth;
  END IF;
END $$;

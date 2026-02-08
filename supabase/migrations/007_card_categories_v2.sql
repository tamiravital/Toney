-- Migration: Update card categories from 6 to 5 types
-- Merges: ritual→practice, mantra→truth, play→practice
-- Adds: plan, practice
-- Removes: ritual, mantra, play
-- Also adds usefulness_score column

-- Step 1: Drop old constraint FIRST (must happen before UPDATEs)
ALTER TABLE rewire_cards DROP CONSTRAINT IF EXISTS rewire_cards_category_check;

-- Step 2: Remap existing cards to new categories
UPDATE rewire_cards SET category = 'practice' WHERE category IN ('ritual', 'play');
UPDATE rewire_cards SET category = 'truth' WHERE category = 'mantra';

-- Step 3: Add new constraint with updated categories
ALTER TABLE rewire_cards ADD CONSTRAINT rewire_cards_category_check
  CHECK (category IN ('reframe', 'truth', 'plan', 'practice', 'conversation_kit'));

-- Step 4: Add usefulness_score column (1-10, nullable)
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS usefulness_score INTEGER
  CHECK (usefulness_score >= 1 AND usefulness_score <= 10);

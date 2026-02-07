-- ============================================================
-- Migration: Add conversation_kit to rewire_cards category
-- ============================================================

-- Drop existing CHECK constraint
ALTER TABLE rewire_cards DROP CONSTRAINT IF EXISTS rewire_cards_category_check;

-- Recreate with conversation_kit added
ALTER TABLE rewire_cards ADD CONSTRAINT rewire_cards_category_check
  CHECK (category IN ('reframe', 'ritual', 'truth', 'mantra', 'play', 'conversation_kit'));

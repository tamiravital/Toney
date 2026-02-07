-- ============================================================
-- Migration: Add topic-based conversations
-- ============================================================

-- 1. Add topic_key to conversations (nullable for backward compat)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS topic_key TEXT;

-- 2. Validate topic_key values
ALTER TABLE conversations ADD CONSTRAINT conversations_topic_key_check
  CHECK (topic_key IS NULL OR topic_key IN (
    'enoughness_future_calm',
    'money_conversations',
    'avoidance_procrastination',
    'spending_awareness',
    'investments',
    'income_courage',
    'big_ticket_decisions'
  ));

-- 3. One conversation per user per topic
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user_topic
  ON conversations(user_id, topic_key)
  WHERE topic_key IS NOT NULL;

-- 4. Add topic_key to rewire_cards for topic tagging
ALTER TABLE rewire_cards ADD COLUMN IF NOT EXISTS topic_key TEXT;

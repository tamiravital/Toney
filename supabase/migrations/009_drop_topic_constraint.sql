-- ============================================================
-- Toney — Drop topic constraint
-- ============================================================
-- Topics are being replaced by session-based conversations.
-- Drop the unique index that constrained one conversation per user per topic.
-- Run after 008_coaching_engine_v2.sql

-- Drop the unique index on (user_id, topic_key) if it exists
-- This constraint was added in 004_topic_conversations.sql
DROP INDEX IF EXISTS idx_conversations_user_topic_unique;

-- Note: We keep the topic_key column on conversations for backward compatibility.
-- Existing conversations retain their topic_key. New conversations won't use it.

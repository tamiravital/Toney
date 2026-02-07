-- ============================================================
-- Toney — Initial Database Schema
-- ============================================================

-- Profiles: user preferences, pattern, style settings
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  pattern_type TEXT CHECK (pattern_type IN ('avoidance', 'fomo', 'retail_therapy', 'over_control')),
  pattern_score INTEGER,
  onboarding_answers JSONB DEFAULT '{}'::jsonb,
  tone INTEGER DEFAULT 5 CHECK (tone >= 1 AND tone <= 10),
  depth TEXT DEFAULT 'balanced' CHECK (depth IN ('surface', 'balanced', 'deep')),
  learning_styles TEXT[] DEFAULT '{}',
  check_in_frequency TEXT DEFAULT 'few_times_week' CHECK (check_in_frequency IN ('daily', 'few_times_week', 'weekly', 'on_demand')),
  life_stage TEXT,
  income_type TEXT,
  relationship_status TEXT,
  financial_goals TEXT[] DEFAULT '{}',
  emotional_why TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations: each chat session
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages: individual messages within conversations
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  can_save BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rewire cards: saved coaching insights with categories
CREATE TABLE rewire_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('reframe', 'ritual', 'truth', 'mantra', 'play')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  pattern_type TEXT,
  trigger_context TEXT,
  times_viewed INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  user_feedback TEXT CHECK (user_feedback IN ('helpful', 'not_useful')),
  auto_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wins: pattern interrupts logged by the user
CREATE TABLE wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  pattern_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Behavioral intelligence: Toney's "notebook" about each user
CREATE TABLE behavioral_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  triggers TEXT[] DEFAULT '{}',
  emotional_vocabulary JSONB DEFAULT '{"used_words":[],"avoided_words":[],"deflection_phrases":[]}'::jsonb,
  resistance_patterns TEXT[] DEFAULT '{}',
  breakthroughs TEXT[] DEFAULT '{}',
  coaching_notes TEXT[] DEFAULT '{}',
  stage_of_change TEXT DEFAULT 'precontemplation' CHECK (stage_of_change IN ('precontemplation', 'contemplation', 'preparation', 'action', 'maintenance', 'relapse')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta analytics: learning from beta testers
CREATE TABLE beta_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  session_duration_seconds INTEGER,
  message_count INTEGER,
  user_initiated BOOLEAN DEFAULT TRUE,
  coaching_quality_score INTEGER CHECK (coaching_quality_score >= 1 AND coaching_quality_score <= 5),
  user_engagement_level TEXT CHECK (user_engagement_level IN ('high', 'medium', 'low', 'disengaged')),
  pattern_match_accuracy TEXT,
  tone_appropriateness TEXT,
  effective_techniques JSONB DEFAULT '[]'::jsonb,
  ineffective_techniques JSONB DEFAULT '[]'::jsonb,
  user_resistance_moments JSONB DEFAULT '[]'::jsonb,
  breakthrough_moments JSONB DEFAULT '[]'::jsonb,
  system_prompt_version TEXT,
  prompt_token_count INTEGER,
  response_latency_ms INTEGER,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_rewire_cards_user_id ON rewire_cards(user_id);
CREATE INDEX idx_wins_user_id ON wins(user_id);
CREATE INDEX idx_wins_created_at ON wins(created_at DESC);
CREATE INDEX idx_behavioral_intel_user_id ON behavioral_intel(user_id);
CREATE INDEX idx_beta_analytics_user_id ON beta_analytics(user_id);
CREATE INDEX idx_beta_analytics_conversation_id ON beta_analytics(conversation_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewire_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_analytics ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Conversations: users can only access their own conversations
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);

-- Messages: users can only access messages in their own conversations
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rewire cards: users can only access their own cards
CREATE POLICY "Users can view own rewire cards" ON rewire_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rewire cards" ON rewire_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rewire cards" ON rewire_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rewire cards" ON rewire_cards FOR DELETE USING (auth.uid() = user_id);

-- Wins: users can only access their own wins
CREATE POLICY "Users can view own wins" ON wins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wins" ON wins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Behavioral intel: users can only access their own intel
CREATE POLICY "Users can view own behavioral intel" ON behavioral_intel FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own behavioral intel" ON behavioral_intel FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own behavioral intel" ON behavioral_intel FOR UPDATE USING (auth.uid() = user_id);

-- Beta analytics: users can insert their own analytics, service role for reading
CREATE POLICY "Users can insert own analytics" ON beta_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own analytics" ON beta_analytics FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: Auto-create profile on user sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: Update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER behavioral_intel_updated_at
  BEFORE UPDATE ON behavioral_intel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

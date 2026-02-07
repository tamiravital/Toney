export type StageOfChange =
  | 'precontemplation'
  | 'contemplation'
  | 'preparation'
  | 'action'
  | 'maintenance'
  | 'relapse';

export interface EmotionalVocabulary {
  used_words: string[];
  avoided_words: string[];
  deflection_phrases: string[];
}

export interface BehavioralIntel {
  id: string;
  user_id: string;
  triggers: string[];
  emotional_vocabulary: EmotionalVocabulary;
  resistance_patterns: string[];
  breakthroughs: string[];
  coaching_notes: string[];
  stage_of_change: StageOfChange;
  updated_at: string;
}

export interface RewireCard {
  id: string;
  user_id: string;
  category: 'reframe' | 'ritual' | 'truth' | 'mantra' | 'play';
  title: string;
  content: string;
  source_message_id?: string;
  tension_type?: string;
  trigger_context?: string;
  times_viewed: number;
  last_viewed_at?: string;
  user_feedback?: 'helpful' | 'not_useful';
  auto_generated: boolean;
  created_at: string;
}

export interface Win {
  id: string;
  user_id?: string;
  text: string;
  tension_type?: string;
  date: Date;
}

export interface Insight {
  id: string;
  content: string;
  category?: 'reframe' | 'ritual' | 'truth' | 'mantra' | 'play';
  savedAt: Date;
  fromChat: boolean;
  tags: string[];
}

export type MemoryType = 'fact' | 'decision' | 'life_event' | 'commitment' | 'topic';
export type MemoryImportance = 'high' | 'medium' | 'low';

export interface CoachMemory {
  id: string;
  user_id: string;
  session_id?: string;
  memory_type: MemoryType;
  content: string;
  importance: MemoryImportance;
  active: boolean;
  created_at: string;
  expires_at?: string;
}

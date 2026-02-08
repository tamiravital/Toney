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
  // v2 fields (Strategist-managed)
  journey_narrative?: string | null;
  growth_edges?: Record<string, unknown> | null;
  last_strategist_run?: string | null;
}

export type RewireCardCategory = 'reframe' | 'truth' | 'plan' | 'practice' | 'conversation_kit';

export interface RewireCard {
  id: string;
  user_id: string;
  category: RewireCardCategory;
  title: string;
  content: string;
  source_message_id?: string | null;
  tension_type?: string | null;
  trigger_context?: string | null;
  times_viewed: number;
  last_viewed_at?: string | null;
  user_feedback?: 'helpful' | 'not_useful' | null;
  usefulness_score?: number | null;
  auto_generated: boolean;
  created_at: string;
  // v2 fields (Focus card lifecycle)
  is_focus?: boolean;
  focus_set_at?: string | null;
  graduated_at?: string | null;
  times_completed?: number;
  last_completed_at?: string | null;
  prescribed_by?: 'coach' | 'strategist' | 'user';
}

export interface Win {
  id: string;
  user_id?: string;
  text: string;
  tension_type?: string | null;
  date?: Date;
  created_at?: string;
}

export interface Insight {
  id: string;
  content: string;
  category?: RewireCardCategory;
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

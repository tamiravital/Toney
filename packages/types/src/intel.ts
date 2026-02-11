export type StageOfChange =
  | 'precontemplation'
  | 'contemplation'
  | 'preparation'
  | 'action'
  | 'maintenance'
  | 'relapse';

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
  // Focus card lifecycle
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

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'divider';
  content: string;
  timestamp?: Date;
  canSave?: boolean;
  can_save?: boolean;
  saved?: boolean;
  session_id?: string;
  user_id?: string;
  created_at?: string;
  quickReplies?: string[];
}

export interface Session {
  id: string;
  user_id: string;
  started_at?: string;
  created_at: string;
  updated_at?: string;
  ended_at?: string | null;
  summary?: string | null;
  title?: string | null;
  is_active?: boolean;
  message_count?: number;
  session_number?: number | null;
  session_notes?: string | null;
  session_status?: 'active' | 'completed' | 'abandoned';
  /** Coaching plan: one-sentence thesis for this session */
  hypothesis?: string | null;
  /** Coaching plan: strength + goal + obstacle intersection */
  leverage_point?: string | null;
  /** Coaching plan: what to explore this session */
  curiosities?: string | null;
  /** Coaching plan: how the Coach should open the session */
  opening_direction?: string | null;
}

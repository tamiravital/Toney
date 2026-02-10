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
}

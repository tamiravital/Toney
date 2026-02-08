export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  canSave?: boolean;
  can_save?: boolean;
  saved?: boolean;
  conversation_id?: string;
  user_id?: string;
  created_at?: string;
  quickReplies?: string[];
}

export interface Conversation {
  id: string;
  user_id: string;
  topic_key?: string | null;
  started_at?: string;
  created_at: string;
  updated_at?: string;
  ended_at?: string | null;
  summary?: string | null;
  title?: string | null;
  is_active?: boolean;
  message_count?: number;
  // v2 fields (session model)
  session_number?: number | null;
  session_notes?: string | null;
  session_status?: 'active' | 'completed' | 'abandoned';
}

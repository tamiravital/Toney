export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  canSave?: boolean;
  saved?: boolean;
  conversation_id?: string;
  quickReplies?: string[];
}

export interface Conversation {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  message_count: number;
}

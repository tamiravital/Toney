import { Profile, Session } from './index';
import { StageOfChange, TensionType } from './index';

export interface UserWithStats extends Profile {
  session_count: number;
  total_messages: number;
  last_active: string | null;
}

export interface OverviewStats {
  totalUsers: number;
  onboardedUsers: number;
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  activeUsers7d: number;
}

export interface TensionDistribution {
  type: TensionType;
  count: number;
}

export interface StageDistribution {
  stage: StageOfChange;
  count: number;
}

export interface RecentSession extends Session {
  user_display_name: string | null;
  user_avatar_url: string | null;
  message_count: number;
}

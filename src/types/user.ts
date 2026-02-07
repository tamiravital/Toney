import { TensionType } from './tension';

export type DepthLevel = 'surface' | 'balanced' | 'deep';
export type LearningStyle = 'analytical' | 'somatic' | 'narrative' | 'experiential';
export type CheckInFrequency = 'daily' | 'few_times_week' | 'weekly' | 'on_demand';

export interface StyleProfile {
  tone: number;
  depth: DepthLevel;
  learningStyles: LearningStyle[];
  checkInFrequency: CheckInFrequency;
}

export interface Profile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  tension_type?: TensionType;
  secondary_tension_type?: TensionType;
  tension_score?: number;
  onboarding_answers?: Record<string, string>;
  tone: number;
  depth: DepthLevel;
  learning_styles: LearningStyle[];
  check_in_frequency: CheckInFrequency;
  life_stage?: string;
  income_type?: string;
  relationship_status?: string;
  financial_goals?: string[];
  emotional_why?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

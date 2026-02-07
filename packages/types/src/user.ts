import { TensionType } from './tension';

export type DepthLevel = 'surface' | 'balanced' | 'deep';
export type LearningStyle = 'analytical' | 'somatic' | 'narrative' | 'experiential';

export interface StyleProfile {
  tone: number;
  depth: DepthLevel;
  learningStyles: LearningStyle[];
}

export interface Profile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  tension_type?: TensionType | null;
  secondary_tension_type?: TensionType | null;
  tension_score?: number | null;
  onboarding_answers?: Record<string, string> | null;
  tone: number;
  depth: DepthLevel;
  learning_styles: LearningStyle[];
  life_stage?: string | null;
  income_type?: string | null;
  relationship_status?: string | null;
  emotional_why?: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

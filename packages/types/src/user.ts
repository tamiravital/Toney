import { TensionType } from './tension';

export type LearningStyle = 'analytical' | 'somatic' | 'narrative' | 'experiential';

export interface StyleProfile {
  tone: number;
  depth: number;
  learningStyles: LearningStyle[];
}

export interface Profile {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  tension_type?: TensionType | null;
  secondary_tension_type?: TensionType | null;
  onboarding_answers?: Record<string, string> | null;
  stage_of_change?: string | null;
  tone: number;
  depth: number;
  learning_styles: LearningStyle[];
  life_stage?: string | null;
  income_type?: string | null;
  relationship_status?: string | null;
  emotional_why?: string | null;
  what_brought_you?: string | null;
  understanding?: string | null;
  understanding_snippet?: string | null;
  language?: string | null;
  is_beta?: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

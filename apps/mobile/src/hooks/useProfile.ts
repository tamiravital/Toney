'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile, TensionType, DepthLevel, LearningStyle, CheckInFrequency } from '@toney/types';

export function useProfile() {
  const supabase = createClient();

  const getProfile = useCallback(async (): Promise<Profile | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) return null;
    return data as Profile;
  }, [supabase]);

  const updateProfile = useCallback(async (updates: Partial<{
    tension_type: TensionType;
    secondary_tension_type: TensionType;
    tension_score: number;
    onboarding_answers: Record<string, string>;
    tone: number;
    depth: DepthLevel;
    learning_styles: LearningStyle[];
    check_in_frequency: CheckInFrequency;
    life_stage: string;
    income_type: string;
    relationship_status: string;
    financial_goals: string[];
    emotional_why: string;
    onboarding_completed: boolean;
    display_name: string;
  }>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }, [supabase]);

  const saveOnboardingResults = useCallback(async (params: {
    tension_type: TensionType;
    secondary_tension_type?: TensionType;
    tension_score: number;
    onboarding_answers: Record<string, string>;
    tone: number;
    depth: DepthLevel;
    learning_styles: LearningStyle[];
    check_in_frequency: CheckInFrequency;
  }) => {
    return updateProfile({
      ...params,
      onboarding_completed: true,
    });
  }, [updateProfile]);

  return { getProfile, updateProfile, saveOnboardingResults };
}

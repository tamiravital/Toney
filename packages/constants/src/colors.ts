import type { TensionType, StageOfChange } from '@toney/types';

const STAGE_COLORS: Record<StageOfChange, { bg: string; text: string }> = {
  precontemplation: { bg: 'bg-slate-100',   text: 'text-slate-700' },
  contemplation:    { bg: 'bg-amber-100',   text: 'text-amber-700' },
  preparation:      { bg: 'bg-blue-100',    text: 'text-blue-700' },
  action:           { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  maintenance:      { bg: 'bg-green-100',   text: 'text-green-700' },
  relapse:          { bg: 'bg-red-100',     text: 'text-red-700' },
};

export function stageColor(stage: StageOfChange | null | undefined): { bg: string; text: string } {
  if (!stage || !STAGE_COLORS[stage]) {
    return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
  return STAGE_COLORS[stage];
}

export function engagementColor(level: string | null | undefined): { bg: string; text: string } {
  switch (level) {
    case 'high':       return { bg: 'bg-green-100',  text: 'text-green-700' };
    case 'medium':     return { bg: 'bg-amber-100',  text: 'text-amber-700' };
    case 'low':        return { bg: 'bg-orange-100', text: 'text-orange-700' };
    case 'disengaged': return { bg: 'bg-red-100',    text: 'text-red-700' };
    default:           return { bg: 'bg-gray-100',   text: 'text-gray-700' };
  }
}

export const ALL_TENSIONS: TensionType[] = ['avoid', 'worry', 'chase', 'perform', 'numb', 'give', 'grip'];
export const ALL_STAGES: StageOfChange[] = ['precontemplation', 'contemplation', 'preparation', 'action', 'maintenance', 'relapse'];

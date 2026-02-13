'use client';

import { useState } from 'react';
import type { Profile, TensionType, LearningStyle } from '@toney/types';
import { ALL_TENSIONS } from '@toney/constants';

const TENSIONS: TensionType[] = ALL_TENSIONS;
const LEARNING_STYLES: LearningStyle[] = ['analytical', 'somatic', 'narrative', 'experiential'];

interface PersonaFormProps {
  initialValues?: {
    name: string;
    profile_config: Partial<Profile>;
    user_prompt: string;
  };
  onSubmit: (data: {
    name: string;
    profile_config: Partial<Profile>;
    user_prompt: string;
  }) => Promise<void>;
  submitLabel?: string;
}

export default function PersonaForm({ initialValues, onSubmit, submitLabel = 'Save Persona' }: PersonaFormProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialValues?.name ?? '');
  const [tensionType, setTensionType] = useState<TensionType>(
    (initialValues?.profile_config?.tension_type as TensionType) ?? 'avoid'
  );
  const [secondaryTension, setSecondaryTension] = useState<string>(
    initialValues?.profile_config?.secondary_tension_type ?? ''
  );
  const [tone, setTone] = useState(initialValues?.profile_config?.tone ?? 3);
  const [depth, setDepth] = useState(initialValues?.profile_config?.depth ?? 3);
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>(
    (initialValues?.profile_config?.learning_styles as LearningStyle[]) ?? ['analytical']
  );
  const [lifeStage, setLifeStage] = useState(initialValues?.profile_config?.life_stage ?? '');
  const [incomeType, setIncomeType] = useState(initialValues?.profile_config?.income_type ?? '');
  const [relationshipStatus, setRelationshipStatus] = useState(
    initialValues?.profile_config?.relationship_status ?? ''
  );
  const [emotionalWhy, setEmotionalWhy] = useState(initialValues?.profile_config?.emotional_why ?? '');
  const [userPrompt, setUserPrompt] = useState(initialValues?.user_prompt ?? '');

  const toggleLearningStyle = (style: LearningStyle) => {
    setLearningStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        profile_config: {
          tension_type: tensionType,
          secondary_tension_type: secondaryTension as TensionType || undefined,
          tone,
          depth,
          learning_styles: learningStyles,
          life_stage: lifeStage || undefined,
          income_type: incomeType || undefined,
          relationship_status: relationshipStatus || undefined,
          emotional_why: emotionalWhy || undefined,
          onboarding_completed: true,
        },
        user_prompt: userPrompt,
      });
    } finally {
      setSaving(false);
    }
  };

  const labelClass = 'block text-xs font-medium text-gray-700 mb-1';
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className={labelClass}>Persona Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g., Anxious Avoider"
          required
        />
      </div>

      {/* Tension Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Primary Tension</label>
          <select
            value={tensionType}
            onChange={(e) => setTensionType(e.target.value as TensionType)}
            className={inputClass}
          >
            {TENSIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Secondary Tension (optional)</label>
          <select
            value={secondaryTension}
            onChange={(e) => setSecondaryTension(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {TENSIONS.filter(t => t !== tensionType).map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className={labelClass}>
          Tone: {tone}/5 — {tone <= 2 ? 'Gentle' : tone >= 4 ? 'Direct' : 'Balanced'}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={tone}
          onChange={(e) => setTone(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 Gentle</span>
          <span>3 Balanced</span>
          <span>5 Direct</span>
        </div>
      </div>

      {/* Depth */}
      <div>
        <label className={labelClass}>
          Depth: {depth}/5 — {depth <= 2 ? 'Surface' : depth >= 4 ? 'Deep' : 'Balanced'}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 Surface</span>
          <span>3 Balanced</span>
          <span>5 Deep</span>
        </div>
      </div>

      {/* Learning Styles */}
      <div>
        <label className={labelClass}>Learning Styles</label>
        <div className="flex flex-wrap gap-2">
          {LEARNING_STYLES.map(style => (
            <button
              key={style}
              type="button"
              onClick={() => toggleLearningStyle(style)}
              className={`py-1.5 px-3 rounded-full text-xs font-medium border transition-colors
                ${learningStyles.includes(style)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Life Context */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Life Stage</label>
          <input
            type="text"
            value={lifeStage}
            onChange={(e) => setLifeStage(e.target.value)}
            className={inputClass}
            placeholder="e.g., early_career"
          />
        </div>
        <div>
          <label className={labelClass}>Income Type</label>
          <input
            type="text"
            value={incomeType}
            onChange={(e) => setIncomeType(e.target.value)}
            className={inputClass}
            placeholder="e.g., steady_paycheck"
          />
        </div>
        <div>
          <label className={labelClass}>Relationship</label>
          <input
            type="text"
            value={relationshipStatus}
            onChange={(e) => setRelationshipStatus(e.target.value)}
            className={inputClass}
            placeholder="e.g., single"
          />
        </div>
      </div>

      {/* Emotional Why */}
      <div>
        <label className={labelClass}>Emotional Why</label>
        <textarea
          value={emotionalWhy}
          onChange={(e) => setEmotionalWhy(e.target.value)}
          className={`${inputClass} h-20 resize-none`}
          placeholder="Why this person is seeking coaching..."
        />
      </div>

      {/* User Prompt (for automated mode) */}
      <div>
        <label className={labelClass}>User Persona Prompt (for automated mode)</label>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          className={`${inputClass} h-32 resize-none font-mono text-xs`}
          placeholder="Instructions for Claude when roleplaying as this user..."
        />
        <p className="text-xs text-gray-400 mt-1">
          This prompt tells Claude how to behave as the simulated user in automated runs.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!name.trim() || saving}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { X, RotateCcw, LogOut } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { tensionColor } from '@/lib/constants/tensions';
import { toneLabel, checkInOptions } from '@/lib/constants/styles';
import { DepthLevel, CheckInFrequency } from '@/types';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

const lifeStageOptions = [
  { value: 'student', label: 'Student' },
  { value: 'early_career', label: 'Early career' },
  { value: 'mid_career', label: 'Mid career' },
  { value: 'new_parent', label: 'New parent' },
  { value: 'pre_retirement', label: 'Pre-retirement' },
  { value: 'retired', label: 'Retired' },
];

const incomeOptions = [
  { value: 'salary', label: 'Salary' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'variable', label: 'Variable' },
  { value: 'multiple', label: 'Multiple sources' },
];

const relationshipOptions = [
  { value: 'single', label: 'Single' },
  { value: 'partner', label: 'With partner' },
  { value: 'shared_finances', label: 'Shared finances' },
];

export default function SettingsOverlay() {
  const { identifiedTension, styleProfile, setStyleProfile, setShowSettings, signOut, resetAll } = useToney();
  const [localStyle, setLocalStyle] = useState({ ...styleProfile });
  const [lifeStage, setLifeStage] = useState('');
  const [incomeType, setIncomeType] = useState('');
  const [relationship, setRelationship] = useState('');
  const [emotionalWhy, setEmotionalWhy] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setStyleProfile(localStyle);

    if (isSupabaseConfigured()) {
      setSaving(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({
            tone: localStyle.tone,
            depth: localStyle.depth,
            learning_styles: localStyle.learningStyles || [],
            check_in_frequency: localStyle.checkInFrequency,
            ...(lifeStage && { life_stage: lifeStage }),
            ...(incomeType && { income_type: incomeType }),
            ...(relationship && { relationship_status: relationship }),
            ...(emotionalWhy && { emotional_why: emotionalWhy }),
          }).eq('id', user.id);
        }
      } catch {
        // Silent fail
      }
      setSaving(false);
    }

    setShowSettings(false);
  };

  const tension = identifiedTension;
  const colors = tension ? tensionColor(tension.primary) : null;

  return (
    <div className="absolute inset-0 bg-white z-50 overflow-y-auto hide-scrollbar">
      <div className="px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tension info */}
        {tension && colors && (
          <div className={`${colors.bg} rounded-2xl p-4 mb-6`}>
            <div className={`font-semibold text-gray-900 text-sm`}>
              You tend to {tension.primary}
            </div>
            <div className="text-xs text-gray-500">Your money tension</div>
            {tension.secondary && (
              <div className="text-xs text-gray-500 mt-1">
                Also tends to {tension.secondary}
              </div>
            )}
          </div>
        )}

        {/* Tone */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Communication Tone</h3>
          <input
            type="range"
            min="1"
            max="10"
            value={localStyle.tone}
            onChange={(e) => setLocalStyle(prev => ({ ...prev, tone: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>Gentle</span>
            <span className="font-semibold text-indigo-600">{toneLabel(localStyle.tone)}</span>
            <span>Direct</span>
          </div>
        </div>

        {/* Depth */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Coaching Depth</h3>
          <div className="space-y-2">
            {(['surface', 'balanced', 'deep'] as DepthLevel[]).map((d) => (
              <button
                key={d}
                onClick={() => setLocalStyle(prev => ({ ...prev, depth: d }))}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all text-sm ${
                  localStyle.depth === d
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="font-medium text-gray-900 capitalize">{d}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Check-in frequency */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Check-in Frequency</h3>
          <div className="grid grid-cols-2 gap-2">
            {checkInOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => setLocalStyle(prev => ({ ...prev, checkInFrequency: f.value as CheckInFrequency }))}
                className={`p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                  localStyle.checkInFrequency === f.value
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Life Context */}
        <div className="border-t border-gray-100 pt-6 mb-6">
          <h3 className="font-semibold text-gray-900 text-base mb-1">About You</h3>
          <p className="text-xs text-gray-400 mb-4">Helps Toney personalize your coaching</p>

          {/* Life stage */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Life stage</label>
            <div className="grid grid-cols-2 gap-2">
              {lifeStageOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLifeStage(lifeStage === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    lifeStage === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Income type */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Income type</label>
            <div className="grid grid-cols-2 gap-2">
              {incomeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIncomeType(incomeType === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    incomeType === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Relationship */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Relationship</label>
            <div className="grid grid-cols-3 gap-2">
              {relationshipOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRelationship(relationship === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    relationship === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional why */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Why does money matter to you?
            </label>
            <textarea
              value={emotionalWhy}
              onChange={(e) => setEmotionalWhy(e.target.value)}
              placeholder="e.g., Stop feeling anxious every month"
              rows={2}
              className="w-full p-3 rounded-xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Retake quiz */}
        <button
          onClick={resetAll}
          className="w-full mt-3 flex items-center justify-center gap-2 text-gray-500 text-sm font-medium py-3 hover:text-gray-700 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Retake tension quiz
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full mt-1 flex items-center justify-center gap-2 text-red-500 text-sm font-medium py-3 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

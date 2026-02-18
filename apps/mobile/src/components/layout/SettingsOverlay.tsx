'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw, LogOut } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { tensionColor, learningStyleOptions, toneLabel, depthLabel } from '@toney/constants';
import { LearningStyle } from '@toney/types';
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
  const { identifiedTension, styleProfile, setStyleProfile, setShowSettings, displayName, setDisplayName, signOut, retakeQuiz } = useToney();
  const [localStyle, setLocalStyle] = useState({ ...styleProfile });
  const [localDisplayName, setLocalDisplayName] = useState(displayName || '');
  const [lifeStage, setLifeStage] = useState('');
  const [incomeType, setIncomeType] = useState('');
  const [relationship, setRelationship] = useState('');
  const [emotionalWhy, setEmotionalWhy] = useState('');
  const [saving, setSaving] = useState(false);

  // Load About You fields from profile on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const loadProfile = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('profiles')
          .select('life_stage, income_type, relationship_status, emotional_why')
          .eq('id', user.id)
          .single();
        if (data) {
          if (data.life_stage) setLifeStage(data.life_stage);
          if (data.income_type) setIncomeType(data.income_type);
          if (data.relationship_status) setRelationship(data.relationship_status);
          if (data.emotional_why) setEmotionalWhy(data.emotional_why);
        }
      } catch {
        // Silent fail
      }
    };
    loadProfile();
  }, []);

  const toggleLearningStyle = (style: LearningStyle) => {
    setLocalStyle(prev => {
      const current = prev.learningStyles || [];
      const has = current.includes(style);
      return {
        ...prev,
        learningStyles: has ? current.filter(s => s !== style) : [...current, style],
      };
    });
  };

  const handleSave = async () => {
    setStyleProfile(localStyle);
    const trimmedName = localDisplayName.trim() || null;
    setDisplayName(trimmedName);

    if (isSupabaseConfigured()) {
      setSaving(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({
            display_name: trimmedName,
            tone: localStyle.tone,
            depth: localStyle.depth,
            learning_styles: localStyle.learningStyles || [],
            life_stage: lifeStage || null,
            income_type: incomeType || null,
            relationship_status: relationship || null,
            emotional_why: emotionalWhy || null,
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

        {/* Display name */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Display Name</h3>
          <input
            type="text"
            value={localDisplayName}
            onChange={(e) => setLocalDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full p-3 rounded-xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none"
          />
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
            max="5"
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
          <input
            type="range"
            min="1"
            max="5"
            value={localStyle.depth}
            onChange={(e) => setLocalStyle(prev => ({ ...prev, depth: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>Surface</span>
            <span className="font-semibold text-indigo-600">{depthLabel(localStyle.depth)}</span>
            <span>Deep</span>
          </div>
        </div>

        {/* Learning Styles */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">How You Learn Best</h3>
          <div className="grid grid-cols-2 gap-2">
            {learningStyleOptions.map((opt) => {
              const selected = (localStyle.learningStyles || []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleLearningStyle(opt.value)}
                  className={`p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
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
          onClick={retakeQuiz}
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

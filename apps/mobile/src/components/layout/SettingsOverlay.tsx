'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw, LogOut, Check, Palette } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { tensionColor, learningStyleOptions, toneLabel, depthLabel } from '@toney/constants';
import { LearningStyle } from '@toney/types';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';
import CustomThemeEditor, { restoreCustomTheme } from './CustomThemeEditor';

type ThemeOption = 'default' | 'dark' | 'warm' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'midnight' | 'sand' | 'rose' | 'custom';

const themeOptions: { value: ThemeOption; label: string; accent: string; surface: string }[] = [
  { value: 'default', label: 'Light', accent: '#4f46e5', surface: '#f9fafb' },
  { value: 'dark', label: 'Dark', accent: '#818cf8', surface: '#0f172a' },
  { value: 'warm', label: 'Warm', accent: '#b45309', surface: '#faf7f2' },
  { value: 'ocean', label: 'Ocean', accent: '#0891b2', surface: '#f0f9ff' },
  { value: 'forest', label: 'Forest', accent: '#15803d', surface: '#f0fdf4' },
  { value: 'sunset', label: 'Sunset', accent: '#ea580c', surface: '#fff7ed' },
  { value: 'lavender', label: 'Lavender', accent: '#7c3aed', surface: '#faf5ff' },
  { value: 'midnight', label: 'Midnight', accent: '#eab308', surface: '#0f172a' },
  { value: 'sand', label: 'Sand', accent: '#a16207', surface: '#fafaf9' },
  { value: 'rose', label: 'Rose', accent: '#e11d48', surface: '#fff1f2' },
  { value: 'custom', label: 'Custom', accent: '#888888', surface: '#ffffff' },
];

function applyTheme(theme: ThemeOption) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try { localStorage.setItem('toney_theme', theme); } catch { /* */ }
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    if (color) meta.setAttribute('content', color);
  }
}

function getStoredTheme(): ThemeOption {
  if (typeof window === 'undefined') return 'default';
  try {
    return (localStorage.getItem('toney_theme') as ThemeOption) || 'default';
  } catch { return 'default'; }
}

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
  const [activeTheme, setActiveTheme] = useState<ThemeOption>(getStoredTheme);
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  // Apply theme on mount (for page refresh) + restore custom CSS if needed
  useEffect(() => {
    applyTheme(activeTheme);
    restoreCustomTheme();
  }, [activeTheme]);

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
    <div className="absolute inset-0 z-50 overflow-y-auto hide-scrollbar bg-surface">
      <div className="px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-primary">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="w-10 h-10 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Theme */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-primary text-sm">Theme</h3>
          </div>

          {/* Theme circles grid */}
          <div className="grid grid-cols-5 gap-3">
            {themeOptions.map((opt) => {
              const isActive = activeTheme === opt.value;
              const isDark = opt.value === 'dark' || opt.value === 'midnight';
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setActiveTheme(opt.value);
                    applyTheme(opt.value);
                    if (opt.value === 'custom') {
                      restoreCustomTheme();
                      setShowCustomEditor(true);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isActive ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{
                      backgroundColor: opt.surface,
                      border: `2.5px solid ${opt.accent}`,
                      '--tw-ring-color': opt.accent,
                    } as React.CSSProperties}
                  >
                    {opt.value === 'custom' ? (
                      <Palette className="w-4 h-4" style={{ color: opt.accent }} />
                    ) : isActive ? (
                      <Check className="w-4 h-4" style={{ color: isDark ? '#fff' : opt.accent }} />
                    ) : (
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: opt.accent }} />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-accent-text' : 'text-muted'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          {activeTheme === 'custom' && (
            <button
              onClick={() => { restoreCustomTheme(); setShowCustomEditor(true); }}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              Edit custom theme...
            </button>
          )}
        </div>

        {/* Display name */}
        <div className="mb-6">
          <h3 className="font-semibold text-primary text-sm mb-2">Display Name</h3>
          <input
            type="text"
            value={localDisplayName}
            onChange={(e) => setLocalDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full p-3 rounded-xl border-2 border-default text-sm text-primary placeholder-muted focus:border-accent focus:outline-none bg-card"
          />
        </div>

        {/* Tension info */}
        {tension && colors && (
          <div className={`${colors.bg} rounded-2xl p-4 mb-6`}>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              You tend to {tension.primary}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your money tension</div>
            {tension.secondary && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Also tends to {tension.secondary}
              </div>
            )}
          </div>
        )}

        {/* Tone */}
        <div className="mb-6">
          <h3 className="font-semibold text-primary text-sm mb-3">Communication Tone</h3>
          <input
            type="range"
            min="1"
            max="5"
            value={localStyle.tone}
            onChange={(e) => setLocalStyle(prev => ({ ...prev, tone: parseInt(e.target.value) }))}
            className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-muted mt-1.5">
            <span>Gentle</span>
            <span className="font-semibold text-accent">{toneLabel(localStyle.tone)}</span>
            <span>Direct</span>
          </div>
        </div>

        {/* Depth */}
        <div className="mb-6">
          <h3 className="font-semibold text-primary text-sm mb-3">Coaching Depth</h3>
          <input
            type="range"
            min="1"
            max="5"
            value={localStyle.depth}
            onChange={(e) => setLocalStyle(prev => ({ ...prev, depth: parseInt(e.target.value) }))}
            className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-muted mt-1.5">
            <span>Surface</span>
            <span className="font-semibold text-accent">{depthLabel(localStyle.depth)}</span>
            <span>Deep</span>
          </div>
        </div>

        {/* Learning Styles */}
        <div className="mb-8">
          <h3 className="font-semibold text-primary text-sm mb-3">How You Learn Best</h3>
          <div className="grid grid-cols-2 gap-2">
            {learningStyleOptions.map((opt) => {
              const selected = (localStyle.learningStyles || []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleLearningStyle(opt.value)}
                  className={`p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    selected
                      ? 'bg-pill-selected text-pill-selected-text border-pill-selected-border'
                      : 'bg-pill-unselected text-pill-unselected-text border-pill-unselected-border hover:border-default'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Life Context */}
        <div className="border-t border-default pt-6 mb-6">
          <h3 className="font-semibold text-primary text-base mb-1">About You</h3>
          <p className="text-xs text-muted mb-4">Helps Toney personalize your coaching</p>

          {/* Life stage */}
          <div className="mb-4">
            <label className="text-sm font-medium text-secondary mb-2 block">Life stage</label>
            <div className="grid grid-cols-2 gap-2">
              {lifeStageOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLifeStage(lifeStage === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    lifeStage === opt.value
                      ? 'bg-pill-selected text-pill-selected-text border-pill-selected-border'
                      : 'bg-pill-unselected text-pill-unselected-text border-pill-unselected-border hover:border-default'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Income type */}
          <div className="mb-4">
            <label className="text-sm font-medium text-secondary mb-2 block">Income type</label>
            <div className="grid grid-cols-2 gap-2">
              {incomeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIncomeType(incomeType === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    incomeType === opt.value
                      ? 'bg-pill-selected text-pill-selected-text border-pill-selected-border'
                      : 'bg-pill-unselected text-pill-unselected-text border-pill-unselected-border hover:border-default'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Relationship */}
          <div className="mb-4">
            <label className="text-sm font-medium text-secondary mb-2 block">Relationship</label>
            <div className="grid grid-cols-3 gap-2">
              {relationshipOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRelationship(relationship === opt.value ? '' : opt.value)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    relationship === opt.value
                      ? 'bg-pill-selected text-pill-selected-text border-pill-selected-border'
                      : 'bg-pill-unselected text-pill-unselected-text border-pill-unselected-border hover:border-default'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional why */}
          <div className="mb-4">
            <label className="text-sm font-medium text-secondary mb-2 block">
              Why does money matter to you?
            </label>
            <textarea
              value={emotionalWhy}
              onChange={(e) => setEmotionalWhy(e.target.value)}
              placeholder="e.g., Stop feeling anxious every month"
              rows={2}
              className="w-full p-3 rounded-xl border-2 border-default text-sm text-primary placeholder-muted focus:border-accent focus:outline-none resize-none bg-card"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-btn-primary text-btn-primary-text py-4 rounded-2xl font-semibold text-lg hover:bg-btn-primary-hover transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Retake quiz */}
        <button
          onClick={retakeQuiz}
          className="w-full mt-3 flex items-center justify-center gap-2 text-secondary text-sm font-medium py-3 hover:text-primary transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Retake tension quiz
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full mt-1 flex items-center justify-center gap-2 text-danger text-sm font-medium py-3 hover:opacity-80 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
      {showCustomEditor && (
        <CustomThemeEditor onClose={() => setShowCustomEditor(false)} />
      )}
    </div>
  );
}

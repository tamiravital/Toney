'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'toney_custom_theme_css';

// Default custom theme CSS — variable declarations only (no selector wrapper)
const DEFAULT_CSS = `/* ─── BACKGROUNDS ─── */

/* Main app background */
--bg-surface: #f9fafb;

/* Card and tile backgrounds */
--bg-card: #ffffff;

/* Modal and overlay backgrounds */
--bg-elevated: #ffffff;

/* Form input backgrounds */
--bg-input: #f3f4f6;

/* Dark overlay behind modals */
--bg-overlay: rgba(0, 0, 0, 0.4);


/* ─── TEXT ─── */

--text-primary: #111827;
--text-secondary: #6b7280;
--text-muted: #9ca3af;
--text-inverse: #ffffff;


/* ─── BORDERS ─── */

--border-default: #e5e7eb;
--border-subtle: #f3f4f6;
--border-focus: #a5b4fc;


/* ─── ACCENT (brand color) ─── */
/* Change --accent first for the biggest impact */

--accent: #4f46e5;
--accent-hover: #4338ca;
--accent-light: #eef2ff;
--accent-subtle: #e0e7ff;
--accent-text: #4338ca;


/* ─── SUCCESS (wins, positive) ─── */

--success: #16a34a;
--success-light: #f0fdf4;
--success-medium: #dcfce7;
--success-text: #15803d;
--success-border: #bbf7d0;


/* ─── WARNING ─── */

--warning: #ea580c;
--warning-light: #fff7ed;
--warning-text: #c2410c;


/* ─── DANGER ─── */

--danger: #ef4444;
--danger-light: #fef2f2;


/* ─── AMBER ─── */

--amber: #d97706;
--amber-light: #fffbeb;
--amber-medium: #fef3c7;
--amber-text: #92400e;
--amber-border: #fde68a;


/* ─── NAVIGATION BAR ─── */

--nav-bg: rgba(255, 255, 255, 0.9);
--nav-active: #4f46e5;
--nav-inactive: #9ca3af;
--nav-border: #f3f4f6;


/* ─── CHAT BUBBLES ─── */

--chat-user-bg: #4f46e5;
--chat-user-text: #ffffff;
--chat-coach-bg: #f3f4f6;
--chat-coach-text: #111827;


/* ─── BUTTONS ─── */

--btn-primary-bg: #4f46e5;
--btn-primary-text: #ffffff;
--btn-primary-hover: #4338ca;
--btn-secondary-bg: #f3f4f6;
--btn-secondary-text: #4b5563;
--btn-secondary-hover: #e5e7eb;
--btn-disabled-bg: #e5e7eb;
--btn-disabled-text: #9ca3af;


/* ─── PILLS ─── */

--pill-selected-bg: #eef2ff;
--pill-selected-text: #4338ca;
--pill-selected-border: #4f46e5;
--pill-unselected-bg: transparent;
--pill-unselected-text: #4b5563;
--pill-unselected-border: #e5e7eb;


/* ─── CARD CATEGORIES ─── */

--cat-reframe-bg: #faf5ff;
--cat-reframe-text: #9333ea;
--cat-reframe-border: #e9d5ff;
--cat-reframe-accent: #9333ea;

--cat-truth-bg: #fffbeb;
--cat-truth-text: #d97706;
--cat-truth-border: #fde68a;
--cat-truth-accent: #d97706;

--cat-plan-bg: #eff6ff;
--cat-plan-text: #2563eb;
--cat-plan-border: #bfdbfe;
--cat-plan-accent: #2563eb;

--cat-practice-bg: #f0fdf4;
--cat-practice-text: #16a34a;
--cat-practice-border: #bbf7d0;
--cat-practice-accent: #16a34a;

--cat-kit-bg: #f0fdfa;
--cat-kit-text: #0d9488;
--cat-kit-border: #99f6e4;
--cat-kit-accent: #0d9488;


/* ─── JOURNEY TIMELINE ─── */

--journey-line: #e0e7ff;
--journey-win-bg: #f0fdf4;
--journey-win-border: #bbf7d0;
--journey-win-tag: #22c55e;
--journey-milestone-bg: #eef2ff;
--journey-milestone-border: #c7d2fe;
--journey-milestone-tag: #818cf8;
--journey-first-bg: #fffbeb;
--journey-first-border: #fde68a;
--journey-first-tag: #f59e0b;


/* ─── FOCUS AREA COLORS ─── */

--focus-0-bg: #eef2ff; --focus-0-border: #c7d2fe; --focus-0-tag: #818cf8;
--focus-1-bg: #fdf2f8; --focus-1-border: #fbcfe8; --focus-1-tag: #ec4899;
--focus-2-bg: #f0f9ff; --focus-2-border: #bae6fd; --focus-2-tag: #38bdf8;
--focus-3-bg: #faf5ff; --focus-3-border: #e9d5ff; --focus-3-tag: #a78bfa;
--focus-4-bg: #fff7ed; --focus-4-border: #fed7aa; --focus-4-tag: #fb923c;
--focus-5-bg: #fefce8; --focus-5-border: #fde68a; --focus-5-tag: #eab308;
--focus-6-bg: #ecfdf5; --focus-6-border: #a7f3d0; --focus-6-tag: #34d399;


/* ─── MISC ─── */

--length-quick: #16a34a;
--length-medium: #2563eb;
--length-deep: #9333ea;
--length-standing: #d97706;
--featured-from: #4f46e5;
--featured-to: #7c3aed;
--loading-dot: #9ca3af;
--loading-dot-accent: #818cf8;
--chip-bg: #ffffff;
--chip-text: #4338ca;
--chip-border: #c7d2fe;
--chip-hover: #eef2ff;
--theme-color: #f9fafb;`;

function getStoredCustomCSS(): string {
  if (typeof window === 'undefined') return DEFAULT_CSS;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CSS;
  } catch {
    return DEFAULT_CSS;
  }
}

/** Inject a <style> tag that wraps the user's variable declarations in [data-theme="custom"] */
function injectCustomStyles(css: string) {
  let el = document.getElementById('toney-custom-theme');
  if (!el) {
    el = document.createElement('style');
    el.id = 'toney-custom-theme';
    document.head.appendChild(el);
  }
  el.textContent = `[data-theme="custom"] { ${css} }`;
}

/** Call this on app load to restore saved custom theme */
export function restoreCustomTheme() {
  if (typeof window === 'undefined') return;
  try {
    const theme = localStorage.getItem('toney_theme');
    if (theme === 'custom') {
      const css = localStorage.getItem(STORAGE_KEY) || DEFAULT_CSS;
      injectCustomStyles(css);
    }
  } catch { /* */ }
}

interface CustomThemeEditorProps {
  onClose: () => void;
}

export default function CustomThemeEditor({ onClose }: CustomThemeEditorProps) {
  const [css, setCss] = useState(getStoredCustomCSS);

  // Apply live as they type
  useEffect(() => {
    injectCustomStyles(css);
  }, [css]);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, css);
    } catch { /* */ }
    injectCustomStyles(css);
    onClose();
  }, [css, onClose]);

  const handleReset = useCallback(() => {
    setCss(DEFAULT_CSS);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-[430px] h-[90dvh] bg-white rounded-2xl flex flex-col shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900">Custom Theme Editor</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex-shrink-0 border-b border-gray-100">
          Edit CSS variables below. Changes preview live. Tap Save when done.
        </div>

        {/* Editor */}
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          spellCheck={false}
          className="flex-1 px-4 py-3 text-xs font-mono text-gray-800 bg-white resize-none outline-none overflow-auto leading-relaxed"
          style={{ tabSize: 2 }}
        />

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
          <button
            onClick={handleSave}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import type { TensionType, StageOfChange } from '@toney/types';

// ============================================================
// Date Formatting
// ============================================================

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

// ============================================================
// Number Formatting
// ============================================================

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

// ============================================================
// Label Formatting
// ============================================================

const TENSION_LABELS: Record<TensionType, string> = {
  avoid: 'Avoid',
  worry: 'Worry',
  chase: 'Chase',
  perform: 'Perform',
  numb: 'Numb',
  give: 'Give',
  grip: 'Grip',
};

export function tensionLabel(type: TensionType | null | undefined): string {
  if (!type) return 'Unknown';
  return TENSION_LABELS[type] || type;
}

const STAGE_LABELS: Record<StageOfChange, string> = {
  precontemplation: 'Pre-contemplation',
  contemplation: 'Contemplation',
  preparation: 'Preparation',
  action: 'Action',
  maintenance: 'Maintenance',
  relapse: 'Relapse',
};

export function stageLabel(stage: StageOfChange | null | undefined): string {
  if (!stage) return 'Unknown';
  return STAGE_LABELS[stage] || stage;
}

const DEPTH_LABELS: Record<string, string> = {
  surface: 'Surface',
  balanced: 'Balanced',
  deep: 'Deep',
};

export function depthLabel(depth: string | null | undefined): string {
  if (!depth) return 'Unknown';
  return DEPTH_LABELS[depth] || depth;
}

export function toneLabel(tone: number): string {
  if (tone <= 4) return `${tone} — Gentle`;
  if (tone <= 6) return `${tone} — Balanced`;
  return `${tone} — Direct`;
}

export function engagementLabel(level: string | null | undefined): string {
  if (!level) return 'Unknown';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function learningStyleLabel(style: string): string {
  return style.charAt(0).toUpperCase() + style.slice(1);
}

export function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ============================================================
// Duration formatting
// ============================================================

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

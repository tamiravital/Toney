export const SESSION_FEEDBACK_OPTIONS = [
  { key: 'something_clicked', emoji: '💡', label: 'Something clicked' },
  { key: 'thinking_differently', emoji: '🌱', label: 'Thinking differently' },
  { key: 'feel_lighter', emoji: '😌', label: 'I feel lighter' },
  { key: 'not_sure', emoji: '😐', label: 'Not sure yet' },
  { key: 'didnt_feel_heard', emoji: '😶', label: "I didn't feel heard" },
] as const;

export type SessionFeedbackKey = typeof SESSION_FEEDBACK_OPTIONS[number]['key'];

export const FEEDBACK_LABELS: Record<string, string> = Object.fromEntries(
  SESSION_FEEDBACK_OPTIONS.map(o => [o.key, o.label])
);

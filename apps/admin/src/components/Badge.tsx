interface BadgeProps {
  label: string;
  bg?: string;
  text?: string;
  size?: 'sm' | 'md';
}

export default function Badge({
  label,
  bg = 'bg-gray-100',
  text = 'text-gray-700',
  size = 'sm',
}: BadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${bg} ${text} ${sizeClasses}`}>
      {label}
    </span>
  );
}

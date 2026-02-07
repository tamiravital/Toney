import type { LucideIcon } from 'lucide-react';
import Badge from '@/components/Badge';

interface IntelSectionProps {
  title: string;
  icon: LucideIcon;
  items: string[];
  emptyText?: string;
  variant?: 'list' | 'badges';
  badgeBg?: string;
  badgeText?: string;
}

export default function IntelSection({
  title,
  icon: Icon,
  items,
  emptyText = 'None recorded',
  variant = 'list',
  badgeBg = 'bg-gray-100',
  badgeText = 'text-gray-700',
}: IntelSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-gray-400" />
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{emptyText}</p>
      ) : variant === 'badges' ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} label={item} bg={badgeBg} text={badgeText} />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-300 mt-1 flex-shrink-0">&#8226;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

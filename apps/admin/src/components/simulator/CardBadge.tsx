import { Sparkles } from 'lucide-react';
import { categoryLabel } from '@/lib/format';

interface CardBadgeProps {
  category: string;
  reason?: string | null;
}

export default function CardBadge({ category, reason }: CardBadgeProps) {
  return (
    <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
      <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <span className="text-xs font-medium text-amber-700">
          Card: {categoryLabel(category)}
        </span>
        {reason && (
          <p className="text-xs text-amber-600 mt-0.5">{reason}</p>
        )}
      </div>
    </div>
  );
}

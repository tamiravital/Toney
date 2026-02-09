'use client';

import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export default function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

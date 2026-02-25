'use client';

import { ReactNode } from 'react';

interface MobileShellProps {
  children: ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="h-dvh flex justify-center overflow-hidden bg-surface">
      <div className="w-full max-w-[430px] h-dvh relative flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
        {children}
      </div>
    </div>
  );
}

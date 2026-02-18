'use client';

import { ReactNode, useEffect } from 'react';
import { restoreCustomTheme } from './CustomThemeEditor';

interface MobileShellProps {
  children: ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  // Restore custom theme CSS on app load (if custom theme was saved)
  useEffect(() => { restoreCustomTheme(); }, []);

  return (
    <div className="h-dvh flex justify-center overflow-hidden bg-white">
      <div className="w-full max-w-[430px] h-dvh relative flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
        {children}
      </div>
    </div>
  );
}

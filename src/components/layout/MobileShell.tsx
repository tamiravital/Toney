'use client';

import { ReactNode } from 'react';

interface MobileShellProps {
  children: ReactNode;
}

export default function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="h-dvh bg-gray-50 flex justify-center overflow-hidden">
      <div className="w-full max-w-[430px] h-dvh bg-gray-50 relative flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

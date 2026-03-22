'use client';

import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '@/lib/i18n/language-context';
import { useState, useEffect, ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider>
      <LanguageProvider>
        <div style={!mounted ? { visibility: 'hidden' } : undefined}>
          {children}
        </div>
      </LanguageProvider>
    </SessionProvider>
  );
}

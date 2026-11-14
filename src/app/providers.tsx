'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { seshatTheme } from '@/themes/seshat/seshat';
import {
  getResolvedModeServerSnapshot,
  getResolvedModeSnapshot,
  subscribeMode,
  syncDocumentTheme,
} from '@/theme/theme-store';
import { hydrateStoredAppearance } from '@/theme/token-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(
    subscribeMode,
    getResolvedModeSnapshot,
    getResolvedModeServerSnapshot,
  );

  useEffect(() => {
    hydrateStoredAppearance();
  }, []);

  useEffect(() => {
    syncDocumentTheme(mode);
  }, [mode]);

  return (
    <Theme theme={seshatTheme} mode={mode}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}

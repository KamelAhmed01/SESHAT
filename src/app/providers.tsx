'use client';

import Link from 'next/link';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { seshatTheme } from '@/themes/seshat/seshatTheme';

/** Original SESHAT Astryx theme. Compiled CSS remains an online verification step. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={seshatTheme} mode="dark">
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}

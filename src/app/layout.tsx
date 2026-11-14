import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { Providers } from './providers';
import { themeInitScript } from '@/theme/theme-store';

export const metadata: Metadata = {
  title: 'SESHAT — Mars Science Mission Planner',
  description: 'Explore time-dependent, evidence-traceable scientific opportunities on Mars. Research prototype; not an operational EVA safety system.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

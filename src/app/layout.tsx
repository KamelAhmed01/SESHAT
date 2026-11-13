import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SESHAT — Mars Science Opportunity Workbench',
  description: 'Explore time-dependent, evidence-traceable scientific opportunities on Mars. Research prototype; not an operational EVA safety system.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}

import { Suspense } from 'react';
import { MissionWorkbench } from '@/components/workbench/MissionWorkbench';

export default function Home() {
  return <Suspense fallback={<main className="rail-section">Loading SESHAT…</main>}><MissionWorkbench /></Suspense>;
}

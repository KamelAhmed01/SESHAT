'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { loadScientificBundle } from '@/data/loader';
import type { BundleResult } from '@/data/loader';
import { MissionLifecycle } from './MissionLifecycle';
import { ThemeControlPopup } from './ThemeControlPopup';

/**
 * Unified entry loader for SESHAT: resolves either the verified/review-pending
 * Jezero Mars dataset (`/data`) or the explicitly disclosed synthetic acceptance
 * scene (`/?demo=1` -> `/demo`) and mounts the single `.field-workbench` UI.
 */
export function MissionWorkbench() {
  const search = useSearchParams();
  const demoMode = search.get('demo') === '1';
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${demoMode ? 'demo' : 'data'}:${reloadKey}`;
  const [loaded, setLoaded] = useState<{ key: string; result: BundleResult } | null>(null);

  useEffect(() => {
    let alive = true;
    loadScientificBundle(demoMode ? '/demo' : '/data').then(result => {
      if (!alive) return;
      setLoaded({ key: requestKey, result });
    });
    return () => {
      alive = false;
    };
  }, [demoMode, requestKey]);

  const loading = loaded?.key !== requestKey;
  const data: BundleResult = loaded?.result ?? {
    state: 'NO_DATA',
    message: 'Checking available scientific datasets…',
  };

  if (loading) {
    return (
      <main className="field-loading" aria-busy="true">
        <VStack gap={2} hAlign="center">
          <Spinner size="lg" aria-label="Loading scientific dataset" />
          <Text type="supporting">
            {demoMode
              ? 'Loading synthetic acceptance landscape…'
              : 'Loading Mars AEQD terrain and science target bundle…'}
          </Text>
        </VStack>
      </main>
    );
  }

  if (data.state === 'VERIFIED' || data.state === 'SOURCE_REVIEW_REQUIRED' || data.state === 'DEMO') {
    return <MissionLifecycle bundle={data.bundle} dataState={data.state} />;
  }

  const isCorrupt = data.state === 'CORRUPT';
  return (
    <div className="field-workbench">
      <header className="field-header">
        <div className="field-header-brand">
          <strong>SESHAT</strong>
          <span>Jezero Crater · Traverse Field Planner</span>
        </div>
        <div className="field-header-actions">
          <ThemeControlPopup />
        </div>
      </header>
      <main className="field-loading">
        <Card padding={4} maxWidth={560}>
          <VStack gap={3}>
            <Heading level={1}>
              {isCorrupt ? 'Scientific bundle failed integrity gate' : 'Mars dataset not yet loaded'}
            </Heading>
            <Banner
              status={isCorrupt ? 'error' : 'warning'}
              title={isCorrupt ? 'DATA INTEGRITY ERROR' : 'NO_DATA — EVIDENCE GATE'}
              description={data.message}
              collapsible={false}
            />
            <Text type="supporting">
              SESHAT refuses unvalidated terrain or unattributed targets. Check `public/data/manifest.json` or open the explicitly labeled synthetic acceptance scene for UI testing.
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button
                label="Retry dataset check"
                variant="secondary"
                onClick={() => setReloadKey(k => k + 1)}
              />
              {!demoMode ? (
                <Link href="/?demo=1">Open synthetic test scene</Link>
              ) : (
                <Link href="/">Return to Mars dataset</Link>
              )}
            </HStack>
          </VStack>
        </Card>
      </main>
    </div>
  );
}

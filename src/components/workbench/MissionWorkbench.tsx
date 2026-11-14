'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MissionLifecycle } from './MissionLifecycle';
import { Button } from '@astryxdesign/core/Button';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import type { MapPointInspection } from '@/components/cartography/LeafletGrid';
import { loadScientificBundle } from '@/data/loader';
import type { BundleResult } from '@/data/loader';
import type { MissionScenario, ScienceTarget } from '@/engine/types';
import { assessTarget } from '@/engine/feasibility';
import { minutesText, stateLabel } from '@/engine/formatting';
import { routeSummary } from '@/engine/route-summary';
import { countFrontier, frontierMembership } from '@/engine/frontier';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import { buildMissionBrief } from '@/engine/mission-brief';
import { buildOpportunityLedger, opportunityExplanation } from '@/engine/opportunity-ledger';
import { explainDelay } from '@/engine/explain';
import scenarioDefaults from '@/config/mission-scenario.json';

const INITIAL_BUDGET = scenarioDefaults.timeBudgetMinutes; // Scenario assumption, never EVA guidance.
const RESERVE = scenarioDefaults.reserveMinutes;
const sourceKind = (state: BundleResult['state']) => state === 'DEMO' ? 'SYNTHETIC TEST SCENE' :
  state === 'VERIFIED' ? 'TEAM-REVIEWED MARS DATA' : state === 'SOURCE_REVIEW_REQUIRED' ? 'REAL-DATA REVIEW PENDING' : 'DATA GATE PENDING';

function customTarget(row: number, col: number): ScienceTarget {
  return {
    id: `custom-${row}-${col}`, name: 'Custom exploration point',
    location: { originalCoordinateText: `Analysis cell (${row}, ${col})`, coordinateFrame: 'LOCAL_ANALYSIS_GRID',
      gridRow: row, gridCol: col, confidence: 'USER_SELECTED', locationSource: 'USER_CLICK' },
    objectiveTags: ['scenario'],
    science: { summary: 'User-selected location. No geologic properties are inferred from a click.',
      sourceIds: [], evidence: [], limitations: ['Not a verified geological target', 'Activity duration is assumed'] },
    activity: { minutes: scenarioDefaults.defaultScienceMinutes, basis: 'SCENARIO_ASSUMPTION' },
  };
}

export function MissionWorkbench() {
  const [data, setData] = useState<BundleResult>({ state: 'NO_DATA', message: 'Checking available scientific datasets…' });
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = useSearchParams();
  const demoMode = search.get('demo') === '1';
  const opportunityMode = search.get('opportunities') === '1';
  const [showOptical, setShowOptical] = useState(false);
  const [showElevation, setShowElevation] = useState(false);
  const [showGeology, setShowGeology] = useState(false);
  const [showThermal, setShowThermal] = useState(false);
  const [resetViewRequestKey, setResetViewRequestKey] = useState(0);
  const [inspectedPoint, setInspectedPoint] = useState<MapPointInspection | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    loadScientificBundle(demoMode ? '/demo' : '/data').then(result => {
      if (!alive) return;
      setData(result);
      if (result.state === 'DEMO' && result.bundle.manifest.scienceTargets?.length) {
        const loc = result.bundle.manifest.scienceTargets[0].location;
        if (loc.gridRow !== null && loc.gridCol !== null) setSelected([loc.gridRow, loc.gridCol]);
      }
    });
    return () => { alive = false; };
  }, [demoMode]);

  // Modal accessibility: focus enters the evidence panel, Tab stays inside,
  // Escape closes, and focus returns to the trigger on exit.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeDrawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setDrawerOpen(false); return; }
      if (event.key !== 'Tab') return;
      const panel = drawerRef.current;
      const controls = panel ? Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )) : [];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [drawerOpen]);

  const loadedBundle = data.state === 'DEMO' || data.state === 'VERIFIED' || data.state === 'SOURCE_REVIEW_REQUIRED' ? data.bundle : null;
  const bundle = loadedBundle?.assetRoot === (demoMode ? '/demo' : '/data') ? loadedBundle : null;
  const isReady = bundle !== null;
  const remaining = Math.max(0, INITIAL_BUDGET - elapsed);
  const scenario: MissionScenario = useMemo(() => ({
    id: scenarioDefaults.id, label: scenarioDefaults.label,
    timeBudgetMinutes: INITIAL_BUDGET, elapsedMinutes: elapsed, reserveMinutes: RESERVE,
    referenceSpeedMetersPerSecond: scenarioDefaults.referenceSpeedMetersPerSecond, speedMultipliers: [0.8, 1, 1.2],
    gradeModelId: scenarioDefaults.gradeModelId, datasetRevision: bundle?.manifest.sourceId ?? 'AWAITING_SOURCE',
  }), [elapsed, bundle]);

  const ledger = useMemo(() => bundle ? buildOpportunityLedger(bundle, scenario) : null, [bundle, scenario]);

  const target = useMemo(() => {
    if (!bundle || !selected) return null;
    const exact = bundle.manifest.scienceTargets?.find(t =>
      t.location.gridRow === selected[0] && t.location.gridCol === selected[1]);
    return exact ?? customTarget(...selected);
  }, [bundle, selected]);

  const outbound = useMemo(() => bundle && selected ? routeSummary(bundle, selected[0] * bundle.manifest.width + selected[1], 'outbound') : null,
    [bundle, selected]);
  const returnRoute = useMemo(() => bundle && selected ? routeSummary(bundle, selected[0] * bundle.manifest.width + selected[1], 'return') : null,
    [bundle, selected]);
  const assessment = useMemo(() => target && outbound && returnRoute ? assessTarget(target, scenario, outbound, returnRoute) : null,
    [target, outbound, returnRoute, scenario]);
  const baseline = useMemo(() => target && outbound && returnRoute ? assessTarget(target, {...scenario, elapsedMinutes: 0}, outbound, returnRoute) : null,
    [target, outbound, returnRoute, scenario]);
  const frontierCount = useMemo(() => bundle ? countFrontier(frontierMembership(
    bundle.outboundMinutes, bundle.returnMinutes, bundle.mask, elapsed, INITIAL_BUDGET, RESERVE)) : null,
    [bundle, elapsed]);
  const originalFrontierCount = useMemo(() => bundle ? countFrontier(frontierMembership(
    bundle.outboundMinutes, bundle.returnMinutes, bundle.mask, 0, INITIAL_BUDGET, RESERVE)) : null,
    [bundle]);
  const frontierLoss = frontierCount === null || originalFrontierCount === null ? null : originalFrontierCount - frontierCount;
  const exportBrief = () => {
    if (!bundle || !target || !assessment) return;
    const report = buildMissionBrief({ target, assessment, scenario, source: bundle.manifest,
      movementFrontierCells: frontierCount, initialFrontierCells: originalFrontierCount });
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `seshat-mission-brief-${target.id.replace(/[^a-z0-9_-]/gi, '_').slice(0, 45)}.md`;
    document.body.appendChild(link); link.click(); link.remove();
    // Delay cleanup one render turn to let the browser begin the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (bundle && !demoMode && !opportunityMode) return <MissionLifecycle bundle={bundle} />;

  return <div className="cc-backdrop"><main className="workbench cc-shell cc-workbench">
    <aside className="cc-sidebar" aria-label="Command navigation">
      <div className="cc-brand">
        <div className="cc-logo-ring" aria-hidden="true">S</div>
        <div className="brand-text"><strong>SESHAT</strong><span>MARS SURFACE SCIENCE</span></div>
      </div>
      <nav className="cc-nav" aria-label="Workspace sections">
        <Link href="/" className="cc-nav-item" prefetch={false}>
          <span className="cc-nav-icon" aria-hidden="true">⌂</span>
          <span>Command center</span>
        </Link>
        <Link href="/?opportunities=1" className={`cc-nav-item${!demoMode ? ' cc-nav-active' : ''}`} prefetch={false}>
          <span className="cc-nav-icon" aria-hidden="true">◫</span>
          <span>Opportunity frontier</span>
        </Link>
        <Link href="/?demo=1" className={`cc-nav-item${demoMode ? ' cc-nav-active' : ''}`} prefetch={false}>
          <span className="cc-nav-icon" aria-hidden="true">◈</span>
          <span>Synthetic test scene</span>
        </Link>
      </nav>
      <div className="cc-sidebar-bottom">
        <button type="button" className="cc-nav-item" onClick={() => setDrawerOpen(true)}>
          <span className="cc-nav-icon" aria-hidden="true">⚙</span>
          <span>Evidence &amp; methods</span>
        </button>
        <div className="cc-help-card">
          <div className="cc-help-title">
            <span className="cc-help-badge" aria-hidden="true">?</span>
            <strong>Need help?</strong>
          </div>
          <p>Review provenance, frames &amp; scenario limits</p>
          <button type="button" className="cc-help-btn" onClick={() => setDrawerOpen(true)}>Documentation</button>
          <div className="cc-mars-orb" aria-hidden="true" />
        </div>
      </div>
    </aside>

    <div className="cc-workspace">
    <header className="mission-header cc-topbar">
      <div className="cc-title-block">
        <span className="cc-main-title">{demoMode ? 'Synthetic Acceptance Scene' : 'Opportunity Frontier'}</span>
        <span className="cc-subtitle">Jezero crater · Opportunity navigator</span>
      </div>
      <div className="header-right cc-topbar-right"><span className="live-state">● {sourceKind(data.state)}</span>
        <button className="text-action" onClick={() => setDrawerOpen(true)}>Evidence &amp; methods ↗</button></div>
    </header>

    <div className="content-grid">
      <aside className="left-rail cc-card" aria-label="Science opportunities">
        <section className="rail-intro">
          <h1>What can we still explore?</h1><p>Every minute changes which opportunities fit a return journey.</p>
          {demoMode && <div className="mode-alert" role="status">SIMULATED TERRAIN <span>Not a Mars measurement</span></div>}
        </section>
        <section id="science-opportunities" className="rail-section"><div className="section-heading"><span>Science opportunities</span><span className="section-index">{bundle?.manifest.scienceTargets?.length ?? 0} TARGETS</span></div>
          {ledger && ledger.entries.length > 0 && <div className="opportunity-overview" aria-live="polite">
            <div className="opportunity-kpi"><strong>{ledger.currentFeasible}<span> / {ledger.entries.length}</span></strong><small>Feasible in ≥1 modeled speed</small></div>
            <div className="opportunity-delta"><strong>{ledger.lost > 0 ? `−${ledger.lost}` : '0'}</strong><small>Lost since start</small></div>
            <div className="opportunity-delta"><strong>{ledger.downgraded}</strong><small>Speed-sensitive shift</small></div>
            {ledger.uncertain > 0 && <p>{ledger.uncertain} location(s) remain unknown; no availability claim.</p>}
          </div>}
          {ledger && ledger.entries.length ? <div className="target-list">{ledger.entries.map((entry, i) => {
            const t = entry.target;
            const r = t.location.gridRow, c = t.location.gridCol;
            const hasPoint = r !== null && c !== null && t.location.confidence !== 'APPROXIMATE_REGION';
            const selectedTarget = hasPoint && selected && r === selected[0] && c === selected[1];
            return <button className={'target-item' + (selectedTarget ? ' target-selected' : '')}
              type="button" key={t.id} aria-pressed={Boolean(selectedTarget)}
              aria-label={`${t.name}: ${entry.current.state.toLowerCase()}. ${opportunityExplanation(entry)}`}
              onClick={() => { if (hasPoint) setSelected([r, c]); else setDrawerOpen(true); }}>
              <span className="target-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="target-body"><strong>{t.name}</strong>
                <span>{t.science.summary}</span>
                <span className="opportunity-meta"><span className={`opportunity-status op-${entry.current.state.toLowerCase()}`}>{stateLabel(entry.current.state)}</span>
                  {entry.change === 'LOST' && <em>LOST AFTER DELAY</em>}
                  {entry.change === 'DOWNGRADED' && <em>NOW SPEED-SENSITIVE</em>}
                </span>
                <small>{t.location.confidence === 'USER_SELECTED' ? 'Scenario location' : t.location.confidence.replace('_', ' ')} · {entry.current.nominalMarginMinutes === null ? 'UNKNOWN MARGIN' : `${minutesText(entry.current.nominalMarginMinutes)} NOMINAL MARGIN`}</small>
              </span>
              <span aria-hidden="true" className="target-chevron">{hasPoint ? '↗' : '?'}</span>
            </button>;
          })}</div> : <div className="evidence-empty"><span className="quiet-icon">⌁</span><strong>Science locations awaiting verification</strong>
            <p>Terrain may be available, but source-backed geological targets need traceable coordinates and overlap tests.</p></div>}
        </section>
        <section className="rail-section rail-bottom"><div className="section-heading"><span>Analysis rules</span></div>
          <p className="context-note">Directional terrain routing, an explicit return reserve and three travel speeds. All scenario values are assumptions, not EVA limits.</p>
          <button className="text-action" onClick={() => setDrawerOpen(true)}>Inspect methodology ↗</button>
          {!demoMode && <p className="demo-link-note"><Link href="/">Mission planner ↗</Link><br/>For interface acceptance testing: <Link href="/?demo=1" prefetch={false}>synthetic demonstration ↗</Link></p>}
        </section>
      </aside>

      <section className="map-stage cc-card" aria-label="Planetary terrain map">
        <div className="map-topline cc-map-header">
          <span className="map-title">Jezero / analysis area</span>
          <div className="cc-map-controls-top">
            <button
              type="button"
              className="cc-map-action-btn"
              onClick={() => setResetViewRequestKey(k => k + 1)}
            >
              Back to Jezero
            </button>
            {bundle?.manifest.optical && <div className="map-layer-switch" role="group" aria-label="Surface layer">
              <button type="button" aria-pressed={!showOptical} onClick={() => setShowOptical(false)}>Terrain</button>
              <button type="button" aria-pressed={showOptical} onClick={() => setShowOptical(true)}>Orbital</button>
            </div>}
            <button
              type="button"
              className="cc-map-action-btn"
              aria-pressed={showElevation}
              onClick={() => setShowElevation(v => !v)}
            >
              Elevation
            </button>
            {bundle?.manifest.contextLayers?.geologicUnits?.geoImagePath && (
              <button
                type="button"
                className="cc-map-action-btn"
                aria-pressed={showGeology}
                onClick={() => setShowGeology(v => !v)}
              >
                Geology
              </button>
            )}
            {bundle?.manifest.contextLayers?.thermalInertia?.geoImagePath && (
              <button
                type="button"
                className="cc-map-action-btn"
                aria-pressed={showThermal}
                onClick={() => setShowThermal(v => !v)}
              >
                Thermal
              </button>
            )}
          </div>
        </div>
        <LeafletGrid bundle={bundle} elapsedMinutes={elapsed} missionBudgetMinutes={INITIAL_BUDGET} reserveMinutes={RESERVE}
          selectedCell={selected} onCellSelect={(r,c) => { if (isReady) setSelected([r,c]); }}
          onInspectPoint={setInspectedPoint}
          outboundRoute={outbound} returnRoute={returnRoute} showOptical={showOptical}
          showElevation={showElevation} showGeology={showGeology} showThermal={showThermal} resetViewRequestKey={resetViewRequestKey}
          opportunities={ledger?.entries}/>
        {inspectedPoint && inspectedPoint.status !== 'COVERED' && (
          <div className="cc-point-inspector" role="status" aria-label="Map point inspection">
            <div className="cc-point-inspector-head">
              <span className="cc-point-inspector-badge" data-status={inspectedPoint.status}>
                {inspectedPoint.status === 'OUTSIDE_GRID'
                  ? 'Browse only · outside modeled terrain'
                  : 'Terrain data unavailable'}
              </span>
              <button
                type="button"
                className="cc-map-action-btn"
                onClick={() => setInspectedPoint(null)}
                aria-label="Close map point inspection"
              >
                ✕
              </button>
            </div>
            {inspectedPoint.lat !== null && inspectedPoint.lon !== null && (
              <div className="cc-point-inspector-meta">
                <span>{`${Math.abs(inspectedPoint.lat).toFixed(4)}°${inspectedPoint.lat >= 0 ? 'N' : 'S'}, ${(((inspectedPoint.lon % 360) + 360) % 360).toFixed(4)}°E`}</span>
              </div>
            )}
          </div>
        )}
        {ledger && ledger.entries.length > 0 && <div className="map-mobile-opportunity">
          <strong>{ledger.currentFeasible} / {ledger.entries.length} opportunities</strong>
          <span>{ledger.lost > 0 ? `${ledger.lost} lost after +${elapsed} min` : 'Under the current assumptions'}</span>
          <a href="#science-opportunities">Inspect destinations ↓</a>
        </div>}
        <div className="map-north" aria-hidden="true">↑ N</div>
        {(!isReady || data.state === 'SOURCE_REVIEW_REQUIRED' || data.state === 'DEMO') && <div className={'map-caution' + (isReady ? ' map-caution-compact' : '')} role="status"><i aria-hidden="true"/><div>
          <strong>{data.state === 'DEMO' ? 'SYNTHETIC — NOT MARS' : data.state === 'SOURCE_REVIEW_REQUIRED' ? 'REAL TERRAIN / SOURCE REVIEW PENDING' : 'MARS DATA NOT YET LOADED'}</strong>
          <span>{data.state === 'CORRUPT' ? data.message : data.state === 'SOURCE_REVIEW_REQUIRED' ?
            'The route analysis is provisional until planetary CRS, Resources and targets pass review.' :
            data.state === 'DEMO' ? 'This acceptance-test landscape is artificially generated. Routes are scenario tests only.' :
            'Source-backed terrain and scientific targets will appear after data ingestion.'}</span></div></div>}
        {isReady && <div className="frontier-stats"><div className="eyebrow">RETURNABLE CELLS · MOVEMENT ONLY</div><strong>{frontierCount?.toLocaleString()}</strong>
          <span>{elapsed ? `−${frontierLoss?.toLocaleString()} cells after +${elapsed} min` : 'At the start of the scenario'}</span></div>}
        <div className="map-footer"><span>{demoMode ? 'SYNTHETIC TEST DATA' : 'MARS LOCAL METRIC GRID'}</span>
          <span>{bundle ? `${bundle.manifest.width} × ${bundle.manifest.height} · ${bundle.manifest.cellWidthMeters.toFixed(0)} M/CELL` : 'DATA GATE · PENDING'}</span></div>
      </section>

      <aside className="right-rail cc-card" aria-label="Mission clock and return feasibility">
        <section className="clock-panel">
          <h2>Time is terrain.</h2><p>Delay the start of the traverse and watch the returnable frontier shrink.</p>
          <div className="time-display"><strong>{remaining}</strong><span>min remaining</span></div>
          <div className="time-metrics"><div><span>Planning window</span><strong>{INITIAL_BUDGET} min</strong></div>
            <div><span>Elapsed</span><strong>+{elapsed} min</strong></div>
            <div><span>Held in reserve</span><strong>{RESERVE} min</strong></div></div>
          <div className="clock-actions"><Button label="Advance +15 min" variant="primary" isDisabled={elapsed >= INITIAL_BUDGET}
            onClick={() => setElapsed(v => Math.min(INITIAL_BUDGET, v + 15))}/>
            <Button label="Reset" onClick={() => setElapsed(0)}/></div>
          <p className="assumption-note">Scenario budget and travel model are not astronaut safety parameters.</p></section>
        <section className="assessment-panel"><div className="section-heading"><span>Return feasibility</span><span className="section-index">0.8× / 1× / 1.2×</span></div>
          {assessment && target ? <><div className="selected-target">{target.name}</div>
            <h3 className={'assessment-state state-' + assessment.state.toLowerCase()}>{stateLabel(assessment.state)}</h3>
            <p className="context-note">{assessment.state === 'UNKNOWN' ? 'Insufficient evidence for a supported route decision.' :
              `Nominal return margin: ${minutesText(assessment.nominalMarginMinutes)}.`}
              {data.state === 'DEMO' && ' Synthetic scenario only.'}
              {data.state === 'SOURCE_REVIEW_REQUIRED' && ' Provisional terrain analysis.'}</p>
            {outbound?.status === 'READY' && returnRoute?.status === 'READY' && <div className="route-metrics">
              <div><small>Outbound</small><strong>{minutesText(outbound.nominalTravelMinutes)}</strong></div>
              <div><small>Return</small><strong>{minutesText(returnRoute.nominalTravelMinutes)}</strong></div>
              <div><small>Fieldwork</small><strong>{target.activity.minutes} min</strong></div>
            </div>}
            <div className="scenario-lines">{assessment.scenarios.map(s => <div key={s.factor}><span>{s.factor.toFixed(1)}×</span>
              <span>{minutesText(s.marginMinutes)}</span><span>{s.feasible === null ? 'Unknown' : s.feasible ? 'Within budget' : 'Over budget'}</span></div>)}</div>
            {bundle && outbound?.status === 'READY' && returnRoute?.status === 'READY' &&
              <details className="terrain-detail"><summary>Inspect terrain profile <span>DEM-SCALE / BOTH LEGS</span></summary>
                <ElevationProfile route={outbound} cellWidthMeters={bundle.manifest.cellWidthMeters}
                  cellHeightMeters={bundle.manifest.cellHeightMeters} label="Outbound" />
                <ElevationProfile route={returnRoute} cellWidthMeters={bundle.manifest.cellWidthMeters}
                  cellHeightMeters={bundle.manifest.cellHeightMeters} label="Return" />
                <p>Elevation sampled from the compiled DEM. The profile does not resolve small surface hazards.</p>
              </details>}
            <div className="brief-actions"><Button label="Export mission brief (.md)" variant="primary" onClick={exportBrief}/>
              <span>Includes scenario, evidence status and limitations.</span></div>
            {elapsed > 0 && <p className="change-explanation">{explainDelay(baseline, assessment)}</p>}
          </> : <div className="assessment-pending"><strong>Decision awaiting a destination</strong>
            <p>{isReady ? 'Select a target or a covered map cell to compute an exploratory round trip.' :
              'Load source-backed terrain or use the labeled test scene to exercise the workflow.'}</p></div>}
        </section>
        <section className="rail-section right-bottom"><span className="eyebrow">Scientific boundary</span><p className="context-note">Regional terrain cannot resolve individual boulders or footstep hazards. NASA data does not imply NASA endorsement.</p></section>
      </aside>
    </div>
    <footer className="site-footer"><span>SESHAT / SPACE APPS 2026</span><span>Evidence before certainty.</span><span>Research prototype · not safety-certified</span></footer>
    </div>
    {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)}>
      <aside ref={drawerRef} className="evidence-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Evidence and method">
        <div className="drawer-top"><span className="eyebrow">Method / evidence</span><button ref={closeDrawerRef} onClick={() => setDrawerOpen(false)} aria-label="Close evidence panel">×</button></div>
        <h2>We show what the data can support.</h2>
        <p>Sources, coordinate frames and analysis assumptions remain visible. A valid bundle is not automatically a certified or globally applicable route.</p>
        {([['Bundle state',data.state],['Terrain source',bundle?.manifest.sourceId ?? 'Not accepted'],
           ['Terrain product',bundle?.manifest.sourceUrl ?? 'Unloaded'],['Model','terrain-scenario-v0'],
           ['Speed','0.75 m/s · scenario assumption'],['Grade penalties','Up 4.0 · down 1.8'],
           ['Source-frame checked',bundle?.manifest.coordinateFrameVerified ? 'Declared reviewed' : 'Pending'],
           ['Challenge resource',bundle?.manifest.challengeResourceQualified ? 'Declared reviewed' : 'Pending']] as const)
          .map(([label,value]) => <div className="drawer-fact" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        {target?.science.evidence.map(source => <p key={source.sourceId} className="source-url"><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></p>)}
        <p className="drawer-disclaimer">All numerical models are experimental. No astronaut-grade safety claim, NASA endorsement, or synthetic-as-real substitution.</p>
      </aside></div>}
  </main></div>;
}

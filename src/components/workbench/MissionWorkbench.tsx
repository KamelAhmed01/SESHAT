'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import { loadScientificBundle } from '@/data/loader';
import type { BundleResult } from '@/data/loader';
import type { MissionScenario, ScienceTarget } from '@/engine/types';
import { assessTarget } from '@/engine/feasibility';
import { minutesText, stateLabel } from '@/engine/formatting';
import { routeSummary } from '@/engine/route-summary';
import { countFrontier, frontierMembership } from '@/engine/frontier';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import { buildMissionBrief } from '@/engine/mission-brief';

const INITIAL_BUDGET = 180; // Assumed research scenario, NOT NASA flight guidance.
const RESERVE = 20;
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
    activity: { minutes: 20, basis: 'SCENARIO_ASSUMPTION' },
  };
}

export function MissionWorkbench() {
  const [data, setData] = useState<BundleResult>({ state: 'NO_DATA', message: 'Checking available scientific datasets…' });
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showOptical, setShowOptical] = useState(false);

  useEffect(() => {
    let alive = true;
    const requestedDemo = new URLSearchParams(window.location.search).get('demo') === '1';
    setDemoMode(requestedDemo);
    loadScientificBundle(requestedDemo ? '/demo' : '/data').then(result => {
      if (!alive) return;
      setData(result);
      if (result.state === 'DEMO' && result.bundle.manifest.scienceTargets?.length) {
        const loc = result.bundle.manifest.scienceTargets[0].location;
        if (loc.gridRow !== null && loc.gridCol !== null) setSelected([loc.gridRow, loc.gridCol]);
      }
    });
    return () => { alive = false; };
  }, []);

  const bundle = data.state === 'DEMO' || data.state === 'VERIFIED' || data.state === 'SOURCE_REVIEW_REQUIRED' ? data.bundle : null;
  const isReady = bundle !== null;
  const remaining = Math.max(0, INITIAL_BUDGET - elapsed);
  const scenario: MissionScenario = useMemo(() => ({
    id: 'research-scenario-v0', label: 'Illustrative EVA planning scenario',
    timeBudgetMinutes: INITIAL_BUDGET, elapsedMinutes: elapsed, reserveMinutes: RESERVE,
    referenceSpeedMetersPerSecond: 0.75, speedMultipliers: [0.8, 1, 1.2],
    gradeModelId: 'terrain-scenario-v0', datasetRevision: bundle?.manifest.sourceId ?? 'AWAITING_SOURCE',
  }), [elapsed, bundle]);

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

  return <main className="workbench">
    <header className="mission-header">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">S<span>·</span></div>
        <div className="brand-text"><strong>SESHAT</strong><span>MARS SURFACE SCIENCE</span></div></div>
      <div className="mission-id"><span className="eyebrow">Field study</span><span>Jezero crater</span><span className="tiny-separator">/</span><span>Opportunity navigator</span></div>
      <div className="header-right"><span className="live-state">● {sourceKind(data.state)}</span>
        <button className="text-action" onClick={() => setDrawerOpen(true)}>Evidence & methods ↗</button></div>
    </header>

    <div className="content-grid">
      <aside className="left-rail" aria-label="Science opportunities">
        <section className="rail-intro"><div className="eyebrow">01 / Objective</div>
          <h1>What can we still explore?</h1><p>Every minute changes which opportunities fit a return journey.</p>
          {demoMode && <div className="mode-alert" role="status">SIMULATED TERRAIN <span>Not a Mars measurement</span></div>}
        </section>
        <section className="rail-section"><div className="section-heading"><span>Science opportunities</span><span className="section-index">{bundle?.manifest.scienceTargets?.length ?? 0} TARGETS</span></div>
          {bundle?.manifest.scienceTargets?.length ? <div className="target-list">{bundle.manifest.scienceTargets.map((t, i) => {
            const r = t.location.gridRow, c = t.location.gridCol;
            const selectedTarget = selected && r === selected[0] && c === selected[1];
            return <button className={'target-item' + (selectedTarget ? ' target-selected' : '')}
              type="button" key={t.id} disabled={r === null || c === null}
              aria-pressed={Boolean(selectedTarget)} onClick={() => { if (r !== null && c !== null) setSelected([r,c]); }}>
              <span className="target-num">0{i + 1}</span><span className="target-body"><strong>{t.name}</strong>
                <span>{t.science.summary}</span><small>{t.location.confidence === 'USER_SELECTED' ? 'Scenario location' : t.location.confidence.replace('_', ' ')}</small></span>
              <span aria-hidden="true" className="target-chevron">↗</span>
            </button>;
          })}</div> : <div className="evidence-empty"><span className="quiet-icon">⌁</span><strong>Science locations awaiting verification</strong>
            <p>Terrain may be available, but source-backed geological targets need traceable coordinates and overlap tests.</p><span className="microcode">NO INVENTED PINS</span></div>}
        </section>
        <section className="rail-section rail-bottom"><div className="section-heading"><span>Analysis rules</span><span className="section-index">v0</span></div>
          <p className="context-note">Directional terrain routing, an explicit return reserve and three travel speeds. All scenario values are assumptions, not EVA limits.</p>
          <button className="text-action" onClick={() => setDrawerOpen(true)}>Inspect methodology ↗</button>
          {!demoMode && <p className="demo-link-note">For interface acceptance testing: <a href="/?demo=1">synthetic demonstration ↗</a></p>}
        </section>
      </aside>

      <section className="map-stage" aria-label="Planetary terrain map">
        <div className="map-topline"><span className="eyebrow">02 / Surface</span><span className="map-title">Jezero / analysis area</span>
          {bundle?.manifest.optical && <div className="map-layer-switch" role="group" aria-label="Surface layer">
            <button type="button" aria-pressed={!showOptical} onClick={() => setShowOptical(false)}>Terrain</button>
            <button type="button" aria-pressed={showOptical} onClick={() => setShowOptical(true)}>Orbital</button>
          </div>}
        </div>
        <LeafletGrid bundle={bundle} elapsedMinutes={elapsed} missionBudgetMinutes={INITIAL_BUDGET} reserveMinutes={RESERVE}
          selectedCell={selected} onCellSelect={(r,c) => { if (isReady) setSelected([r,c]); }}
          outboundRoute={outbound} returnRoute={returnRoute} showOptical={showOptical}/>
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

      <aside className="right-rail" aria-label="Mission clock and return feasibility">
        <section className="clock-panel"><div className="eyebrow">03 / Mission clock</div>
          <h2>Time is terrain.</h2><p>Delay the start of the traverse and watch the returnable frontier shrink.</p>
          <div className="time-display"><strong>{remaining}</strong><span>min remaining</span></div>
          <div className="time-metrics"><div><span>Planning window</span><strong>{INITIAL_BUDGET} min</strong></div>
            <div><span>Elapsed</span><strong>+{elapsed} min</strong></div>
            <div><span>Held in reserve</span><strong>{RESERVE} min</strong></div></div>
          <div className="clock-actions"><Button label="Advance +15 min" variant="primary" disabled={elapsed >= INITIAL_BUDGET}
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
            {elapsed > 0 && baseline?.state !== assessment.state && <p className="change-explanation">After +{elapsed} min, <b>{baseline?.state.toLowerCase()}</b> becomes <b>{assessment.state.toLowerCase()}</b>.</p>}
          </> : <div className="assessment-pending"><strong>Decision awaiting a destination</strong>
            <p>{isReady ? 'Select a target or a covered map cell to compute an exploratory round trip.' :
              'Load source-backed terrain or use the labeled test scene to exercise the workflow.'}</p></div>}
        </section>
        <section className="rail-section right-bottom"><span className="eyebrow">Scientific boundary</span><p className="context-note">Regional terrain cannot resolve individual boulders or footstep hazards. NASA data does not imply NASA endorsement.</p></section>
      </aside>
    </div>
    <footer className="site-footer"><span>SESHAT / SPACE APPS 2026</span><span>Evidence before certainty.</span><span>Research prototype · not safety-certified</span></footer>
    {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)}>
      <aside className="evidence-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Evidence and method">
        <div className="drawer-top"><span className="eyebrow">Method / evidence</span><button onClick={() => setDrawerOpen(false)} aria-label="Close panel">×</button></div>
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
  </main>;
}

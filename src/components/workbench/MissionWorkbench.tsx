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

const INITIAL_BUDGET = 180; // Research scenario, NOT an operational NASA EVA window.
const RESERVE = 20;

export function MissionWorkbench() {
  const [data, setData] = useState<BundleResult>({ state: 'NO_DATA', message: 'Checking evidence bundle…' });
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    loadScientificBundle().then(result => { if (alive) setData(result); });
    return () => { alive = false; };
  }, []);
  const bundle = data.state === 'VERIFIED' || data.state === 'SOURCE_REVIEW_REQUIRED' ? data.bundle : null;
  const verified = data.state === 'VERIFIED';
  const remaining = Math.max(0, INITIAL_BUDGET - elapsed);
  const scenario: MissionScenario = useMemo(() => ({
    id: 'research-scenario-v0', label: 'Exploratory EVA scenario',
    timeBudgetMinutes: INITIAL_BUDGET, elapsedMinutes: elapsed, reserveMinutes: RESERVE,
    referenceSpeedMetersPerSecond: 0.75, speedMultipliers: [0.8, 1, 1.2],
    gradeModelId: 'terrain-scenario-v0', datasetRevision: bundle?.manifest.sourceId ?? 'AWAITING_SOURCE',
  }), [elapsed, bundle]);
  const assessment = useMemo(() => {
    if (!verified || !bundle || !selected) return null;
    const [row, col] = selected;
    const target: ScienceTarget = {
      id: `custom-${row}-${col}`, name: 'User-selected grid cell',
      location: { originalCoordinateText: 'Not independently verified', coordinateFrame: 'LOCAL_ANALYSIS_GRID',
        gridRow: row, gridCol: col, confidence: 'USER_SELECTED', locationSource: 'USER_CLICK' },
      objectiveTags: ['exploratory'], science: { summary: 'Hypothetical destination, not a geological site claim.',
        sourceIds: [], evidence: [], limitations: ['Activity duration is an assumption', 'Not EVA safety advice'] },
      activity: { minutes: 20, basis: 'SCENARIO_ASSUMPTION' },
    };
    const index = row * bundle.manifest.width + col;
    return assessTarget(target, scenario, routeSummary(bundle, index, 'outbound'), routeSummary(bundle, index, 'return'));
  }, [verified, bundle, selected, scenario]);

  return <main className="workbench">
    <header className="mission-header">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">S<span>·</span></div>
        <div className="brand-text"><strong>SESHAT</strong><span>MARS SURFACE SCIENCE</span></div></div>
      <div className="mission-id"><span className="eyebrow">Study</span><span>Jezero crater</span><span className="tiny-separator">/</span><span>Exploratory scenario</span></div>
      <div className="header-right"><span className="live-state">● RESEARCH PROTOTYPE</span>
        <button className="text-action" onClick={() => setDrawerOpen(true)}>Evidence & methods ↗</button></div>
    </header>

    <div className="content-grid">
      <aside className="left-rail" aria-label="Science opportunities">
        <section className="rail-intro"><div className="eyebrow">01 / Objective</div>
          <h1>What can we still explore?</h1><p>Science opportunities change as the safe-return planning window gets smaller.</p></section>
        <section className="rail-section"><div className="section-heading"><span>Science opportunities</span><span className="section-index">G2 / PENDING</span></div>
          <div className="evidence-empty"><span className="quiet-icon">⌁</span><strong>Locations awaiting verification</strong>
            <p>Target cards appear only after coordinates, scientific references, and terrain overlap pass review.</p>
            <span className="microcode">NO INVENTED PINS</span></div></section>
        <section className="rail-section rail-bottom"><div className="section-heading"><span>Method</span><span className="section-index">v0</span></div>
          <p className="context-note">Directional grade, real round-trip costs and three speed sensitivities. Model speeds, work time and reserve are labeled assumptions.</p>
          <button className="text-action" onClick={() => setDrawerOpen(true)}>Inspect methodology ↗</button></section>
      </aside>

      <section className="map-stage" aria-label="Planetary science grid map">
        <div className="map-topline"><span className="eyebrow">02 / Surface</span><span className="map-title">Jezero / local analysis grid</span></div>
        <LeafletGrid bundle={bundle} elapsedMinutes={elapsed} missionBudgetMinutes={INITIAL_BUDGET} reserveMinutes={RESERVE}
          selectedCell={selected} onCellSelect={(r, c) => { if (verified) setSelected([r, c]); }} />
        <div className="map-north" aria-hidden="true">↑ N</div>
        {!verified && <div className="map-caution" role="status"><i aria-hidden="true"/><div>
          <strong>{data.state === 'SOURCE_REVIEW_REQUIRED' ? 'SOURCE REVIEW REQUIRED' : 'MARS DATA NOT YET LOADED'}</strong>
          <span>{data.state === 'CORRUPT' ? data.message : 'This is a grid UI scaffold, not a Mars terrain product.'}</span></div></div>}
        <div className="map-footer"><span>NO EARTH DISTANCE CALCULATIONS</span>
          <span>{bundle ? `${bundle.manifest.width} × ${bundle.manifest.height} CELLS` : 'DATA GATE G1 · PENDING'}</span></div>
      </section>

      <aside className="right-rail" aria-label="Mission clock and return feasibility">
        <section className="clock-panel"><div className="eyebrow">03 / Mission clock</div>
          <h2>Time is terrain.</h2><p>Advance departure time. The returnable frontier contracts when verified terrain data is available.</p>
          <div className="time-display"><strong>{remaining}</strong><span>min remaining</span></div>
          <div className="time-metrics"><div><span>Planning window</span><strong>{INITIAL_BUDGET} min</strong></div>
            <div><span>Elapsed</span><strong>+{elapsed} min</strong></div>
            <div><span>Held in reserve</span><strong>{RESERVE} min</strong></div></div>
          <div className="clock-actions"><Button label="Advance +15 min" variant="primary"
            onClick={() => setElapsed(v => Math.min(INITIAL_BUDGET, v + 15))}/>
            <Button label="Reset" onClick={() => setElapsed(0)}/></div>
          <p className="assumption-note">Exploratory scenario values, not certified EVA procedure.</p></section>
        <section className="assessment-panel"><div className="section-heading"><span>Return feasibility</span><span className="section-index">0.8× / 1× / 1.2×</span></div>
          {assessment ? <><h3 className={'assessment-state state-' + assessment.state.toLowerCase()}>{stateLabel(assessment.state)}</h3>
            <p className="context-note">{assessment.state === 'UNKNOWN' ? 'Data cannot support a conclusion.' :
              `Nominal margin: ${minutesText(assessment.nominalMarginMinutes)}. Hypothetical custom cell.`}</p>
            <div className="scenario-lines">{assessment.scenarios.map(s => <div key={s.factor}><span>{s.factor.toFixed(1)}×</span>
              <span>{minutesText(s.marginMinutes)}</span><span>{s.feasible === null ? 'Unknown' : s.feasible ? 'Feasible' : 'Over budget'}</span></div>)}</div>
          </> : <div className="assessment-pending"><strong>Decision awaiting evidence</strong><p>{verified
            ? 'Select a covered map cell to calculate a hypothetical round trip.'
            : 'Verified terrain and target data are required before numerical assessment.'}</p></div>}
        </section>
        <section className="rail-section right-bottom"><span className="eyebrow">Scope</span><p className="context-note">Research prototype. Regional DEMs do not resolve footstep hazards. Unknown terrain remains unknown.</p></section>
      </aside>
    </div>
    <footer className="site-footer"><span>SESHAT / 2026</span><span>Evidence before certainty.</span><span>Not NASA-endorsed or safety-certified</span></footer>
    {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)}>
      <aside className="evidence-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Evidence and method">
        <div className="drawer-top"><span className="eyebrow">Method / evidence</span><button onClick={() => setDrawerOpen(false)} aria-label="Close panel">×</button></div>
        <h2>We show what the data can support.</h2>
        <p>Source provenance is mandatory. Terrain routing cannot substitute for verified science targets or astronaut safety certification.</p>
        {([['Bundle',data.state],['Source',bundle?.manifest.sourceId ?? 'Not accepted'],['Model','terrain-scenario-v0'],
           ['Speed','0.75 m/s · assumption'],['Grade penalties','Uphill 4.0 · downhill 1.8'],['Science gate', verified ? 'Passed (bundle declaration)' : 'Pending']] as const)
          .map(([label,value]) => <div className="drawer-fact" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        {bundle?.manifest.sourceUrl && <p className="source-url">Source: <a href={bundle.manifest.sourceUrl} target="_blank" rel="noopener noreferrer">{bundle.manifest.sourceUrl}</a></p>}
        <p className="drawer-disclaimer">NASA data products are sources, not endorsements. Not flight qualified.</p>
      </aside></div>}
  </main>;
}

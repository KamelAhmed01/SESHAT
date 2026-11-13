'use client';

import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import type { FieldBundle } from '@/data/loader';
import { addResources, subtractResources, zeroResources } from '@/engine/consumables';
import { advanceMission, decideReplan, proposeReturn, recordEvent, remainingActivePlan, startMission } from '@/engine/lifecycle-store';
import type { MissionExecution } from '@/engine/lifecycle-store';
import { archiveMarkdown, createArchive, missionClock } from '@/engine/mission-archive';
import { canApprove, landingCell, landingId, previewMission, stopLimit, targetCell } from '@/engine/multi-leg-planner';
import type { MissionPlan, RoutePreference } from '@/engine/multi-leg-planner';
import { cellIndex } from '@/engine/traverse-graph';
import type { Cell } from '@/engine/traverse-graph';
import type { ScienceTarget } from '@/engine/types';
import scenario from '@/config/mission-scenario.json';
import { channelLabels, eventLabel, eventMeasurement, MissionEventRecorder, scenarioPoint } from './MissionEventRecorder';
import type { EventSubmission } from './MissionEventRecorder';
import { AnalysisDonutRings, marginText, MissionPlanPreview, nominalMargin, PlanComparison, TwinStatusCards } from './MissionPlanPreview';

const surfaceGallery = [
  {id: 'shuyak', shortName: 'Enchanted Lake', file: 'enchanted-lake.webp', label: 'Enchanted Lake · Cape Nukshak', caption: 'Enchanted Lake area · Perseverance Hazcam · NASA/JPL-Caltech'},
  {id: 'swift-run', shortName: 'Skinner Ridge', file: 'skinner-ridge.webp', label: 'Thornton Gap · Skinner Ridge', caption: 'Thornton Gap abrasion, Skinner Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
  {id: 'hazeltop', shortName: 'Wildcat Ridge', file: 'wildcat-ridge.webp', label: 'Berry Hollow · Wildcat Ridge', caption: 'Berry Hollow abrasion, Wildcat Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
] as const;

const photos: Record<string, {file: string; caption: string}> = {
  'swift-run': {file: 'skinner-ridge.webp', caption: 'Thornton Gap abrasion, Skinner Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
  hazeltop: {file: 'wildcat-ridge.webp', caption: 'Berry Hollow abrasion, Wildcat Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
  shuyak: {file: 'enchanted-lake.webp', caption: 'Enchanted Lake area · Perseverance Hazcam · NASA/JPL-Caltech'},
};

function download(filename: string, body: string, type: string) {
  const href = URL.createObjectURL(new Blob([body], {type}));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function SiteEvidence({stop}: {stop: ScienceTarget}) {
  const photo = photos[stop.id];
  return <details className="mission-disclosure site-evidence">
    <summary>Science &amp; provenance</summary>
    <p>{stop.science.summary}</p>
    <p>{stop.location.originalCoordinateText}</p>
    {photo && <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- local evidence images ship with the offline export */}
      <img loading="lazy" src={`/data/imagery/${photo.file}`} alt={photo.caption} />
      <figcaption>{photo.caption}</figcaption>
    </figure>}
    {stop.science.evidence.map(item => <p key={item.sourceId}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></p>)}
  </details>;
}

function SelectionPanel({
  catalog, selected, limit, origin, width, height, customCol, customRow,
  onCustomCol, onCustomRow, onAddCustomPoint, onMode, onAdd, onChange, onReorder, onResume,
}: {
  catalog: ScienceTarget[]; selected: ScienceTarget[]; limit: number;
  origin: Cell; width: number; height: number;
  customCol: string; customRow: string;
  onCustomCol: (v: string) => void; onCustomRow: (v: string) => void;
  onAddCustomPoint: () => void;
  onMode: (limit: number) => void; onAdd: (stop: ScienceTarget) => void;
  onChange: (stops: ScienceTarget[]) => void; onReorder: (index: number) => void;
  onResume: () => void;
}) {
  const lastTarget = selected.at(-1);
  return <>
    <section className="cc-panel-block cc-panel-compact">
      <div className="cc-panel-header">
        <div>
          <h1>Plan a science traverse</h1>
          <p className="context-note cc-sub-note">Compare Jezero western fan exposures and return safely.</p>
        </div>
        <div className="cc-header-controls">
          <div className="mission-actions" role="group" aria-label="Destination mode">
            <button type="button" aria-pressed={limit === 1} onClick={() => onMode(1)}>Single</button>
            <button type="button" aria-pressed={limit > 1} onClick={() => onMode(stopLimit)}>Multiple</button>
          </div>
          <Button label="Resume saved mission" onClick={onResume}/>
        </div>
      </div>

      <div className="cc-coords-grid">
        <div className="cc-coord-group">
          <span className="cc-coord-label">Enter first point (Landing origin):</span>
          <div className="cc-coord-pair">
            <div className="cc-coord-box"><span>X:</span><strong>{origin[1]}</strong><small>col</small></div>
            <div className="cc-coord-box"><span>Y:</span><strong>{origin[0]}</strong><small>row</small></div>
          </div>
        </div>

        <div className="cc-coord-group">
          <span className="cc-coord-label">
            {lastTarget ? `Next point (${lastTarget.name}):` : 'Enter second point (click map or cell):'}
          </span>
          <div className="cc-coord-pair cc-coord-input-row">
            <label className="cc-coord-input">
              <span>X:</span>
              <input type="number" min={0} max={width - 1} value={customCol}
                onChange={e => onCustomCol(e.target.value)} aria-label="Target column X" />
            </label>
            <label className="cc-coord-input">
              <span>Y:</span>
              <input type="number" min={0} max={height - 1} value={customRow}
                onChange={e => onCustomRow(e.target.value)} aria-label="Target row Y" />
            </label>
            <button type="button" className="cc-plus-btn" onClick={onAddCustomPoint}
              aria-label="Add custom coordinate point" title="Add cell to traverse">+</button>
          </div>
          <span className="cc-choose-hint">Choose on map · click any valid 20 m terrain cell</span>
        </div>
      </div>
    </section>

    <section className="cc-panel-block cc-panel-compact">
      <div className="section-heading">
        <h2>Stop priorities</h2>
        <span className="section-index">{selected.length} / {limit}</span>
      </div>
      {selected.length === 0 ? (
        <p className="context-note">Top priority stays first if a stop is deferred. Select a site below or click the map.</p>
      ) : (
        <ol className="mission-stop-list">
          {selected.map((stop, index) => <li key={stop.id}>
            <div><strong>{stop.name}</strong><button type="button" aria-label={`Remove ${stop.name}`}
              onClick={() => onChange(selected.filter(item => item.id !== stop.id))}>×</button></div>
            <div><label>Activity (min)<input type="number" min="0" max="120" value={stop.activity.minutes}
              onChange={event => onChange(selected.map(item => item.id === stop.id ? {...stop,
                activity: {...stop.activity, minutes: Math.max(0, Math.min(120, Number(event.target.value)))}} : item))} /></label>
              {index > 0 && <button type="button" aria-label={`Raise priority of ${stop.name}`} onClick={() => onReorder(index)}>↑ Priority</button>}</div>
          </li>)}
        </ol>
      )}
    </section>

    <section className="cc-panel-block cc-panel-compact mission-catalog">
      <h2>Science sites</h2>
      {catalog.length === 0 && <p className="context-note">No documented targets match the current filter.</p>}
      <div className="cc-catalog-grid">
        {catalog.map(stop => <div key={stop.id} className="cc-catalog-item">
          <Button label={`Add ${stop.name}`} onClick={() => onAdd(stop)}
            isDisabled={!targetCell(stop) || selected.some(item => item.id === stop.id) || (limit > 1 && selected.length >= limit)} />
          <SiteEvidence stop={stop}/>
        </div>)}
      </div>
    </section>
  </>;
}

function ExecutionPanel({mission, onEvent, selected}: {
  mission: MissionExecution;
  onEvent: (entry: EventSubmission) => void; selected: Cell | null;
}) {
  const leg = mission.active.legs[mission.legIndex];
  const complete = mission.status === 'COMPLETED';
  const remaining = mission.active.stops.filter(stop => !mission.completed.includes(stop.id) &&
    !mission.events.some(event => event.category === 'DESTINATION_ACCESSIBILITY_CHANGE' && event.targetId === stop.id));
  const baselineIndex = complete ? mission.baseline.legs.length - 1
    : mission.baseline.legs.findIndex(item => item.targetId === mission.completed.at(-1));
  const baselineClock = mission.baseline.legs[baselineIndex]?.leave;
  const baselineResources = baselineIndex < 0 ? null
    : mission.baseline.legs.slice(0, baselineIndex + 1).reduce((total, item) => addResources(total, item.used), zeroResources);
  const completedStopName = (id: string) => {
    const baseline = mission.baseline.stops.find(stop => stop.id === id);
    const discovered = mission.events.find(event => event.category === 'NEW_SCIENTIFIC_DISCOVERY' && event.target.id === id);
    return baseline?.name ?? (discovered?.category === 'NEW_SCIENTIFIC_DISCOVERY' ? discovered.target.name : id);
  };
  return <>
    <section className="cc-panel-block cc-panel-compact">
      <h1>{complete ? 'Returned to landing site' : 'Execute the approved plan'}</h1>
      <div className="cc-coord-pair cc-exec-coords">
        <div className="cc-coord-box"><span>X:</span><strong>{mission.position[1]}</strong><small>col</small></div>
        <div className="cc-coord-box"><span>Y:</span><strong>{mission.position[0]}</strong><small>row</small></div>
      </div>
      <p className="context-note">Simulated position ({mission.position.join(', ')}) · {missionClock(mission.spent.minutes)} · {mission.spent.oxygen.toFixed(1)} L O₂ · {mission.spent.energy.toFixed(1)} Wh</p>
      {baselineClock !== undefined && baselineResources && <p className="context-note">Baseline at {complete ? 'return' : 'latest completed stop'} · {missionClock(baselineClock)} · {baselineResources.oxygen.toFixed(1)} L O₂ · {baselineResources.energy.toFixed(1)} Wh</p>}
      {leg && <p className="cc-next-leg">Next waypoint: <strong>{leg.to}</strong></p>}
    </section>

    <section className="cc-panel-block cc-panel-compact">
      <h2>Mission history</h2>
      <p className="context-note" role="status">{complete ? 'Returned · archive ready'
        : mission.status === 'REVIEW' ? 'Event analyzed · revised plan awaiting approval'
        : mission.status === 'HOLD' ? 'Holding · record a new event or review direct return'
        : mission.decisions.length ? 'Continuing on the approved revision' : 'Baseline approved · tracking progress'}</p>
      <ol className="mission-history">
        {mission.completed.map(id => <li key={id}>✓ {completedStopName(id)}</li>)}
        {mission.events.map(event => <li key={event.id}>{missionClock(event.minute)} · {eventLabel(event.category)}
          <small>{channelLabels[event.channel]} · {eventMeasurement(event)} · ({event.cell.join(', ')})
            {event.description && ` · ${event.description}`}</small></li>)}
        {mission.decisions.map((decision, i) => <li key={i}>{missionClock(decision.minute)} · Revision {decision.kind}</li>)}
      </ol>
      {!mission.completed.length && !mission.events.length && <p className="context-note">Baseline locked. Use the map HUD controls to advance along the leg.</p>}
    </section>

    {!complete && <details className="mission-disclosure cc-event-disclosure" open={mission.status !== 'REVIEW'}>
      <summary>Record an event</summary>
      <MissionEventRecorder position={mission.position} selected={selected} remaining={remaining}
        nextEvent={mission.events.length + 1} onRecord={onEvent} />
    </details>}
  </>;
}

function ChangeReview({execution, baselineRemaining, onDecision, returnPlan}: {
  execution: MissionExecution; baselineRemaining: MissionPlan; returnPlan: MissionPlan | null;
  onDecision: (plan: MissionPlan, decision: 'approved' | 'held' | 'abort') => void;
}) {
  const proposed = execution.proposal;
  if (!proposed) return null;
  const omitted = baselineRemaining.stops.filter(stop => !proposed.stops.some(candidate => candidate.id === stop.id));
  const previousMargin = nominalMargin(baselineRemaining), proposedMargin = nominalMargin(proposed);
  const delta = previousMargin && proposedMargin && subtractResources(proposedMargin, previousMargin);
  const added = proposed.stops.filter(stop => !baselineRemaining.stops.some(prior => prior.id === stop.id));
  const shortened = proposed.stops.filter(stop => baselineRemaining.stops.some(prior =>
    prior.id === stop.id && prior.activity.minutes > stop.activity.minutes));
  return <section className="mission-review" aria-label="Replan review">
    <h2>{execution.status === 'HOLD' ? 'Holding position' : 'Review the revised plan'}</h2>
    <PlanComparison previous={baselineRemaining} proposed={proposed} label="Previous remaining plan" />
    {omitted.length > 0 && <p>Deferred: {omitted.map(stop => stop.name).join(', ')}.</p>}
    {added.length > 0 && <p>Added: {added.map(stop => stop.name).join(', ')}.</p>}
    {delta && <p>Reserve margin change: {marginText(delta)}.</p>}
    {shortened.length > 0 && <p>Shortened activity: {shortened.map(stop => stop.name).join(', ')}.</p>}
    {!canApprove(proposed) && <p role="status">Approval requires all three reserves at every modeled speed.</p>}
    <div className="mission-buttons">
      {execution.status === 'REVIEW' && <>
        <Button label="Approve revision & continue" variant="primary" isDisabled={!canApprove(proposed)}
          onClick={() => onDecision(proposed, 'approved')} />
        <Button label="Hold position" onClick={() => onDecision(proposed, 'held')} />
      </>}
      {returnPlan && <Button label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
        isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'} onClick={() => onDecision(returnPlan, 'abort')} />}
    </div>
  </section>;
}

export function MissionLifecycle({bundle}: {bundle: FieldBundle}) {
  const [selected, setSelected] = useState<ScienceTarget[]>([]);
  const [limit, setLimit] = useState(stopLimit);
  const [preference, setPreference] = useState<RoutePreference>('fastest');
  const [useAlternative, setUseAlternative] = useState<'primary' | 'subset' | 'priority' | 'lowerSlope'>('primary');
  const [execution, setExecution] = useState<MissionExecution | null>(null);
  const [mapSelection, setMapSelection] = useState<Cell | null>(null);
  const [optical, setOptical] = useState(false);
  const [notice, setNotice] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [siteQuery, setSiteQuery] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [cameraMode, setCameraMode] = useState<'surface' | 'profile'>('surface');
  const [cameraZoom, setCameraZoom] = useState(1);
  const [mapExpanded, setMapExpanded] = useState(false);

  const {manifest} = bundle;
  const origin = useMemo(() => landingCell(bundle), [bundle]);
  const [customCol, setCustomCol] = useState(String(origin[1]));
  const [customRow, setCustomRow] = useState(String(origin[0]));

  const planning = useMemo(() => {
    if (execution || !selected.length) return null;
    const input = {bundle, origin, stops: selected, spent: zeroResources, routePreference: preference};
    return {primary: previewMission(input), lowerSlope: selected.length === 1 ? previewMission({...input, routePreference: 'lowerSlope'}) : null};
  }, [bundle, execution, origin, preference, selected]);

  const primary = planning?.primary.optimized;
  const plan = execution?.proposal ?? execution?.active ?? (useAlternative === 'subset' ? planning?.primary.subset : undefined)
    ?? (useAlternative === 'priority' ? planning?.primary.priority : undefined)
    ?? (useAlternative === 'lowerSlope' ? planning?.lowerSlope?.optimized : undefined) ?? primary;
  const returnPlan = useMemo(() => execution && execution.status !== 'COMPLETED'
    ? proposeReturn(execution, bundle) : null, [bundle, execution]);
  const previous = useMemo(() => execution && remainingActivePlan(execution, bundle), [bundle, execution]);
  const currentPlan = execution && !execution.proposal && previous ? previous : plan;
  const displayed = currentPlan?.legs;
  const overlay = useMemo(() => ({planned: displayed ?? [], previous: execution?.proposal ? previous?.legs : undefined,
    traveled: execution?.travels, hazards: execution?.hazards, position: execution?.position, selected: mapSelection}),
  [displayed, execution, previous, mapSelection]);
  const storageKey = `seshat-execution-v1:${manifest.sourceFileSha256 ?? manifest.sourceId}:${manifest.baseIndex}`;

  const totalDistanceMeters = useMemo(() => {
    if (!currentPlan) return 0;
    return currentPlan.legs.reduce((sum, leg) => sum + (Number.isFinite(leg.terrain.distance) ? leg.terrain.distance : 0), 0);
  }, [currentPlan]);

  const filteredCatalog = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    const list = manifest.scienceTargets ?? [];
    if (!q) return list;
    return list.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.science.summary.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q));
  }, [manifest.scienceTargets, siteQuery]);

  const activePhoto = surfaceGallery[photoIndex % surfaceGallery.length];
  const activeExecutionLeg = execution ? execution.active.legs[execution.legIndex] : undefined;
  const profileLeg = currentPlan?.legs[0];

  useEffect(() => {
    if (!execution) return;
    try { localStorage.setItem(storageKey, JSON.stringify(execution)); }
    catch (error) { console.warn('Mission history could not be saved on this browser.', error); }
  }, [execution, storageKey]);

  function resumeMission() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as MissionExecution | null;
      if (!saved?.baseline || !saved.active || !Array.isArray(saved.events) || !Array.isArray(saved.position)) {
        return setNotice('There is no saved mission for this terrain bundle.');
      }
      setExecution(saved);
      setNotice('');
    } catch {
      setNotice('The saved mission could not be read.');
    }
  }

  function changeStops(stops: ScienceTarget[]) {
    setSelected(stops);
    setUseAlternative('primary');
    setNotice('');
    const last = stops.at(-1);
    if (last && last.location.gridCol !== null && last.location.gridRow !== null) {
      setCustomCol(String(last.location.gridCol));
      setCustomRow(String(last.location.gridRow));
      const matchedIdx = surfaceGallery.findIndex(item => item.id === last.id);
      if (matchedIdx >= 0) setPhotoIndex(matchedIdx);
    }
  }

  function addStop(stop: ScienceTarget) {
    if (selected.some(item => item.id === stop.id)) return;
    if (limit === 1) return changeStops([stop]);
    if (selected.length >= limit) return setNotice('Remove a stop before adding another. Four stops is the planning limit.');
    changeStops([...selected, stop]);
  }

  function selectCell(row: number, col: number) {
    const point: Cell = [row, col];
    setCustomCol(String(col));
    setCustomRow(String(row));
    if (execution) return setMapSelection(point);
    const index = cellIndex(point, bundle);
    if (bundle.mask[index] !== 1 || index === manifest.baseIndex) return setNotice('Choose a covered terrain cell away from the landing site.');
    const documented = manifest.scienceTargets?.find(stop => stop.location.gridRow === row && stop.location.gridCol === col);
    addStop(documented ?? scenarioPoint(point, `Custom point (${row}, ${col})`));
  }

  function addManualCell() {
    const row = Number(customRow);
    const col = Number(customCol);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= manifest.height || col < 0 || col >= manifest.width) {
      return setNotice(`Coordinates must be integers within 0–${manifest.width - 1} (X) and 0–${manifest.height - 1} (Y).`);
    }
    selectCell(row, col);
  }

  function exportPlan(format: 'json' | 'md') {
    if (!plan) return;
    const archive = createArchive(execution?.baseline ?? plan, manifest, execution ?? undefined);
    download(`seshat-${execution?.status === 'COMPLETED' ? 'mission-archive' : 'baseline'}.${format}`,
      format === 'json' ? JSON.stringify(archive, null, 2) : archiveMarkdown(archive),
      format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8');
  }

  return (
    <div className="cc-backdrop">
      <main className="workbench lifecycle cc-shell">
        <aside className="cc-sidebar" aria-label="Command navigation">
          <div className="cc-brand">
            <div className="cc-logo-ring" aria-hidden="true">S</div>
            <div className="brand-text">
              <strong>SESHAT</strong>
              <span>MARS SURFACE SCIENCE</span>
            </div>
          </div>

          <nav className="cc-nav" aria-label="Workspace sections">
            <button type="button" className="cc-nav-item" onClick={() => { setSiteQuery(''); setMapExpanded(false); }}>
              <span className="cc-nav-icon" aria-hidden="true">⌂</span>
              <span>Overview</span>
            </button>
            <Link href="/?opportunities=1" className="cc-nav-item" prefetch={false}>
              <span className="cc-nav-icon" aria-hidden="true">◫</span>
              <span>Opportunity frontier</span>
            </Link>
            <button type="button" className="cc-nav-item cc-nav-active" aria-current="page">
              <span className="cc-nav-icon" aria-hidden="true">⌖</span>
              <span>Command center</span>
            </button>
          </nav>

          <div className="cc-sidebar-bottom">
            <button type="button" className="cc-nav-item" onClick={() => setShowSources(value => !value)} aria-expanded={showSources}>
              <span className="cc-nav-icon" aria-hidden="true">⚙</span>
              <span>Data &amp; assumptions</span>
            </button>
            <Link href="/?demo=1" className="cc-nav-item" prefetch={false}>
              <span className="cc-nav-icon" aria-hidden="true">◈</span>
              <span>Synthetic test scene</span>
            </Link>

            <div className="cc-help-card">
              <div className="cc-help-title">
                <span className="cc-help-badge" aria-hidden="true">?</span>
                <strong>Need help?</strong>
              </div>
              <p>Inspect NASA CTX sources &amp; scenario assumptions</p>
              <button type="button" className="cc-help-btn" onClick={() => setShowSources(true)}>
                Documentation
              </button>
              <div className="cc-mars-orb" aria-hidden="true" />
            </div>
          </div>
        </aside>

        <div className="cc-workspace">
          <header className="mission-header cc-topbar">
            <div className="cc-title-block">
              <span className="cc-main-title">Command Center</span>
              <span className="cc-subtitle">
                Jezero Western Fan · {manifest.status === 'VERIFIED' ? 'Team-reviewed Mars terrain' : 'Real Mars terrain · review pending'}
              </span>
            </div>

            <nav className="mission-phases" aria-label="Mission phase">
              <span aria-current={!execution ? 'step' : undefined}>Plan</span>
              <span aria-current={execution?.status === 'EXECUTING' ? 'step' : undefined}>Execute</span>
              <span aria-current={execution && execution.status !== 'EXECUTING' ? 'step' : undefined}>Adapt &amp; return</span>
            </nav>

            <div className="header-right cc-topbar-right">
              <label className="cc-search-wrap">
                <span className="cc-search-icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={siteQuery}
                  onChange={e => setSiteQuery(e.target.value)}
                  placeholder="Search Jezero sites…"
                  aria-label="Search Jezero sites"
                />
              </label>
              <button
                type="button"
                className="cc-bell-btn"
                onClick={() => setShowSources(value => !value)}
                aria-label="Toggle data provenance notice"
                aria-expanded={showSources}
              >
                <span aria-hidden="true">◔</span>
                <i className="cc-bell-dot" aria-hidden="true" />
              </button>
              <div className="cc-user-pill">
                <span className="cc-avatar" aria-hidden="true">M2</span>
                <div>
                  <strong>Jezero Ops</strong>
                  <small>Planetary Scientist</small>
                </div>
              </div>
            </div>
          </header>

          {showSources && <section className="mission-source-strip" aria-label="Data and assumptions">
            <p><strong>Research prototype.</strong> Orbital terrain, imagery and published rover observations are historical. All mobility and consumable parameters are scenario assumptions.</p>
            <p><a href={manifest.sourceUrl}>CTX terrain</a> · {manifest.optical && <><a href={manifest.optical.sourceUrl}>CTX orbital mosaic</a> · </>}
              <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/">Perseverance raw imagery</a> · <a href="https://trek.nasa.gov/mars/">NASA Mars Trek</a></p>
            <p>{Object.values(scenario.environmentalContext).join(' ')}</p>
          </section>}

          <div className={`content-grid lifecycle-grid cc-bento${mapExpanded ? ' cc-bento-map-expanded' : ''}`}>
            <div className="cc-col-left">
              <section className="cc-card cc-map-card map-stage" aria-label="Planetary terrain map">
                <div className="map-topline cc-map-header">
                  <div className="cc-map-title-group">
                    <span className="map-title">Topographic map</span>
                    <span className="cc-map-sub">{manifest.width}×{manifest.height} · 20 m local Mars AEQD</span>
                  </div>
                  <div className="cc-map-controls-top">
                    {manifest.optical && <div className="map-layer-switch" role="group" aria-label="Surface layer">
                      <button type="button" aria-pressed={!optical} onClick={() => setOptical(false)}>Terrain</button>
                      <button type="button" aria-pressed={optical} onClick={() => setOptical(true)}>Orbital</button>
                    </div>}
                    <span className="map-north" aria-hidden="true">↑ N</span>
                    <button
                      type="button"
                      className="cc-expand-btn"
                      onClick={() => setMapExpanded(v => !v)}
                      aria-label={mapExpanded ? 'Restore map size' : 'Expand map'}
                    >
                      {mapExpanded ? '↙' : '⤢'}
                    </button>
                  </div>
                </div>

                <LeafletGrid
                  bundle={bundle}
                  selectedCell={null}
                  onCellSelect={selectCell}
                  elapsedMinutes={0}
                  missionBudgetMinutes={scenario.timeBudgetMinutes}
                  reserveMinutes={scenario.reserveMinutes}
                  showOptical={optical}
                  mission={overlay}
                />

                <div className="cc-map-hud">
                  <div className="cc-hud-cta">
                    {!execution && (
                      <Button
                        label="Approve & lock baseline plan"
                        variant="primary"
                        isDisabled={!plan || !canApprove(plan)}
                        onClick={() => plan && setExecution(startMission(plan, selected, limit))}
                      />
                    )}
                    {execution && execution.status !== 'COMPLETED' && (
                      <>
                        <Button
                          label="Move along active leg"
                          onClick={() => {setExecution(current => current && advanceMission(current, bundle, 'part')); setMapSelection(null);}}
                          isDisabled={execution.status !== 'EXECUTING' || execution.cursor >= (activeExecutionLeg?.route.geometryGrid.length ?? 1) - 1}
                        />
                        <Button
                          label={activeExecutionLeg?.targetId === landingId ? 'Return to Landing Site' : 'Complete next stop'}
                          variant="primary"
                          onClick={() => {setExecution(current => current && advanceMission(current, bundle, 'finish')); setMapSelection(null);}}
                          isDisabled={execution.status !== 'EXECUTING'}
                        />
                      </>
                    )}
                  </div>
                  <div className="cc-hud-metrics">
                    <div className="cc-hud-pill">
                      <small>Distance:</small>
                      <strong>{totalDistanceMeters >= 1000 ? `${(totalDistanceMeters / 1000).toFixed(2)} km` : `${Math.round(totalDistanceMeters)} m`}</strong>
                    </div>
                    <div className="cc-hud-pill">
                      <small>Time:</small>
                      <strong>{currentPlan?.used?.minutes != null ? `${Math.round(currentPlan.used.minutes)} min` : '0 min'}</strong>
                    </div>
                  </div>
                </div>

                <div className="lifecycle-map-key">
                  <span>● Scenario landing site</span>
                  <span>● Contingency stop</span>
                  {execution?.proposal && <span>┄ Previous route</span>}
                  <span>20 m analysis cells</span>
                </div>
              </section>

              <section className="cc-card cc-camera-card" aria-label="Surface camera and elevation view">
                <div className="cc-camera-header">
                  <div>
                    <span className="cc-camera-title">Camera view</span>
                    <span className="cc-camera-sub">{activePhoto.label}</span>
                  </div>
                  <button
                    type="button"
                    className="cc-expand-btn"
                    onClick={() => setCameraZoom(z => (z > 1.05 ? 1 : 1.35))}
                    aria-label={cameraZoom > 1.05 ? 'Reset camera zoom' : 'Zoom camera view'}
                  >
                    ⤢
                  </button>
                </div>

                {cameraMode === 'surface' ? (
                  <div className="cc-camera-stage">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local Perseverance surface imagery ships with the offline export */}
                    <img
                      src={`/data/imagery/${activePhoto.file}`}
                      alt={activePhoto.caption}
                      className="cc-camera-img"
                      style={{transform: `scale(${cameraZoom})`}}
                    />
                    <div className="cc-camera-scrim" aria-hidden="true" />
                    <span className="cc-camera-caption">{activePhoto.caption}</span>
                  </div>
                ) : (
                  <div className="cc-camera-profile-stage">
                    {profileLeg?.route.status === 'READY' ? (
                      <ElevationProfile
                        route={profileLeg.route}
                        cellWidthMeters={manifest.cellWidthMeters}
                        cellHeightMeters={manifest.cellHeightMeters}
                        label={`Leg 1 · ${profileLeg.to}`}
                      />
                    ) : (
                      <p className="context-note">Select a science destination to inspect its modeled CTX elevation profile.</p>
                    )}
                  </div>
                )}

                <div className="cc-camera-controls">
                  <div className="cc-cam-pill">
                    <button type="button" onClick={() => setPhotoIndex(i => (i - 1 + surfaceGallery.length) % surfaceGallery.length)} aria-label="Previous surface site">←</button>
                    <span>{activePhoto.shortName}</span>
                    <button type="button" onClick={() => setPhotoIndex(i => (i + 1) % surfaceGallery.length)} aria-label="Next surface site">→</button>
                  </div>
                  <div className="cc-cam-pill">
                    <button type="button" aria-pressed={cameraMode === 'surface'} onClick={() => setCameraMode('surface')}>↓ Surface</button>
                    <button type="button" aria-pressed={cameraMode === 'profile'} onClick={() => setCameraMode('profile')}>Profile ↑</button>
                  </div>
                  <div className="cc-cam-pill">
                    <button type="button" onClick={() => setCameraZoom(z => Math.max(1, +(z - 0.35).toFixed(2)))} aria-label="Zoom out camera">−</button>
                    <span>Zoom</span>
                    <button type="button" onClick={() => setCameraZoom(z => Math.min(2.05, +(z + 0.35).toFixed(2)))} aria-label="Zoom in camera">+</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="cc-col-right">
              <aside className="cc-card cc-command-card left-rail" aria-label={execution ? 'Mission execution' : 'Mission planning'}>
                {execution ? (
                  <ExecutionPanel
                    mission={execution}
                    selected={mapSelection}
                    onEvent={entry => {setExecution(recordEvent(execution, bundle, entry)); setMapSelection(null);}}
                  />
                ) : (
                  <SelectionPanel
                    catalog={filteredCatalog}
                    selected={selected}
                    limit={limit}
                    origin={origin}
                    width={manifest.width}
                    height={manifest.height}
                    customCol={customCol}
                    customRow={customRow}
                    onCustomCol={setCustomCol}
                    onCustomRow={setCustomRow}
                    onAddCustomPoint={addManualCell}
                    onMode={newLimit => {setLimit(newLimit); changeStops(selected.slice(0, newLimit));}}
                    onAdd={addStop}
                    onChange={changeStops}
                    onReorder={index => {
                      const ordered = [...selected];
                      [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
                      changeStops(ordered);
                    }}
                    onResume={resumeMission}
                  />
                )}
                {notice && <p role="status" className="mission-error">{notice}</p>}
              </aside>

              <TwinStatusCards plan={currentPlan} spent={execution?.spent ?? zeroResources} />

              <aside className="cc-card cc-analysis-card right-rail" aria-label="Mission preview">
                {execution?.proposal && previous && (
                  <ChangeReview
                    execution={execution}
                    baselineRemaining={previous}
                    returnPlan={returnPlan}
                    onDecision={(updated, decision) => setExecution(decideReplan(execution, updated, decision))}
                  />
                )}

                <div className="cc-panel-header">
                  <h2>{execution?.status === 'COMPLETED' ? 'Mission complete' : execution ? 'Mission status' : 'Mission preview'}</h2>
                  {!execution && selected.length > 1 && (
                    <label className="mission-field cc-inline-select">
                      <span>Route preference</span>
                      <select value={preference} onChange={event => {setPreference(event.target.value as RoutePreference); setUseAlternative('primary');}}>
                        <option value="fastest">Minimum travel time</option>
                        <option value="lowerSlope">Prefer gentler terrain</option>
                      </select>
                    </label>
                  )}
                </div>

                {returnPlan && <p className="context-note cc-sub-note">Direct return margin at 1× · {marginText(nominalMargin(returnPlan))}</p>}

                <AnalysisDonutRings bundle={bundle} plan={currentPlan} spent={execution?.spent ?? zeroResources} />

                {currentPlan ? (
                  <MissionPlanPreview
                    plan={currentPlan}
                    spent={execution?.spent ?? zeroResources}
                    manifest={manifest}
                    label={execution?.proposal ? 'Proposed remaining route' : execution ? 'Approved route' : 'Selected plan'}
                  />
                ) : (
                  <p className="context-note">Select a destination to preview the round trip, return reserves, and leg telemetry.</p>
                )}

                {!execution && plan && plan.deferred.length > 0 && (
                  <p className="context-note">
                    Deferred from this option: {plan.deferred.map(stop => stop.name).join(', ')}.
                  </p>
                )}

                {!execution && primary && (
                  <div className="mission-alternatives">
                    <Button label="Show optimized order" onClick={() => setUseAlternative('primary')} />
                    {planning?.primary.subset && <Button label="Show feasible subset" onClick={() => setUseAlternative('subset')} />}
                    {planning?.lowerSlope && <Button label="Show lower-slope option" onClick={() => setUseAlternative('lowerSlope')} />}
                    {selected.length > 1 && planning && (
                      <PlanComparison
                        previous={planning.primary.priority}
                        proposed={primary}
                        label="Astronaut priority order"
                        action="Use priority order"
                        onChoose={() => setUseAlternative('priority')}
                      />
                    )}
                  </div>
                )}

                {plan && (
                  <div className="mission-buttons mission-export">
                    {!execution && !canApprove(plan) && (
                      <p className="context-note">Approval requires all three reserves at every modeled speed.</p>
                    )}
                    {execution && (
                      <>
                        <Button label="Download JSON" onClick={() => exportPlan('json')} />
                        <Button label="Download Markdown" onClick={() => exportPlan('md')} />
                        <Button label="Print plan" onClick={() => window.print()} />
                      </>
                    )}
                    {execution?.status === 'COMPLETED' && (
                      <Button label="Plan another mission" onClick={() => {
                        setExecution(null); changeStops([]); setMapSelection(null);
                      }} />
                    )}
                  </div>
                )}
              </aside>
            </div>
          </div>

          <footer className="site-footer">
            <span>SESHAT / SPACE APPS 2026</span>
            <span>Research prototype · not safety-certified</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

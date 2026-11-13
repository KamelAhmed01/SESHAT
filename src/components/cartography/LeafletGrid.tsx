'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldBundle } from '@/data/loader';
import { gridToViewer, viewerToGrid } from '@/cartography/coordinates';
import { frontierMembership } from '@/engine/frontier';
import { landingId } from '@/engine/multi-leg-planner';
import type { MissionLeg } from '@/engine/multi-leg-planner';
import type { TravelRecord } from '@/engine/lifecycle-store';
import type { Cell, HazardZone } from '@/engine/traverse-graph';
import type { RouteSummary } from '@/engine/types';
import type { OpportunityEntry } from '@/engine/opportunity-ledger';
import { targetMarkers } from '@/cartography/target-markers';

interface Props {
  bundle: FieldBundle | null;
  onCellSelect: (row: number, col: number) => void;
  selectedCell: [number, number] | null;
  elapsedMinutes: number;
  missionBudgetMinutes: number;
  reserveMinutes: number;
  outboundRoute?: RouteSummary | null;
  returnRoute?: RouteSummary | null;
  showOptical?: boolean;
  opportunities?: readonly OpportunityEntry[];
  mission?: {
    planned: readonly MissionLeg[];
    previous?: readonly MissionLeg[];
    traveled?: readonly TravelRecord[];
    hazards?: readonly HazardZone[];
    position?: Cell;
    selected?: Cell | null;
  };
}

function contourOverlayPng(bundle: FieldBundle): string {
  const { width: w, height: h } = bundle.manifest;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const z = bundle.elevationMeters;
  const mask = bundle.mask;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 1 && Number.isFinite(z[i])) {
      if (z[i] < minZ) minZ = z[i];
      if (z[i] > maxZ) maxZ = z[i];
    }
  }
  if (!Number.isFinite(minZ) || maxZ - minZ < 1) return '';

  const rawStep = (maxZ - minZ) / 14;
  const step = Math.max(5, Math.round(rawStep / 5) * 5);
  const startLevel = Math.ceil(minZ / step) * step;

  let levelIndex = 0;
  for (let level = startLevel; level < maxZ; level += step, levelIndex++) {
    const isMajor = levelIndex % 4 === 0;
    ctx.beginPath();
    ctx.strokeStyle = isMajor ? 'rgba(243, 168, 51, 0.34)' : 'rgba(245, 240, 235, 0.16)';
    ctx.lineWidth = isMajor ? 1.3 : 0.85;

    for (let r = 0; r < h - 1; r++) {
      for (let c = 0; c < w - 1; c++) {
        const i0 = r * w + c;
        const i1 = i0 + 1;
        const i2 = i0 + w + 1;
        const i3 = i0 + w;
        if (mask[i0] !== 1 || mask[i1] !== 1 || mask[i2] !== 1 || mask[i3] !== 1) continue;
        const v0 = z[i0], v1 = z[i1], v2 = z[i2], v3 = z[i3];
        if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue;

        const b0 = v0 >= level ? 1 : 0;
        const b1 = v1 >= level ? 1 : 0;
        const b2 = v2 >= level ? 1 : 0;
        const b3 = v3 >= level ? 1 : 0;
        if (b0 === b1 && b1 === b2 && b2 === b3) continue;

        const x0 = (c + 0.5) * scale;
        const x1 = (c + 1.5) * scale;
        const y0 = (r + 0.5) * scale;
        const y1 = (r + 1.5) * scale;
        const pts: [number, number][] = [];
        if (b0 !== b1) pts.push([x0 + ((level - v0) / (v1 - v0)) * scale, y0]);
        if (b1 !== b2) pts.push([x1, y0 + ((level - v1) / (v2 - v1)) * scale]);
        if (b2 !== b3) pts.push([x1 - ((level - v2) / (v3 - v2)) * scale, y1]);
        if (b3 !== b0) pts.push([x0, y1 - ((level - v3) / (v0 - v3)) * scale]);

        if (pts.length >= 2) {
          ctx.moveTo(pts[0][0], pts[0][1]);
          ctx.lineTo(pts[1][0], pts[1][1]);
          if (pts.length === 4) {
            ctx.moveTo(pts[2][0], pts[2][1]);
            ctx.lineTo(pts[3][0], pts[3][1]);
          }
        }
      }
    }
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

function frontierPng(bundle: FieldBundle, elapsed: number, budget: number, reserve: number): string {
  const m = bundle.manifest;
  const canvas = document.createElement('canvas');
  canvas.width = m.width; canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const image = ctx.createImageData(m.width, m.height);
  const membership = frontierMembership(bundle.outboundMinutes, bundle.returnMinutes, bundle.mask, elapsed, budget, reserve);
  for (let i = 0; i < m.width * m.height; i++) {
    const included = membership[i] === 1;
    const off = i * 4;
    image.data[off] = 229; image.data[off + 1] = 178; image.data[off + 2] = 92;
    image.data[off + 3] = included ? 52 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function LeafletGrid({ bundle, selectedCell, onCellSelect,
  elapsedMinutes, missionBudgetMinutes, reserveMinutes, outboundRoute, returnRoute,
  showOptical = false, opportunities = [], mission }: Props) {
  const isMissionMap = mission !== undefined;
  const element = useRef<HTMLDivElement>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const backgroundOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const contourOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const selectionLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const frontierRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const routeLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const onSelectRef = useRef(onCellSelect);
  useEffect(() => { onSelectRef.current = onCellSelect; }, [onCellSelect]);

  useEffect(() => {
    if (!element.current) return;
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !element.current || mapRef.current) return;
      const h = bundle?.manifest.height ?? 120;
      const w = bundle?.manifest.width ?? 160;
      const bounds = L.latLngBounds([[0, 0], [h, w]]);
      const map = L.map(element.current, {
        crs: L.CRS.Simple,
        zoomControl: false, attributionControl: false,
        zoomSnap: 0.25, zoomDelta: 0.5, minZoom: -5,
        maxZoom: 4, maxBoundsViscosity: 0.7,
      });
      L.control.zoom({position: 'bottomright'}).addTo(map);
      map.fitBounds(bounds, { padding: [26, 26], animate: false });
      map.setMaxBounds(bounds.pad(0.35));
      L.rectangle(bounds, { color: '#453e38', weight: 1, fillColor: '#181512', fillOpacity: 0.04, dashArray: '4 6' }).addTo(map);
      if (bundle) {
        const overlay = L.imageOverlay(bundle.assetRoot + '/' + bundle.manifest.imagery.path, bounds, { opacity: 0.88 });
        overlay.addTo(map);
        backgroundOverlayRef.current = overlay;
        overlay.getElement()?.setAttribute('alt', 'DEM-derived shaded relief; not orbital photography');

        const contourUrl = contourOverlayPng(bundle);
        if (contourUrl) {
          contourOverlayRef.current = L.imageOverlay(contourUrl, bounds, { opacity: 0.9, interactive: false }).addTo(map);
        }
      } else {
        // The grid is a UI wiring scaffold ONLY, not a depiction of Martian terrain.
        for (let x = 0; x <= w; x += 20) L.polyline([[0, x], [h, x]], { color: '#3c3732', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
        for (let y = 0; y <= h; y += 20) L.polyline([[y, 0], [y, w]], { color: '#3c3732', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
      }
      const selection = L.layerGroup().addTo(map);
      selectionLayerRef.current = selection;
      map.on('click', e => {
        if (!bundle) return;
        const cell = viewerToGrid(e.latlng.lat, e.latlng.lng, w, h);
        if (cell) onSelectRef.current(...cell);
      });
      mapRef.current = map; leafletRef.current = L;
      setMapRevision(revision => revision + 1);
      // Leaflet initializes when the shell has already established its dimensions.
      requestAnimationFrame(() => { if (!cancelled) map.invalidateSize(); });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove(); mapRef.current = null;
      selectionLayerRef.current = null;
      backgroundOverlayRef.current = null;
      contourOverlayRef.current = null;
      frontierRef.current = null;
      routeLayerRef.current = null;
    };
  }, [bundle, isMissionMap]);

  useEffect(() => {
    if (!bundle || !backgroundOverlayRef.current) return;
    const path = showOptical && bundle.manifest.optical ? bundle.manifest.optical.path : bundle.manifest.imagery.path;
    backgroundOverlayRef.current.setUrl(`${bundle.assetRoot}/${path}`);
    backgroundOverlayRef.current.getElement()?.setAttribute('alt',
      showOptical && bundle.manifest.optical ? 'Orbital imagery aligned to terrain grid; source review required' : 'DEM-derived shaded relief; not photography');
  }, [bundle, showOptical, mapRevision]);

  useEffect(() => {
    if (!bundle || !mapRef.current || !leafletRef.current || isMissionMap) return;
    const L = leafletRef.current;
    frontierRef.current?.remove();
    const h = bundle.manifest.height, w = bundle.manifest.width;
    const image = frontierPng(bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes);
    frontierRef.current = L.imageOverlay(image, [[0, 0], [h, w]], { interactive: false, opacity: 1 }).addTo(mapRef.current);
  }, [bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes, mapRevision, isMissionMap]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!map || !L || !bundle) return;
    routeLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    routeLayerRef.current = layer;
    const draw = (route: RouteSummary | null | undefined, color: string, dashArray?: string, glow?: boolean) => {
      if (route?.status !== 'READY' || route.geometryGrid.length < 2) return;
      const pts = route.geometryGrid.map(([r, c]) => gridToViewer(r, c, bundle.manifest.height));
      if (glow) {
        L.polyline(pts, { color, weight: 7, opacity: 0.16, interactive: false }).addTo(layer);
      }
      L.polyline(pts, { color, weight: 3, opacity: 0.96, interactive: false, dashArray }).addTo(layer);
    };
    draw(outboundRoute, '#f3a833', undefined, true);
    draw(returnRoute, '#34d399', '6 7', false);
    if (mission) {
      const point = ([r, c]: Cell) => gridToViewer(r, c, bundle.manifest.height);
      mission.traveled?.forEach(record => L.polyline(record.cells.map(point),
        {color: '#94a3b8', weight: 4.5, interactive: false}).addTo(layer));
      mission.previous?.forEach(leg => draw(leg.route, '#fde047', '3 8'));
      for (const [index, leg] of mission.planned.entries()) {
        const isReturn = leg.targetId === landingId;
        draw(leg.route, isReturn ? '#34d399' : '#f3a833', isReturn ? '7 5' : undefined, !isReturn);
        const end = leg.route.geometryGrid.at(-1);
        if (end && !isReturn) {
          const marker = L.circleMarker(point(end), {radius: 6.5, color: '#f3a833', fillColor: '#181512',
            fillOpacity: 1, weight: 3, interactive: false}).addTo(layer);
          const label = document.createElement('span');
          label.textContent = `${index + 1}. ${leg.to} (${end[0]}, ${end[1]})`;
          const closeToPrevious = mission.planned.slice(0, index).some(previousLeg => {
            const previousEnd = previousLeg.route.geometryGrid.at(-1);
            return previousEnd && Math.hypot(previousEnd[0] - end[0], previousEnd[1] - end[1]) < 8;
          });
          marker.bindTooltip(label, {permanent: true, direction: closeToPrevious ? 'left' : 'right', offset: [closeToPrevious ? -9 : 9, 0], className: 'mission-map-label'});
        }
        for (const waypoint of leg.waypoints) {
          L.circleMarker(point(waypoint.cell), {radius: 4, color: '#a7f3d0', fillColor: '#064e3b', fillOpacity: 1,
            interactive: false}).addTo(layer);
        }
      }
      mission.hazards?.forEach(zone => L.circle(point(zone.cell), {radius: zone.radius + 0.5, color: '#ef4444',
        fillOpacity: .22, dashArray: '4 4', interactive: false}).addTo(layer));
      if (mission.position) L.circleMarker(point(mission.position), {radius: 8, color: '#fef3c7', fillColor: '#10b981',
        fillOpacity: 1, weight: 3, interactive: false}).addTo(layer);
      if (mission.selected) L.circleMarker(point(mission.selected), {radius: 8, color: '#fde047', fillOpacity: 0,
        interactive: false}).addTo(layer);
    }
    return () => { layer.remove(); if (routeLayerRef.current === layer) routeLayerRef.current = null; };
  }, [bundle, outboundRoute, returnRoute, mapRevision, mission]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current, layer = selectionLayerRef.current;
    if (!map || !L || !layer || !bundle) return;
    layer.clearLayers();
    const markerColors = { ROBUST: '#10b981', MARGINAL: '#f59e0b', INFEASIBLE: '#ef4444', UNKNOWN: '#9ca3af' };
    for (const point of targetMarkers(opportunities, bundle.manifest.height, bundle.manifest.width)) {
      const marker = L.circleMarker([point.viewerLatitude, point.viewerLongitude], {
        radius: 5, color: '#14110f', weight: 1.5, fillColor: markerColors[point.state], fillOpacity: 0.98,
      }).addTo(layer);
      // Leaflet accepts an HTMLElement; textContent prevents untrusted geology titles becoming HTML.
      const tooltip = document.createElement('span');
      tooltip.textContent = `${point.title} · ${point.state.toLowerCase()} (research scenario)`;
      marker.bindTooltip(tooltip);
      marker.on('click', () => onSelectRef.current(point.row, point.col));
    }
    const [br, bc] = [Math.floor(bundle.manifest.baseIndex / bundle.manifest.width), bundle.manifest.baseIndex % bundle.manifest.width];
    L.circleMarker(gridToViewer(br, bc, bundle.manifest.height), {
      radius: 6.5, color: '#f3a833', weight: 3, fillColor: '#181512', fillOpacity: 1,
    }).addTo(layer).bindTooltip(`Scenario landing site (${br}, ${bc})`);
    const historic = bundle.manifest.historicalLandingCell;
    if (historic) L.circleMarker(gridToViewer(...historic, bundle.manifest.height), {
      radius: 5, color: '#cbd5e1', fillOpacity: .2, interactive: true,
    }).addTo(layer).bindTooltip('Historical Perseverance landing · Octavia E. Butler');

    if (selectedCell) {
      L.circleMarker(gridToViewer(selectedCell[0], selectedCell[1], bundle.manifest.height), {
        radius: 7.5, color: '#fde047', weight: 2.5, fillColor: '#e58e26', fillOpacity: 1,
      }).addTo(layer).bindTooltip('Selected scenario destination');
    }
  }, [bundle, selectedCell, opportunities, mapRevision]);

  return <div className="map-root" ref={element} role="application" aria-label="Mars local-grid map viewer; select a cell only after scientific data is loaded" />;
}

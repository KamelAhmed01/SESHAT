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
    image.data[off] = 206; image.data[off + 1] = 211; image.data[off + 2] = 171;
    image.data[off + 3] = included ? 48 : 0;
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
        zoomControl: !isMissionMap, attributionControl: false,
        zoomSnap: 0.25, zoomDelta: 0.5, minZoom: -5,
        maxZoom: 4, maxBoundsViscosity: 0.7,
      });
      if (isMissionMap) L.control.zoom({position: 'bottomleft'}).addTo(map);
      map.fitBounds(bounds, { padding: [24, 24], animate: false });
      map.setMaxBounds(bounds.pad(0.35));
      L.rectangle(bounds, { color: '#6f655e', weight: 1, fillColor: '#202127', fillOpacity: 0.02, dashArray: '4 6' }).addTo(map);
      if (bundle) {
        const overlay = L.imageOverlay(bundle.assetRoot + '/' + bundle.manifest.imagery.path, bounds, { opacity: 0.94 });
        overlay.addTo(map);
        backgroundOverlayRef.current = overlay;
        overlay.getElement()?.setAttribute('alt', 'DEM-derived shaded relief; not orbital photography');
      } else {
        // The grid is a UI wiring scaffold ONLY, not a depiction of Martian terrain.
        for (let x = 0; x <= w; x += 20) L.polyline([[0, x], [h, x]], { color: '#3c3b3a', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
        for (let y = 0; y <= h; y += 20) L.polyline([[y, 0], [y, w]], { color: '#3c3b3a', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
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
    const draw = (route: RouteSummary | null | undefined, color: string, dashArray?: string) => {
      if (route?.status !== 'READY' || route.geometryGrid.length < 2) return;
      L.polyline(route.geometryGrid.map(([r,c]) => gridToViewer(r,c,bundle.manifest.height)),
        { color, weight: 3.5, opacity: 0.97, interactive: false, dashArray }).addTo(layer);
    };
    draw(outboundRoute, '#f4c3a2');
    draw(returnRoute, '#c8d2ab', '6 7');
    if (mission) {
      const point = ([r, c]: Cell) => gridToViewer(r, c, bundle.manifest.height);
      mission.traveled?.forEach(record => L.polyline(record.cells.map(point),
        {color: '#849397', weight: 5, interactive: false}).addTo(layer));
      mission.previous?.forEach(leg => draw(leg.route, '#f3deab', '3 8'));
      for (const [index, leg] of mission.planned.entries()) {
        draw(leg.route, leg.targetId === landingId ? '#d1e7ae' : '#ffba8b', leg.targetId === landingId ? '7 5' : undefined);
        const end = leg.route.geometryGrid.at(-1);
        if (end && leg.targetId !== landingId) {
          const marker = L.circleMarker(point(end), {radius: 7, color: '#311e17', fillColor: '#ffba8b',
            fillOpacity: 1, weight: 2, interactive: false}).addTo(layer);
          const label = document.createElement('span');
          label.textContent = `${index + 1}. ${leg.to}`;
          const closeToPrevious = mission.planned.slice(0, index).some(previousLeg => {
            const previousEnd = previousLeg.route.geometryGrid.at(-1);
            return previousEnd && Math.hypot(previousEnd[0] - end[0], previousEnd[1] - end[1]) < 8;
          });
          marker.bindTooltip(label, {permanent: true, direction: closeToPrevious ? 'left' : 'right', offset: [closeToPrevious ? -7 : 7, 0], className: 'mission-map-label'});
        }
        for (const waypoint of leg.waypoints) {
          L.circleMarker(point(waypoint.cell), {radius: 4, color: '#cbefd9', fillColor: '#284f43', fillOpacity: 1,
            interactive: false}).addTo(layer);
        }
      }
      mission.hazards?.forEach(zone => L.circle(point(zone.cell), {radius: zone.radius + 0.5, color: '#ff8077',
        fillOpacity: .22, dashArray: '4 4', interactive: false}).addTo(layer));
      if (mission.position) L.circleMarker(point(mission.position), {radius: 8, color: '#e1fffd', fillColor: '#66bdbe',
        fillOpacity: 1, weight: 3, interactive: false}).addTo(layer);
      if (mission.selected) L.circleMarker(point(mission.selected), {radius: 8, color: '#f7efb4', fillOpacity: 0,
        interactive: false}).addTo(layer);
    }
    return () => { layer.remove(); if (routeLayerRef.current === layer) routeLayerRef.current = null; };
  }, [bundle, outboundRoute, returnRoute, mapRevision, mission]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current, layer = selectionLayerRef.current;
    if (!map || !L || !layer || !bundle) return;
    layer.clearLayers();
    const markerColors = { ROBUST: '#c6d6a7', MARGINAL: '#f0b78d', INFEASIBLE: '#dd8d7d', UNKNOWN: '#a6b7b7' };
    for (const point of targetMarkers(opportunities, bundle.manifest.height, bundle.manifest.width)) {
      const marker = L.circleMarker([point.viewerLatitude, point.viewerLongitude], {
        radius: 4.5, color: '#1b2729', weight: 1.5, fillColor: markerColors[point.state], fillOpacity: 0.98,
      }).addTo(layer);
      // Leaflet accepts an HTMLElement; textContent prevents untrusted geology titles becoming HTML.
      const tooltip = document.createElement('span');
      tooltip.textContent = `${point.title} · ${point.state.toLowerCase()} (research scenario)`;
      marker.bindTooltip(tooltip);
      marker.on('click', () => onSelectRef.current(point.row, point.col));
    }
    const [br, bc] = [Math.floor(bundle.manifest.baseIndex / bundle.manifest.width), bundle.manifest.baseIndex % bundle.manifest.width];
    L.circleMarker(gridToViewer(br, bc, bundle.manifest.height), {
      radius: 6, color: '#f5e8d7', weight: 2, fillColor: '#b27757', fillOpacity: 1,
    }).addTo(layer).bindTooltip('Scenario landing site');
    const historic = bundle.manifest.historicalLandingCell;
    if (historic) L.circleMarker(gridToViewer(...historic, bundle.manifest.height), {
      radius: 5, color: '#b8c0d1', fillOpacity: .2, interactive: true,
    }).addTo(layer).bindTooltip('Historical Perseverance landing · Octavia E. Butler');

    if (selectedCell) {
      L.circleMarker(gridToViewer(selectedCell[0], selectedCell[1], bundle.manifest.height), {
        radius: 7, color: '#f0b792', weight: 2, fillColor: '#eb9564', fillOpacity: 1,
      }).addTo(layer).bindTooltip('Selected scenario destination');
    }
  }, [bundle, selectedCell, opportunities, mapRevision]);

  return <div className="map-root" ref={element} role="application" aria-label="Mars local-grid map viewer; select a cell only after scientific data is loaded" />;
}

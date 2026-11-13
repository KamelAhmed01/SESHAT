'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldBundle } from '@/data/loader';
import { gridToViewer, viewerToGrid } from '@/cartography/coordinates';

interface Props {
  bundle: FieldBundle | null;
  onCellSelect: (row: number, col: number) => void;
  selectedCell: [number, number] | null;
  elapsedMinutes: number;
  missionBudgetMinutes: number;
  reserveMinutes: number;
}

function frontierPng(bundle: FieldBundle, elapsed: number, budget: number, reserve: number): string {
  const m = bundle.manifest;
  const canvas = document.createElement('canvas');
  canvas.width = m.width; canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const image = ctx.createImageData(m.width, m.height);
  const remaining = Math.max(0, budget - elapsed);
  for (let i = 0; i < m.width * m.height; i++) {
    const c = bundle.outboundMinutes[i] + bundle.returnMinutes[i] + reserve;
    const included = bundle.mask[i] === 1 && Number.isFinite(c) && c <= remaining;
    const off = i * 4;
    image.data[off] = 206; image.data[off + 1] = 211; image.data[off + 2] = 171;
    image.data[off + 3] = included ? 48 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function LeafletGrid({ bundle, selectedCell, onCellSelect,
  elapsedMinutes, missionBudgetMinutes, reserveMinutes }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const selectionLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const frontierRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const onSelectRef = useRef(onCellSelect);
  onSelectRef.current = onCellSelect;

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
        zoomControl: true, attributionControl: false,
        zoomSnap: 0.25, zoomDelta: 0.5, minZoom: -5,
        maxZoom: 4, maxBoundsViscosity: 0.7,
      });
      map.fitBounds(bounds, { padding: [24, 24], animate: false });
      map.setMaxBounds(bounds.pad(0.35));
      L.rectangle(bounds, { color: '#6f655e', weight: 1, fillColor: '#202127', fillOpacity: 0.02, dashArray: '4 6' }).addTo(map);
      if (bundle) {
        const overlay = L.imageOverlay('/data/' + bundle.manifest.imagery.path, bounds, { opacity: 0.94 });
        overlay.addTo(map);
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
      frontierRef.current = null;
    };
  }, [bundle]);

  useEffect(() => {
    if (!bundle || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    frontierRef.current?.remove();
    const h = bundle.manifest.height, w = bundle.manifest.width;
    const image = frontierPng(bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes);
    frontierRef.current = L.imageOverlay(image, [[0, 0], [h, w]], { interactive: false, opacity: 1 }).addTo(mapRef.current);
  }, [bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes, mapRevision]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current, layer = selectionLayerRef.current;
    if (!map || !L || !layer || !bundle) return;
    layer.clearLayers();
    const [br, bc] = [Math.floor(bundle.manifest.baseIndex / bundle.manifest.width), bundle.manifest.baseIndex % bundle.manifest.width];
    L.circleMarker(gridToViewer(br, bc, bundle.manifest.height), {
      radius: 6, color: '#f5e8d7', weight: 2, fillColor: '#b27757', fillOpacity: 1,
    }).addTo(layer).bindTooltip('Scenario base');
    if (selectedCell) {
      L.circleMarker(gridToViewer(selectedCell[0], selectedCell[1], bundle.manifest.height), {
        radius: 7, color: '#f0b792', weight: 2, fillColor: '#eb9564', fillOpacity: 1,
      }).addTo(layer).bindTooltip('User-selected cell · hypothetical activity');
    }
  }, [bundle, selectedCell, mapRevision]);

  return <div className="map-root" ref={element} role="application" aria-label="Mars local-grid map viewer; select a cell only after scientific data is loaded" />;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldBundle } from '@/data/loader';
import {
  MARS_SPHERE_RADIUS_METERS,
  aeqdMetersToLonLat,
  gridBoundaryLatLngs,
  gridGeographicBounds,
  gridPointToMarsLatLng,
  gridToMarsLatLng,
  gridToViewer,
  isMarsGeographic,
  marsLatLngToGrid,
  marsLatLngToGridFloat,
  marsSurfaceDistanceMeters,
  normalizeMarsEastLon,
  viewerToGrid,
} from '@/cartography/coordinates';
import { frontierMembership } from '@/engine/frontier';
import { landingId } from '@/engine/multi-leg-planner';
import type { MissionLeg } from '@/engine/multi-leg-planner';
import type { TravelRecord } from '@/engine/lifecycle-store';
import type { Cell, HazardZone } from '@/engine/traverse-graph';
import { elevationAtCell, hasModeledTerrain, isNeighborhoodCell } from '@/engine/traverse-graph';
import type { RouteSummary } from '@/engine/types';
import type { OpportunityEntry } from '@/engine/opportunity-ledger';
import { targetMarkers } from '@/cartography/target-markers';
import { MapLegend } from './MapLegend';
import { Mars3DView } from './Mars3DView';

const noOpportunities: readonly OpportunityEntry[] = [];

export interface MapPointInspection {
  lat: number | null;
  lon: number | null;
  cell: Cell | null;
  status: 'COVERED' | 'NODATA' | 'OUTSIDE_GRID';
  label: string;
  elevationMeters?: number | null;
  geologicUnit?: string | null;
  thermalInertia?: number | null;
  frontierStatus?: string | null;
  screenPoint?: readonly [x: number, y: number];
}

interface Props {
  bundle: FieldBundle | null;
  onCellSelect: (row: number, col: number) => void;
  onInspectPoint?: (info: MapPointInspection) => void;
  onMapMove?: () => void;
  selectedCell: [number, number] | null;
  elapsedMinutes: number;
  missionBudgetMinutes: number;
  reserveMinutes: number;
  outboundRoute?: RouteSummary | null;
  returnRoute?: RouteSummary | null;
  showOptical?: boolean;
  showElevation?: boolean;
  showGeology?: boolean;
  showThermal?: boolean;
  show3D?: boolean;
  onToggle3D?: () => void;
  showFrontier?: boolean;
  liveFrontier?: Uint8Array | null;
  opportunities?: readonly OpportunityEntry[];
  fitRequestKey?: number;
  resetViewRequestKey?: number;
  fitCells?: readonly Cell[];
  neighborhoodOverview?: boolean;
  mission?: {
    planned: readonly MissionLeg[];
    previous?: readonly MissionLeg[];
    traveled?: readonly TravelRecord[];
    hazards?: readonly HazardZone[];
    position?: Cell;
    selected?: Cell | null;
    previousSpans?: readonly Cell[][];
    focusedLeg?: number;
    preview?: boolean;
    onSelectLeg?: (index: number) => void;
  };
}

const EMPTY_TILE_URI = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function formatMarsCoord(lat: number, lon: number): string {
  const eastLon = normalizeMarsEastLon(lon);
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${eastLon.toFixed(4)}°E`;
}

function niceScaleMeters(rawMeters: number): number {
  if (!Number.isFinite(rawMeters) || rawMeters <= 0) return 500;
  const pow = 10 ** Math.floor(Math.log10(rawMeters));
  const scaled = rawMeters / pow;
  const mult = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1;
  return mult * pow;
}

function elevToNormalizedT(elev: number, minZ: number, maxZ: number): number {
  const span = Math.max(1e-6, maxZ - minZ);
  if (span > 400 && minZ < -2560 && maxZ > -2350) {
    const zFloor = -2555;
    const zDeltaPeak = -2415;
    if (elev <= zFloor) {
      return Math.max(0, Math.min(1, ((elev - minZ) / Math.max(1e-6, zFloor - minZ)) * 0.22));
    }
    if (elev <= zDeltaPeak) {
      return 0.22 + ((elev - zFloor) / (zDeltaPeak - zFloor)) * 0.54;
    }
    return Math.min(1, 0.76 + ((elev - zDeltaPeak) / Math.max(1e-6, maxZ - zDeltaPeak)) * 0.24);
  }
  return Math.max(0, Math.min(1, (elev - minZ) / span));
}

function hypsometricColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.22) {
    const u = clamped / 0.22;
    return [
      Math.round(25 + u * (20 - 25)),
      Math.round(28 + u * (165 - 28)),
      Math.round(135 + u * (215 - 135)),
    ];
  } else if (clamped <= 0.46) {
    const u = (clamped - 0.22) / 0.24;
    return [
      Math.round(20 + u * (34 - 20)),
      Math.round(165 + u * (197 - 165)),
      Math.round(215 + u * (94 - 215)),
    ];
  } else if (clamped <= 0.62) {
    const u = (clamped - 0.46) / 0.16;
    return [
      Math.round(34 + u * (245 - 34)),
      Math.round(197 + u * (165 - 197)),
      Math.round(94 + u * (15 - 94)),
    ];
  } else if (clamped <= 0.76) {
    const u = (clamped - 0.62) / 0.14;
    return [
      Math.round(245 + u * (235 - 245)),
      Math.round(165 + u * (50 - 165)),
      Math.round(15 + u * (40 - 15)),
    ];
  }
  const u = (clamped - 0.76) / 0.24;
  return [
    Math.round(235 + u * (248 - 235)),
    Math.round(50 + u * (175 - 50)),
    Math.round(40 + u * (195 - 40)),
  ];
}

function elevationHeatmapPng(
  bundle: FieldBundle,
  geoBounds?: { south: number; west: number; north: number; east: number },
): string {
  const m = bundle.manifest;
  const z = bundle.elevationMeters;
  const mask = bundle.mask;
  const w = m.width;
  const h = m.height;
  const total = w * h;

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < total; i++) {
    if (mask[i] === 1 && Number.isFinite(z[i])) {
      if (z[i] < minZ) minZ = z[i];
      if (z[i] > maxZ) maxZ = z[i];
    }
  }
  if (!Number.isFinite(minZ) || maxZ <= minZ) return '';

  const canvas = document.createElement('canvas');
  if (geoBounds && isMarsGeographic(m)) {
    const gw = 240;
    const gh = 240;
    canvas.width = gw;
    canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const imgData = ctx.createImageData(gw, gh);
    for (let py = 0; py < gh; py++) {
      const lat = geoBounds.north - ((py + 0.5) / gh) * (geoBounds.north - geoBounds.south);
      for (let px = 0; px < gw; px++) {
        const lon = geoBounds.west + ((px + 0.5) / gw) * (geoBounds.east - geoBounds.west);
        const pt = marsLatLngToGridFloat(lat, lon, m);
        const off = (py * gw + px) * 4;
        if (!pt) continue;
        const r = Math.floor(pt[0]);
        const c = Math.floor(pt[1]);
        if (r < 0 || r >= h || c < 0 || c >= w) continue;
        const idx = r * w + c;
        if (mask[idx] === 1 && Number.isFinite(z[idx])) {
          const t = elevToNormalizedT(z[idx], minZ, maxZ);
          const [red, green, blue] = hypsometricColor(t);
          imgData.data[off] = red;
          imgData.data[off + 1] = green;
          imgData.data[off + 2] = blue;
          imgData.data[off + 3] = 185;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgData = ctx.createImageData(w, h);
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    if (mask[i] === 1 && Number.isFinite(z[i])) {
      const t = elevToNormalizedT(z[i], minZ, maxZ);
      const [red, green, blue] = hypsometricColor(t);
      imgData.data[off] = red;
      imgData.data[off + 1] = green;
      imgData.data[off + 2] = blue;
      imgData.data[off + 3] = 185;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function contourOverlayPng(bundle: FieldBundle, geoBounds?: { south: number; west: number; north: number; east: number }): string {
  const { width: w, height: h } = bundle.manifest;
  const canvas = document.createElement('canvas');
  const scale = 4;
  if (geoBounds && isMarsGeographic(bundle.manifest)) {
    const gw = 360;
    const gh = 360;
    canvas.width = gw;
    canvas.height = gh;
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
    const toPx = (rowF: number, colF: number): [number, number] => {
      const [lat, lon] = gridPointToMarsLatLng(rowF, colF, bundle.manifest);
      const px = ((lon - geoBounds.west) / (geoBounds.east - geoBounds.west)) * gw;
      const py = ((geoBounds.north - lat) / (geoBounds.north - geoBounds.south)) * gh;
      return [px, py];
    };
    let levelIndex = 0;
    for (let level = startLevel; level < maxZ; level += step, levelIndex++) {
      const isMajor = levelIndex % 4 === 0;
      ctx.beginPath();
      ctx.strokeStyle = isMajor ? 'rgba(243, 168, 51, 0.34)' : 'rgba(245, 240, 235, 0.16)';
      ctx.lineWidth = isMajor ? 1.25 : 0.8;
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
          const pts: [number, number][] = [];
          if (b0 !== b1) pts.push(toPx(r + 0.5, c + 0.5 + (level - v0) / (v1 - v0)));
          if (b1 !== b2) pts.push(toPx(r + 0.5 + (level - v1) / (v2 - v1), c + 1.5));
          if (b2 !== b3) pts.push(toPx(r + 1.5, c + 1.5 - (level - v2) / (v3 - v2)));
          if (b3 !== b0) pts.push(toPx(r + 1.5 - (level - v3) / (v0 - v3), c + 0.5));
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

function frontierPng(
  bundle: FieldBundle,
  elapsed: number,
  budget: number,
  reserve: number,
  geoBounds?: { south: number; west: number; north: number; east: number },
): string {
  const m = bundle.manifest;
  const membership = frontierMembership(bundle.outboundMinutes, bundle.returnMinutes, bundle.mask, elapsed, budget, reserve);
  const canvas = document.createElement('canvas');

  if (geoBounds && isMarsGeographic(m)) {
    const gw = 240;
    const gh = 240;
    canvas.width = gw;
    canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    const image = ctx.createImageData(gw, gh);
    for (let py = 0; py < gh; py++) {
      const lat = geoBounds.north - ((py + 0.5) / gh) * (geoBounds.north - geoBounds.south);
      for (let px = 0; px < gw; px++) {
        const lon = geoBounds.west + ((px + 0.5) / gw) * (geoBounds.east - geoBounds.west);
        const pt = marsLatLngToGridFloat(lat, lon, m);
        const off = (py * gw + px) * 4;
        if (!pt) continue;
        const r = Math.floor(pt[0]);
        const c = Math.floor(pt[1]);
        const idx = r * m.width + c;
        if (membership[idx] === 1) {
          image.data[off] = 229;
          image.data[off + 1] = 178;
          image.data[off + 2] = 92;
          image.data[off + 3] = 56;
        } else if (bundle.mask[idx] !== 1) {
          image.data[off] = 15;
          image.data[off + 1] = 23;
          image.data[off + 2] = 42;
          image.data[off + 3] = 95;
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const image = ctx.createImageData(m.width, m.height);
  for (let i = 0; i < m.width * m.height; i++) {
    const included = membership[i] === 1;
    const off = i * 4;
    image.data[off] = 229; image.data[off + 1] = 178; image.data[off + 2] = 92;
    image.data[off + 3] = included ? 52 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function frontierTierStatusLabel(tier: number | undefined): string | null {
  if (tier === undefined) return null;
  if (tier === 2) return 'Full 20-min science feasible at 0.8×';
  if (tier === 1) return 'Pass-through only · insufficient 0.8× margin for 20-min stop';
  return 'Beyond 0.8× safe-return horizon';
}

function liveFrontierPng(
  bundle: FieldBundle,
  membership: Uint8Array,
  geoBounds?: { south: number; west: number; north: number; east: number },
): string {
  const m = bundle.manifest;
  const w = m.width;
  const h = m.height;
  const isEdge = (r: number, c: number, tier: number) => {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) return true;
      const nt = membership[nr * w + nc];
      if (tier === 2 ? nt !== 2 : nt === 0) return true;
    }
    return false;
  };
  const writeTierPixel = (data: Uint8ClampedArray, off: number, r: number, c: number) => {
    const tier = membership[r * w + c];
    if (tier === 2) {
      const edge = isEdge(r, c, 2);
      data[off] = 16;
      data[off + 1] = 185;
      data[off + 2] = 129;
      data[off + 3] = edge ? 195 : 54;
    } else if (tier === 1) {
      const edge = isEdge(r, c, 1);
      data[off] = 245;
      data[off + 1] = 158;
      data[off + 2] = 11;
      data[off + 3] = edge ? 190 : 52;
    }
  };
  const canvas = document.createElement('canvas');
  if (geoBounds && isMarsGeographic(m)) {
    const gw = 260;
    const gh = 260;
    canvas.width = gw;
    canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const image = ctx.createImageData(gw, gh);
    for (let py = 0; py < gh; py++) {
      const lat = geoBounds.north - ((py + 0.5) / gh) * (geoBounds.north - geoBounds.south);
      for (let px = 0; px < gw; px++) {
        const lon = geoBounds.west + ((px + 0.5) / gw) * (geoBounds.east - geoBounds.west);
        const pt = marsLatLngToGridFloat(lat, lon, m);
        if (!pt) continue;
        const r = Math.floor(pt[0]);
        const c = Math.floor(pt[1]);
        if (r < 0 || r >= h || c < 0 || c >= w) continue;
        writeTierPixel(image.data, (py * gw + px) * 4, r, c);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(w, h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      writeTierPixel(image.data, (r * w + c) * 4, r, c);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function marsGeodesicCircleLatLngs(
  centerCell: Cell,
  radiusCells: number,
  manifest: FieldBundle['manifest'],
): [number, number][] {
  const [a, b, c, d, e, f] = manifest.rasterTransform!;
  const r0 = centerCell[0] + 0.5;
  const c0 = centerCell[1] + 0.5;
  const cx = a * c0 + b * r0 + c;
  const cy = d * c0 + e * r0 + f;
  const radiusMeters = (radiusCells + 0.5) * manifest.cellWidthMeters;
  const lat0 = manifest.analysisCenterPlanetocentricLat!;
  const lon0 = manifest.analysisCenterPositiveEastLon!;
  const sphereR = manifest.sourceBodyRadiusMeters ?? MARS_SPHERE_RADIUS_METERS;
  const pts: [number, number][] = [];
  for (let k = 0; k < 32; k++) {
    const theta = (k / 32) * 2 * Math.PI;
    const [lon, lat] = aeqdMetersToLonLat(
      cx + radiusMeters * Math.cos(theta),
      cy + radiusMeters * Math.sin(theta),
      lat0,
      lon0,
      sphereR,
    );
    pts.push([lat, lon]);
  }
  return pts;
}

export function LeafletGrid({
  bundle,
  selectedCell,
  onCellSelect,
  onInspectPoint,
  onMapMove,
  elapsedMinutes,
  missionBudgetMinutes,
  reserveMinutes,
  outboundRoute,
  returnRoute,
  showOptical = false,
  showElevation = false,
  showGeology = false,
  showThermal = false,
  show3D = false,
  onToggle3D,
  showFrontier = false,
  liveFrontier = null,
  opportunities = noOpportunities,
  fitRequestKey = 0,
  resetViewRequestKey = 0,
  fitCells,
  neighborhoodOverview = false,
  mission,
}: Props) {
  const isMissionMap = mission !== undefined;
  const element = useRef<HTMLDivElement>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const [scaleInfo, setScaleInfo] = useState<{ label: string; widthPx: number; zoomLabel: string } | null>(null);
  const [cursorInfo, setCursorInfo] = useState<string>('');
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const backgroundOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const neighborhoodBgRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const contourOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const elevationOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const neighborhoodHeatmapRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const geologyOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const thermalOverlayRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const selectionLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const frontierRef = useRef<import('leaflet').ImageOverlay | null>(null);
  const routeLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const onSelectRef = useRef(onCellSelect);
  const lastFitRequest = useRef(0);
  const onInspectRef = useRef(onInspectPoint);
  const onMapMoveRef = useRef(onMapMove);
  const liveFrontierRef = useRef(liveFrontier);
  const initialFitDoneRef = useRef(false);

  useEffect(() => { onSelectRef.current = onCellSelect; }, [onCellSelect]);
  useEffect(() => { onInspectRef.current = onInspectPoint; }, [onInspectPoint]);
  useEffect(() => { onMapMoveRef.current = onMapMove; }, [onMapMove]);
  useEffect(() => { liveFrontierRef.current = liveFrontier; }, [liveFrontier]);

  const useMarsGeo = Boolean(bundle && isMarsGeographic(bundle.manifest));

  useEffect(() => {
    if (!element.current) return;
    let cancelled = false;
    initialFitDoneRef.current = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !element.current || mapRef.current) return;

      if (bundle && isMarsGeographic(bundle.manifest)) {
        const radius = bundle.manifest.sourceBodyRadiusMeters ?? MARS_SPHERE_RADIUS_METERS;
        const geoBounds = gridGeographicBounds(bundle.manifest);
        const gridBoundsLatLng = L.latLngBounds(
          [geoBounds.south, geoBounds.west],
          [geoBounds.north, geoBounds.east],
        );

        const marsCrs = L.extend({}, L.CRS.EPSG4326, {
          code: 'MARS:4326',
          R: radius,
          distance(a: import('leaflet').LatLng, b: import('leaflet').LatLng) {
            return marsSurfaceDistanceMeters(a.lat, a.lng, b.lat, b.lng, radius);
          },
        });

        const centerLat = bundle.manifest.analysisCenterPlanetocentricLat ?? 18.452;
        const centerLon = bundle.manifest.analysisCenterPositiveEastLon ?? 77.414;

        const map = L.map(element.current, {
          crs: marsCrs,
          center: [centerLat, centerLon],
          zoom: isMissionMap ? 13 : 12,
          zoomControl: false,
          attributionControl: false,
          zoomSnap: 0.5,
          zoomDelta: 1,
          minZoom: 0,
          maxZoom: 15,
          maxBounds: [[-90, -540], [90, 540]],
          maxBoundsViscosity: 0.8,
        });
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const mapDisplay = bundle.manifest.mapDisplay;
        const localVikingSet = new Set(mapDisplay?.localVikingTiles ?? []);
        const jezeroSet = new Set(mapDisplay?.jezeroTiles ?? []);

        const MarsTileLayer = L.TileLayer.extend({
          initialize(
            this: import('leaflet').TileLayer & { _mode: string },
            mode: string,
            options: import('leaflet').TileLayerOptions,
          ) {
            this._mode = mode;
            const proto = L.TileLayer.prototype as unknown as {
              initialize: (url: string, opts: import('leaflet').TileLayerOptions) => void;
            };
            proto.initialize.call(this, '', options);
          },
          getTileUrl(this: import('leaflet').TileLayer & { _mode: string }, coords: import('leaflet').Coords) {
            const z = coords.z;
            const rows = 1 << z;
            if (z < 0 || coords.y < 0 || coords.y >= rows) return EMPTY_TILE_URI;
            const cols = 1 << (z + 1);
            const wrappedX = ((coords.x % cols) + cols) % cols;
            const key = `${z}/${coords.y}/${wrappedX}`;

            if (this._mode === 'viking-base') {
              return localVikingSet.has(key) ? `${bundle.assetRoot}/tiles/viking/${key}.jpg` : EMPTY_TILE_URI;
            }
            if (this._mode === 'viking-detail') {
              if (localVikingSet.has(key)) return `${bundle.assetRoot}/tiles/viking/${key}.jpg`;
              const tmpl = mapDisplay?.vikingTileTemplate
                ?? 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
              return tmpl.replace('{z}', String(z)).replace('{y}', String(coords.y)).replace('{x}', String(wrappedX));
            }
            if (this._mode === 'jezero-full' || this._mode === 'jezero-fan') {
              return jezeroSet.has(key) ? `${bundle.assetRoot}/tiles/jezero/${key}.webp` : EMPTY_TILE_URI;
            }
            return EMPTY_TILE_URI;
          },
        });

        const addResilientTileLayer = (mode: string, options: import('leaflet').TileLayerOptions) => {
          const LayerCtor = MarsTileLayer as unknown as new (m: string, o: import('leaflet').TileLayerOptions) => import('leaflet').TileLayer;
          const layer = new LayerCtor(mode, options);
          layer.on('tileerror', (evt: import('leaflet').TileErrorEvent) => {
            if (evt.tile) evt.tile.style.display = 'none';
          });
          return layer.addTo(map);
        };

        // Planet-wide Viking MDIM 2.1 local base (levels 0-2), scaled seamlessly up to maxZoom
        addResilientTileLayer('viking-base', {
          minZoom: 0,
          maxNativeZoom: 2,
          maxZoom: 15,
          tileSize: 256,
          zIndex: 10,
        });

        // Mars Trek regional Viking levels 3-7 (local Jezero corridor first, online fallback when reachable)
        addResilientTileLayer('viking-detail', {
          minZoom: 3,
          maxNativeZoom: 7,
          maxZoom: 15,
          tileSize: 256,
          crossOrigin: true,
          zIndex: 20,
        });

        // Wider Jezero 6 m MRO CTX mosaic pyramid (levels 8-12 full extent, level 13 western fan)
        if (jezeroSet.size > 0) {
          addResilientTileLayer('jezero-full', {
            minZoom: 8,
            maxNativeZoom: 12,
            maxZoom: 15,
            tileSize: 256,
            zIndex: 30,
          });
          addResilientTileLayer('jezero-fan', {
            minZoom: 13,
            maxNativeZoom: 13,
            maxZoom: 15,
            tileSize: 256,
            zIndex: 35,
          });
        }

        // 2-Layer Chunk Neighborhood (5x5 chunks = 22.0 x 22.0 km around central chunk)
        const nb = mapDisplay?.neighborhood;
        if (nb) {
          const [nbSouth, nbWest, nbNorth, nbEast] = nb.geographicBounds;
          const nbBoundsLatLng = L.latLngBounds([nbSouth, nbWest], [nbNorth, nbEast]);
          const nbBg = L.imageOverlay(`${bundle.assetRoot}/${nb.terrainGeoPath}`, nbBoundsLatLng, {
            opacity: 0.85,
            interactive: false,
            zIndex: 42,
          }).addTo(map);
          neighborhoodBgRef.current = nbBg;

          // Outer 5x5 neighborhood perimeter
          L.polygon(nb.boundaryPolygonLatLng, {
            color: '#c9a982',
            weight: 1.4,
            dashArray: '6 5',
            fill: false,
            interactive: false,
          }).addTo(map);

          // Draw Ring 1 (8 chunks) & Ring 2 (16 chunks) chunk grid outlines
          for (const ch of nb.chunks) {
            if (ch.ring === 0) continue;
            L.polygon(ch.polygonLatLng, {
              color: ch.ring === 1 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(201, 169, 130, 0.30)',
              weight: ch.ring === 1 ? 1.1 : 0.8,
              dashArray: ch.ring === 1 ? '3 3' : '2 4',
              fill: false,
              interactive: false,
            }).addTo(map);
          }
        }

        // Exact AEQD 20 m modeled area outline (always visible as crisp boundary even at Mars overview)
        L.polygon(gridBoundaryLatLngs(bundle.manifest, 28), {
          color: '#f3a833',
          weight: 1.6,
          dashArray: '5 4',
          fill: false,
          interactive: false,
        }).addTo(map);

        // Modeled 20 m analysis display raster (AEQD reprojected to Mars Plate Carree)
        // If 2-layer chunk neighborhood is active, neighborhoodBgRef covers the entire 5x5 region seamlessly;
        // backgroundOverlayRef opacity is kept at 0 in terrain mode to prevent double-darkening the center chunk.
        const initialBgPath = mapDisplay?.terrainGeoPath ?? bundle.manifest.imagery.path;
        const bgOverlay = L.imageOverlay(`${bundle.assetRoot}/${initialBgPath}`, gridBoundsLatLng, {
          opacity: nb ? 0 : 0.9,
          zIndex: 45,
        }).addTo(map);
        bgOverlay.getElement()?.setAttribute('alt', 'DEM-derived shaded relief aligned to Mars AEQD; not orbital photography');
        backgroundOverlayRef.current = bgOverlay;

        const contourUrl = contourOverlayPng(bundle, geoBounds);
        if (contourUrl) {
          contourOverlayRef.current = L.imageOverlay(contourUrl, gridBoundsLatLng, {
            opacity: 0.85,
            interactive: false,
            zIndex: 48,
          }).addTo(map);
        }

        const selection = L.layerGroup().addTo(map);
        selectionLayerRef.current = selection;

        const updateScale = () => {
          const z = map.getZoom();
          const size = map.getSize();
          if (!size.x || !size.y) return;
          const y = Math.round(size.y * 0.5);
          const p1 = map.containerPointToLatLng([Math.round(size.x * 0.5 - 50), y]);
          const p2 = map.containerPointToLatLng([Math.round(size.x * 0.5 + 50), y]);
          const meters100Px = marsSurfaceDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng, radius);
          const targetMeters = niceScaleMeters(meters100Px);
          const widthPx = Math.max(28, Math.min(130, Math.round((targetMeters / Math.max(0.01, meters100Px)) * 100)));
          const label = targetMeters >= 1000 ? `${(targetMeters / 1000).toFixed(targetMeters >= 10000 ? 0 : 1).replace(/\.0$/, '')} km` : `${Math.round(targetMeters)} m`;
          const zoomLabel = z >= 12 ? 'Western fan · 6 m CTX' : z >= 8 ? 'Jezero regional · CTX' : z >= 3 ? 'Mars regional · Viking' : 'Mars global · Viking MDIM 2.1';
          setScaleInfo({ label, widthPx, zoomLabel });
        };

        map.on('zoomend moveend', updateScale);
        map.on('movestart', () => onMapMoveRef.current?.());
        map.on('mousemove', e => {
          setCursorInfo(formatMarsCoord(e.latlng.lat, e.latlng.lng));
        });
        const inspectTerrain = ({lat, lng: lon}: import('leaflet').LatLng, screenPoint: MapPointInspection['screenPoint']) => {
          const cell = marsLatLngToGrid(lat, lon, bundle.manifest);
          if (!cell) {
            // Check if click falls inside the 2-layer chunk neighborhood (Ring 1 or Ring 2)
            const nbMeta = bundle.manifest.mapDisplay?.neighborhood;
            const extended = nbMeta && marsLatLngToGridFloat(lat, lon, bundle.manifest, true);
            if (extended) {
              const [row, col] = extended.map(Math.floor);
              const cellPoint: Cell = [row, col];
              if (isNeighborhoodCell(bundle, cellPoint)) {
                const cCol = Math.floor(col / bundle.manifest.width);
                const cRow = Math.floor(row / bundle.manifest.height);
                const ring = Math.max(Math.abs(cRow), Math.abs(cCol));
                const chDesc = nbMeta.chunks.find(c => c.rowOffset === cRow && c.colOffset === cCol);
                const supported = hasModeledTerrain(bundle, cellPoint);
                const nbElev = supported ? elevationAtCell(bundle, cellPoint) : NaN;
                onInspectRef.current?.({
                  screenPoint,
                  lat,
                  lon,
                  cell: cellPoint,
                  status: supported ? 'COVERED' : 'NODATA',
                  label: chDesc
                    ? `${chDesc.label} · Cell (${row}, ${col})`
                    : `Ring ${ring} · Chunk (${cRow >= 0 ? `+${cRow}` : cRow}, ${cCol >= 0 ? `+${cCol}` : cCol})`,
                  elevationMeters: Number.isFinite(nbElev) ? nbElev : null,
                });
                if (!isMissionMap) onSelectRef.current(...cellPoint);
                return;
              }
            }
            onInspectRef.current?.({
              screenPoint,
              lat,
              lon,
              cell: null,
              status: 'OUTSIDE_GRID',
              label: 'Browse only · outside modeled terrain',
            });
            return;
          }
          const idx = cell[0] * bundle.manifest.width + cell[1];
          const elev = Number.isFinite(bundle.elevationMeters[idx]) ? bundle.elevationMeters[idx] : null;
          const tiVal = bundle.contextData?.thermalInertia && Number.isFinite(bundle.contextData.thermalInertia[idx])
            ? bundle.contextData.thermalInertia[idx] : null;
          const unitIdx = bundle.contextData?.geologicUnitGrid?.[idx] ?? 0;
          const unitObj = unitIdx > 0 ? bundle.contextData?.geologicUnits?.units.find(u => u.index === unitIdx) : undefined;
          const unitLabel = unitObj ? `${unitObj.symbol} · ${unitObj.name}` : 'Unknown / unmapped';

          if (bundle.mask[idx] !== 1) {
            onInspectRef.current?.({
              screenPoint,
              lat,
              lon,
              cell,
              status: 'NODATA',
              label: 'Terrain data unavailable',
              elevationMeters: elev,
              geologicUnit: unitLabel,
              thermalInertia: tiVal,
            });
            if (!isMissionMap) onSelectRef.current(...cell);
            return;
          }
          onInspectRef.current?.({
            screenPoint,
            lat,
            lon,
            cell,
            status: 'COVERED',
            label: `Modeled 20 m cell (${cell[0]}, ${cell[1]})`,
            elevationMeters: elev,
            geologicUnit: unitLabel,
            thermalInertia: tiVal,
            frontierStatus: frontierTierStatusLabel(liveFrontierRef.current?.[idx]),
          });
          if (!isMissionMap) onSelectRef.current(...cell);
        };
        const inspectMousePoint = (event: import('leaflet').LeafletMouseEvent) => {
          inspectTerrain(event.latlng, [event.originalEvent.clientX, event.originalEvent.clientY]);
        };
        map.on('click', inspectMousePoint);
        if (neighborhoodOverview) map.on('contextmenu', inspectMousePoint);
        if (neighborhoodOverview) {
          map.getContainer().addEventListener('keydown', event => {
            if (event.target !== map.getContainer() || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
            event.preventDefault();
            const rect = map.getContainer().getBoundingClientRect();
            inspectTerrain(map.getCenter(), [rect.left + rect.width / 2, rect.top + rect.height / 2]);
          });
        }

        mapRef.current = map;
        leafletRef.current = L;
        setMapRevision(revision => revision + 1);
        requestAnimationFrame(() => {
          if (cancelled) return;
          map.invalidateSize();
          if (!initialFitDoneRef.current) {
            const bounds = neighborhoodOverview && nb
              ? L.latLngBounds(nb.boundaryPolygonLatLng) : gridBoundsLatLng;
            map.fitBounds(bounds, { padding: [24, 24], animate: false });
            initialFitDoneRef.current = true;
          }
          updateScale();
        });
      } else {
        // Synthetic / local CRS.Simple viewer
        const h = bundle?.manifest.height ?? 120;
        const w = bundle?.manifest.width ?? 160;
        const bounds = L.latLngBounds([[0, 0], [h, w]]);
        const map = L.map(element.current, {
          crs: L.CRS.Simple,
          zoomControl: false,
          attributionControl: false,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          minZoom: -5,
          maxZoom: 4,
          maxBoundsViscosity: 0.7,
        });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
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
          for (let x = 0; x <= w; x += 20) L.polyline([[0, x], [h, x]], { color: '#3c3732', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
          for (let y = 0; y <= h; y += 20) L.polyline([[y, 0], [y, w]], { color: '#3c3732', weight: 0.6, opacity: 0.5, interactive: false }).addTo(map);
        }
        const selection = L.layerGroup().addTo(map);
        selectionLayerRef.current = selection;
        map.on('click', e => {
          if (!bundle) return;
          const cell = viewerToGrid(e.latlng.lat, e.latlng.lng, w, h);
          if (cell) {
            const idx = cell[0] * w + cell[1];
            onInspectRef.current?.({
              lat: null,
              lon: null,
              cell,
              status: bundle.mask[idx] === 1 ? 'COVERED' : 'NODATA',
              label: bundle.mask[idx] === 1 ? `Synthetic cell (${cell[0]}, ${cell[1]})` : 'Terrain data unavailable',
              frontierStatus: bundle.mask[idx] === 1 ? frontierTierStatusLabel(liveFrontierRef.current?.[idx]) : null,
            });
            onSelectRef.current(...cell);
          } else {
            onInspectRef.current?.({
              lat: null,
              lon: null,
              cell: null,
              status: 'OUTSIDE_GRID',
              label: 'Browse only · outside modeled terrain',
            });
          }
        });
        mapRef.current = map;
        leafletRef.current = L;
        setMapRevision(revision => revision + 1);
        requestAnimationFrame(() => { if (!cancelled) map.invalidateSize(); });
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      selectionLayerRef.current = null;
      backgroundOverlayRef.current = null;
      neighborhoodBgRef.current = null;
      contourOverlayRef.current = null;
      elevationOverlayRef.current = null;
      neighborhoodHeatmapRef.current = null;
      geologyOverlayRef.current = null;
      thermalOverlayRef.current = null;
      frontierRef.current = null;
      routeLayerRef.current = null;
    };
  }, [bundle, isMissionMap, neighborhoodOverview]);

  // Swap surface layer without moving the camera or recreating the map
  useEffect(() => {
    if (!bundle || !backgroundOverlayRef.current) return;
    if (isMarsGeographic(bundle.manifest)) {
      const md = bundle.manifest.mapDisplay;
      const hasNb = Boolean(md?.neighborhood);
      const path = showOptical && bundle.manifest.optical
        ? (md?.orbitalGeoPath ?? bundle.manifest.optical.path)
        : (md?.terrainGeoPath ?? bundle.manifest.imagery.path);
      backgroundOverlayRef.current.setUrl(`${bundle.assetRoot}/${path}`);
      if (neighborhoodBgRef.current && md?.neighborhood) {
        const nbPath = showOptical && md.neighborhood.orbitalGeoPath
          ? md.neighborhood.orbitalGeoPath
          : md.neighborhood.terrainGeoPath;
        neighborhoodBgRef.current.setUrl(`${bundle.assetRoot}/${nbPath}`);
        neighborhoodBgRef.current.setOpacity(showOptical ? 0.95 : 0.88);
      }
      if (isMissionMap) {
        // When neighborhood is active:
        // In optical mode, overlay the high-res 880x880 CTX center chunk (opacity 0.95) over the neighborhood.
        // In terrain mode, let neighborhoodBgRef provide the unified hillshade (opacity 0.88) without double-darkening the center.
        backgroundOverlayRef.current.setOpacity(showOptical ? (hasNb ? 0.95 : 0.9) : (hasNb ? 0 : 0.9));
        contourOverlayRef.current?.setOpacity(showOptical ? 0 : 0.85);
      }
      backgroundOverlayRef.current.getElement()?.setAttribute('alt',
        showOptical && bundle.manifest.optical ? 'Orbital imagery aligned to Mars AEQD; source review required' : 'DEM-derived shaded relief aligned to Mars AEQD; not photography');
      return;
    }
    const path = showOptical && bundle.manifest.optical ? bundle.manifest.optical.path : bundle.manifest.imagery.path;
    backgroundOverlayRef.current.setUrl(`${bundle.assetRoot}/${path}`);
    backgroundOverlayRef.current.getElement()?.setAttribute('alt',
      showOptical && bundle.manifest.optical ? 'Orbital imagery aligned to terrain grid; source review required' : 'DEM-derived shaded relief; not photography');
  }, [bundle, showOptical, mapRevision, isMissionMap]);

  // Toggle optional Geologic Units and Thermal Inertia overlays (Geographic Mars mode)
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!map || !L || !bundle || !isMarsGeographic(bundle.manifest)) return;
    const b = gridGeographicBounds(bundle.manifest);
    const latLngBounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);

    geologyOverlayRef.current?.remove();
    geologyOverlayRef.current = null;
    if (showGeology && bundle.manifest.contextLayers?.geologicUnits?.geoImagePath) {
      geologyOverlayRef.current = L.imageOverlay(
        `${bundle.assetRoot}/${bundle.manifest.contextLayers.geologicUnits.geoImagePath}`,
        latLngBounds,
        { opacity: 0.70, interactive: false, zIndex: 49 },
      ).addTo(map);
    }

    thermalOverlayRef.current?.remove();
    thermalOverlayRef.current = null;
    if (showThermal && bundle.manifest.contextLayers?.thermalInertia?.geoImagePath) {
      thermalOverlayRef.current = L.imageOverlay(
        `${bundle.assetRoot}/${bundle.manifest.contextLayers.thermalInertia.geoImagePath}`,
        latLngBounds,
        { opacity: 0.72, interactive: false, zIndex: 50 },
      ).addTo(map);
    }
  }, [bundle, showGeology, showThermal, mapRevision]);

  // Toggle Elevation Heatmap (hypsometric tint) overlay
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!map || !L || !bundle) return;
    elevationOverlayRef.current?.remove();
    elevationOverlayRef.current = null;
    neighborhoodHeatmapRef.current?.remove();
    neighborhoodHeatmapRef.current = null;
    if (!showElevation) return;

    if (isMarsGeographic(bundle.manifest)) {
      const nb = bundle.manifest.mapDisplay?.neighborhood;
      // When neighborhood heatmap is available, it covers all 25 chunks (22x22 km) seamlessly
      // using the global neighborhood elevation scale. Never stack a center chunk overlay with
      // mismatched local min/max over it.
      if (nb?.heatmapGeoPath) {
        const [nbSouth, nbWest, nbNorth, nbEast] = nb.geographicBounds;
        neighborhoodHeatmapRef.current = L.imageOverlay(
          `${bundle.assetRoot}/${nb.heatmapGeoPath}`,
          L.latLngBounds([nbSouth, nbWest], [nbNorth, nbEast]),
          { opacity: 0.78, interactive: false, zIndex: 46 },
        ).addTo(map);
      } else {
        const b = gridGeographicBounds(bundle.manifest);
        const latLngBounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
        const url = elevationHeatmapPng(bundle, b);
        if (url) {
          elevationOverlayRef.current = L.imageOverlay(url, latLngBounds, {
            opacity: 0.75,
            interactive: false,
            zIndex: 47,
          }).addTo(map);
        }
      }
    } else {
      const h = bundle.manifest.height, w = bundle.manifest.width;
      const bounds = L.latLngBounds([[0, 0], [h, w]]);
      const url = elevationHeatmapPng(bundle);
      if (url) {
        elevationOverlayRef.current = L.imageOverlay(url, bounds, {
          opacity: 0.75,
          interactive: false,
          zIndex: 47,
        }).addTo(map);
      }
    }
  }, [bundle, showElevation, mapRevision]);

  // Frontier overlay for both Opportunity Navigator mode and live Mission Workbench mode
  useEffect(() => {
    if (!bundle || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    frontierRef.current?.remove();
    frontierRef.current = null;
    const h = bundle.manifest.height, w = bundle.manifest.width;

    if (isMissionMap) {
      if (!showFrontier || !liveFrontier) return;
      if (isMarsGeographic(bundle.manifest)) {
        const geoBounds = gridGeographicBounds(bundle.manifest);
        const image = liveFrontierPng(bundle, liveFrontier, geoBounds);
        if (image) {
          frontierRef.current = L.imageOverlay(image, [[geoBounds.south, geoBounds.west], [geoBounds.north, geoBounds.east]], {
            interactive: false,
            opacity: 0.92,
            zIndex: 51,
          }).addTo(mapRef.current);
        }
        return;
      }
      const image = liveFrontierPng(bundle, liveFrontier);
      if (image) {
        frontierRef.current = L.imageOverlay(image, [[0, 0], [h, w]], { interactive: false, opacity: 0.92 }).addTo(mapRef.current);
      }
      return;
    }

    if (isMarsGeographic(bundle.manifest)) {
      const geoBounds = gridGeographicBounds(bundle.manifest);
      const image = frontierPng(bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes, geoBounds);
      frontierRef.current = L.imageOverlay(image, [[geoBounds.south, geoBounds.west], [geoBounds.north, geoBounds.east]], {
        interactive: false,
        opacity: 1,
        zIndex: 52,
      }).addTo(mapRef.current);
      return;
    }
    const image = frontierPng(bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes);
    frontierRef.current = L.imageOverlay(image, [[0, 0], [h, w]], { interactive: false, opacity: 1 }).addTo(mapRef.current);
  }, [bundle, elapsedMinutes, missionBudgetMinutes, reserveMinutes, mapRevision, isMissionMap, showFrontier, liveFrontier]);

  // Explicit "Back to Jezero" viewport action
  useEffect(() => {
    if (!resetViewRequestKey || !mapRef.current || !leafletRef.current || !bundle) return;
    const map = mapRef.current, L = leafletRef.current;
    if (isMarsGeographic(bundle.manifest)) {
      const gb = gridGeographicBounds(bundle.manifest);
      const nb = neighborhoodOverview && bundle.manifest.mapDisplay?.neighborhood;
      const bounds = nb ? L.latLngBounds(nb.boundaryPolygonLatLng) : L.latLngBounds([gb.south, gb.west], [gb.north, gb.east]);
      map.fitBounds(bounds, { padding: [24, 24], animate: true });
    } else {
      map.fitBounds(L.latLngBounds([[0, 0], [bundle.manifest.height, bundle.manifest.width]]), { padding: [24, 24], animate: true });
    }
  }, [resetViewRequestKey, bundle, neighborhoodOverview]);

  // Explicit "Fit mission" viewport action
  useEffect(() => {
    if (!fitRequestKey || fitRequestKey === lastFitRequest.current || !mapRef.current || !leafletRef.current || !bundle) return;
    lastFitRequest.current = fitRequestKey;
    const map = mapRef.current, L = leafletRef.current;
    const toPt = (c: Cell): [number, number] =>
      isMarsGeographic(bundle.manifest)
        ? gridToMarsLatLng(c[0], c[1], bundle.manifest)
        : gridToViewer(c[0], c[1], bundle.manifest.height);
    const pts: [number, number][] = [];
    if (fitCells?.length) pts.push(...fitCells.map(toPt));
    if (!pts.length && mission?.position) pts.push(toPt(mission.position));
    for (const leg of fitCells?.length ? [] : mission?.planned ?? []) {
      for (const c of leg.route.geometryGrid) pts.push(toPt(c));
    }
    for (const c of outboundRoute?.geometryGrid ?? []) pts.push(toPt(c));
    for (const c of returnRoute?.geometryGrid ?? []) pts.push(toPt(c));
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 15, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    } else if (isMarsGeographic(bundle.manifest)) {
      const gb = gridGeographicBounds(bundle.manifest);
      const nb = neighborhoodOverview && bundle.manifest.mapDisplay?.neighborhood;
      const bounds = nb ? L.latLngBounds(nb.boundaryPolygonLatLng) : L.latLngBounds([gb.south, gb.west], [gb.north, gb.east]);
      map.fitBounds(bounds, { padding: [24, 24], animate: true });
    }
  }, [fitRequestKey, fitCells, bundle, mission, outboundRoute, returnRoute, mapRevision, neighborhoodOverview]);

  // Draw route geometry, hazards, contingency waypoints, and astronaut position
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!map || !L || !bundle) return;
    routeLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    routeLayerRef.current = layer;
    const geo = isMarsGeographic(bundle.manifest);
    const point = ([r, c]: Cell): [number, number] =>
      geo ? gridToMarsLatLng(r, c, bundle.manifest) : gridToViewer(r, c, bundle.manifest.height);

    const draw = (route: RouteSummary | null | undefined, color: string, dashArray?: string, glow?: boolean) => {
      if (route?.status !== 'READY' || route.geometryGrid.length < 2) return;
      const pts = route.geometryGrid.map(point);
      if (glow) {
        L.polyline(pts, { color, weight: 7, opacity: 0.16, interactive: false }).addTo(layer);
      }
      L.polyline(pts, { color, weight: 3, opacity: 0.96, interactive: false, dashArray }).addTo(layer);
    };

    draw(outboundRoute, '#f3a833', undefined, true);
    draw(returnRoute, '#34d399', '6 7', false);

    if (mission) {
      mission.traveled?.forEach(record => L.polyline(record.cells.map(point), {
        color: '#94a3b8', weight: 4.5, interactive: false,
      }).addTo(layer));
      mission.previous?.forEach(leg => draw(leg.route, '#e1ddd3', '3 8'));
      mission.previousSpans?.forEach(cells => {
        L.polyline(cells.map(point), {
          color: '#f5efe5', weight: 3, opacity: 0.7, dashArray: '4 6',
        }).addTo(layer).bindTooltip('Previous path');
      });

      for (const [index, leg] of mission.planned.entries()) {
        const isReturn = leg.targetId === landingId;
        if (mission.onSelectLeg && leg.route.status === 'READY' && leg.route.geometryGrid.length > 1) {
          const focused = mission.focusedLeg === index;
          const points = leg.route.geometryGrid.map(point);
          L.polyline(points, {color: '#162e2b', weight: focused ? 8 : 5, interactive: false}).addTo(layer);
          L.polyline(points, {
            color: mission.preview ? '#f7d28c' : focused ? '#a0f5dc' : '#36c7ab', weight: focused ? 5 : 3,
            opacity: focused ? 1 : 0.86, dashArray: isReturn ? '7 5' : undefined,
          }).addTo(layer).bindTooltip(leg.to).on('click', event => {
            L.DomEvent.stopPropagation(event);
            mission.onSelectLeg?.(index);
          });
        } else {
          draw(leg.route, '#27c5ae', isReturn ? '7 5' : undefined, true);
        }
        const end = leg.route.geometryGrid.at(-1);
        if (end && !isReturn) {
          const marker = L.circleMarker(point(end), {
            radius: 6.5, color: '#ecf5eb', fillColor: '#10584e',
            fillOpacity: 1, weight: 3, interactive: neighborhoodOverview, bubblingMouseEvents: false,
          }).addTo(layer);
          if (neighborhoodOverview) {
            const openStopActions = (event: import('leaflet').LeafletMouseEvent) => {
              const [lat, lon] = point(end);
              const elevation = elevationAtCell(bundle, end);
              onInspectRef.current?.({
                lat: geo ? lat : null, lon: geo ? lon : null, cell: end, status: 'COVERED',
                label: leg.to, elevationMeters: Number.isFinite(elevation) ? elevation : null,
                screenPoint: [event.originalEvent.clientX, event.originalEvent.clientY],
              });
            };
            marker.on('click', openStopActions);
            marker.on('contextmenu', openStopActions);
          }
          const label = document.createElement('span');
          label.textContent = `${index + 1}. ${leg.to.split(' · ')[0].replace(/ \(\d+, \d+\)$/, '')}`;
          const closeToPrevious = mission.planned.slice(0, index).some(previousLeg => {
            const previousEnd = previousLeg.route.geometryGrid.at(-1);
            return previousEnd && Math.hypot(previousEnd[0] - end[0], previousEnd[1] - end[1]) < 8;
          });
          if (mission.onSelectLeg) label.textContent = `${index + 1}. ${leg.to.split(' · ')[0]} · ${Math.round(leg.arrival - leg.departure)} min`;
          marker.bindTooltip(label, {
            permanent: true,
            direction: closeToPrevious ? 'left' : 'right',
            offset: [closeToPrevious ? -9 : 9, closeToPrevious ? 10 : -8],
            className: 'mission-map-label',
          });
        }
        for (const waypoint of leg.waypoints) {
          L.circleMarker(point(waypoint.cell), {
            radius: 4, color: '#a7f3d0', fillColor: '#064e3b', fillOpacity: 1,
            interactive: false,
          }).addTo(layer);
        }
      }

      mission.hazards?.forEach(zone => {
        if (geo) {
          L.polygon(marsGeodesicCircleLatLngs(zone.cell, zone.radius, bundle.manifest), {
            color: '#ef4444', weight: 2, fillOpacity: 0.24, dashArray: '4 4', interactive: false,
          }).addTo(layer);
        } else {
          L.circle(point(zone.cell), {
            radius: zone.radius + 0.5, color: '#ef4444',
            fillOpacity: 0.22, dashArray: '4 4', interactive: false,
          }).addTo(layer);
        }
      });

      if (mission.position) {
        L.circleMarker(point(mission.position), {
          radius: 8, color: '#fef3c7', fillColor: '#10b981',
          fillOpacity: 1, weight: 3, interactive: false,
        }).addTo(layer).bindTooltip(`Astronaut (${mission.position[0]}, ${mission.position[1]})`);
      }
      if (mission.selected) {
        L.circleMarker(point(mission.selected), {
          radius: 8.5, color: '#fde047', weight: 2.5, fillOpacity: 0, interactive: false,
        }).addTo(layer);
      }
    }
    return () => { layer.remove(); if (routeLayerRef.current === layer) routeLayerRef.current = null; };
  }, [bundle, outboundRoute, returnRoute, mapRevision, mission, neighborhoodOverview]);

  // Draw documented targets, base markers, and selected pin (always visible before stop selection)
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current, layer = selectionLayerRef.current;
    if (!map || !L || !layer || !bundle) return;
    layer.clearLayers();
    const geo = isMarsGeographic(bundle.manifest);
    const point = ([r, c]: Cell): [number, number] =>
      geo ? gridToMarsLatLng(r, c, bundle.manifest) : gridToViewer(r, c, bundle.manifest.height);

    const markerColors = { ROBUST: '#10b981', MARGINAL: '#f59e0b', INFEASIBLE: '#ef4444', UNKNOWN: '#9ca3af' };
    const docTargets = opportunities.length > 0
      ? targetMarkers(opportunities, bundle.manifest.height, bundle.manifest.width)
      : (bundle.manifest.scienceTargets ?? []).flatMap(t => {
        const { gridRow: row, gridCol: col, confidence } = t.location;
        if (confidence === 'APPROXIMATE_REGION' || row === null || col === null) return [];
        const [vLat, vLon] = gridToViewer(row, col, bundle.manifest.height);
        return [{ id: t.id, title: t.name, row, col, viewerLatitude: vLat, viewerLongitude: vLon, state: 'ROBUST' as const }];
      });

    for (const [idx, pt] of docTargets.entries()) {
      const latLng: [number, number] = geo ? gridToMarsLatLng(pt.row, pt.col, bundle.manifest) : [pt.viewerLatitude, pt.viewerLongitude];
      const marker = L.circleMarker(latLng, {
        radius: 5.5, color: '#14110f', weight: 1.5, fillColor: markerColors[pt.state], fillOpacity: 0.98,
        bubblingMouseEvents: false,
      }).addTo(layer);
      const tooltip = document.createElement('span');
      tooltip.textContent = opportunities.length > 0
        ? `${pt.title} · ${pt.state.toLowerCase()} (research scenario)`
        : `${pt.title} (${pt.row}, ${pt.col})`;
      // Offset close adjacent tooltips (e.g. Swift Run & Hazeltop are 1 cell apart)
      const nearPrev = docTargets.slice(0, idx).some(prev => Math.hypot(prev.row - pt.row, prev.col - pt.col) < 8);
      marker.bindTooltip(tooltip, {
        direction: nearPrev ? 'bottom' : 'top',
        offset: [0, nearPrev ? 8 : -8],
      });
      const inspectTarget = (screenPoint?: MapPointInspection['screenPoint']) => {
        const pinIdx = pt.row * bundle.manifest.width + pt.col;
        const unitIdx = bundle.contextData?.geologicUnitGrid?.[pinIdx] ?? 0;
        const unitObj = unitIdx > 0 ? bundle.contextData?.geologicUnits?.units.find(u => u.index === unitIdx) : undefined;
        onInspectRef.current?.({
          screenPoint,
          lat: geo ? latLng[0] : null,
          lon: geo ? latLng[1] : null,
          cell: [pt.row, pt.col],
          status: 'COVERED',
          label: pt.title,
          elevationMeters: Number.isFinite(bundle.elevationMeters[pinIdx]) ? bundle.elevationMeters[pinIdx] : null,
          geologicUnit: unitObj ? `${unitObj.symbol} · ${unitObj.name}` : null,
          thermalInertia:
            bundle.contextData?.thermalInertia && Number.isFinite(bundle.contextData.thermalInertia[pinIdx])
              ? bundle.contextData.thermalInertia[pinIdx]
              : null,
          frontierStatus: frontierTierStatusLabel(liveFrontierRef.current?.[pinIdx]),
        });
        if (!isMissionMap) onSelectRef.current(pt.row, pt.col);
      };
      const inspectMarker = (event: import('leaflet').LeafletMouseEvent) => {
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const bounds = map.getContainer().getBoundingClientRect();
        const original = event.originalEvent;
        inspectTarget(original ? [original.clientX, original.clientY] : [bounds.left + center.x, bounds.top + center.y]);
      };
      marker.on('click', inspectMarker);
      if (neighborhoodOverview) marker.on('contextmenu', inspectMarker);
      if (isMissionMap) {
        const pin = marker.getElement();
        pin?.setAttribute('role', 'button');
        pin?.setAttribute('tabindex', '0');
        pin?.setAttribute('aria-label', `Inspect ${pt.title}`);
        pin?.addEventListener('keydown', (event: Event) => {
          const key = (event as KeyboardEvent).key;
          if (key !== 'Enter' && key !== ' ' &&
              !(neighborhoodOverview && (key === 'ContextMenu' || ((event as KeyboardEvent).shiftKey && key === 'F10')))) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = pin.getBoundingClientRect();
          inspectTarget([rect.left + rect.width / 2, rect.top + rect.height / 2]);
        });
      }
    }

    const [br, bc] = [Math.floor(bundle.manifest.baseIndex / bundle.manifest.width), bundle.manifest.baseIndex % bundle.manifest.width];
    L.circleMarker(point([br, bc]), {
      radius: 6.5, color: '#f3a833', weight: 3, fillColor: '#181512', fillOpacity: 1,
    }).addTo(layer).bindTooltip(`Scenario landing site (${br}, ${bc})`);

    const historic = bundle.manifest.historicalLandingCell;
    if (historic) {
      L.circleMarker(point(historic), {
        radius: 5, color: '#cbd5e1', fillOpacity: 0.2, interactive: true,
      }).addTo(layer).bindTooltip('Historical Perseverance landing · Octavia E. Butler');
    }

    if (selectedCell) {
      L.circleMarker(point(selectedCell), {
        radius: 7.5, color: '#fde047', weight: 2.5, fillColor: '#e58e26', fillOpacity: 1,
      }).addTo(layer).bindTooltip('Selected scenario destination');
    }
  }, [bundle, selectedCell, opportunities, mapRevision, isMissionMap, neighborhoodOverview]);

  return (
    <div className="map-root-wrap">
      <div
        className="map-root"
        ref={element}
        style={show3D && bundle ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
        role="application"
        aria-label="Mars seamless terrain map viewer; pan across Jezero crater or zoom out to global Mars"
      />
      {show3D && bundle && (
        <Mars3DView
          bundle={bundle}
          onCellSelect={onCellSelect}
          onInspectPoint={onInspectPoint}
          selectedCell={selectedCell}
          outboundRoute={outboundRoute}
          returnRoute={returnRoute}
          showOptical={showOptical}
          showElevation={showElevation}
          showGeology={showGeology}
          showThermal={showThermal}
          opportunities={opportunities}
          mission={mission}
          onExit3D={onToggle3D}
          routePreview={Boolean(mission?.onSelectLeg)}
        />
      )}
      {!show3D && useMarsGeo && (scaleInfo || cursorInfo) && (
        <div className="cc-mars-scale-bar" aria-live="off">
          {scaleInfo && (
            <div className="cc-scale-graphic" title="Spherical Mars distance scale (R = 3,396,190 m)">
              <span className="cc-scale-line" style={{ width: `${scaleInfo.widthPx}px` }} />
              <strong>{scaleInfo.label}</strong>
              <small>{scaleInfo.zoomLabel}</small>
            </div>
          )}
          {cursorInfo && <span className="cc-cursor-coord">{cursorInfo}</span>}
        </div>
      )}
      <MapLegend
        bundle={bundle}
        showOptical={showOptical}
        showElevation={showElevation}
        showGeology={showGeology}
        showThermal={showThermal}
        showFrontier={showFrontier}
        isMissionMap={isMissionMap}
        hasPlannedRoute={(mission?.planned?.length ?? 0) > 0 || outboundRoute?.status === 'READY'}
        hasPreviousRoute={(mission?.previousSpans?.length ?? 0) > 0 || (mission?.previous?.length ?? 0) > 0 || returnRoute?.status === 'READY'}
        hasHazards={(mission?.hazards?.length ?? 0) > 0}
      />
    </div>
  );
}

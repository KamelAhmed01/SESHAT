'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FieldBundle } from '@/data/loader';
import { gridToMarsLatLng, indexToGrid, isMarsGeographic } from '@/cartography/coordinates';
import { landingId } from '@/engine/multi-leg-planner';
import type { MissionLeg } from '@/engine/multi-leg-planner';
import type { TravelRecord } from '@/engine/lifecycle-store';
import type { Cell, HazardZone } from '@/engine/traverse-graph';
import { elevationAtCell, hasModeledTerrain } from '@/engine/traverse-graph';
import type { RouteSummary } from '@/engine/types';
import type { OpportunityEntry } from '@/engine/opportunity-ledger';
import type { MapPointInspection } from './LeafletGrid';

interface Mars3DViewProps {
  bundle: FieldBundle;
  onCellSelect: (row: number, col: number) => void;
  onInspectPoint?: (info: MapPointInspection) => void;
  selectedCell: [number, number] | null;
  outboundRoute?: RouteSummary | null;
  returnRoute?: RouteSummary | null;
  showOptical?: boolean;
  showElevation?: boolean;
  showGeology?: boolean;
  showThermal?: boolean;
  opportunities?: readonly OpportunityEntry[];
  mission?: {
    planned: readonly MissionLeg[];
    previous?: readonly MissionLeg[];
    traveled?: readonly TravelRecord[];
    hazards?: readonly HazardZone[];
    position?: Cell;
    selected?: Cell | null;
    previousSpans?: readonly Cell[][];
    focusedLeg?: number;
  };
  onExit3D?: () => void;
  routePreview?: boolean;
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

function hypsometricRgb(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  if (c <= 0.22) {
    const u = c / 0.22;
    return [25 + u * (20 - 25), 28 + u * (165 - 28), 135 + u * (215 - 135)];
  }
  if (c <= 0.46) {
    const u = (c - 0.22) / 0.24;
    return [20 + u * (34 - 20), 165 + u * (197 - 165), 215 + u * (94 - 215)];
  }
  if (c <= 0.62) {
    const u = (c - 0.46) / 0.16;
    return [34 + u * (245 - 34), 197 + u * (165 - 197), 94 + u * (15 - 94)];
  }
  if (c <= 0.76) {
    const u = (c - 0.62) / 0.14;
    return [245 + u * (235 - 245), 165 + u * (50 - 165), 15 + u * (40 - 15)];
  }
  const u = (c - 0.76) / 0.24;
  return [235 + u * (248 - 235), 50 + u * (175 - 50), 40 + u * (195 - 40)];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [16, 185, 129];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface TextureData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function sampleTextureBilinear(
  tex: TextureData,
  u: number,
  v: number,
): [number, number, number] {
  const fx = Math.max(0, Math.min(1, u)) * (tex.width - 1);
  const fy = Math.max(0, Math.min(1, v)) * (tex.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(tex.width - 1, x0 + 1);
  const y1 = Math.min(tex.height - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;

  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  const i00 = (y0 * tex.width + x0) * 4;
  const i10 = (y0 * tex.width + x1) * 4;
  const i01 = (y1 * tex.width + x0) * 4;
  const i11 = (y1 * tex.width + x1) * 4;

  const d = tex.data;
  return [
    d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11,
    d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11,
    d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11,
  ];
}

export function Mars3DView({
  bundle,
  onCellSelect,
  onInspectPoint,
  selectedCell,
  outboundRoute,
  returnRoute,
  showOptical = false,
  showElevation = false,
  showGeology = false,
  showThermal = false,
  mission,
  onExit3D,
  routePreview = false,
}: Mars3DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasNeighborhood = Boolean(
    bundle.manifest.mapDisplay?.neighborhood &&
      bundle.contextData?.neighborhoodElevation &&
      bundle.contextData?.neighborhoodMask,
  );

  // Scope: 'neighborhood' shows all 5x5 chunks (22x22 km), 'center' zooms into the central 4.4x4.4 km chunk
  const [scope, setScope] = useState<'neighborhood' | 'center'>(hasNeighborhood ? 'neighborhood' : 'center');
  const [headingDeg, setHeadingDeg] = useState<number>(-32);
  const [tiltDeg, setTiltDeg] = useState<number>(56);
  const [zoom, setZoom] = useState<number>(1.12);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(18);
  const [exaggeration, setExaggeration] = useState<number>(routePreview ? 1 : 3.5);
  const [showChunkGrid, setShowChunkGrid] = useState(true);
  const [centerTexture, setCenterTexture] = useState<TextureData | null>(null);
  const [neighborhoodTexture, setNeighborhoodTexture] = useState<TextureData | null>(null);

  const dragRef = useRef<{
    mode: 'orbit' | 'pan';
    startX: number;
    startY: number;
    startHeading: number;
    startTilt: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  // Load ground textures for 3D rendering (both center high-res chunk and surrounding neighborhood)
  useEffect(() => {
    let cancelled = false;
    const loadImg = (path: string, onLoaded: (td: TextureData) => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        const off = document.createElement('canvas');
        off.width = img.width;
        off.height = img.height;
        const ctx = off.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        onLoaded({ data: imageData.data, width: img.width, height: img.height });
      };
      img.src = `${bundle.assetRoot}/${path}`;
    };

    // Center chunk high-resolution zoomed-in texture (880x880)
    const centerPath = showOptical
      ? (bundle.manifest.mapDisplay?.orbitalGeoPath ?? 'imagery/orbital-geo.webp')
      : (bundle.manifest.mapDisplay?.terrainGeoPath ?? 'imagery/study-area-geo.webp');
    loadImg(centerPath, setCenterTexture);

    // 5x5 neighborhood wide context texture (880x880 covering 22x22 km)
    const nb = bundle.manifest.mapDisplay?.neighborhood;
    if (nb) {
      const nbPath = showOptical
        ? (nb.orbitalGeoPath ?? 'imagery/neighborhood-orbital-geo.webp')
        : (nb.terrainGeoPath ?? 'imagery/neighborhood-terrain-geo.webp');
      loadImg(nbPath, setNeighborhoodTexture);
    }

    return () => {
      cancelled = true;
    };
  }, [bundle, showOptical]);

  // Precompute subsampled 3D terrain mesh (~88 x 88 vertices) for 60 FPS interactive rendering
  const mesh = useMemo(() => {
    const m = bundle.manifest;
    const nb = m.mapDisplay?.neighborhood;
    const useNb =
      scope === 'neighborhood' &&
      nb &&
      bundle.contextData?.neighborhoodElevation &&
      bundle.contextData?.neighborhoodMask;

    const srcW = useNb ? nb.width : m.width;
    const srcH = useNb ? nb.height : m.height;
    const elev = useNb ? bundle.contextData!.neighborhoodElevation! : bundle.elevationMeters;
    const mask = useNb ? bundle.contextData!.neighborhoodMask! : bundle.mask;
    const spanMeters = useNb ? nb.spanMeters : m.width * m.cellWidthMeters;
    const cellMeters = useNb ? nb.cellWidthMeters : m.cellWidthMeters;

    const meshSide = 110;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < elev.length; i++) {
      if (mask[i] === 1 && Number.isFinite(elev[i])) {
        if (elev[i] < minZ) minZ = elev[i];
        if (elev[i] > maxZ) maxZ = elev[i];
      }
    }
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      minZ = -2600;
      maxZ = -2400;
    }

    // Center chunk min/max and thermal/geology lookups
    const centerW = m.width;
    const centerH = m.height;
    const ti = bundle.contextData?.thermalInertia;
    const tiMin = m.contextLayers?.thermalInertia?.minValue ?? 140;
    const tiMax = m.contextLayers?.thermalInertia?.maxValue ?? 305;
    const geoGrid = bundle.contextData?.geologicUnitGrid;
    const geoUnits = bundle.contextData?.geologicUnits?.units ?? [];
    const unitRgbMap = new Map<number, [number, number, number]>();
    for (const u of geoUnits) {
      unitRgbMap.set(u.index, hexToRgb(u.color));
    }

    const zGrid = new Float32Array((meshSide + 1) * (meshSide + 1));
    const validGrid = new Uint8Array((meshSide + 1) * (meshSide + 1));

    for (let mr = 0; mr <= meshSide; mr++) {
      const sr = Math.min(srcH - 1, Math.floor((mr / meshSide) * (srcH - 1)));
      for (let mc = 0; mc <= meshSide; mc++) {
        const sc = Math.min(srcW - 1, Math.floor((mc / meshSide) * (srcW - 1)));
        const idx = sr * srcW + sc;
        const v = mask[idx] === 1 && Number.isFinite(elev[idx]);
        validGrid[mr * (meshSide + 1) + mc] = v ? 1 : 0;
        zGrid[mr * (meshSide + 1) + mc] = v ? elev[idx] : minZ;
      }
    }

    return {
      useNb: Boolean(useNb),
      meshSide,
      srcW,
      srcH,
      centerW,
      centerH,
      spanMeters,
      cellMeters,
      minZ,
      maxZ,
      zGrid,
      validGrid,
      ti,
      tiMin,
      tiMax,
      geoGrid,
      unitRgbMap,
    };
  }, [bundle, scope]);

  // Project normalized coordinates (nx in [-0.5, 0.5], ny in [-0.5, 0.5], elevMeters) into canvas (sx, sy, depth)
  const projectPoint = useCallback(
    (nx: number, ny: number, elevMeters: number, width: number, height: number) => {
      const radH = (headingDeg * Math.PI) / 180;
      const radT = (tiltDeg * Math.PI) / 180;
      const cosH = Math.cos(radH);
      const sinH = Math.sin(radH);
      const cosT = Math.cos(radT);
      const sinT = Math.sin(radT);

      const scale = Math.min(width, height) * 0.70 * zoom;
      const zMid = (mesh.minZ + mesh.maxZ) * 0.5;
      const zNorm =
        ((elevMeters - zMid) / Math.max(1, mesh.spanMeters)) * exaggeration;

      // Rotate in horizontal plane (nx East, ny South)
      const rx = nx * cosH - ny * sinH;
      const ry = nx * sinH + ny * cosH;

      // Distance from camera to center pivot
      const camDist = 2.4 / Math.max(0.35, zoom);
      // Depth along camera line-of-sight (looking from front/south towards back/north)
      const camDepth = Math.max(0.6, camDist - ry * cosT + zNorm * sinT);
      const persp = 2.15 / camDepth;

      const sx = width * 0.5 + panX + rx * scale * persp;
      const sy =
        height * 0.52 +
        panY +
        (ry * sinT - zNorm * cosT) * scale * persp;

      return { sx, sy, depth: camDepth, persp };
    },
    [headingDeg, tiltDeg, zoom, panX, panY, exaggeration, mesh.minZ, mesh.maxZ, mesh.spanMeters],
  );

  // Convert any cell [row, col] into normalized [-0.5, +0.5] coordinates in the active 3D scope
  const centerCellToNorm = useCallback(
    (row: number, col: number): { nx: number; ny: number; elev: number } => {
      const m = bundle.manifest;
      const u = (col + 0.5) / m.width - 0.5;
      const v = (row + 0.5) / m.height - 0.5;
      if (mesh.useNb) {
        const chunksPerSide = m.mapDisplay?.neighborhood?.chunksPerSide ?? 5;
        const nbCol = Math.min(549, Math.max(0, Math.floor(220 + col / 2)));
        const nbRow = Math.min(549, Math.max(0, Math.floor(220 + row / 2)));
        const nbElev = bundle.contextData?.neighborhoodElevation?.[nbRow * 550 + nbCol];
        const elev: number = typeof nbElev === 'number' && Number.isFinite(nbElev) ? nbElev : mesh.minZ;
        return { nx: u / chunksPerSide, ny: v / chunksPerSide, elev };
      }
      const cIdx = Math.max(0, Math.min(m.height - 1, Math.floor(row))) * m.width +
        Math.max(0, Math.min(m.width - 1, Math.floor(col)));
      const elev = Number.isFinite(bundle.elevationMeters[cIdx]) ? bundle.elevationMeters[cIdx] : mesh.minZ;
      return { nx: u, ny: v, elev };
    },
    [bundle, mesh.minZ, mesh.useNb],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Deep Martian Space / Atmosphere Horizon Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0908');
    bgGrad.addColorStop(0.45, '#151210');
    bgGrad.addColorStop(1, '#1c1714');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const N = mesh.meshSide;
    const zSpan = Math.max(1, mesh.maxZ - mesh.minZ);
    const stepMeters = mesh.spanMeters / N;

    // Pre-project all (N+1) x (N+1) vertices
    const projX = new Float32Array((N + 1) * (N + 1));
    const projY = new Float32Array((N + 1) * (N + 1));
    const projDepth = new Float32Array((N + 1) * (N + 1));

    for (let r = 0; r <= N; r++) {
      const ny = r / N - 0.5;
      for (let c = 0; c <= N; c++) {
        const nx = c / N - 0.5;
        const idx = r * (N + 1) + c;
        const p = projectPoint(nx, ny, mesh.zGrid[idx], width, height);
        projX[idx] = p.sx;
        projY[idx] = p.sy;
        projDepth[idx] = p.depth;
      }
    }

    // Build and depth-sort quads (back-to-front painter's algorithm)
    const quadCount = N * N;
    const quadOrder = new Int32Array(quadCount);
    const quadDepths = new Float32Array(quadCount);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const qIdx = r * N + c;
        quadOrder[qIdx] = qIdx;
        const i00 = r * (N + 1) + c;
        const i01 = i00 + 1;
        const i10 = (r + 1) * (N + 1) + c;
        const i11 = i10 + 1;
        quadDepths[qIdx] = (projDepth[i00] + projDepth[i01] + projDepth[i10] + projDepth[i11]) * 0.25;
      }
    }
    quadOrder.sort((a, b) => quadDepths[b] - quadDepths[a]);

    // Directional solar illumination vector (from NW upper sky)
    const lx = -0.48;
    const ly = -0.48;
    const lz = 0.734;

    const chunksPerSide = bundle.manifest.mapDisplay?.neighborhood?.chunksPerSide ?? 5;

    // 2. Render 3D terrain surface quads + draped layers + terrain skirt
    for (let k = 0; k < quadCount; k++) {
      const qIdx = quadOrder[k];
      const r = Math.floor(qIdx / N);
      const c = qIdx % N;
      const i00 = r * (N + 1) + c;
      const i01 = i00 + 1;
      const i10 = (r + 1) * (N + 1) + c;
      const i11 = i10 + 1;

      if (!mesh.validGrid[i00] && !mesh.validGrid[i11]) continue;

      const z00 = mesh.zGrid[i00];
      const z01 = mesh.zGrid[i01];
      const z10 = mesh.zGrid[i10];
      const z11 = mesh.zGrid[i11];
      const zMean = (z00 + z01 + z10 + z11) * 0.25;

      // Surface normal and hillshade factor
      const dzdx = ((z01 - z00 + (z11 - z10)) * 0.5) / stepMeters;
      const dzdy = ((z10 - z00 + (z11 - z01)) * 0.5) / stepMeters;
      const nx = -dzdx * 1.6;
      const ny = -dzdy * 1.6;
      const nz = 1.0;
      const norm = Math.hypot(nx, ny, nz);
      const illum = Math.max(0.15, Math.min(1.0, (nx * lx + ny * ly + nz * lz) / norm));
      const shade = 0.42 + 0.68 * illum;

      const uFrac = (c + 0.5) / N;
      const vFrac = (r + 0.5) / N;

      // Check if quad lies inside the central 220x220 mission chunk
      const inCenterChunk = mesh.useNb
        ? uFrac >= (2 / chunksPerSide) &&
          uFrac <= (3 / chunksPerSide) &&
          vFrac >= (2 / chunksPerSide) &&
          vFrac <= (3 / chunksPerSide)
        : true;

      const centerU = mesh.useNb ? (uFrac - 2 / chunksPerSide) * chunksPerSide : uFrac;
      const centerV = mesh.useNb ? (vFrac - 2 / chunksPerSide) * chunksPerSide : vFrac;

      // Base ground color:
      // When inside the central chunk, sample the high-res 880x880 centerTexture (using centerU, centerV).
      // When in the outer neighborhood, sample the 880x880 neighborhoodTexture (using uFrac, vFrac).
      // Bilinear interpolation ensures continuous, smooth rendering with zero blocky pixel artifacts.
      let cr: number;
      let cg: number;
      let cb: number;

      if (inCenterChunk && centerTexture) {
        const [tr, tg, tb] = sampleTextureBilinear(centerTexture, centerU, centerV);
        const boost = showOptical ? (0.55 + 0.55 * illum) : (0.44 + 0.66 * illum);
        cr = tr * boost;
        cg = tg * boost;
        cb = tb * boost;
      } else if (neighborhoodTexture) {
        const [tr, tg, tb] = sampleTextureBilinear(neighborhoodTexture, uFrac, vFrac);
        const boost = showOptical ? (0.55 + 0.55 * illum) : (0.44 + 0.66 * illum);
        cr = tr * boost;
        cg = tg * boost;
        cb = tb * boost;
      } else {
        // Fallback procedural terracotta DEM relief
        const tElev = Math.max(0, Math.min(1, (zMean - mesh.minZ) / zSpan));
        cr = (82 + 74 * tElev) * shade;
        cg = (56 + 53 * tElev) * shade;
        cb = (48 + 41 * tElev) * shade;
      }

      // Layer 1: Hypsometric Elevation Heatmap
      if (showElevation) {
        const tElev = elevToNormalizedT(zMean, mesh.minZ, mesh.maxZ);
        const [hr, hg, hb] = hypsometricRgb(tElev);
        cr = hr * (0.52 + 0.52 * illum);
        cg = hg * (0.52 + 0.52 * illum);
        cb = hb * (0.52 + 0.52 * illum);
      }

      // Layer 2: Stack et al. (2020) Geologic Bedrock Units (inside central science corridor)
      if (showGeology && inCenterChunk && mesh.geoGrid) {
        const gr = Math.min(mesh.centerH - 1, Math.max(0, Math.floor(centerV * mesh.centerH)));
        const gc = Math.min(mesh.centerW - 1, Math.max(0, Math.floor(centerU * mesh.centerW)));
        const unitCode = mesh.geoGrid[gr * mesh.centerW + gc];
        const uRgb = mesh.unitRgbMap.get(unitCode);
        if (uRgb) {
          cr = cr * 0.35 + uRgb[0] * 0.65 * shade;
          cg = cg * 0.35 + uRgb[1] * 0.65 * shade;
          cb = cb * 0.35 + uRgb[2] * 0.65 * shade;
        }
      }

      // Layer 3: Edwards & Buz (2021) Thermal Inertia (inside central science corridor)
      if (showThermal && inCenterChunk && mesh.ti) {
        const tr = Math.min(mesh.centerH - 1, Math.max(0, Math.floor(centerV * mesh.centerH)));
        const tc = Math.min(mesh.centerW - 1, Math.max(0, Math.floor(centerU * mesh.centerW)));
        const tiVal = mesh.ti[tr * mesh.centerW + tc];
        if (Number.isFinite(tiVal) && tiVal > 0) {
          const normTi = Math.max(0, Math.min(1, (tiVal - mesh.tiMin) / Math.max(1, mesh.tiMax - mesh.tiMin)));
          const trR = 45 + 205 * normTi;
          const trG = 90 + 110 * (1 - Math.abs(normTi - 0.5) * 2);
          const trB = 185 * (1 - normTi) + 35;
          cr = cr * 0.32 + trR * 0.68 * shade;
          cg = cg * 0.32 + trG * 0.68 * shade;
          cb = cb * 0.32 + trB * 0.68 * shade;
        }
      }

      const rgbStr = `rgb(${Math.round(Math.min(255, cr))},${Math.round(Math.min(255, cg))},${Math.round(Math.min(255, cb))})`;
      ctx.fillStyle = rgbStr;
      ctx.strokeStyle = rgbStr;
      ctx.lineWidth = 0.65;

      ctx.beginPath();
      ctx.moveTo(projX[i00], projY[i00]);
      ctx.lineTo(projX[i01], projY[i01]);
      ctx.lineTo(projX[i11], projY[i11]);
      ctx.lineTo(projX[i10], projY[i10]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Clean Perimeter Rim (replaces opaque occluding pedestal skirt)
    ctx.strokeStyle = 'rgba(201, 169, 130, 0.40)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let c = 0; c <= N; c++) {
      const idx = c;
      if (c === 0) ctx.moveTo(projX[idx], projY[idx]);
      else ctx.lineTo(projX[idx], projY[idx]);
    }
    for (let r = 0; r <= N; r++) {
      const idx = r * (N + 1) + N;
      ctx.lineTo(projX[idx], projY[idx]);
    }
    for (let c = N; c >= 0; c--) {
      const idx = N * (N + 1) + c;
      ctx.lineTo(projX[idx], projY[idx]);
    }
    for (let r = N; r >= 0; r--) {
      const idx = r * (N + 1);
      ctx.lineTo(projX[idx], projY[idx]);
    }
    ctx.stroke();

    // 4. Draw 5x5 Chunk Grid Lines & Ring Boundaries on 3D Surface
    if (showChunkGrid && mesh.useNb) {
      for (let k = 0; k <= chunksPerSide; k++) {
        const gridStep = Math.round((k / chunksPerSide) * N);
        // Horizontal chunk seam
        ctx.beginPath();
        for (let c = 0; c <= N; c++) {
          const idx = gridStep * (N + 1) + c;
          if (c === 0) ctx.moveTo(projX[idx], projY[idx]);
          else ctx.lineTo(projX[idx], projY[idx]);
        }
        ctx.strokeStyle = k === 2 || k === 3 ? 'rgba(56, 189, 248, 0.72)' : 'rgba(232, 194, 152, 0.34)';
        ctx.lineWidth = k === 2 || k === 3 ? 1.6 : 1.0;
        ctx.stroke();

        // Vertical chunk seam
        ctx.beginPath();
        for (let r = 0; r <= N; r++) {
          const idx = r * (N + 1) + gridStep;
          if (r === 0) ctx.moveTo(projX[idx], projY[idx]);
          else ctx.lineTo(projX[idx], projY[idx]);
        }
        ctx.stroke();
      }
    }

    // Highlight the Central 20 m Modeled Routing Chunk boundary
    if (mesh.useNb) {
      const rStart = Math.round((2 / chunksPerSide) * N);
      const rEnd = Math.round((3 / chunksPerSide) * N);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let c = rStart; c <= rEnd; c++) {
        const idx = rStart * (N + 1) + c;
        if (c === rStart) ctx.moveTo(projX[idx], projY[idx]);
        else ctx.lineTo(projX[idx], projY[idx]);
      }
      for (let r = rStart; r <= rEnd; r++) {
        const idx = r * (N + 1) + rEnd;
        ctx.lineTo(projX[idx], projY[idx]);
      }
      for (let c = rEnd; c >= rStart; c--) {
        const idx = rEnd * (N + 1) + c;
        ctx.lineTo(projX[idx], projY[idx]);
      }
      for (let r = rEnd; r >= rStart; r--) {
        const idx = r * (N + 1) + rStart;
        ctx.lineTo(projX[idx], projY[idx]);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw 3D Traverse Routes (Outbound, Return, and Multi-Leg Planned Routes)
    const drawRoute3D = (cells: readonly Cell[], color: string, widthPx: number, dashed = false) => {
      if (cells.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      cells.forEach(([r, c], idx) => {
        const { nx, ny, elev } = centerCellToNorm(r, c);
        const pt = projectPoint(nx, ny, elev + 3.5, width, height);
        if (idx === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      });
      ctx.stroke();
      ctx.restore();
    };

    if (mission) {
      mission.traveled?.forEach(leg => {
        if (leg.cells.length > 1) drawRoute3D(leg.cells, '#38bdf8', 3.4, false);
      });
      mission.previousSpans?.forEach(cells => drawRoute3D(cells, '#f5efe5', 2.4, true));
      mission.planned.forEach((leg, index) => {
        if (leg.route.geometryGrid.length > 1) {
          const isReturn = leg.targetId === landingId;
          drawRoute3D(
            leg.route.geometryGrid,
            routePreview ? index === mission.focusedLeg ? '#a0f5dc' : '#36c7ab' : isReturn ? '#38bdf8' : '#f3a833',
            routePreview && index === mission.focusedLeg ? 4.5 : 3.2,
            isReturn,
          );
        }
      });
    } else {
      if (outboundRoute?.status === 'READY') {
        drawRoute3D(outboundRoute.geometryGrid, '#f3a833', 3.2, false);
      }
      if (returnRoute?.status === 'READY') {
        drawRoute3D(returnRoute.geometryGrid, '#38bdf8', 2.8, true);
      }
    }

    // 6. Draw 3D Elevated Pins (Landing Base, Science Targets, Selected Cell)
    const draw3DPin = (
      row: number,
      col: number,
      label: string,
      color: string,
      stemHeightPx = 22,
      isSelected = false,
    ) => {
      const { nx, ny, elev } = centerCellToNorm(row, col);
      const ground = projectPoint(nx, ny, elev, width, height);
      const pinX = ground.sx;
      const pinY = ground.sy - stemHeightPx;

      // Ground shadow ring
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(ground.sx, ground.sy, 4.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Vertical stem
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.moveTo(ground.sx, ground.sy);
      ctx.lineTo(pinX, pinY);
      ctx.stroke();

      // Pin head
      ctx.fillStyle = color;
      ctx.strokeStyle = '#0c0b0a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(pinX, pinY, isSelected ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label pill
      ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textW = ctx.measureText(label).width;
      const boxX = pinX - textW / 2 - 6;
      const boxY = pinY - 24;
      ctx.fillStyle = 'rgba(14, 12, 11, 0.88)';
      ctx.strokeStyle = isSelected ? '#ffffff' : color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, textW + 12, 17, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f7f3ee';
      ctx.fillText(label, pinX - textW / 2, boxY + 12);
    };

    const [baseRow, baseCol] = indexToGrid(bundle.manifest.baseIndex, bundle.manifest.width);
    draw3DPin(baseRow, baseCol, 'Landing Base', '#f3a833', 26, false);

    for (const t of bundle.manifest.scienceTargets ?? []) {
      if (t.location.gridRow !== null && t.location.gridCol !== null) {
        const shortName = t.name.split('·')[0].trim();
        const isSel =
          selectedCell !== null &&
          selectedCell[0] === t.location.gridRow &&
          selectedCell[1] === t.location.gridCol;
        draw3DPin(t.location.gridRow, t.location.gridCol, shortName, '#10b981', 20, isSel);
      }
    }

    if (routePreview && mission?.position) {
      draw3DPin(mission.position[0], mission.position[1], 'Current position', '#a0f5dc', 24, true);
    }
    const activeSel = mission?.selected ?? selectedCell;
    if (activeSel) {
      draw3DPin(
        activeSel[0],
        activeSel[1],
        `(${activeSel[0]}, ${activeSel[1]})`,
        '#38bdf8',
        30,
        true,
      );
    }
  }, [
    bundle,
    mesh,
    projectPoint,
    centerCellToNorm,
    showOptical,
    centerTexture,
    neighborhoodTexture,
    showElevation,
    showGeology,
    showThermal,
    showChunkGrid,
    mission,
    outboundRoute,
    returnRoute,
    selectedCell,
    routePreview,
  ]);

  // Handle click on 3D surface to inspect/select nearest cell or chunk
  const handleCanvasClick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    const N = mesh.meshSide;
    let bestDist = Infinity;
    let bestR = 0;
    let bestC = 0;
    for (let r = 0; r <= N; r++) {
      const ny = r / N - 0.5;
      for (let c = 0; c <= N; c++) {
        const nx = c / N - 0.5;
        const p = projectPoint(nx, ny, mesh.zGrid[r * (N + 1) + c], width, height);
        const d = Math.hypot(p.sx - mx, p.sy - my);
        if (d < bestDist) {
          bestDist = d;
          bestR = r;
          bestC = c;
        }
      }
    }
    if (bestDist > 42) return;

    const uFrac = bestC / N;
    const vFrac = bestR / N;
    const m = bundle.manifest;
    const chunksPerSide = m.mapDisplay?.neighborhood?.chunksPerSide ?? 5;

    if (mesh.useNb) {
      const outerRings = (chunksPerSide - 1) / 2;
      const col = Math.min((outerRings + 1) * m.width - 1, Math.floor((uFrac * chunksPerSide - outerRings) * m.width));
      const row = Math.min((outerRings + 1) * m.height - 1, Math.floor((vFrac * chunksPerSide - outerRings) * m.height));
      const chunkCol = Math.floor(col / m.width);
      const chunkRow = Math.floor(row / m.height);
      const supported = hasModeledTerrain(bundle, [row, col]);
      const elev = supported ? elevationAtCell(bundle, [row, col]) : NaN;
      const [lat, lon] = isMarsGeographic(m) ? gridToMarsLatLng(row, col, m) : [null, null];

      const chDesc = m.mapDisplay?.neighborhood?.chunks.find(
        c => c.rowOffset === chunkRow && c.colOffset === chunkCol
      );
      const label = chDesc
        ? `${chDesc.label} · Cell (${row}, ${col})`
        : `Ring ${Math.max(Math.abs(chunkRow), Math.abs(chunkCol))} · (${row}, ${col})`;

      onInspectPoint?.({
        screenPoint: [clientX, clientY],
        lat,
        lon,
        cell: [row, col],
        status: supported ? 'COVERED' : 'NODATA',
        label,
        elevationMeters: Number.isFinite(elev) ? elev : null,
      });
      onCellSelect(row, col);
    } else {
      const row = Math.max(0, Math.min(m.height - 1, Math.floor(vFrac * m.height)));
      const col = Math.max(0, Math.min(m.width - 1, Math.floor(uFrac * m.width)));
      const elev = bundle.elevationMeters[row * m.width + col];
      const [lat, lon] = isMarsGeographic(m) ? gridToMarsLatLng(row, col, m) : [null, null];
      onInspectPoint?.({
        screenPoint: [clientX, clientY],
        lat,
        lon,
        cell: [row, col],
        status: 'COVERED',
        label: `Cell (${row}, ${col})`,
        elevationMeters: elev,
      });
      onCellSelect(row, col);
    }
  };

  return (
    <div
      className="mars-3d-viewport"
      data-testid="mars-3d-view"
      onContextMenu={e => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="mars-3d-canvas"
        onMouseDown={e => {
          const isPan = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey;
          dragRef.current = {
            mode: isPan ? 'pan' : 'orbit',
            startX: e.clientX,
            startY: e.clientY,
            startHeading: headingDeg,
            startTilt: tiltDeg,
            startPanX: panX,
            startPanY: panY,
            moved: false,
          };
        }}
        onMouseMove={e => {
          const d = dragRef.current;
          if (!d) return;
          const dx = e.clientX - d.startX;
          const dy = e.clientY - d.startY;
          if (Math.hypot(dx, dy) > 4) d.moved = true;
          if (d.mode === 'orbit') {
            setHeadingDeg((d.startHeading + dx * 0.45) % 360);
            setTiltDeg(Math.max(20, Math.min(88, d.startTilt - dy * 0.35)));
          } else {
            setPanX(d.startPanX + dx);
            setPanY(d.startPanY + dy);
          }
        }}
        onMouseUp={e => {
          const d = dragRef.current;
          dragRef.current = null;
          if (d && !d.moved && (e.button === 0 || (routePreview && e.button === 2))) {
            handleCanvasClick(e.clientX, e.clientY);
          }
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
        onWheel={e => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.91;
          setZoom(z => Math.max(0.55, Math.min(3.2, z * factor)));
        }}
      />

      {/* Google Maps-style 3D Camera & Chunk Scope Controls */}
      <div className={routePreview ? "mars-3d-hud-top mars-3d-navigation" : "mars-3d-hud-top"}>
        <div className="mars-3d-badge">
          <span className="mars-3d-badge-dot" />
          <span>
            3D Martian Topography ·{' '}
            {mesh.useNb
              ? `5×5 Chunks (22×22 km · ${Math.round(mesh.minZ)} m to ${Math.round(mesh.maxZ)} m)`
              : `Center Chunk (4.4×4.4 km · ${Math.round(mesh.minZ)} m to ${Math.round(mesh.maxZ)} m)`}
          </span>
        </div>

        <div className="mars-3d-controls-row">

          {hasNeighborhood && (
            <div className="mars-3d-pill-group" role="group" aria-label="3D Chunk Scope">
              <button
                type="button"
                className={scope === 'neighborhood' ? 'active' : ''}
                onClick={() => setScope('neighborhood')}
              >
                5×5 Chunks (22 km)
              </button>
              <button
                type="button"
                className={scope === 'center' ? 'active' : ''}
                onClick={() => setScope('center')}
              >
                Center Chunk (4.4 km)
              </button>
            </div>
          )}

          <div className="mars-3d-pill-group" role="group" aria-label="Vertical Exaggeration">
            <span className="mars-3d-pill-label">Relief:</span>
            {[1, 2, 3.5, 5].map(v => (
              <button
                key={v}
                type="button"
                className={exaggeration === v ? 'active' : ''}
                onClick={() => setExaggeration(v)}
              >
                {v}×
              </button>
            ))}
          </div>

          {mesh.useNb && (
            <button
              type="button"
              className={`mars-3d-btn ${showChunkGrid ? 'active' : ''}`}
              onClick={() => setShowChunkGrid(g => !g)}
            >
              25-Chunk Grid
            </button>
          )}

          {onExit3D && (
            <button type="button" className="mars-3d-btn mars-3d-exit" onClick={onExit3D}>
              2D Map
            </button>
          )}
        </div>
      </div>

      {/* Bottom-left Google Maps-style Orbit / Tilt / Compass widget */}
      <div className="mars-3d-compass-dock" role="group" aria-label="3D Camera Navigation">
        <button
          type="button"
          title="Orbit Left"
          aria-label="Orbit Left"
          onClick={() => setHeadingDeg(h => (h - 22.5) % 360)}
        >
          ↺
        </button>
        <button
          type="button"
          title="Orbit Right"
          aria-label="Orbit Right"
          onClick={() => setHeadingDeg(h => (h + 22.5) % 360)}
        >
          ↻
        </button>
        <button
          type="button"
          title="Tilt Down"
          aria-label="Tilt Down"
          onClick={() => setTiltDeg(t => Math.min(88, t + 8))}
        >
          ⤒
        </button>
        <button
          type="button"
          title="Tilt Up"
          aria-label="Tilt Up"
          onClick={() => setTiltDeg(t => Math.max(20, t - 8))}
        >
          ⤓
        </button>
        <button
          type="button"
          title="Top-Down Map View (88°)"
          aria-label="Top-Down Map View"
          onClick={() => {
            setTiltDeg(88);
            setHeadingDeg(0);
            setPanX(0);
            setPanY(0);
          }}
        >
          Top
        </button>
        <button
          type="button"
          title="Oblique 3D View (52°)"
          aria-label="Oblique 3D View"
          onClick={() => {
            setTiltDeg(52);
            setHeadingDeg(-30);
            setPanX(0);
            setPanY(0);
          }}
        >
          3D
        </button>
        <button
          type="button"
          title="Reset 3D View"
          aria-label="Reset 3D View"
          onClick={() => {
            setHeadingDeg(-30);
            setTiltDeg(52);
            setZoom(1.12);
            setPanX(0);
            setPanY(0);
          }}
        >
          Reset
        </button>
        <span className="mars-3d-hint">Drag: Orbit &amp; Tilt · Shift+Drag / Right-Drag: Pan · Scroll: Zoom</span>
      </div>
    </div>
  );
}

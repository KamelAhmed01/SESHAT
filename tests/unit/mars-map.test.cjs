const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MARS_SPHERE_RADIUS_METERS,
  aeqdMetersToLonLat,
  gridBoundaryLatLngs,
  gridGeographicBounds,
  gridPointToMarsLatLng,
  gridToMarsLatLng,
  isMarsGeographic,
  lonLatToAeqdMeters,
  marsLatLngToGrid,
  marsLatLngToGridFloat,
  marsSurfaceDistanceMeters,
  normalizeMarsEastLon,
} = require('../../.build/src/cartography/coordinates.js');

const manifest = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'public/data/manifest.json'), 'utf8'),
);

describe('Mars geographic AEQD coordinate transforms', () => {
  it('recognizes verified spherical AEQD metadata and rejects empty metadata', () => {
    assert.equal(isMarsGeographic(manifest), true);
    assert.equal(isMarsGeographic(null), false);
    assert.equal(isMarsGeographic({ width: 10, height: 10 }), false);
  });

  it('roundtrips all four corners, grid center, and every documented target exactly', () => {
    const h = manifest.height;
    const w = manifest.width;
    const samples = [
      [0, 0],
      [0, w - 1],
      [h - 1, 0],
      [h - 1, w - 1],
      [Math.floor(h / 2), Math.floor(w / 2)],
    ];

    for (const target of manifest.scienceTargets ?? []) {
      if (target.location?.gridRow !== null && target.location?.gridCol !== null) {
        samples.push([target.location.gridRow, target.location.gridCol]);
      }
    }

    for (const [row, col] of samples) {
      const [lat, lon] = gridToMarsLatLng(row, col, manifest);
      const backCell = marsLatLngToGrid(lat, lon, manifest);
      assert.deepEqual(backCell, [row, col], `cell (${row}, ${col}) failed integer inverse`);

      const backFloat = marsLatLngToGridFloat(lat, lon, manifest);
      assert.ok(backFloat !== null);
      assert.ok(Math.abs(backFloat[0] - (row + 0.5)) < 1e-7);
      assert.ok(Math.abs(backFloat[1] - (col + 0.5)) < 1e-7);
    }
  });

  it('matches manifest geographicBounds and boundary polygon closely', () => {
    const bounds = gridGeographicBounds(manifest);
    const [mSouth, mWest, mNorth, mEast] = manifest.mapDisplay.geographicBounds;
    assert.ok(Math.abs(bounds.south - mSouth) < 1e-4);
    assert.ok(Math.abs(bounds.west - mWest) < 1e-4);
    assert.ok(Math.abs(bounds.north - mNorth) < 1e-4);
    assert.ok(Math.abs(bounds.east - mEast) < 1e-4);

    const ring = gridBoundaryLatLngs(manifest, 16);
    assert.equal(ring.length, 64);
    for (const [lat, lon] of ring) {
      assert.ok(lat >= bounds.south - 1e-9 && lat <= bounds.north + 1e-9);
      assert.ok(lon >= bounds.west - 1e-9 && lon <= bounds.east + 1e-9);
    }
  });

  it('returns null outside the 20 m AEQD grid (browse-only area)', () => {
    const bounds = gridGeographicBounds(manifest);
    assert.equal(marsLatLngToGrid(bounds.north + 0.5, bounds.east + 0.5, manifest), null);
    assert.equal(marsLatLngToGrid(0, 0, manifest), null);
    assert.equal(marsLatLngToGrid(18.45, -100, manifest), null);
    assert.equal(marsLatLngToGrid(NaN, 77.4, manifest), null);
  });

  it('handles antimeridian wrapping and computes realistic spherical Mars distances', () => {
    const [x, y] = lonLatToAeqdMeters(179.9, 10, 10, -179.9, MARS_SPHERE_RADIUS_METERS);
    assert.ok(x < 0, '179.9 E should be just west of -179.9 (-180 wrap)');
    const [lonBack, latBack] = aeqdMetersToLonLat(x, y, 10, -179.9, MARS_SPHERE_RADIUS_METERS);
    assert.ok(Math.abs(normalizeMarsEastLon(lonBack) - 179.9) < 1e-9);
    assert.ok(Math.abs(latBack - 10) < 1e-9);

    const [latA, lonA] = gridPointToMarsLatLng(0, 0, manifest);
    const [latB, lonB] = gridPointToMarsLatLng(manifest.height, manifest.width, manifest);
    const diagMeters = marsSurfaceDistanceMeters(latA, lonA, latB, lonB);
    const expectedDiagMeters = Math.hypot(manifest.width * 20, manifest.height * 20);
    assert.ok(Math.abs(diagMeters - expectedDiagMeters) < 5, `diag=${diagMeters}, expected=${expectedDiagMeters}`);
  });

  it('includes the 2-layer chunk neighborhood (5x5 = 25 chunks, 22x22 km) with verified binary files', () => {
    const nb = manifest.mapDisplay?.neighborhood;
    assert.ok(nb, 'manifest.mapDisplay.neighborhood must be present');
    assert.equal(nb.rings, 2);
    assert.equal(nb.chunksPerSide, 5);
    assert.equal(nb.totalChunks, 25);
    assert.equal(nb.spanMeters, 22000);
    assert.equal(nb.chunks.length, 25);

    const elevBuf = fs.readFileSync(path.join(process.cwd(), 'public/data', nb.elevationPath));
    const maskBuf = fs.readFileSync(path.join(process.cwd(), 'public/data', nb.maskPath));
    assert.equal(elevBuf.byteLength, nb.width * nb.height * 4);
    assert.equal(maskBuf.byteLength, nb.width * nb.height);
    assert.ok(nb.minElevationMeters < -2650 && nb.maxElevationMeters > -1700);
  });

  it('allows navigation stops and calculates terrain-aware routes into neighborhood chunks', () => {
    const { routeNeighborhood } = require('../../.build/src/engine/traverse-graph.js');
    const origin = [86, 24]; // Landing site
    const targetInRing1 = [86, 280]; // East in Chunk (0, +1)
    const centerElevBuf = fs.readFileSync(path.join(process.cwd(), 'public/data/elevation.bin'));
    const centerElev = new Float32Array(
      centerElevBuf.buffer.slice(centerElevBuf.byteOffset, centerElevBuf.byteOffset + centerElevBuf.byteLength),
    );
    const nbElevBuf = fs.readFileSync(path.join(process.cwd(), 'public/data/neighborhood-elevation.bin'));
    const nbElev = new Float32Array(
      nbElevBuf.buffer.slice(nbElevBuf.byteOffset, nbElevBuf.byteOffset + nbElevBuf.byteLength),
    );
    const nbMask = new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'public/data/neighborhood-mask.bin')));
    const realBundle = {
      manifest,
      elevationMeters: centerElev,
      mask: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'public/data/validity-mask.bin'))),
      contextData: { neighborhoodElevation: nbElev, neighborhoodMask: nbMask },
    };

    const route = routeNeighborhood(realBundle, origin, targetInRing1);
    assert.equal(route.status, 'READY');
    assert.ok(route.distanceMeters > 5000);
    assert.ok(route.geometryGrid.length > 200);
    assert.ok(route.nominalTravelMinutes > 40);

    // Verify terrain-aware avoidance: place a steep peak/ridge on the direct line in Chunk (0, +1)
    // around 20m cell (86, 250) -> nbRow = 263, nbCol = 345
    const ridgeElev = nbElev.slice();
    for (let r = 259; r <= 267; r++) {
      for (let c = 343; c <= 347; c++) {
        ridgeElev[r * 550 + c] += 85; // 85m spire/ridge blocking the straight line
      }
    }
    const ridgeBundle = {
      ...realBundle,
      contextData: { neighborhoodElevation: ridgeElev, neighborhoodMask: nbMask },
    };
    const detourRoute = routeNeighborhood(ridgeBundle, [86, 224], [86, 276]);
    assert.equal(detourRoute.status, 'READY');
    // The route must detour around the peak at row 86, col 250 rather than going straight through it
    const passedThroughPeakCenter = detourRoute.geometryGrid.some(
      ([r, c]) => Math.abs(r - 86) <= 2 && Math.abs(c - 250) <= 2,
    );
    assert.equal(passedThroughPeakCenter, false, 'routeNeighborhood must detour around steep peaks outside the first chunk');

    // Also verify HazardZone avoidance in outer chunks
    const hazardRoute = routeNeighborhood(
      realBundle,
      [86, 224],
      [86, 276],
      [{ cell: [86, 250], radius: 8 }],
      false,
    );
    assert.equal(hazardRoute.status, 'READY');
    const hitHazard = hazardRoute.geometryGrid.some(([r, c]) => Math.hypot(r - 86, c - 250) <= 6);
    assert.equal(hitHazard, false, 'routeNeighborhood must detour around hazard zones in outer chunks');
  });
});

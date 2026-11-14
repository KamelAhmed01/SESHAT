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
});

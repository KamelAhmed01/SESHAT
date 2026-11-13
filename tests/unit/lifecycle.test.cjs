const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {previewMission, replanMission, canApprove, landingCell} = require('../../.build/src/engine/multi-leg-planner.js');
const {advanceMission, decideReplan, proposeReturn, recordEvent, remainingActivePlan, startMission} = require('../../.build/src/engine/lifecycle-store.js');
const {createTraverseGraph} = require('../../.build/src/engine/traverse-graph.js');
const {zeroResources} = require('../../.build/src/engine/consumables.js');

function stop(id, row, col, minutes = 20) {
  return {id, name: id, location: {gridRow: row, gridCol: col, confidence: 'USER_SELECTED'}, activity: {minutes}};
}

function flatBundle() {
  return {manifest: {width: 9, height: 9, baseIndex: 40, cellWidthMeters: 20, cellHeightMeters: 20},
    mask: new Uint8Array(81).fill(1), elevationMeters: new Float32Array(81)};
}

function approved(bundle, stops) {
  return startMission(previewMission({bundle, origin: landingCell(bundle), stops, spent: zeroResources}).optimized, stops);
}

function event(mission, bundle, details) {
  return recordEvent(mission, bundle, {details, description: 'Observed change', channel: 'AUTO_SENSOR_INPUT'});
}

test('directed costs on Jezero match the compiled H4 outbound and return fields', () => {
  const root = 'public/data/';
  const manifest = JSON.parse(readFileSync(root + 'manifest.json'));
  const f64 = name => {
    const bytes = readFileSync(root + name);
    return new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
  };
  const z = readFileSync(root + 'elevation.bin');
  const bundle = {manifest, mask: new Uint8Array(readFileSync(root + 'validity-mask.bin')),
    elevationMeters: new Float32Array(z.buffer, z.byteOffset, z.byteLength / 4)};
  const graph = createTraverseGraph(bundle, [], manifest.baseIndex);
  const outbound = f64('outbound-costs.bin'), back = f64('return-costs.bin');
  for (const target of manifest.scienceTargets) {
    const i = target.location.gridRow * manifest.width + target.location.gridCol;
    assert.ok(Math.abs(graph.route(manifest.baseIndex, i).nominalTravelMinutes - outbound[i]) < 0.002);
    assert.ok(Math.abs(graph.route(i, manifest.baseIndex).nominalTravelMinutes - back[i]) < 0.002);
  }
});

test('single and multi-stop previews retain the complete landing-site round trip and apply independent reserves', () => {
  const bundle = flatBundle(), origin = landingCell(bundle);
  const a = stop('east', 4, 8, 85), b = stop('west', 4, 0, 85), c = stop('north', 0, 4, 20);
  const single = previewMission({bundle, origin, stops: [a], spent: zeroResources}).optimized;
  assert.equal(single.legs.length, 2);
  assert.deepEqual(single.legs.at(-1).route.geometryGrid.at(-1), origin);
  const constrained = previewMission({bundle, origin, stops: [a, b, c], spent: zeroResources});
  assert.equal(canApprove(constrained.optimized), false);
  assert.deepEqual(constrained.subset.stops.map(item => item.id).sort(), ['east', 'north']);
  const marginal = previewMission({bundle, origin, stops: [c],
    spent: {minutes: 135.9, oxygen: 0, energy: 0}}).optimized;
  assert.ok(marginal.margins[1].margin.minutes > 0 && marginal.margins[0].margin.minutes < 0);
  assert.equal(canApprove(marginal), false);
  const lowBattery = previewMission({bundle, origin, stops: [c],
    spent: {minutes: 0, oxygen: 0, energy: 730}}).optimized.margins[1].margin;
  assert.ok(lowBattery.minutes > 0 && lowBattery.oxygen > 0 && lowBattery.energy < 0);
});

test('partial movement, delay and approval preserve the original baseline and completed stop', () => {
  const bundle = flatBundle(), stops = [stop('east', 4, 8), stop('north', 0, 4)];
  const baseline = approved(bundle, stops);
  const first = advanceMission(baseline, bundle, 'finish');
  const moving = advanceMission(first, bundle, 'part');
  assert.notDeepEqual(moving.position, first.position);
  const review = event(moving, bundle, {category: 'MISSION_DELAY', minutes: 15});
  assert.equal(review.spent.minutes, moving.spent.minutes + 15);
  assert.equal(review.spent.oxygen, moving.spent.oxygen + 36);
  assert.deepEqual(review.proposal.origin, moving.position);
  assert.equal(review.active, baseline.active);
  assert.equal(review.proposal.stops.length, 1);
  assert.deepEqual(review.completed, first.completed);
  assert.equal(advanceMission(review, bundle, 'finish'), review);
  assert.equal(remainingActivePlan(review, bundle).legs[0].departure, review.spent.minutes);
  const continued = decideReplan(review, review.proposal, 'approved');
  const second = advanceMission(continued, bundle, 'finish');
  const completed = advanceMission(second, bundle, 'finish');
  assert.equal(completed.status, 'COMPLETED');
  assert.deepEqual(completed.position, landingCell(bundle));
  assert.equal(completed.baseline, baseline.baseline);
});

test('a new hazard causes a detour and a closed landing cell prevents an abort route', () => {
  const bundle = flatBundle(), mission = approved(bundle, [stop('east', 4, 8)]);
  const zone = {cell: [4, 6], radius: 0};
  const review = event(mission, bundle, {category: 'NEW_TERRAIN_HAZARD', zone});
  assert.deepEqual(review.events[0].cell, zone.cell);
  assert.ok(review.proposal.legs.every(leg => leg.route.geometryGrid.every(cell => cell.join() !== zone.cell.join())));
  assert.ok(review.proposal.used.minutes > mission.active.used.minutes);
  const moving = advanceMission(mission, bundle, 'part');
  const landingBlocked = event(moving, bundle, {category: 'NEW_TERRAIN_HAZARD', zone: {cell: landingCell(bundle), radius: 0}});
  assert.equal(proposeReturn(landingBlocked, bundle).legs[0].route.status, 'NO_SUPPORTED_PATH');
});

test('replanning retains the astronaut’s highest-priority stop under oxygen loss', () => {
  const bundle = flatBundle(), stops = [stop('first', 4, 8, 40), stop('second', 4, 0, 40)];
  const mission = approved(bundle, stops);
  const review = event(mission, bundle, {category: 'RESOURCE_CHANGE', oxygen: 340, energy: 5});
  assert.deepEqual(review.spent, {minutes: 0, oxygen: 340, energy: 5});
  assert.deepEqual(review.proposal.stops.map(item => item.id), ['first']);
  assert.equal(canApprove(review.proposal), true);
});

test('discovery insertion, accessibility, and repeated pace changes alter only pending legs', () => {
  const bundle = flatBundle(), existing = stop('first', 4, 8), discovery = stop('discovery', 0, 4, 10);
  const mission = approved(bundle, [existing]);
  const found = event(mission, bundle, {category: 'NEW_SCIENTIFIC_DISCOVERY', target: discovery});
  assert.ok(found.proposal.stops.some(item => item.id === 'discovery'));
  const single = startMission(mission.baseline, [existing], 1);
  const singleWithDiscovery = event(single, bundle, {category: 'NEW_SCIENTIFIC_DISCOVERY', target: discovery});
  assert.deepEqual(singleWithDiscovery.proposal.stops.map(item => item.id), [existing.id]);
  const held = decideReplan(found, found.proposal, 'held');
  const blocked = event(held, bundle, {category: 'DESTINATION_ACCESSIBILITY_CHANGE', targetId: existing.id});
  assert.deepEqual(blocked.proposal.stops.map(item => item.id), ['discovery']);
  const slow = event(blocked, bundle, {category: 'ENVIRONMENTAL_OR_TERRAIN_CHANGE', speedFactor: 0.5});
  assert.ok(slow.proposal.used.minutes > blocked.proposal.used.minutes);
  const costly = replanMission({bundle, origin: landingCell(bundle), stops: [discovery],
    spent: {minutes: 0, oxygen: 449, energy: 0}});
  assert.equal(costly.stops.length, 0);
  assert.equal(canApprove(costly), true);
});

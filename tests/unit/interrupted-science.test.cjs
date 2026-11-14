const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { addResources, scienceResources, zeroResources } = require('../../.build/src/engine/consumables.js');
const {
  advanceMission,
  decideReplan,
  logStopObservation,
  recordPendingReading,
  startMission,
} = require('../../.build/src/engine/lifecycle-store.js');
const { archiveMarkdown, createArchive } = require('../../.build/src/engine/mission-archive.js');
const { canApprove, landingId, previewMission } = require('../../.build/src/engine/multi-leg-planner.js');
const { evaluatePositionOpportunities } = require('../../.build/src/engine/opportunity-ledger.js');
const scenario = require('../../.build/src/config/mission-scenario.json');

function loadRealJezeroBundle() {
  const dir = path.join(process.cwd(), 'public/data');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const readTyped = (file, Typed) => {
    const buf = fs.readFileSync(path.join(dir, file));
    return new Typed(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  };
  const geologicUnits = JSON.parse(fs.readFileSync(path.join(dir, 'geologic-units.json'), 'utf8'));
  const meda = JSON.parse(fs.readFileSync(path.join(dir, 'meda-context.json'), 'utf8'));
  return {
    manifest,
    assetRoot: '/data',
    outboundMinutes: readTyped('outbound-costs.bin', Float64Array),
    returnMinutes: readTyped('return-costs.bin', Float64Array),
    outboundParents: readTyped('outbound-parents.bin', Int32Array),
    returnNext: readTyped('return-next.bin', Int32Array),
    elevationMeters: readTyped('elevation.bin', Float32Array),
    mask: readTyped('validity-mask.bin', Uint8Array),
    contextData: { geologicUnits, meda, optionalFailures: [] },
  };
}

describe('Separated arrival, exploration, simulated reading interrupt, and partial-science proposals', () => {
  const bundle = loadRealJezeroBundle();
  const shuyak = bundle.manifest.scienceTargets.find(t => t.id === 'shuyak');
  const swiftRun = bundle.manifest.scienceTargets.find(t => t.id === 'swift-run');
  assert.ok(shuyak && swiftRun);

  it('separates arrive, explore, observation logging, reading trigger, and both finish vs leave proposals', () => {
    const preview = previewMission({
      bundle,
      origin: [Math.floor(bundle.manifest.baseIndex / bundle.manifest.width), bundle.manifest.baseIndex % bundle.manifest.width],
      stops: [shuyak, swiftRun],
      spent: zeroResources,
    });
    assert.equal(canApprove(preview.optimized), true);

    let mission = startMission(preview.optimized, [shuyak, swiftRun]);
    assert.equal(mission.activeStopId, null);
    assert.equal(mission.stopProgress.shuyak.status, 'pending');

    // Arrive at Shuyak without spending stop science time yet
    mission = advanceMission(mission, bundle, 'arrive');
    assert.equal(mission.activeStopId, 'shuyak');
    assert.equal(mission.stopProgress.shuyak.status, 'arrived');
    assert.equal(mission.stopProgress.shuyak.exploredMinutes, 0);
    assert.equal(mission.completed.length, 0);
    const arrivalSpent = mission.spent;
    assert.ok(arrivalSpent.minutes > 0 && arrivalSpent.oxygen > 0 && arrivalSpent.energy > 0);

    // Log a geological field observation
    mission = logStopObservation(mission, 'Layered sulfate lens observed along western scarp bench', 'CaSO4 signature');
    assert.equal(mission.fieldObservations.length, 1);
    assert.equal(mission.stopProgress.shuyak.observations.length, 1);

    // Explore +10 min -> triggers deterministic incoming simulated reading
    mission = advanceMission(mission, bundle, 'explore', 10);
    const expectedAfterExplore = addResources(arrivalSpent, scienceResources(10));
    assert.ok(Math.abs(mission.spent.minutes - expectedAfterExplore.minutes) < 1e-6);
    assert.ok(Math.abs(mission.spent.oxygen - expectedAfterExplore.oxygen) < 1e-6);
    assert.ok(Math.abs(mission.spent.energy - expectedAfterExplore.energy) < 1e-6);
    assert.equal(mission.stopProgress.shuyak.status, 'exploring');
    assert.equal(mission.stopProgress.shuyak.exploredMinutes, 10);
    assert.ok(mission.pendingReading, 'exploring >= 10 min on first stop triggers incoming simulated reading');
    const contactCell = mission.pendingReading.cell;
    assert.equal(bundle.mask[contactCell[0] * bundle.manifest.width + contactCell[1]], 1);

    // Record pending reading -> interrupts stop & yields both proposals
    const interrupted = recordPendingReading(mission, bundle);
    assert.equal(interrupted.pendingReading, null);
    assert.equal(interrupted.status, 'REVIEW');
    assert.equal(interrupted.stopProgress.shuyak.status, 'interrupted');
    assert.equal(interrupted.stopProgress.shuyak.exploredMinutes, 10);
    assert.equal(interrupted.stopProgress.shuyak.observations.length, 1);
    assert.ok(interrupted.finishProposal, 'must propose finishing current stop');
    assert.ok(interrupted.leaveStopProposal, 'must propose leaving current stop with partial science');
    assert.ok(interrupted.recommendedProposal === 'finish-stop' || interrupted.recommendedProposal === 'leave-stop');
    assert.ok(typeof interrupted.proposalReason === 'string' && interrupted.proposalReason.length > 10);

    // Option A: Approve finishing Shuyak (+10 min remaining science) before continuing
    const finishedBranch = decideReplan(interrupted, interrupted.finishProposal, 'approved', { stopAction: 'finish-stop' });
    assert.equal(finishedBranch.status, 'EXECUTING');
    assert.equal(finishedBranch.activeStopId, null);
    assert.equal(finishedBranch.stopProgress.shuyak.status, 'completed');
    assert.equal(finishedBranch.stopProgress.shuyak.exploredMinutes, 20);
    assert.ok(finishedBranch.completed.includes('shuyak'));
    assert.ok(Math.abs(finishedBranch.spent.minutes - (expectedAfterExplore.minutes + 10)) < 1e-6);

    // Option B: Leave Shuyak early keeping 10 min partial science & observations, finish remaining legs, and archive
    let leftBranch = decideReplan(interrupted, interrupted.leaveStopProposal, 'approved', { stopAction: 'leave-stop' });
    assert.equal(leftBranch.status, 'EXECUTING');
    assert.equal(leftBranch.activeStopId, null);
    assert.equal(leftBranch.stopProgress.shuyak.status, 'departed-early');
    assert.equal(leftBranch.stopProgress.shuyak.exploredMinutes, 10);
    assert.equal(leftBranch.stopProgress.shuyak.observations.length, 1);
    assert.ok(!leftBranch.completed.includes('shuyak'));
    assert.ok(Math.abs(leftBranch.spent.minutes - expectedAfterExplore.minutes) < 1e-6);

    // Complete remaining legs back to landing site
    let guard = 0;
    while (leftBranch.status === 'EXECUTING' && guard++ < 10) {
      leftBranch = advanceMission(leftBranch, bundle, 'finish');
    }
    assert.equal(leftBranch.status, 'COMPLETED');
    assert.equal(leftBranch.active.legs.at(-1).targetId, landingId);

    const archive = createArchive(leftBranch.baseline, bundle.manifest, leftBranch, bundle.contextData);
    assert.equal(archive.execution.stopProgress.shuyak.status, 'departed-early');
    assert.equal(archive.execution.stopProgress.shuyak.exploredMinutes, 10);
    assert.equal(archive.execution.fieldObservations.length, 1);
    assert.ok(archive.environmentalContext.geologicUnits.length >= 1);
    assert.equal(archive.environmentalContext.medaPressureSols.length, 3);
    assert.ok(Object.keys(archive.environmentalContext.unavailableFields).length >= 3);

    const md = archiveMarkdown(archive);
    assert.match(md, /departed-early/);
    assert.match(md, /Layered sulfate lens observed/);
  });

  it('evaluates live position opportunities accurately back to landing site', () => {
    const assessmentMap = evaluatePositionOpportunities(
      bundle,
      [shuyak.location.gridRow, shuyak.location.gridCol],
      {
        schemaVersion: '1.0',
        referenceSpeedMetersPerSecond: scenario.referenceSpeedMetersPerSecond,
        timeBudgetMinutes: scenario.timeBudgetMinutes,
        elapsedMinutes: 30,
        reserveMinutes: scenario.reserveMinutes,
      },
    );
    assert.ok(assessmentMap.shuyak);
    assert.equal(assessmentMap.shuyak.state, 'ROBUST');
  });
});

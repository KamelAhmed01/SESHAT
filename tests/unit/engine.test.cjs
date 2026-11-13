const test = require('node:test');
const assert = require('node:assert/strict');
const {assessTarget, validateScenario, returnableAtNominalSpeed} = require('../../.build/src/engine/feasibility.js');
const {reconstructOutbound,reconstructReturn} = require('../../.build/src/engine/route-path.js');
const {gridToViewer,viewerToGrid} = require('../../.build/src/cartography/coordinates.js');

const scenario = (elapsed=0) => ({ id:'oracle',label:'Test',timeBudgetMinutes:180,elapsedMinutes:elapsed,reserveMinutes:20,
  referenceSpeedMetersPerSecond:0.75,speedMultipliers:[0.8,1,1.2],gradeModelId:'terrain-scenario-v0',datasetRevision:'SYNTHETIC_ORACLE'});
const target = (confidence='VERIFIED_POINT') => ({id:'t',name:'Fixture',location:{originalCoordinateText:'test',coordinateFrame:'SYNTHETIC',gridRow:0,gridCol:1,confidence,locationSource:'TEST'},
  objectiveTags:[],science:{summary:'Synthetic fixture',sourceIds:[],evidence:[],limitations:[]},activity:{minutes:20,basis:'SCENARIO_ASSUMPTION'}});
const route = minutes => ({status:'READY',distanceMeters:300,nominalTravelMinutes:minutes,geometryGrid:[[0,0],[0,1]],sampledElevationsMeters:[0,0]});

test('O01: robust when all speed scenarios meet the budget',()=>{
  const r=assessTarget(target(),scenario(),route(15),route(20));
  assert.equal(r.state,'ROBUST'); assert.equal(r.nominalMarginMinutes, 180-15-20-20-20);
});
test('O02: time delay never increases margin',()=>{
  const before=assessTarget(target(),scenario(0),route(30),route(35));
  const after=assessTarget(target(),scenario(15),route(30),route(35));
  assert.equal(before.nominalMarginMinutes-after.nominalMarginMinutes,15);
});
test('O03: 3 speed factors use uniformly scaled travel time',()=>{
  const r=assessTarget(target(),scenario(),route(10),route(20));
  assert.equal(r.scenarios[0].requiredMinutes,30/0.8+40);
  assert.equal(r.scenarios[2].requiredMinutes,30/1.2+40);
});
test('O04: exact zero margin is feasible',()=>{
  const s={...scenario(),timeBudgetMinutes:90};
  const r=assessTarget(target(),s,route(25),route(25));
  assert.equal(r.scenarios[1].feasible,true);
});
test('O05: approximate regions are UNKNOWN even if numeric fields available',()=>{
  assert.equal(assessTarget(target('APPROXIMATE_REGION'),scenario(),route(1),route(1)).state,'UNKNOWN');
});
test('O06: no-data route is unknown, not a negative claim',()=>{
  const missing={...route(1),status:'NO_SUPPORTED_PATH',nominalTravelMinutes:null,unknownReason:'MISSING_DATA'};
  assert.equal(assessTarget(target(),scenario(),missing,route(1)).state,'UNKNOWN');
});
test('O07: invalid or negative budget is rejected',()=>{
  assert.match(validateScenario({...scenario(),reserveMinutes:-1}),/nonnegative/);
  assert.match(validateScenario({...scenario(),referenceSpeedMetersPerSecond:0}),/positive/);
});
test('O08: a movement-only frontier shrinks when departure is delayed',()=>{
  assert.equal(returnableAtNominalSpeed(50,40,scenario(0)),true);
  assert.equal(returnableAtNominalSpeed(50,40,{...scenario(),timeBudgetMinutes:110,elapsedMinutes:15}),false);
});
test('O09: base index zero is valid, pointer output is correctly oriented',()=>{
  const pointers=new Int32Array([-1,0,1,2]);
  assert.deepEqual(reconstructOutbound(pointers,0,3).indices,[0,1,2,3]);
  assert.deepEqual(reconstructReturn(pointers,0,3).indices,[3,2,1,0]);
});
test('O10: corrupt pointer cycle is UNKNOWN',()=>{
  const path=reconstructReturn(new Int32Array([-1,2,1]),0,2);
  assert.equal(path.status,'UNKNOWN');
});
test('O11: all four corners and click inverse preserve row-column conventions',()=>{
  const H=100,W=120;
  for (const [r,c] of [[0,0],[0,W-1],[H-1,0],[H-1,W-1]]){
    const [lat,lng]=gridToViewer(r,c,H);
    assert.deepEqual(viewerToGrid(lat,lng,W,H),[r,c]);
  }
});
test('O12: invalid map click returns null, never wraps index',()=>{
  assert.equal(viewerToGrid(-1,0,120,100),null);
  assert.equal(viewerToGrid(1,120,120,100),null);
});

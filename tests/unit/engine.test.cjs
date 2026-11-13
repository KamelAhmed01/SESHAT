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

const {routeSummary} = require('../../.build/src/engine/route-summary.js');
const {elevationProfile} = require('../../.build/src/engine/elevation-profile.js');
const {buildMissionBrief} = require('../../.build/src/engine/mission-brief.js');

function terrain(mask, outbound, returns, outboundParents, returnNext) {
  const count=mask.length;
  return {
    manifest:{ width:count, height:1, baseIndex:0, cellWidthMeters:20, cellHeightMeters:20 },
    mask:new Uint8Array(mask), outboundMinutes:new Float64Array(outbound),
    returnMinutes:new Float64Array(returns), outboundParents:new Int32Array(outboundParents),
    returnNext:new Int32Array(returnNext), elevationMeters:new Float32Array(count),
  };
}
test('H2-O01: full observed graph with hard constraints is INFEASIBLE, not UNKNOWN',()=>{
  const b=terrain([1,1,1],[0,Infinity,Infinity],[0,Infinity,Infinity],[-1,-1,-1],[-1,-1,-1]);
  const out=routeSummary(b,2,'outbound');
  assert.equal(out.unknownReason,'HARD_CONSTRAINT');
  assert.equal(assessTarget({...target(),location:{...target().location,gridCol:2}},scenario(),out,out).state,'INFEASIBLE');
});
test('H2-O02: unknown gap forces UNKNOWN even when no route is found',()=>{
  const b=terrain([1,0,1],[0,Infinity,Infinity],[0,Infinity,Infinity],[-1,-1,-1],[-1,-1,-1]);
  const r=routeSummary(b,2,'outbound');
  assert.equal(r.unknownReason,'MISSING_DATA');
});
test('H2-O03: explicitly blocked target cell is classified as HARD_CONSTRAINT',()=>{
  const b=terrain([1,2],[0,Infinity],[0,Infinity],[-1,-1],[-1,-1]);
  assert.equal(routeSummary(b,1,'outbound').unknownReason,'HARD_CONSTRAINT');
});
test('H2-O04: apparently finite cost with corrupt pointer is never accepted',()=>{
  const b=terrain([1,1],[0,1],[0,1],[-1,-1],[-1,-1]);
  assert.equal(routeSummary(b,1,'outbound').status,'INVALID_GEOMETRY');
});
test('H2-O05: elevation profile sums outbound ascent and descent in traveled order',()=>{
  const trip={...route(15),geometryGrid:[[0,0],[0,1],[1,1],[1,2]],sampledElevationsMeters:[100,115,110,125]};
  const p=elevationProfile(trip,20,30);
  assert.equal(p.horizontalDistanceMeters,70);
  assert.equal(p.ascentMeters,30); assert.equal(p.descentMeters,5);
  assert.equal(p.netChangeMeters,25); assert.equal(p.vertices.at(-1).distanceMeters,70);
});
test('H2-O06: elevation profile refuses nonexistent elevations / unsupported route',()=>{
  assert.equal(elevationProfile({...route(1),sampledElevationsMeters:[0,NaN]},20,20),null);
  assert.equal(elevationProfile({...route(1),status:'NO_SUPPORTED_PATH'},20,20),null);
});
test('H2-O07: exported synthetic mission brief prominently rejects NASA safety claim',()=>{
  const b=assessTarget(target(),scenario(15),route(10),route(15));
  const md=buildMissionBrief({target:target(),assessment:b,scenario:scenario(15),
    source:{status:'DEMO_SYNTHETIC',sourceId:'SYNTHETIC',sourceUrl:'local',modelId:'test',width:2,height:1,
      cellWidthMeters:20,cellHeightMeters:20,coordinateFrameVerified:false},
    movementFrontierCells:5,initialFrontierCells:10});
  assert.match(md,/SYNTHETIC TEST FIXTURE — NOT MARS DATA/);
  assert.match(md,/NOT astronaut navigation or safety guidance/);
  assert.match(md,/## Scientific references/);
  assert.match(md,/0\.8×/);
  assert.match(md,/Start: 10 cells/);
});
test('H2-O08: export preserves UNKNOWN route truth and pending evidence',()=>{
  const noPath={...route(0),status:'NO_SUPPORTED_PATH',distanceMeters:null,nominalTravelMinutes:null,unknownReason:'MISSING_DATA'};
  const a=assessTarget(target('APPROXIMATE_REGION'),scenario(),noPath,noPath);
  const md=buildMissionBrief({target:target('APPROXIMATE_REGION'),assessment:a,scenario:scenario(),
    source:{status:'SOURCE_REVIEW_REQUIRED',sourceId:'PENDING',sourceUrl:'https://usgs.gov/example',modelId:'v0',width:2,height:1,
      cellWidthMeters:20,cellHeightMeters:20,coordinateFrameVerified:false,challengeResourceQualified:false},
    movementFrontierCells:null,initialFrontierCells:null});
  assert.match(md,/REAL-SOURCE REVIEW PENDING/); assert.match(md,/Feasibility: \*\*UNKNOWN\*\*/);
  assert.match(md,/Outbound distance: UNKNOWN m/);
  assert.match(md,/Challenge-listed Resource verified: Not verified/);
});
const {plotVertices} = require('../../.build/src/engine/elevation-profile.js');
test('H2-O09: profile decimation is bounded, includes endpoints and extrema',()=>{
  const count=5000;
  const p={vertices:Array.from({length:count},(_,i)=>({distanceMeters:i,elevationMeters:i===1444?-1000:i===1777?2000:i%7}))};
  const points=plotVertices(p,240);
  assert.ok(points.length<=240);
  assert.deepEqual(points[0],p.vertices[0]);assert.deepEqual(points.at(-1),p.vertices.at(-1));
  assert.ok(points.some(v=>v.elevationMeters===-1000));
  assert.ok(points.some(v=>v.elevationMeters===2000));
});
test('H2-O10: route rendering rejects diagonal corner cuts through unknown cells',()=>{
  const b=terrain([1,0,0,1],[0,Infinity,Infinity,1],[0,Infinity,Infinity,1],[-1,-1,-1,0],[-1,-1,-1,0]);
  b.manifest.width=2; b.manifest.height=2;
  assert.equal(routeSummary(b,3,'outbound').status,'INVALID_GEOMETRY');
});

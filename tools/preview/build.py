"""Build an OFFLINE VISUAL-ACCEPTANCE HARNESS, not a Next production build.
Shares SESHAT's CSS and real Python-generated binary fixture, but not the React runtime.
"""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
css=(root/'src/app/globals.css').read_text()
css='\n'.join(line for line in css.splitlines() if not line.startswith('@import ') and not line.startswith('@layer reset,'))
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SESHAT — acceptance preview (synthetic)</title><style>CSS_GOES_HERE
.preview-map-image{position:absolute;object-fit:fill;image-rendering:auto;left:5%;top:6%;width:90%;height:88%;filter:contrast(1.17) saturate(.83)}
.preview-frontier{position:absolute;left:5%;top:6%;width:90%;height:88%;pointer-events:none}
.preview-lines{position:absolute;left:5%;top:6%;width:90%;height:88%;overflow:visible;pointer-events:none}
.preview-label{position:absolute;z-index:600;background:#172226e6;color:#f6c4a2;border:1px solid #ae7c5f;padding:5px 8px;font-size:10px;pointer-events:none}
.preview-watermark{position:absolute;z-index:800;transform:rotate(-25deg);left:24%;top:47%;font:600 16px ui-monospace,monospace;letter-spacing:.18em;color:#e6d2bf75;pointer-events:none;text-shadow:0 2px 9px #111}
@media(max-width:900px){.preview-watermark{font-size:10px}.preview-map-image,.preview-frontier,.preview-lines{top:12%;height:76%;}}
</style></head><body>
<main class="workbench"><header class="mission-header"><div class="brand-lockup"><div class="brand-mark">S<span>·</span></div><div class="brand-text"><strong>SESHAT</strong><span>MARS SURFACE SCIENCE</span></div></div>
<div class="mission-id"><span class="eyebrow">Field study</span><span>Jezero crater</span><span class="tiny-separator">/</span><span>Opportunity navigator</span></div><div class="header-right"><span class="live-state">● SYNTHETIC TEST SCENE</span><button id="evidence-btn" class="text-action">Evidence & methods ↗</button></div></header>
<div class="content-grid"><aside class="left-rail"><section class="rail-intro"><div class="eyebrow">01 / Objective</div><h1>What can we still explore?</h1><p>Every minute changes which opportunities fit a return journey.</p><div class="mode-alert">SIMULATED TERRAIN <span>Not a Mars measurement</span></div></section>
<section class="rail-section"><div class="section-heading"><span>Science opportunities</span><span class="section-index">03 TEST TARGETS</span></div><div class="target-list" id="target-list"></div></section>
<section class="rail-section rail-bottom"><div class="section-heading"><span>Analysis rules</span><span class="section-index">v0</span></div><p class="context-note">Directional terrain routing, a defined return reserve, and three travel speeds. Values are assumptions; no EVA safety claims.</p></section></aside>
<section class="map-stage"><div class="map-topline"><span class="eyebrow">02 / Surface</span><span class="map-title">Illustrative analysis area</span></div>
<div class="map-root"><img id="terrain" class="preview-map-image" alt="Synthetic shaded elevation, not Mars" src="/demo/imagery/study-area.webp"><canvas id="frontier" class="preview-frontier"></canvas><svg id="lines" class="preview-lines" viewBox="0 0 190 160" preserveAspectRatio="none"></svg></div>
<div class="map-north">↑ N</div><div class="map-caution map-caution-compact"><i></i><div><strong>SYNTHETIC — NOT MARS</strong><span>Test landscape generated to validate interaction and routing only.</span></div></div>
<div class="frontier-stats"><div class="eyebrow">RETURNABLE CELLS</div><strong id="frontier-count">—</strong><span id="frontier-loss">At scenario start</span></div><div class="preview-watermark">SYNTHETIC TEST</div><div class="map-footer"><span>SYNTHETIC TEST DATA</span><span>190 × 160 · 32 M/CELL</span></div></section>
<aside class="right-rail"><section class="clock-panel"><div class="eyebrow">03 / Mission clock</div><h2>Time is terrain.</h2><p>Delay the traverse and watch the returnable opportunity frontier shrink.</p>
<div class="time-display"><strong id="remaining">180</strong><span>min remaining</span></div><div class="time-metrics"><div><span>Planning window</span><strong>180 min</strong></div><div><span>Elapsed</span><strong id="elapsed">+0 min</strong></div><div><span>Held in reserve</span><strong>20 min</strong></div></div><div class="clock-actions"><button id="advance" type="button" class="preview-button-primary">Advance +15 min</button><button id="reset" class="preview-button" type="button">Reset</button></div><p class="assumption-note">Illustrative research parameters, not certified EVA guidance.</p></section>
<section class="assessment-panel"><div class="section-heading"><span>Return feasibility</span><span class="section-index">0.8× / 1× / 1.2×</span></div><div class="selected-target" id="selected-target">—</div>
<h3 class="assessment-state" id="status">—</h3><p class="context-note" id="margin"></p><div class="route-metrics"><div><small>Outbound</small><strong id="outbound">—</strong></div><div><small>Return</small><strong id="return">—</strong></div><div><small>Fieldwork</small><strong id="activity">—</strong></div></div><div class="scenario-lines" id="speed-rows"></div><p class="change-explanation" id="change-line"></p><details class="terrain-detail" id="preview-profile"><summary>Inspect terrain profile <span>DEM-SCALE / BOTH LEGS</span></summary><div class="profile-chart"><div class="profile-heading"><strong>Outbound / synthetic</strong><span id="profile-length"></span></div><svg id="profile-svg" viewBox="0 0 320 104" role="img" aria-label="Synthetic elevation profile"></svg><div class="profile-metrics"><span id="profile-ascent"></span><span>SIMULATED TEST</span></div></div><p>Artificial elevation generated for interface QA, not a Mars surface measurement.</p></details><div class="brief-actions"><button class="preview-button-primary" id="export-preview" type="button">Export mission brief (.md)</button><span>Test export is marked SYNTHETIC in its contents.</span></div></section>
<section class="rail-section right-bottom"><span class="eyebrow">Scientific boundary</span><p class="context-note">All imagery and coordinates here are artificial test inputs. NASA is not associated with this preview.</p></section></aside></div>
<footer class="site-footer"><span>SESHAT / SPACE APPS 2026</span><span>Evidence before certainty.</span><span>VISUAL ACCEPTANCE PREVIEW · NOT NEXT RUNTIME</span></footer></main>
<div id="scrim" class="drawer-scrim" hidden><aside class="evidence-drawer"><div class="drawer-top"><span class="eyebrow">Method / evidence</span><button id="close" aria-label="Close panel">×</button></div><h2>We show what the data can support.</h2><p>This visual acceptance harness loads synthetic fields from the real Python compiler. It does NOT display downloaded Mars terrain, verified science or the Next.js application.</p><div class="drawer-fact"><span>Scene</span><strong>DEMO_SYNTHETIC</strong></div><div class="drawer-fact"><span>Speed</span><strong>0.75 m/s assumption</strong></div><div class="drawer-fact"><span>Routing</span><strong>Directed, grade-penalized</strong></div><p class="drawer-disclaimer">No NASA endorsement or safety claim.</p></aside></div>
<script src="/preview/preview.js" defer></script></body></html>'''
html=html.replace('CSS_GOES_HERE',css+'''
.preview-button-primary,.preview-button{font:500 12px sans-serif;padding:10px 12px;border-radius:5px;border:1px solid #4b5758;background:#1d2c2e;color:#ebede6}
.preview-button-primary{background:#c78b68;color:#11181b;border:1px solid #d39a74}.preview-button:hover{background:#324345}
[hidden]{display:none!important}
''')
(root/'tools/preview/dist').mkdir(parents=True,exist_ok=True)
(root/'tools/preview/dist/index.html').write_text(html)
(root/'tools/preview/dist/preview.js').write_text((root/'tools/preview/preview.js').read_text())
print('Acceptance-preview HTML generated; independent of the Next.js build.')

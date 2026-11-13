"""Browser QA of the standalone visual fixture, not the Next.js app runtime."""
from pathlib import Path
import os
import base64
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
shots=ROOT/'screenshots';shots.mkdir(exist_ok=True)
# Browser navigation is blocked in this hosted runtime; use a self-contained
# HTML document with the SAME fixture bytes, CSS and preview interactions.
page_html=(ROOT/'tools/preview/dist/index.html').read_text()
js=(ROOT/'tools/preview/dist/preview.js').read_text()
files=['manifest.json','outbound-costs.bin','return-costs.bin','outbound-parents.bin',
       'return-next.bin','validity-mask.bin','elevation.bin']
raw={ '/demo/'+f: base64.b64encode((ROOT/'public/demo'/f).read_bytes()).decode() for f in files }
bootstrap='''<script>const PREVIEW_FIXTURE_B64 = DATA_HERE;
window.fetch=async function(input){const key=String(input), encoded=PREVIEW_FIXTURE_B64[key];
  if(!encoded) throw new Error('Unsupported preview resource '+key);
  const binary=atob(encoded), out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return new Response(out,{status:200,headers:{'content-type':key.endsWith('.json')?'application/json':'application/octet-stream'}});
};</script>'''.replace('DATA_HERE',json.dumps(raw))
image_bytes=(ROOT/'public/demo/imagery/study-area.webp').read_bytes()
page_html=page_html.replace('src="/demo/imagery/study-area.webp"',
    'src="data:image/webp;base64,'+base64.b64encode(image_bytes).decode()+'"')
page_html=page_html.replace('<script src="/preview/preview.js" defer></script>',bootstrap+'<script>'+js+'</script>')
with sync_playwright() as p:
    # Use a configured system browser when available, otherwise use Playwright's installed Chromium.
    browser=p.chromium.launch(executable_path=os.getenv('SESHAT_CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(page_html,wait_until='load')
    page.wait_for_function('window.SESHAT_PREVIEW_READY===true',timeout=10000)
    assert not errors, errors
    start=int(page.locator('#frontier-count').inner_text().replace(',',''))
    assert start>0
    assert 'ROBUST' in page.locator('#status').inner_text()
    assert page.locator('#lost-targets').inner_text()=='0'
    assert page.locator('.opportunity-status').count()==3
    page.screenshot(path=str(shots/'seshat-acceptance-desktop.png'),full_page=True)
    page.locator('#preview-profile summary').click()
    assert page.locator('#profile-svg path').count()==1
    assert 'ascent' in page.locator('#profile-ascent').inner_text()
    page.screenshot(path=str(shots/'seshat-acceptance-profile.png'),full_page=True)
    page.locator('#export-preview').click()
    assert 'SYNTHETIC TEST FIXTURE' in page.evaluate('window.SESHAT_PREVIEW_LAST_BRIEF')
    assert 'Target:' in page.evaluate('window.SESHAT_PREVIEW_LAST_BRIEF')
    page.locator('#advance').click()
    count=int(page.locator('#frontier-count').inner_text().replace(',',''))
    assert count<=start, (start,count)
    assert page.locator('#remaining').inner_text()=='165'
    assert page.locator('#lost-targets').inner_text()!='0', 'Expected a lost example in the synthetic fixture'
    assert page.locator('.opportunity-meta em').count()>=1
    page.screenshot(path=str(shots/'seshat-acceptance-after-delay.png'),full_page=True)
    page.screenshot(path=str(shots/'seshat-acceptance-opportunity-ledger.png'),full_page=True)
    page.locator('[data-select="2"]').click()
    assert 'Eastern traverse' in page.locator('#selected-target').inner_text()
    assert page.locator('#outbound').inner_text()!='Unknown'
    page.locator('#reset').click()
    assert page.locator('#remaining').inner_text()=='180'
    assert page.locator('#lost-targets').inner_text()=='0'
    page.locator('#evidence-btn').click()
    assert page.locator('#scrim').is_visible()
    page.locator('#close').click()
    assert page.locator('#scrim').is_hidden()
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mobile.set_content(page_html,wait_until='load')
    mobile.wait_for_function('window.SESHAT_PREVIEW_READY===true',timeout=10000)
    mobile.screenshot(path=str(shots/'seshat-acceptance-mobile.png'),full_page=True)
    mobile.locator('#advance').click()
    assert mobile.locator('#lost-targets').inner_text()!='0'
    mobile.screenshot(path=str(shots/'seshat-acceptance-mobile-delayed.png'),full_page=True)
    overflow=mobile.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not overflow, 'Mobile viewport has unwanted horizontal overflow'
    print('BROWSER QA PASSED: no JS errors, synthetic compiler fixture, time frontier, all-target opportunity changes, target selection, export, drawer, mobile overflow')
    print('CHECKPOINT: start frontier cells',start,'after +15min',count)
    browser.close()

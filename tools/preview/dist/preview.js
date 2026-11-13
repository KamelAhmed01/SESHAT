/* Standalone visual harness. Uses actual binary scenario fixture, not the Next app. */
(async()=>{
  const root='/demo/';
  const manifest=await (await fetch(root+'manifest.json')).json();
  if(manifest.status!=='DEMO_SYNTHETIC')throw Error('Preview must use synthetic fixture');
  const n=manifest.width*manifest.height;
  async function numbers(name,kind){const b=await (await fetch(root+name)).arrayBuffer();const v=new DataView(b);
    const arr=new Array(n);for(let i=0;i<n;i++){let ofs=kind==='f64'?i*8:kind==='i32'?i*4:i;
      arr[i]=kind==='f64'?v.getFloat64(ofs,true):kind==='i32'?v.getInt32(ofs,true):v.getUint8(ofs)}return arr;}
  const [out,ret,parents,retNext,mask]=await Promise.all([
    numbers('outbound-costs.bin','f64'),numbers('return-costs.bin','f64'),numbers('outbound-parents.bin','i32'),numbers('return-next.bin','i32'),numbers('validity-mask.bin','u8')]);
  let selected=0,elapsed=0;const budget=180,reserve=20;
  const $=id=>document.getElementById(id);
  const fmt=v=>isFinite(v)?(Math.round(v*10)/10).toFixed(1)+' min':'Unknown';
  function chain(idx,direction){const path=[],seen=new Set(),base=manifest.baseIndex;
    for(let p=idx;p>=0&&p<n&&!seen.has(p);p=(direction==='out'?parents:retNext)[p]){path.push(p);seen.add(p);if(p===base)return direction==='out'?path.reverse():path;}return []}
  function polyline(points,color,dashed){if(points.length<2)return'';
    const ps=points.map(i=>(i%manifest.width+.5)+','+(Math.floor(i/manifest.width)+.5)).join(' ');
    return `<polyline points="${ps}" fill="none" stroke="${color}" stroke-width=".95" ${dashed?'stroke-dasharray="2 1.5"':''} />`;}
  function update(){let count=0,count0=0;const canvas=$('frontier');canvas.width=manifest.width;canvas.height=manifest.height;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(manifest.width,manifest.height);
    for(let i=0;i<n;i++){const cost=out[i]+ret[i];const valid=mask[i]===1&&isFinite(cost);
      const before=valid&&cost+reserve<=budget;const after=valid&&cost+reserve<=budget-elapsed;
      if(before)count0++;if(after)count++;const o=i*4;
      pixels.data[o]=214;pixels.data[o+1]=234;pixels.data[o+2]=183;pixels.data[o+3]=after?70:0;}
    ctx.putImageData(pixels,0,0);
    $('frontier-count').textContent=count.toLocaleString();$('frontier-loss').textContent=elapsed?`−${(count0-count).toLocaleString()} cells after +${elapsed} min`:'At scenario start';
    $('remaining').textContent=budget-elapsed;$('elapsed').textContent='+'+elapsed+' min';
    const t=manifest.scienceTargets[selected],loc=t.location,idx=loc.gridRow*manifest.width+loc.gridCol;
    $('selected-target').textContent=t.name;const a=out[idx],b=ret[idx],activity=t.activity.minutes;
    $('outbound').textContent=fmt(a);$('return').textContent=fmt(b);$('activity').textContent=activity+' min';
    const scenarios=[.8,1,1.2].map(f=>({f,margin:budget-elapsed-reserve-activity-(a+b)/f}));
    const feasible=scenarios.filter(s=>s.margin>=0).length;const status=feasible===3?'ROBUST':feasible?'MARGINAL':'INFEASIBLE';
    $('status').textContent=status;$('status').className='assessment-state state-'+status.toLowerCase();
    $('margin').textContent='Nominal margin: '+fmt(scenarios[1].margin)+'. Artificial terrain and hypothetical fieldwork only.';
    $('speed-rows').innerHTML=scenarios.map(s=>`<div><span>${s.f.toFixed(1)}×</span><span>${fmt(s.margin)}</span><span>${s.margin>=0?'Within budget':'Over budget'}</span></div>`).join('');
    $('change-line').textContent=elapsed?'Elapsed time reduces every scenario margin by '+elapsed+' min.':'';
    const pathOut=chain(idx,'out'),pathReturn=chain(idx,'ret');
    const br=Math.floor(manifest.baseIndex/manifest.width),bc=manifest.baseIndex%manifest.width;
    $('lines').innerHTML=polyline(pathOut,'#ffd2b0',false)+polyline(pathReturn,'#a6dfbe',true)+
      `<circle cx="${bc+.5}" cy="${br+.5}" r="2" stroke="#fff" fill="#ad593d" stroke-width=".5"/>`+
      `<circle cx="${loc.gridCol+.5}" cy="${loc.gridRow+.5}" r="2.6" stroke="#fff" fill="#e58d52" stroke-width=".65"/>`;
    $('target-list').innerHTML=manifest.scienceTargets.map((v,i)=>`<button class="target-item ${i===selected?'target-selected':''}" data-select="${i}" aria-pressed="${i===selected}"><span class="target-num">0${i+1}</span><span class="target-body"><strong>${v.name}</strong><span>${v.science.summary}</span><small>Synthetic test target</small></span><span class="target-chevron">↗</span></button>`).join('');
    [...document.querySelectorAll('[data-select]')].forEach(btn=>btn.addEventListener('click',()=>{selected=Number(btn.dataset.select);update()}));
  }
  $('advance').addEventListener('click',()=>{elapsed=Math.min(budget,elapsed+15);update()});
  $('reset').addEventListener('click',()=>{elapsed=0;update()});
  $('evidence-btn').addEventListener('click',()=>{$('scrim').hidden=false});
  $('close').addEventListener('click',()=>{$('scrim').hidden=true});
  $('scrim').addEventListener('click',e=>{if(e.target===$('scrim'))$('scrim').hidden=true});
  update();window.SESHAT_PREVIEW_READY=true;
})().catch(e=>{document.body.dataset.previewError=String(e);console.error(e)});

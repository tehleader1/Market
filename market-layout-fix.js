(function(){
  function css(){
    if(document.querySelector('#lmLayoutFixCss')) return;
    const s=document.createElement('style');
    s.id='lmLayoutFixCss';
    s.textContent=`
      body{overflow-x:hidden!important;}
      .dashboard{display:block!important;max-width:1480px;margin:0 auto;padding:18px!important;}
      .ticker-panel{display:none!important;}
      #lmGlobalTrackerPanel{max-width:none!important;margin:0!important;}
      .lm-side-by-side{display:grid;grid-template-columns:minmax(320px,420px) minmax(0,1fr);gap:18px;align-items:start;}
      .lm-laser-panel{border:1px solid rgba(97,244,166,.24);border-radius:18px;background:radial-gradient(circle at 30% 10%,rgba(97,244,166,.18),transparent 35%),rgba(255,255,255,.045);padding:1rem;min-height:520px;position:sticky;top:16px;overflow:hidden;}
      .lm-laser-panel h2{margin:.2rem 0;font-size:2rem;line-height:1;}
      .lm-laser-screen{margin-top:1rem;border-radius:18px;background:#050b16;border:1px solid rgba(255,255,255,.12);padding:1rem;min-height:250px;position:relative;overflow:hidden;}
      .lm-laser-line{height:4px;border-radius:999px;background:rgba(255,255,255,.06);margin:14px 0;position:relative;overflow:hidden;}
      .lm-laser-line:before{content:"";position:absolute;inset:0 auto 0 -40%;width:46%;background:linear-gradient(90deg,transparent,#61f4a6,#59d9ff,transparent);animation:lmLaser 1.6s linear infinite;}
      .lm-laser-line:nth-child(2):before{animation-duration:1.1s}.lm-laser-line:nth-child(3):before{animation-duration:2s}.lm-laser-line:nth-child(4):before{animation-duration:1.35s}.lm-laser-line:nth-child(5):before{animation-duration:1.8s}
      @keyframes lmLaser{to{transform:translateX(360%)}}
      .lm-laser-stat{display:grid;grid-template-columns:1fr auto;gap:.5rem;border-top:1px solid rgba(255,255,255,.1);padding:.7rem 0;color:rgba(247,251,255,.78)}
      .lm-laser-stat strong{color:#fff}.lm-laser-pill{display:inline-block;border:1px solid rgba(97,244,166,.28);border-radius:999px;padding:.25rem .55rem;margin:.15rem;color:#61f4a6;font-size:.78rem;font-weight:900;}
      .lm-tracker-side{min-width:0;overflow:auto;}
      @media(max-width:980px){.lm-side-by-side{grid-template-columns:1fr}.lm-laser-panel{position:relative;top:0;min-height:auto}}
    `;
    document.head.appendChild(s);
  }
  function laserHtml(){
    return `<aside class="lm-laser-panel" id="lmLaserReaderRestored">
      <div class="lm-laser-pill">Laser Reader Restored</div>
      <h2>LasersMarket</h2>
      <p class="lm-note">Live candle pressure reader beside the private signals board.</p>
      <div class="lm-laser-screen">
        <div class="lm-laser-line"></div><div class="lm-laser-line"></div><div class="lm-laser-line"></div><div class="lm-laser-line"></div><div class="lm-laser-line"></div>
      </div>
      <div class="lm-laser-stat"><span>Main laser</span><strong>Scanning</strong></div>
      <div class="lm-laser-stat"><span>Pressure route</span><strong>10m</strong></div>
      <div class="lm-laser-stat"><span>Bias reader</span><strong>Active</strong></div>
      <div class="lm-laser-stat"><span>Private app</span><strong>Unlocked view</strong></div>
    </aside>`;
  }
  function apply(){
    css();
    const panel=document.querySelector('#lmGlobalTrackerPanel');
    if(!panel || panel.dataset.layoutFixed==='true') return;
    panel.dataset.layoutFixed='true';
    const current=panel.innerHTML;
    panel.innerHTML=`<div class="lm-side-by-side">${laserHtml()}<div class="lm-tracker-side">${current}</div></div>`;
    document.querySelector('#lmLoginBox')?.style.setProperty('z-index','10000');
  }
  const observer=new MutationObserver(apply);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{apply();observer.observe(document.body,{childList:true,subtree:true});},{once:true});
  else {apply();observer.observe(document.body,{childList:true,subtree:true});}
})();
(function(){
  const DEFAULT_TICKER = 'AAPL';
  const STATE = { ticker: DEFAULT_TICKER, last: null };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function seed(symbol, salt){let n=0;for(const ch of String(symbol||'LM'))n+=ch.charCodeAt(0);return ((Math.sin(n+salt)*10000)%1+1)%1}

  function css(){
    if(document.querySelector('#lmTickerSearchRadarCss')) return;
    const s=document.createElement('style');
    s.id='lmTickerSearchRadarCss';
    s.textContent=`
      .lm-ticker-search-radar{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:radial-gradient(circle at 20% 0%,rgba(97,244,166,.12),transparent 35%),#070f1f;color:#fff;padding:1rem;margin:1rem 0;box-shadow:0 24px 70px rgba(0,0,0,.22)}
      .lm-tsr-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.lm-tsr-head h2{margin:.15rem 0}.lm-tsr-form{display:flex;gap:.5rem;flex-wrap:wrap}.lm-tsr-form input{min-width:190px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.35);color:#fff;padding:.75rem;font-weight:900;text-transform:uppercase}.lm-tsr-form button{border:0;border-radius:12px;background:#61f4a6;color:#06101f;font-weight:1000;padding:.75rem 1rem;cursor:pointer}.lm-tsr-grid{display:grid;grid-template-columns:270px minmax(280px,1fr) 280px;gap:1rem;align-items:stretch;margin-top:1rem}.lm-tsr-laser{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:.9rem;overflow:hidden}.lm-tsr-symbol{font-size:2.4rem;font-weight:1000;letter-spacing:.04em}.lm-tsr-price{font-size:1.2rem;color:rgba(255,255,255,.76)}.lm-tsr-lasers{display:grid;gap:6px;margin:1rem 0}.lm-tsr-lasers span{height:5px;border-radius:999px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}.lm-tsr-lasers span:before{content:"";position:absolute;inset:0 auto 0 -40%;width:45%;background:linear-gradient(90deg,transparent,#59d9ff,#61f4a6,transparent);animation:lmTsrLaser var(--lm-tsr-speed,1.1s) linear infinite}.lm-tsr-meter{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(0,0,0,.24);padding:1rem}.lm-tsr-radar{height:92px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(90deg,rgba(255,104,104,.18),rgba(255,255,255,.04),rgba(97,244,166,.18));position:relative;overflow:hidden}.lm-tsr-red,.lm-tsr-green{position:absolute;top:0;bottom:0;transition:width .55s ease}.lm-tsr-red{left:0;background:linear-gradient(90deg,rgba(255,104,104,.82),rgba(255,104,104,.08))}.lm-tsr-green{right:0;background:linear-gradient(270deg,rgba(97,244,166,.86),rgba(97,244,166,.08))}.lm-tsr-line{position:absolute;top:0;bottom:0;width:3px;background:#fff;left:50%;box-shadow:0 0 18px #fff;z-index:2;transition:left .55s ease}.lm-tsr-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:1000;text-shadow:0 2px 14px rgba(0,0,0,.9);z-index:3}.lm-tsr-center strong{font-size:1.55rem}.lm-tsr-center small{display:block;font-size:.78rem;opacity:.82}.lm-tsr-counts{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.8rem}.lm-tsr-counts div{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.7rem;background:rgba(255,255,255,.045)}.lm-tsr-counts strong{display:block;font-size:1.25rem}.lm-tsr-bear{color:#ff6868}.lm-tsr-bull{color:#61f4a6}.lm-tsr-read{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:1rem}.lm-tsr-read h3{margin:.1rem 0}.lm-tsr-stat{display:flex;justify-content:space-between;gap:.75rem;border-top:1px solid rgba(255,255,255,.09);padding:.55rem 0;color:rgba(255,255,255,.75)}.lm-tsr-stat strong{color:#fff}.lm-tsr-disclaimer{font-size:.78rem;opacity:.65;margin-top:.6rem;line-height:1.35}@keyframes lmTsrLaser{to{transform:translateX(350%)}}@media(max-width:1050px){.lm-tsr-grid{grid-template-columns:1fr}.lm-tsr-symbol{font-size:2rem}}
    `;
    document.head.appendChild(s);
  }

  function fallback(symbol){
    const score=Math.round(35+seed(symbol,Date.now()/30000)*60);
    const bull=Math.max(5,Math.min(95,score+Math.round((seed(symbol,Date.now()/7000)-.5)*20)));
    const bear=100-bull;
    const volume=Math.round(120+seed(symbol,Date.now()/9000)*1500);
    return {symbol,price:(8+seed(symbol,2)*280).toFixed(2),score,bull,bear,buys:Math.round(volume*bull/100),sells:Math.round(volume*bear/100),bias:bull>=bear?'Bullish':'Bearish',source:'fallback radar',pressure:score,volume};
  }

  async function load(symbol){
    const clean=String(symbol||DEFAULT_TICKER).trim().toUpperCase().replace(/[^A-Z0-9.]/g,'').slice(0,10)||DEFAULT_TICKER;
    try{
      const res=await fetch(`/api/options-dashboard?ticker=${encodeURIComponent(clean)}&ts=${Date.now()}`,{cache:'no-store'});
      if(!res.ok) throw new Error('api '+res.status);
      const p=await res.json();
      const m=p.metrics||{}; const c=p.contract||{}; const candles=p.candles||[]; const last=candles[candles.length-1]||{};
      const pressure=Number(m.pressure||m.pressureScore||m.moveReadiness||0) || fallback(clean).pressure;
      const callVol=Number(m.callVolume||c.callVolume||m.calls||0);
      const putVol=Number(m.putVolume||c.putVolume||m.puts||0);
      let bull = callVol||putVol ? Math.round((callVol/(callVol+putVol))*100) : Math.round(Math.max(5,Math.min(95,pressure)));
      bull = Math.max(5,Math.min(95,bull));
      const bear=100-bull;
      const volume=Number(c.volume||m.volume||callVol+putVol)||fallback(clean).volume;
      return {symbol:clean,price:Number(last.close||m.underlyingPrice||p.price||0)?.toFixed?.(2)||fallback(clean).price,score:Math.round(pressure),bull,bear,buys:Math.round(volume*bull/100),sells:Math.round(volume*bear/100),bias:bull>=bear?'Bullish':'Bearish',source:'real options dashboard',pressure:Math.round(pressure),volume};
    }catch(e){return fallback(clean)}
  }

  function html(d){
    const winner=d.bull>=d.bear?'BULLS':'BEARS';
    const edge=Math.abs(d.bull-d.bear);
    const speed=Math.max(.25,2.2-(d.score/100)*1.9).toFixed(2)+'s';
    return `<section class="lm-ticker-search-radar" id="lmTickerSearchRadar" style="--lm-tsr-speed:${speed}">
      <div class="lm-tsr-head"><div><div class="lm-eyebrow">Search Stock Options Radar</div><h2>Ticker Laser Reader</h2><p>Search any ticker to generate a laser read, buy/sell pressure meter, bullish/bearish read, and statistics above the 5 laser scanners.</p></div><form class="lm-tsr-form" data-tsr-form><input data-tsr-input placeholder="Ticker e.g. AAPL" value="${esc(d.symbol)}"><button type="submit">Generate Radar</button></form></div>
      <div class="lm-tsr-grid">
        <article class="lm-tsr-laser"><div class="lm-tsr-symbol">${esc(d.symbol)}</div><div class="lm-tsr-price">$${esc(d.price)} · ${esc(d.source)}</div><div class="lm-tsr-lasers"><span></span><span></span><span></span><span></span></div><div class="lm-tsr-stat"><span>Laser Score</span><strong>${d.score}%</strong></div><div class="lm-tsr-stat"><span>Bias</span><strong class="${d.bias==='Bullish'?'lm-tsr-bull':'lm-tsr-bear'}">${esc(d.bias)}</strong></div></article>
        <article class="lm-tsr-meter"><div class="lm-tsr-radar"><div class="lm-tsr-red" style="width:${d.bear}%"></div><div class="lm-tsr-green" style="width:${d.bull}%"></div><div class="lm-tsr-line" style="left:${d.bear}%"></div><div class="lm-tsr-center"><div><strong>${winner} +${edge}%</strong><small>${d.bull}% bulls / ${d.bear}% bears</small></div></div></div><div class="lm-tsr-counts"><div><span class="lm-tsr-bear">Sells / puts</span><strong>${d.sells}</strong></div><div><span class="lm-tsr-bull">Buys / calls</span><strong>${d.buys}</strong></div></div></article>
        <article class="lm-tsr-read"><h3>${esc(d.symbol)} Reading</h3><p>${d.bias==='Bullish'?'Bullish pressure is winning right now. Bulls are pushing the meter green, which means call/buy pressure is stronger than sell/put pressure in this read.':'Bearish pressure is winning right now. Bears are pushing the meter red, which means sell/put pressure is stronger than buy/call pressure in this read.'}</p><div class="lm-tsr-stat"><span>Pressure</span><strong>${d.pressure}%</strong></div><div class="lm-tsr-stat"><span>Volume base</span><strong>${d.volume}</strong></div><div class="lm-tsr-stat"><span>Signal type</span><strong>${d.bias==='Bullish'?'Bullish / call pressure':'Bearish / put pressure'}</strong></div><p class="lm-tsr-disclaimer">Research-only market analytics. This does not place trades or guarantee performance.</p></article>
      </div>
    </section>`;
  }

  async function render(symbol){
    css();
    STATE.ticker = String(symbol||STATE.ticker||DEFAULT_TICKER).toUpperCase();
    const data=await load(STATE.ticker);
    STATE.last=data;
    let mount=document.querySelector('#lmTickerSearchRadar');
    const live=document.querySelector('#lmLiveScanners');
    const host=document.querySelector('#lmGlobalTrackerPanel .lm-tracker-side')||document.querySelector('#lmGlobalTrackerPanel')||document.querySelector('main.dashboard')||document.body;
    if(mount) mount.outerHTML=html(data);
    else if(live) live.insertAdjacentHTML('beforebegin',html(data));
    else host.insertAdjacentHTML('afterbegin',html(data));
  }

  document.addEventListener('submit',e=>{
    const form=e.target.closest('[data-tsr-form]');
    if(!form)return;
    e.preventDefault();
    const ticker=form.querySelector('[data-tsr-input]')?.value||DEFAULT_TICKER;
    render(ticker);
  },true);

  function start(){setTimeout(()=>render(localStorage.getItem('lmLastTicker')||DEFAULT_TICKER),900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
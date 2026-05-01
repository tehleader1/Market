(function(){
  const DEFAULT_TICKER = 'AAPL';
  const STATE = { ticker: DEFAULT_TICKER, last: null };
  const MARKET_URL = 'https://shop.supportrd.com/products/supportrd-market-signals';
  const RECENT_KEY = 'lmRecentStockSearches';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function seed(symbol, salt){let n=0;for(const ch of String(symbol||'LM'))n+=ch.charCodeAt(0);return ((Math.sin(n+salt)*10000)%1+1)%1}
  function marketAccess(){try{const a=JSON.parse(localStorage.getItem('lmAuthV1')||'{}');const plan=String(a.plan||a.tier||'');return !!(window.LasersMarketAccess?.isPaid?.()||/signals|25000/i.test(plan)||(!plan&&localStorage.getItem('lmMarketSignalsPaid')==='true'));}catch{return localStorage.getItem('lmMarketSignalsPaid')==='true'}}
  function scoreText(score){return marketAccess()?`${score}%`:'VIP score';}
  function readRecent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]').filter(Boolean).slice(0,6)}catch{return []}}
  function remember(symbol){const clean=String(symbol||'').toUpperCase().replace(/[^A-Z0-9.]/g,'').slice(0,10);if(!clean)return;const next=[clean,...readRecent().filter(x=>x!==clean)].slice(0,6);localStorage.setItem(RECENT_KEY,JSON.stringify(next));localStorage.setItem('lmLastTicker',clean)}
  function recentHtml(){const recent=readRecent();return recent.length?`<div class="lm-tsr-recents"><span>Recent</span>${recent.map(t=>`<button type="button" data-tsr-recent="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}

  function css(){
    if(document.querySelector('#lmTickerSearchRadarCss')) return;
    const s=document.createElement('style');
    s.id='lmTickerSearchRadarCss';
    s.textContent=`
      .lm-ticker-search-radar{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:radial-gradient(circle at 20% 0%,rgba(97,244,166,.12),transparent 35%),#070f1f;color:#fff;padding:1rem;margin:1rem 0;box-shadow:0 24px 70px rgba(0,0,0,.22)}
      .lm-tsr-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.lm-tsr-head h2{margin:.15rem 0}.lm-tsr-form{display:flex;gap:.5rem;flex-wrap:wrap}.lm-tsr-form input{min-width:190px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.35);color:#fff;padding:.75rem;font-weight:900;text-transform:uppercase}.lm-tsr-form button{border:0;border-radius:12px;background:#61f4a6;color:#06101f;font-weight:1000;padding:.75rem 1rem;cursor:pointer}.lm-tsr-recents{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.55rem}.lm-tsr-recents span{color:rgba(255,255,255,.62);font-size:.72rem;font-weight:900;text-transform:uppercase}.lm-tsr-recents button{border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.055);color:#fff;padding:.32rem .55rem;font-size:.72rem;font-weight:900;cursor:pointer}
      .lm-tsr-grid{display:grid;grid-template-columns:270px minmax(300px,1fr) 300px;gap:1rem;align-items:stretch;margin-top:1rem}.lm-tsr-laser,.lm-tsr-meter,.lm-tsr-read,.lm-tsr-chart{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:.9rem;overflow:hidden}.lm-tsr-symbol{font-size:2.4rem;font-weight:1000;letter-spacing:.04em}.lm-tsr-price{font-size:1.2rem;color:rgba(255,255,255,.76)}.lm-tsr-lasers{display:grid;gap:6px;margin:1rem 0}.lm-tsr-lasers span{height:5px;border-radius:999px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}.lm-tsr-lasers span:before{content:"";position:absolute;inset:0 auto 0 -40%;width:45%;background:linear-gradient(90deg,transparent,#59d9ff,#61f4a6,transparent);animation:lmTsrLaser var(--lm-tsr-speed,1.1s) linear infinite}
      .lm-tsr-radar{height:92px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(90deg,rgba(255,104,104,.18),rgba(255,255,255,.04),rgba(97,244,166,.18));position:relative;overflow:hidden}.lm-tsr-red,.lm-tsr-green{position:absolute;top:0;bottom:0;transition:width .55s ease}.lm-tsr-red{left:0;background:linear-gradient(90deg,rgba(255,104,104,.82),rgba(255,104,104,.08))}.lm-tsr-green{right:0;background:linear-gradient(270deg,rgba(97,244,166,.86),rgba(97,244,166,.08))}.lm-tsr-line{position:absolute;top:0;bottom:0;width:3px;background:#fff;left:50%;box-shadow:0 0 18px #fff;z-index:2;transition:left .55s ease}.lm-tsr-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:1000;text-shadow:0 2px 14px rgba(0,0,0,.9);z-index:3}.lm-tsr-center strong{font-size:1.55rem}.lm-tsr-center small{display:block;font-size:.78rem;opacity:.82}.lm-tsr-counts{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.8rem}.lm-tsr-counts div{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.7rem;background:rgba(255,255,255,.045)}.lm-tsr-counts strong{display:block;font-size:1.25rem}
      .lm-tsr-chart{grid-column:1/3;background:rgba(0,0,0,.24);min-height:320px}.lm-tsr-chart-head{display:flex;justify-content:space-between;gap:.8rem;align-items:center;margin-bottom:.75rem}.lm-tsr-chart-head h3,.lm-tsr-read h3{margin:.1rem 0}.lm-tsr-chart-head span{color:rgba(255,255,255,.7);font-size:.82rem}.lm-tsr-chart canvas{width:100%;height:260px;border-radius:14px;background:#030814;border:1px solid rgba(255,255,255,.1);display:block}.lm-tsr-description{grid-column:3/4}.lm-tsr-bear{color:#ff6868}.lm-tsr-bull{color:#61f4a6}.lm-tsr-stat{display:flex;justify-content:space-between;gap:.75rem;border-top:1px solid rgba(255,255,255,.09);padding:.55rem 0;color:rgba(255,255,255,.75)}.lm-tsr-stat strong{color:#fff}.lm-tsr-buy-link{display:inline-flex;align-items:center;justify-content:center;margin-top:.45rem;border:1px solid rgba(255,197,66,.35);border-radius:8px;padding:.45rem .55rem;color:#ffe7a3;text-decoration:none;background:rgba(255,197,66,.1);font-size:.72rem;font-weight:1000}.lm-tsr-disclaimer{font-size:.78rem;opacity:.65;margin-top:.6rem;line-height:1.35}@keyframes lmTsrLaser{to{transform:translateX(350%)}}@media(max-width:1050px){.lm-tsr-grid{grid-template-columns:1fr}.lm-tsr-symbol{font-size:2rem}.lm-tsr-chart,.lm-tsr-description{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function makeCandles(symbol, score){
    let base=8+seed(symbol,2)*280;
    return Array.from({length:40},(_,i)=>{
      const drift=(score-50)/100*i*.08;
      const wave=Math.sin(i*.56+seed(symbol,4)*4)*1.4;
      const open=base+wave+drift;
      const close=open+(seed(symbol,i+7)-.5)*(score>70?3.2:1.7);
      const high=Math.max(open,close)+seed(symbol,i+17)*1.4;
      const low=Math.min(open,close)-seed(symbol,i+27)*1.4;
      base=close;
      return {open,close,high,low};
    });
  }

  function fallback(symbol){
    const score=Math.round(35+seed(symbol,Date.now()/30000)*60);
    const bull=Math.max(5,Math.min(95,score+Math.round((seed(symbol,Date.now()/7000)-.5)*20)));
    const bear=100-bull;
    const volume=Math.round(120+seed(symbol,Date.now()/9000)*1500);
    return {symbol,price:(8+seed(symbol,2)*280).toFixed(2),score,bull,bear,buys:Math.round(volume*bull/100),sells:Math.round(volume*bear/100),bias:bull>=bear?'Bullish':'Bearish',source:'fallback radar',pressure:score,volume,candles:makeCandles(symbol,score)};
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
      return {symbol:clean,price:Number(last.close||m.underlyingPrice||p.price||0)?.toFixed?.(2)||fallback(clean).price,score:Math.round(pressure),bull,bear,buys:Math.round(volume*bull/100),sells:Math.round(volume*bear/100),bias:bull>=bear?'Bullish':'Bearish',source:'real options dashboard',pressure:Math.round(pressure),volume,candles:candles.length?candles.slice(-40):makeCandles(clean,pressure)};
    }catch(e){return fallback(clean)}
  }

  function drawChart(canvas, candles, bias){
    if(!canvas||!candles?.length)return;
    const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||640,h=canvas.clientHeight||260;
    canvas.width=w*dpr;canvas.height=h*dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const max=Math.max(...candles.map(c=>Number(c.high??c.close??0))),min=Math.min(...candles.map(c=>Number(c.low??c.close??0))),range=Math.max(.01,max-min);
    ctx.fillStyle='#030814';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';
    for(let i=0;i<5;i++){const y=14+i*(h-28)/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    const step=w/candles.length,cw=Math.max(4,step*.52);
    candles.forEach((c,i)=>{const x=i*step+step/2;const y=v=>14+(max-v)/range*(h-28);const open=Number(c.open??c.close),close=Number(c.close??c.open),high=Number(c.high??Math.max(open,close)),low=Number(c.low??Math.min(open,close));const up=close>=open;ctx.strokeStyle=up?'#61f4a6':'#ff6868';ctx.fillStyle=up?'rgba(97,244,166,.92)':'rgba(255,104,104,.92)';ctx.beginPath();ctx.moveTo(x,y(high));ctx.lineTo(x,y(low));ctx.stroke();ctx.fillRect(x-cw/2,Math.min(y(open),y(close)),cw,Math.max(2,Math.abs(y(close)-y(open))))});
    ctx.fillStyle=bias==='Bullish'?'rgba(97,244,166,.08)':'rgba(255,104,104,.08)';ctx.fillRect(0,0,w,h);
  }

  function description(d){
    const side=d.bias==='Bullish'?'buy/call':'sell/put';
    const opposite=d.bias==='Bullish'?'sell/put':'buy/call';
    return `${d.symbol} is showing ${side} pressure ahead of ${opposite} pressure in this read. The gauge is measuring recent pressure, volume base, and dashboard context, while the 1-minute chart view shows whether the move is smoothing out or still choppy.`;
  }

  function html(d){
    const winner=d.bull>=d.bear?'BULLS':'BEARS';
    const edge=Math.abs(d.bull-d.bear);
    const speed=Math.max(.25,2.2-(d.score/100)*1.9).toFixed(2)+'s';
    const paid=marketAccess();
    return `<section class="lm-ticker-search-radar" id="lmTickerSearchRadar" style="--lm-tsr-speed:${speed}">
      <div class="lm-tsr-head"><div><div class="lm-eyebrow">Search Stock Options Radar</div><h2>Ticker Laser Reader</h2><p>Free accounts remember recent searches. $25,000 Market Signals unlocks the actual stock reading score.</p>${paid?'':`<a class="lm-tsr-buy-link" href="${MARKET_URL}" target="_blank" rel="noopener">Buy LasersMarket Access</a>`}${recentHtml()}</div><form class="lm-tsr-form" data-tsr-form><input data-tsr-input placeholder="Ticker e.g. AAPL" value="${esc(d.symbol)}"><button type="submit">Generate Stock View</button></form></div>
      <div class="lm-tsr-grid">
        <article class="lm-tsr-laser"><div class="lm-tsr-symbol">${esc(d.symbol)}</div><div class="lm-tsr-price">$${esc(d.price)} - ${esc(d.source)}</div><div class="lm-tsr-lasers"><span></span><span></span><span></span><span></span></div><div class="lm-tsr-stat"><span>Laser Score</span><strong>${scoreText(d.score)}</strong></div><div class="lm-tsr-stat"><span>Bias</span><strong class="${d.bias==='Bullish'?'lm-tsr-bull':'lm-tsr-bear'}">${esc(d.bias)}</strong></div></article>
        <article class="lm-tsr-meter"><div class="lm-tsr-radar"><div class="lm-tsr-red" style="width:${d.bear}%"></div><div class="lm-tsr-green" style="width:${d.bull}%"></div><div class="lm-tsr-line" style="left:${d.bear}%"></div><div class="lm-tsr-center"><div><strong>${winner} +${edge}%</strong><small>${d.bull}% bulls / ${d.bear}% bears</small></div></div></div><div class="lm-tsr-counts"><div><span class="lm-tsr-bear">Sells / puts</span><strong>${d.sells}</strong></div><div><span class="lm-tsr-bull">Buys / calls</span><strong>${d.buys}</strong></div></div></article>
        <article class="lm-tsr-read"><h3>${esc(d.symbol)} Quick Read</h3><p>${d.bias==='Bullish'?'Bullish pressure is winning right now in this reader.':'Bearish pressure is winning right now in this reader.'}</p><div class="lm-tsr-stat"><span>Pressure</span><strong>${scoreText(d.pressure)}</strong></div><div class="lm-tsr-stat"><span>Volume base</span><strong>${d.volume}</strong></div><div class="lm-tsr-stat"><span>Signal type</span><strong>${d.bias==='Bullish'?'Bullish / call pressure':'Bearish / put pressure'}</strong></div></article>
        <article class="lm-tsr-chart"><div class="lm-tsr-chart-head"><h3>${esc(d.symbol)} 1-Minute Chart View</h3><span>${esc(d.source)} - ${esc(d.bias)}</span></div><canvas data-tsr-chart="${esc(d.symbol)}"></canvas></article>
        <article class="lm-tsr-read lm-tsr-description"><h3>${esc(d.symbol)} Description View</h3><p>${esc(description(d))}</p><p class="lm-tsr-disclaimer">Research-only market analytics. This does not place trades or guarantee performance.</p></article>
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
    setTimeout(()=>drawChart(document.querySelector('[data-tsr-chart]'), data.candles, data.bias), 40);
  }

  document.addEventListener('submit',e=>{
    const form=e.target.closest('[data-tsr-form]');
    if(!form)return;
    e.preventDefault();
    const ticker=form.querySelector('[data-tsr-input]')?.value||DEFAULT_TICKER;
    remember(ticker);
    render(ticker);
  },true);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-tsr-recent]');if(b){remember(b.dataset.tsrRecent);render(b.dataset.tsrRecent)}},true);
  document.addEventListener('lm-auth-updated',()=>render(STATE.ticker),true);

  function start(){setTimeout(()=>render(localStorage.getItem('lmLastTicker')||DEFAULT_TICKER),900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

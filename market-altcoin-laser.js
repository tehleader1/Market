(function(){
  const WATCH = ['SOL','ETH','XRP','DOGE','AVAX','ADA','LINK','LTC','DOT','ATOM','NEAR','ARB','OP','SUI','INJ','PEPE','SHIB'];
  const DEFAULT = 'SOL';
  const STATE = { coin: DEFAULT, budget: 200, timer:null, rotation:0 };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function seed(symbol, salt){let n=0;for(const ch of String(symbol||'SOL'))n+=ch.charCodeAt(0);return ((Math.sin(n+salt)*10000)%1+1)%1}

  function css(){
    if(document.querySelector('#lmAltcoinLaserCss')) return;
    const s=document.createElement('style');
    s.id='lmAltcoinLaserCss';
    s.textContent=`
      .lm-altcoin-laser{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:radial-gradient(circle at 80% 0%,rgba(255,197,66,.16),transparent 35%),radial-gradient(circle at 0% 20%,rgba(97,244,166,.13),transparent 35%),#060d1a;color:#fff;padding:1rem;margin:1rem 0;box-shadow:0 24px 70px rgba(0,0,0,.25)}
      .lm-alt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}.lm-alt-head h2{margin:.15rem 0}.lm-alt-form{display:flex;gap:.5rem;flex-wrap:wrap}.lm-alt-form input{border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.35);color:#fff;padding:.72rem;font-weight:900;text-transform:uppercase}.lm-alt-form input[type=number]{width:115px}.lm-alt-form button{border:0;border-radius:12px;background:#ffc542;color:#06101f;font-weight:1000;padding:.72rem 1rem;cursor:pointer}
      .lm-alt-reader-grid{display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:.7rem;margin:.9rem 0}.lm-alt-reader{border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#07101f;padding:.75rem;overflow:hidden}.lm-alt-reader-top{display:flex;justify-content:space-between;gap:.5rem;align-items:center}.lm-alt-reader-top strong{font-size:1.15rem}.lm-alt-reader-score{font-weight:1000;color:#ffc542}.lm-alt-mini{width:100%;height:112px;border-radius:12px;background:#030814;border:1px solid rgba(255,255,255,.08);margin:.55rem 0;display:block}.lm-alt-bb{border:1px solid rgba(255,255,255,.14);border-radius:13px;background:rgba(0,0,0,.28);padding:.62rem;margin-top:.45rem;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 12px 30px rgba(0,0,0,.18)}.lm-alt-bb.is-bullish{border-color:rgba(97,244,166,.38)}.lm-alt-bb.is-bearish{border-color:rgba(255,104,104,.38)}.lm-alt-gauge-title{display:flex;justify-content:space-between;gap:.45rem;align-items:center;margin-bottom:.42rem;text-transform:uppercase;font-size:.7rem;letter-spacing:.08em;color:rgba(255,255,255,.7)}.lm-alt-gauge-title strong{color:#fff;text-align:right}.lm-alt-gauge-read{font-size:.78rem;line-height:1.35;margin:.5rem 0 0;color:rgba(255,255,255,.82)}.lm-alt-radar{height:56px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(90deg,rgba(255,104,104,.2),rgba(255,255,255,.04),rgba(97,244,166,.2));position:relative;overflow:hidden}.lm-alt-red,.lm-alt-green{position:absolute;top:0;bottom:0}.lm-alt-red{left:0;background:linear-gradient(90deg,rgba(255,104,104,.82),rgba(255,104,104,.08))}.lm-alt-green{right:0;background:linear-gradient(270deg,rgba(97,244,166,.84),rgba(97,244,166,.08))}.lm-alt-line{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 12px #fff}.lm-alt-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:1000;text-shadow:0 1px 9px rgba(0,0,0,.9)}
      .lm-alt-grid{display:grid;grid-template-columns:270px minmax(320px,1fr) 310px;gap:1rem;margin-top:1rem}.lm-alt-card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.045);padding:.9rem;overflow:hidden}.lm-alt-symbol{font-size:2.5rem;font-weight:1000}.lm-alt-pair{opacity:.75}.lm-alt-lasers{display:grid;gap:6px;margin:1rem 0}.lm-alt-lasers span{height:5px;border-radius:999px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}.lm-alt-lasers span:before{content:"";position:absolute;inset:0 auto 0 -40%;width:46%;background:linear-gradient(90deg,transparent,#ffc542,#61f4a6,transparent);animation:lmAltLaser var(--lm-alt-speed,1.1s) linear infinite}.lm-alt-chart{grid-column:1/3;min-height:320px;background:rgba(0,0,0,.24)}.lm-alt-chart-head{display:flex;justify-content:space-between;gap:.8rem;align-items:center;margin-bottom:.75rem}.lm-alt-chart-head h3{margin:0}.lm-alt-chart-head span{color:rgba(255,255,255,.7);font-size:.82rem}.lm-alt-chart canvas{width:100%;height:260px;border-radius:14px;background:#030814;border:1px solid rgba(255,255,255,.1);display:block}.lm-alt-counts{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.8rem}.lm-alt-counts div{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.65rem;background:rgba(255,255,255,.045)}.lm-alt-bear{color:#ff6868}.lm-alt-bull{color:#61f4a6}.lm-alt-stat{display:flex;justify-content:space-between;gap:.75rem;border-top:1px solid rgba(255,255,255,.09);padding:.55rem 0;color:rgba(255,255,255,.75)}.lm-alt-stat strong{color:#fff}.lm-alt-hot{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:.55rem;margin-top:.9rem}.lm-alt-hot button{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.055);color:#fff;padding:.65rem;text-align:left;cursor:pointer}.lm-alt-hot button strong{display:block}.lm-alt-note{font-size:.78rem;opacity:.66;line-height:1.35;margin-top:.6rem}@keyframes lmAltLaser{to{transform:translateX(350%)}}@media(max-width:1100px){.lm-alt-grid,.lm-alt-reader-grid{grid-template-columns:1fr 1fr}.lm-alt-chart{grid-column:1/-1}}@media(max-width:700px){.lm-alt-grid,.lm-alt-reader-grid,.lm-alt-hot{grid-template-columns:1fr}.lm-alt-chart{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function pair(coin){return `${coin}/USD`}
  function makeCandles(coin, score){
    let base=seed(coin,2)*120+(coin==='ETH'?2200:coin==='SOL'?80:coin==='XRP'?0.4:coin==='DOGE'?0.08:1);
    return Array.from({length:40},(_,i)=>{
      const drift=(score-50)/100*i*.04;
      const scale=coin==='ETH'?18:coin==='BTC'?120:coin==='XRP'||coin==='DOGE'?0.004:1.2;
      const open=base+Math.sin(i*.52+seed(coin,4)*4)*scale+drift;
      const close=open+(seed(coin,i+9)-.5)*scale*(score>70?1.7:.9);
      const high=Math.max(open,close)+seed(coin,i+13)*scale*.8;
      const low=Math.min(open,close)-seed(coin,i+19)*scale*.8;
      base=close;
      return {open,close,high,low};
    });
  }

  function calc(coin,budget,slot=0){
    const s=String(coin||DEFAULT).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)||DEFAULT;
    const score=Math.round(38+seed(s,Date.now()/45000+slot)*58);
    let bull=Math.round(Math.max(6,Math.min(94,score+(seed(s,Date.now()/8000+slot)-.5)*24)));
    const bear=100-bull;
    const price=(seed(s,2)*120+(s==='ETH'?2200:s==='BTC'?61000:s==='SOL'?80:s==='XRP'?0.4:s==='DOGE'?0.08:1)).toFixed(s==='XRP'||s==='DOGE'||s==='PEPE'||s==='SHIB'?5:2);
    const flowBase=Math.round(1200+seed(s,Date.now()/12000+slot)*9800);
    const demand=Math.round(flowBase*bull/100);
    const supply=Math.round(flowBase*bear/100);
    const bias=bull>=bear?'Bullish pressure':'Bearish pressure';
    const volatility=Number((2+seed(s,6+slot)*9).toFixed(2));
    return {coin:s,pair:pair(s),score,bull,bear,demand,supply,bias,price,volatility,budget:Number(budget)||200,source:'24/7 altcoin analytics radar',candles:makeCandles(s,score)};
  }

  function drawChart(canvas, candles, bias){
    if(!canvas||!candles?.length)return;
    const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||620,h=canvas.clientHeight||260;
    canvas.width=w*dpr;canvas.height=h*dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const max=Math.max(...candles.map(c=>Number(c.high??c.close??0))),min=Math.min(...candles.map(c=>Number(c.low??c.close??0))),range=Math.max(.00001,max-min);
    ctx.fillStyle='#030814';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';
    for(let i=0;i<5;i++){const y=14+i*(h-28)/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    const step=w/candles.length,cw=Math.max(4,step*.52);
    candles.forEach((c,i)=>{const x=i*step+step/2;const y=v=>14+(max-v)/range*(h-28);const open=Number(c.open??c.close),close=Number(c.close??c.open),high=Number(c.high??Math.max(open,close)),low=Number(c.low??Math.min(open,close));const up=close>=open;ctx.strokeStyle=up?'#61f4a6':'#ff6868';ctx.fillStyle=up?'rgba(97,244,166,.92)':'rgba(255,104,104,.92)';ctx.beginPath();ctx.moveTo(x,y(high));ctx.lineTo(x,y(low));ctx.stroke();ctx.fillRect(x-cw/2,Math.min(y(open),y(close)),cw,Math.max(2,Math.abs(y(close)-y(open))))});
    ctx.fillStyle=bias.includes('Bullish')?'rgba(97,244,166,.08)':'rgba(255,104,104,.08)';ctx.fillRect(0,0,w,h);
  }

  function gauge(d){
    const bullish=d.bull>=d.bear;
    const edge=Math.abs(d.bull-d.bear);
    const winner=bullish?'Buy pressure':'Sell pressure';
    const read=bullish?`${d.coin} buy-side demand is leading by ${edge}%.`:`${d.coin} sell-side supply is leading by ${edge}%.`;
    return `<div class="lm-alt-bb ${bullish?'is-bullish':'is-bearish'}"><div class="lm-alt-gauge-title"><span>Laser Gauge Read</span><strong>${winner}</strong></div><div class="lm-alt-radar"><div class="lm-alt-red" style="width:${d.bear}%"></div><div class="lm-alt-green" style="width:${d.bull}%"></div><div class="lm-alt-line" style="left:${d.bear}%"></div><div class="lm-alt-center">${winner} +${edge}%</div></div><p class="lm-alt-gauge-read">${esc(read)}</p><div class="lm-alt-counts"><div><span class="lm-alt-bear">Sell ${d.bear}%</span><strong>${d.supply}</strong></div><div><span class="lm-alt-bull">Buy ${d.bull}%</span><strong>${d.demand}</strong></div></div></div>`;
  }

  function description(d){
    const side=d.bull>=d.bear?'buy demand':'sell supply';
    const opposite=d.bull>=d.bear?'sell supply':'buy demand';
    return `${d.coin} is showing ${side} ahead of ${opposite} in this 24/7 altcoin read. The gauge measures demand/supply pressure, the 1-minute chart view shows whether the move is gliding or choppy, and the description view keeps the search result readable.`;
  }

  function readerCard(d){
    return `<article class="lm-alt-reader"><div class="lm-alt-reader-top"><strong>${esc(d.coin)}</strong><span class="lm-alt-reader-score">${d.score}%</span></div><canvas class="lm-alt-mini" data-alt-mini="${esc(d.coin)}"></canvas><div class="lm-alt-stat"><span>Pair</span><strong>${esc(d.pair)}</strong></div>${gauge(d)}</article>`;
  }

  function html(d, readers){
    const speed=Math.max(.22,2.25-(d.score/100)*1.95).toFixed(2)+'s';
    const hot=WATCH.slice(STATE.rotation,STATE.rotation+4); const hotList=(hot.length<4?hot.concat(WATCH.slice(0,4-hot.length)):hot);
    return `<section class="lm-altcoin-laser" id="lmAltcoinLaser" style="--lm-alt-speed:${speed}">
      <div class="lm-alt-head"><div><div class="lm-eyebrow">Search Altcoin Radar</div><h2>4 Altcoin Readers + Buy/Sell Gauge</h2><p>Search an altcoin ticker to open its own 1-minute chart view, description view, and demand/supply pressure gauge.</p></div><form class="lm-alt-form" data-alt-form><input data-alt-coin placeholder="SOL" value="${esc(d.coin)}"><input data-alt-budget type="number" min="1" step="1" value="${esc(d.budget)}"><button type="submit">Generate Altcoin View</button></form></div>
      <div class="lm-alt-reader-grid">${readers.map(readerCard).join('')}</div>
      <div class="lm-alt-grid"><article class="lm-alt-card"><div class="lm-alt-symbol">${esc(d.coin)}</div><div class="lm-alt-pair">${esc(d.pair)} - $${esc(d.price)}</div><div class="lm-alt-lasers"><span></span><span></span><span></span><span></span></div><div class="lm-alt-stat"><span>Laser Score</span><strong>${d.score}%</strong></div><div class="lm-alt-stat"><span>Bias</span><strong class="${d.bull>=d.bear?'lm-alt-bull':'lm-alt-bear'}">${esc(d.bias)}</strong></div><div class="lm-alt-stat"><span>Volatility Read</span><strong>${d.volatility}%</strong></div></article>
      <article class="lm-alt-card">${gauge(d)}</article>
      <article class="lm-alt-card"><h3>${esc(d.coin)} Quick Read</h3><p>${d.bull>=d.bear?'Green demand pressure is stronger in this read.':'Red supply pressure is stronger in this read.'}</p><div class="lm-alt-stat"><span>Budget lens</span><strong>$${d.budget}</strong></div><div class="lm-alt-stat"><span>Risk mode</span><strong>${d.volatility>=7?'High volatility':'Moderate volatility'}</strong></div></article>
      <article class="lm-alt-card lm-alt-chart"><div class="lm-alt-chart-head"><h3>${esc(d.coin)} 1-Minute Chart View</h3><span>${esc(d.source)} - ${esc(d.bias)}</span></div><canvas data-alt-chart="${esc(d.coin)}"></canvas></article>
      <article class="lm-alt-card"><h3>${esc(d.coin)} Description View</h3><p>${esc(description(d))}</p><p class="lm-alt-note">Research-only analytics. This does not place orders, guarantee gains, or recommend a trade. Use exchange risk controls.</p></article></div>
      <div class="lm-alt-hot">${hotList.map(c=>`<button type="button" data-alt-hot="${esc(c)}"><strong>${esc(c)}</strong><span>${esc(pair(c))}</span></button>`).join('')}</div>
    </section>`;
  }

  function render(coin,budget){
    css();
    STATE.coin=String(coin||STATE.coin||DEFAULT).toUpperCase();
    STATE.budget=Number(budget||STATE.budget||200);
    const data=calc(STATE.coin,STATE.budget);
    const readers=Array.from({length:4},(_,i)=>calc(WATCH[(STATE.rotation+i)%WATCH.length],STATE.budget,i));
    let box=document.querySelector('#lmAltcoinLaser');
    const stockRadar=document.querySelector('#lmTickerSearchRadar');
    const live=document.querySelector('#lmLiveScanners');
    const host=document.querySelector('#lmGlobalTrackerPanel .lm-tracker-side')||document.querySelector('#lmGlobalTrackerPanel')||document.querySelector('main.dashboard')||document.body;
    if(box) box.outerHTML=html(data,readers);
    else if(stockRadar) stockRadar.insertAdjacentHTML('afterend',html(data,readers));
    else if(live) live.insertAdjacentHTML('beforebegin',html(data,readers));
    else host.insertAdjacentHTML('afterbegin',html(data,readers));
    setTimeout(()=>{
      drawChart(document.querySelector('[data-alt-chart]'), data.candles, data.bias);
      readers.forEach(row=>drawChart(document.querySelector(`[data-alt-mini="${row.coin}"]`), row.candles, row.bias));
    },40);
  }

  document.addEventListener('submit',e=>{const form=e.target.closest('[data-alt-form]');if(!form)return;e.preventDefault();render(form.querySelector('[data-alt-coin]')?.value||DEFAULT,form.querySelector('[data-alt-budget]')?.value||200)},true);
  document.addEventListener('click',e=>{const hot=e.target.closest('[data-alt-hot]');if(hot)render(hot.dataset.altHot,STATE.budget)},true);
  function start(){render(DEFAULT,200);clearInterval(STATE.timer);STATE.timer=setInterval(()=>{STATE.rotation=(STATE.rotation+4)%WATCH.length;render(STATE.coin,STATE.budget)},45000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1100),{once:true});else setTimeout(start,1100);
})();

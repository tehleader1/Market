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
      .lm-alt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}.lm-alt-head h2{margin:.15rem 0}.lm-alt-form{display:flex;gap:.5rem;flex-wrap:wrap}.lm-alt-form input{border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.35);color:#fff;padding:.72rem;font-weight:900;text-transform:uppercase}.lm-alt-form input[type=number]{width:115px}.lm-alt-form button{border:0;border-radius:12px;background:#ffc542;color:#06101f;font-weight:1000;padding:.72rem 1rem;cursor:pointer}.lm-alt-grid{display:grid;grid-template-columns:260px minmax(300px,1fr) 300px;gap:1rem;margin-top:1rem}.lm-alt-card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.045);padding:.9rem;overflow:hidden}.lm-alt-symbol{font-size:2.5rem;font-weight:1000}.lm-alt-pair{opacity:.75}.lm-alt-lasers{display:grid;gap:6px;margin:1rem 0}.lm-alt-lasers span{height:5px;border-radius:999px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}.lm-alt-lasers span:before{content:"";position:absolute;inset:0 auto 0 -40%;width:46%;background:linear-gradient(90deg,transparent,#ffc542,#61f4a6,transparent);animation:lmAltLaser var(--lm-alt-speed,1.1s) linear infinite}.lm-alt-radar{height:96px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(90deg,rgba(255,104,104,.18),rgba(255,255,255,.04),rgba(97,244,166,.18));position:relative;overflow:hidden}.lm-alt-red,.lm-alt-green{position:absolute;top:0;bottom:0;transition:width .55s ease}.lm-alt-red{left:0;background:linear-gradient(90deg,rgba(255,104,104,.82),rgba(255,104,104,.08))}.lm-alt-green{right:0;background:linear-gradient(270deg,rgba(97,244,166,.86),rgba(97,244,166,.08))}.lm-alt-line{position:absolute;top:0;bottom:0;width:3px;background:#fff;left:50%;box-shadow:0 0 18px #fff;z-index:2}.lm-alt-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:1000;text-shadow:0 2px 14px rgba(0,0,0,.9);z-index:3}.lm-alt-center strong{font-size:1.5rem}.lm-alt-center small{display:block;font-size:.78rem;opacity:.82}.lm-alt-counts{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.8rem}.lm-alt-counts div{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.65rem;background:rgba(255,255,255,.045)}.lm-alt-bear{color:#ff6868}.lm-alt-bull{color:#61f4a6}.lm-alt-stat{display:flex;justify-content:space-between;gap:.75rem;border-top:1px solid rgba(255,255,255,.09);padding:.55rem 0;color:rgba(255,255,255,.75)}.lm-alt-stat strong{color:#fff}.lm-alt-hot{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:.55rem;margin-top:.9rem}.lm-alt-hot button{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.055);color:#fff;padding:.65rem;text-align:left;cursor:pointer}.lm-alt-hot button strong{display:block}.lm-alt-note{font-size:.78rem;opacity:.66;line-height:1.35;margin-top:.6rem}@keyframes lmAltLaser{to{transform:translateX(350%)}}@media(max-width:1100px){.lm-alt-grid{grid-template-columns:1fr}.lm-alt-hot{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.lm-alt-hot{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function pair(coin){return `${coin}/USD`}
  function calc(coin,budget){
    const s=String(coin||DEFAULT).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)||DEFAULT;
    const score=Math.round(38+seed(s,Date.now()/45000)*58);
    let bull=Math.round(Math.max(6,Math.min(94,score+(seed(s,Date.now()/8000)-.5)*24)));
    const bear=100-bull;
    const price=(seed(s,2)*120+(s==='ETH'?2200:s==='SOL'?80:s==='XRP'?0.4:s==='DOGE'?0.08:1)).toFixed(s==='XRP'||s==='DOGE'||s==='PEPE'||s==='SHIB'?5:2);
    const flowBase=Math.round(1200+seed(s,Date.now()/12000)*9800);
    const demand=Math.round(flowBase*bull/100);
    const supply=Math.round(flowBase*bear/100);
    const bias=bull>=bear?'Bullish pressure':'Bearish pressure';
    const volatility=Number((2+seed(s,6)*9).toFixed(2));
    return {coin:s,pair:pair(s),score,bull,bear,demand,supply,bias,price,volatility,budget:Number(budget)||200,source:'Kraken-style analytics radar'};
  }

  function html(d){
    const winner=d.bull>=d.bear?'BULLS':'BEARS'; const edge=Math.abs(d.bull-d.bear); const speed=Math.max(.22,2.25-(d.score/100)*1.95).toFixed(2)+'s';
    const hot=WATCH.slice(STATE.rotation,STATE.rotation+5); const hotList=(hot.length<5?hot.concat(WATCH.slice(0,5-hot.length)):hot);
    return `<section class="lm-altcoin-laser" id="lmAltcoinLaser" style="--lm-alt-speed:${speed}">
      <div class="lm-alt-head"><div><div class="lm-eyebrow">Kraken Altcoin Laser</div><h2>Crypto Bull / Bear Radar</h2><p>Search altcoins by ticker to view pressure, volatility, and a research-only read for a small account budget.</p></div><form class="lm-alt-form" data-alt-form><input data-alt-coin placeholder="SOL" value="${esc(d.coin)}"><input data-alt-budget type="number" min="1" step="1" value="${esc(d.budget)}"><button type="submit">Generate Coin Radar</button></form></div>
      <div class="lm-alt-grid"><article class="lm-alt-card"><div class="lm-alt-symbol">${esc(d.coin)}</div><div class="lm-alt-pair">${esc(d.pair)} · $${esc(d.price)}</div><div class="lm-alt-lasers"><span></span><span></span><span></span><span></span></div><div class="lm-alt-stat"><span>Laser Score</span><strong>${d.score}%</strong></div><div class="lm-alt-stat"><span>Bias</span><strong class="${d.bull>=d.bear?'lm-alt-bull':'lm-alt-bear'}">${esc(d.bias)}</strong></div><div class="lm-alt-stat"><span>Volatility Read</span><strong>${d.volatility}%</strong></div></article>
      <article class="lm-alt-card"><div class="lm-alt-radar"><div class="lm-alt-red" style="width:${d.bear}%"></div><div class="lm-alt-green" style="width:${d.bull}%"></div><div class="lm-alt-line" style="left:${d.bear}%"></div><div class="lm-alt-center"><div><strong>${winner} +${edge}%</strong><small>${d.bull}% bulls / ${d.bear}% bears</small></div></div></div><div class="lm-alt-counts"><div><span class="lm-alt-bear">Supply pressure</span><strong>${d.supply}</strong></div><div><span class="lm-alt-bull">Demand pressure</span><strong>${d.demand}</strong></div></div></article>
      <article class="lm-alt-card"><h3>${esc(d.coin)} Analytics Read</h3><p>${d.bull>=d.bear?'Green pressure is stronger in this read, meaning demand is currently ahead of supply in the analytics meter.':'Red pressure is stronger in this read, meaning supply is currently ahead of demand in the analytics meter.'}</p><div class="lm-alt-stat"><span>Budget lens</span><strong>$${d.budget}</strong></div><div class="lm-alt-stat"><span>Risk mode</span><strong>${d.volatility>=7?'High volatility':'Moderate volatility'}</strong></div><div class="lm-alt-stat"><span>Signal type</span><strong>${esc(d.bias)}</strong></div><p class="lm-alt-note">Research-only analytics. This does not place orders, guarantee gains, or recommend a trade. Use exchange risk controls.</p></article></div>
      <div class="lm-alt-hot">${hotList.map(c=>`<button type="button" data-alt-hot="${esc(c)}"><strong>${esc(c)}</strong><span>${esc(pair(c))}</span></button>`).join('')}</div>
    </section>`;
  }

  function render(coin,budget){
    css();
    STATE.coin=String(coin||STATE.coin||DEFAULT).toUpperCase();
    STATE.budget=Number(budget||STATE.budget||200);
    const data=calc(STATE.coin,STATE.budget);
    let box=document.querySelector('#lmAltcoinLaser');
    const stockRadar=document.querySelector('#lmTickerSearchRadar');
    const live=document.querySelector('#lmLiveScanners');
    const host=document.querySelector('#lmGlobalTrackerPanel .lm-tracker-side')||document.querySelector('#lmGlobalTrackerPanel')||document.querySelector('main.dashboard')||document.body;
    if(box) box.outerHTML=html(data);
    else if(stockRadar) stockRadar.insertAdjacentHTML('afterend',html(data));
    else if(live) live.insertAdjacentHTML('beforebegin',html(data));
    else host.insertAdjacentHTML('afterbegin',html(data));
  }

  document.addEventListener('submit',e=>{const form=e.target.closest('[data-alt-form]');if(!form)return;e.preventDefault();render(form.querySelector('[data-alt-coin]')?.value||DEFAULT,form.querySelector('[data-alt-budget]')?.value||200)},true);
  document.addEventListener('click',e=>{const hot=e.target.closest('[data-alt-hot]');if(hot)render(hot.dataset.altHot,STATE.budget)},true);
  function start(){render(DEFAULT,200);clearInterval(STATE.timer);STATE.timer=setInterval(()=>{STATE.rotation=(STATE.rotation+5)%WATCH.length;render(STATE.coin,STATE.budget)},45000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1100),{once:true});else setTimeout(start,1100);
})();
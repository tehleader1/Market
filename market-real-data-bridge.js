(function(){
  const WATCH = ['RBLX','SNAP','FUBO','PINS','PLTR','SOFI','HOOD','AMD','SHOP','DKNG','UBER','AAPL','TSLA','NVDA'];
  const STATE = { index:0, timer:null };
  function score(payload,symbol){
    const m=payload?.metrics||{}; const c=payload?.contract||{};
    const pressure=Number(m.pressure||m.pressureScore||m.moveReadiness||0);
    const vol=Number(c.volume||m.volumePercent||0);
    let fallback=40; for(const ch of symbol) fallback += ch.charCodeAt(0)%7;
    return Math.max(1,Math.min(99,Math.round((pressure||fallback)+Math.min(12,vol/2500))));
  }
  function candles(payload){
    const raw=payload?.candles||payload?.bars||[];
    return raw.map(c=>({open:Number(c.open??c.o),close:Number(c.close??c.c),high:Number(c.high??c.h),low:Number(c.low??c.l)})).filter(c=>Number.isFinite(c.open)&&Number.isFinite(c.close)&&Number.isFinite(c.high)&&Number.isFinite(c.low)).slice(-30);
  }
  async function get(symbol){
    const r=await fetch(`/api/options-dashboard?ticker=${encodeURIComponent(symbol)}&ts=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error('dashboard '+r.status);
    const p=await r.json(); const m=p.metrics||{}; const last=(p.candles||[]).slice(-1)[0]||{}; const s=score(p,symbol);
    return {symbol,score:s,price:Number(last.close||m.underlyingPrice||0)||'',bias:String(m.direction||'').toLowerCase().includes('bear')?'bearish pressure':'bullish pressure',candles:candles(p),source:'real dashboard'};
  }
  async function refreshReal(){
    if(!window.LasersMarketLiveRows)return;
    const symbols=[]; for(let i=0;i<5;i++)symbols.push(WATCH[(STATE.index+i)%WATCH.length]); STATE.index=(STATE.index+5)%WATCH.length;
    const real=await Promise.allSettled(symbols.map(get));
    const rows=real.map((x,i)=>x.status==='fulfilled'?x.value:null).filter(Boolean);
    if(!rows.length)return;
    window.LasersMarketRealRows=rows;
    const cards=[...document.querySelectorAll('[data-scan-card]')];
    rows.forEach((row,i)=>{
      const card=cards[i]; if(!card)return;
      card.dataset.scanCard=row.symbol; card.classList.toggle('locked',row.score>=95); card.style.setProperty('--laser-speed',Math.max(.22,2.4-(row.score/100)*2.05).toFixed(2)+'s');
      const sym=card.querySelector('.lm-scan-symbol'); if(sym)sym.textContent=row.symbol;
      const score=card.querySelector('.lm-scan-score'); if(score)score.textContent=row.score+'%';
      const meta=card.querySelector('.lm-scan-meta'); if(meta)meta.innerHTML=`${row.price||'live'} · 45s real data<br>${new Date().toLocaleTimeString()}`;
      const bias=card.querySelector('.lm-scan-bias'); if(bias){bias.textContent=row.bias; bias.className='lm-scan-bias '+(row.bias.includes('bull')?'bullish':'bearish')}
      const canvas=card.querySelector('canvas'); if(canvas&&row.candles.length&&window.LasersMarketDrawScannerChart)window.LasersMarketDrawScannerChart(canvas,row.candles,row.score);
    });
  }
  function start(){clearInterval(STATE.timer);setTimeout(refreshReal,1200);STATE.timer=setInterval(refreshReal,45000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
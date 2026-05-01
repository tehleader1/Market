(function(){
  const STATE = { timer:null };

  function seed(symbol, salt){
    let n = 0;
    for (const ch of String(symbol || 'LM')) n += ch.charCodeAt(0);
    return ((Math.sin(n + salt) * 10000) % 1 + 1) % 1;
  }

  function css(){
    if(document.querySelector('#lmBullBearMeterCss')) return;
    const s = document.createElement('style');
    s.id = 'lmBullBearMeterCss';
    s.textContent = `
      .lm-bb-meter{margin:.75rem 0 .55rem;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(0,0,0,.25);padding:.6rem;position:relative;overflow:hidden}
      .lm-bb-top{display:flex;justify-content:space-between;align-items:center;gap:.4rem;font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      .lm-bb-bull{color:#61f4a6}.lm-bb-bear{color:#ff6868}
      .lm-bb-radar{position:relative;height:54px;margin:.35rem 0;border-radius:999px;background:linear-gradient(90deg,rgba(255,104,104,.18),rgba(255,255,255,.05),rgba(97,244,166,.18));border:1px solid rgba(255,255,255,.1);overflow:hidden}
      .lm-bb-red,.lm-bb-green{position:absolute;top:0;bottom:0;transition:width .55s ease,opacity .55s ease}.lm-bb-red{left:0;background:linear-gradient(90deg,rgba(255,104,104,.78),rgba(255,104,104,.12));}.lm-bb-green{right:0;background:linear-gradient(270deg,rgba(97,244,166,.82),rgba(97,244,166,.12));}
      .lm-bb-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:1000;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.9);z-index:2;line-height:1.05}.lm-bb-center small{display:block;font-size:.68rem;opacity:.78;font-weight:800}.lm-bb-line{position:absolute;top:0;bottom:0;width:2px;background:#fff;left:50%;opacity:.75;box-shadow:0 0 14px #fff;z-index:2;transition:left .55s ease}.lm-bb-counts{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.78rem}.lm-bb-counts div{border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.4rem;background:rgba(255,255,255,.045)}.lm-bb-counts strong{display:block;font-size:1rem}.lm-bb-meter.bulls-winning{box-shadow:0 0 22px rgba(97,244,166,.12)}.lm-bb-meter.bears-winning{box-shadow:0 0 22px rgba(255,104,104,.12)}
    `;
    document.head.appendChild(s);
  }

  function existingRows(){
    const bySymbol = {};
    [...(window.LasersMarketLiveRows || []), ...(window.LasersMarketRealRows || [])].forEach(row=>{
      if(row && row.symbol) bySymbol[row.symbol] = row;
    });
    return bySymbol;
  }

  function calc(card, row){
    const symbol = card.dataset.scanCard || row?.symbol || 'LM';
    const scoreText = card.querySelector('.lm-scan-score')?.textContent || '';
    const score = Number(scoreText.replace(/[^0-9.]/g,'')) || Number(row?.score) || Math.round(40 + seed(symbol, Date.now()/9000) * 45);
    const biasText = String(row?.bias || card.querySelector('.lm-scan-bias')?.textContent || '').toLowerCase();
    const bullBias = biasText.includes('bull') ? 12 : 0;
    const bearBias = biasText.includes('bear') ? 12 : 0;
    const noise = Math.round((seed(symbol, Math.floor(Date.now()/6000)) - .5) * 18);
    let bull = Math.round(Math.max(4, Math.min(96, score + bullBias - bearBias + noise)));
    let bear = 100 - bull;
    if (bear < 4) { bear = 4; bull = 96; }
    if (bull < 4) { bull = 4; bear = 96; }
    const volumeBase = Math.round(80 + seed(symbol, Date.now()/12000) * 920);
    const buys = Math.max(1, Math.round(volumeBase * bull / 100));
    const sells = Math.max(1, Math.round(volumeBase * bear / 100));
    const winner = bull >= bear ? 'Bulls' : 'Bears';
    const edge = Math.abs(bull - bear);
    return { symbol, bull, bear, buys, sells, winner, edge };
  }

  function meterHtml(m){
    const line = m.bear;
    return `<div class="lm-bb-meter ${m.bull>=m.bear?'bulls-winning':'bears-winning'}" data-bb-meter>
      <div class="lm-bb-top"><span class="lm-bb-bear">Bears ${m.bear}%</span><span>Buy / Sell Radar</span><span class="lm-bb-bull">Bulls ${m.bull}%</span></div>
      <div class="lm-bb-radar">
        <div class="lm-bb-red" style="width:${m.bear}%"></div>
        <div class="lm-bb-green" style="width:${m.bull}%"></div>
        <div class="lm-bb-line" style="left:${line}%"></div>
        <div class="lm-bb-center"><div>${m.winner} +${m.edge}%<small>${m.symbol} pressure</small></div></div>
      </div>
      <div class="lm-bb-counts"><div><span class="lm-bb-bear">Sells</span><strong>${m.sells}</strong></div><div><span class="lm-bb-bull">Buys</span><strong>${m.buys}</strong></div></div>
    </div>`;
  }

  function apply(){
    css();
    const rows = existingRows();
    document.querySelectorAll('.lm-scan-card').forEach(card=>{
      const symbol = card.dataset.scanCard || card.querySelector('.lm-scan-symbol')?.textContent || '';
      const m = calc(card, rows[symbol]);
      const old = card.querySelector('[data-bb-meter]');
      if(old) old.outerHTML = meterHtml(m);
      else {
        const chart = card.querySelector('.lm-mini-chart');
        if(chart) chart.insertAdjacentHTML('afterend', meterHtml(m));
        else card.insertAdjacentHTML('beforeend', meterHtml(m));
      }
    });
  }

  function start(){
    apply();
    clearInterval(STATE.timer);
    STATE.timer = setInterval(apply, 5000);
    new MutationObserver(()=>setTimeout(apply,80)).observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(start,800),{once:true});
  else setTimeout(start,800);
})();
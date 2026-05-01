(function(){
  const LOGIN_KEY = 'lasersMarketLoginV1';
  const OWNER_EMAILS = ['zzzanthony123@gmail.com'];
  const OWNER_PHONES = ['9802306202','7044533983'];
  const CHECKOUT_URL = 'https://shop.supportrd.com/products/supportrd-market-signals';
  const rows = [
    {slot:'#1',symbol:'RBLX',market:'SPY watch universe',date:'2026-04-29 overnight to 2026-04-30',price:'54.45',premium:'private app',cp:'n/a / n/a',bias:'bearish building',route:'10m scanner',score:87},
    {slot:'#2',symbol:'SNAP',market:'SPY watch universe',date:'2026-04-29 overnight to 2026-04-30',price:'5.63',premium:'private app',cp:'n/a / n/a',bias:'bearish building',route:'10m scanner',score:62},
    {slot:'#3',symbol:'FUBO',market:'SPY watch universe',date:'2026-04-29 overnight to 2026-04-30',price:'12.34',premium:'private app',cp:'n/a / n/a',bias:'bearish scanning',route:'10m scanner',score:35},
    {slot:'#4',symbol:'PINS',market:'SPY watch universe',date:'2026-04-29 overnight to 2026-04-30',price:'19.73',premium:'private app',cp:'n/a / n/a',bias:'bearish unhooked',route:'10m scanner',score:28}
  ];
  const history = [
    ['Ticker A','7/10 trend holds','Range compression','Volume route repeats','Low','84'],
    ['Ticker B','6/10 pressure watch','Bias stays narrow','Scanner needs more prints','Medium','71'],
    ['Ticker C','4/10 unstable','Chop zone','Wait for confirmation','High','52']
  ];
  const phone = v => String(v||'').replace(/[^0-9]/g,'');
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function read(){try{return JSON.parse(localStorage.getItem(LOGIN_KEY)||'{}')}catch{return {}}}
  function write(next){localStorage.setItem(LOGIN_KEY,JSON.stringify(next));return next}
  function owner(email,ph){return OWNER_EMAILS.includes(String(email||'').toLowerCase())||OWNER_PHONES.includes(phone(ph))}
  function isRegistered(){const l=read();return !!l.verified && !!(l.email || l.phone)}
  function hasPaidAccess(){const l=read();return owner(l.email,l.phone) || l.paid === true || localStorage.getItem('lasersMarketPaidAccess') === 'true'}
  function accessLabel(){if(!isRegistered())return 'Register to continue';return hasPaidAccess()?'Private app unlocked':'Registered - checkout required'}
  function saveLogin(email,ph,provider){
    const cleanPhone=phone(ph);
    const ok=owner(email,cleanPhone);
    return write({
      email:String(email||'').trim(),
      phone:cleanPhone,
      provider:provider||'email',
      verified:true,
      paid:ok,
      tier:ok?'Verified Owner Access':'Verified Member - Checkout Required',
      username:ok?'DYGENRJE':(String(email||'').split('@')[0]||'Member'),
      at:new Date().toISOString()
    });
  }
  function markPaid(){const l=read();write({...l,verified:true,paid:true,tier:'Private Signals App Access',paidAt:new Date().toISOString()});localStorage.setItem('lasersMarketPaidAccess','true')}
  function css(){if(document.querySelector('#lmGlobalTrackerCss'))return;const s=document.createElement('style');s.id='lmGlobalTrackerCss';s.textContent=`
    .lm-login-box{position:fixed;right:1rem;bottom:1rem;z-index:9999;width:310px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(7,13,27,.92);backdrop-filter:blur(16px);box-shadow:0 18px 60px rgba(0,0,0,.4);padding:1rem;color:#fff}.lm-login-box h3{margin:.1rem 0 .4rem}.lm-login-box input{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(0,0,0,.28);color:#fff;padding:.65rem;margin:.25rem 0}.lm-login-box button,.lm-login-box a{border:0;border-radius:10px;background:#6ee7ff;color:#07101f;font-weight:900;padding:.6rem .75rem;margin:.18rem;cursor:pointer;text-decoration:none;display:inline-block}.lm-login-box .ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.16)}.lm-note{color:rgba(255,255,255,.68);font-size:.82rem;line-height:1.35}.lm-global-panel{margin:1rem auto;max-width:1380px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#0a0f1c;color:#f7fbff;padding:1rem;box-shadow:0 24px 70px rgba(0,0,0,.25)}.lm-global-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.lm-eyebrow{color:#61f3ff;text-transform:uppercase;letter-spacing:.16em;font-weight:900}.lm-lock{font-weight:900;font-size:1.15rem}.lm-global-panel p{color:rgba(247,251,255,.72);line-height:1.45}.lm-table{width:100%;border-collapse:separate;border-spacing:0 .5rem}.lm-table th{background:#183744;color:#fff;text-align:left;padding:.75rem;font-size:.9rem;text-transform:uppercase;letter-spacing:.05em}.lm-table td{background:rgba(255,255,255,.055);padding:1rem;border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1)}.lm-table tr td:first-child{border-left:1px solid rgba(255,255,255,.1);border-radius:12px 0 0 12px}.lm-table tr td:last-child{border-right:1px solid rgba(255,255,255,.1);border-radius:0 12px 12px 0;font-weight:900}.lm-history{max-width:960px}.lm-locked-blur{filter:blur(2px);opacity:.45;pointer-events:none}.lm-actions button,.lm-actions a{border:0;border-radius:10px;padding:.65rem .9rem;background:#6ee7ff;color:#06101f;font-weight:900;cursor:pointer;text-decoration:none;display:inline-block}.lm-actions .ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.16)}.lm-pay-card{border:1px solid rgba(255,236,110,.24);background:rgba(255,236,110,.08);border-radius:14px;padding:.85rem;margin:.75rem 0}.lm-verified-banner{border:1px solid rgba(169,207,67,.3);background:rgba(169,207,67,.1);border-radius:14px;padding:.85rem;margin:.75rem 0}@media(max-width:800px){.lm-login-box{position:static;width:auto;margin:1rem}.lm-global-head{display:block}.lm-table{font-size:.82rem}}
  `;document.head.appendChild(s)}
  function loginHtml(){
    const l=read();
    if(isRegistered()){
      return `<h3>Verified Login</h3><p class="lm-note"><strong>${esc(l.email||'Email not saved')}</strong><br>${esc(l.phone||'Phone not saved')}<br>${esc(l.tier||'Verified Member')}</p>${hasPaidAccess()?'<div class="lm-verified-banner">Private app access is active.</div>':`<div class="lm-pay-card"><strong>Checkout required</strong><p class="lm-note">Register is complete. Pay for the LasersMarket signals private app to unlock the full tracker.</p><a href="${CHECKOUT_URL}" target="_blank" rel="noopener">Go to Checkout</a><button class="ghost" data-lm-mark-paid>Mark Paid After Checkout</button></div>`}<button class="ghost" data-lm-edit>Switch Account</button>`;
    }
    return `<h3>LasersMarket Login</h3><p class="lm-note">Register normally first. After registration, checkout unlocks the private signals app.</p><input data-lm-email placeholder="Email"><input data-lm-phone placeholder="Phone number"><div><button data-lm-provider="gmail">Gmail</button><button data-lm-provider="microsoft">Microsoft</button><button data-lm-provider="apple">Apple</button></div><button data-lm-save>Register / Login</button><p class="lm-note">New users register as Verified Members. Owner email/phones unlock automatically.</p>`
  }
  function renderLogin(){
    let box=document.querySelector('#lmLoginBox');
    if(hasPaidAccess()){ if(box) box.remove(); return; }
    if(!box){box=document.createElement('aside');box.id='lmLoginBox';box.className='lm-login-box';document.body.appendChild(box)}
    box.innerHTML=loginHtml();
  }
  function tableHtml(data){return `<table class="lm-table"><thead><tr>${['Slot','Symbol','Market','Date','Price','Premium','Calls/Puts','Bias','Route','Score'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr><td>${r.slot}</td><td><strong>${r.symbol}</strong></td><td>${r.market}</td><td>${r.date}</td><td>${r.price}</td><td>${r.premium}</td><td>${r.cp}</td><td>${r.bias}</td><td>${r.route}</td><td>${r.score}</td></tr>`).join('')}</tbody></table>`}
  function historyHtml(){return `<table class="lm-table lm-history"><thead><tr>${['Symbol','10 Day','1 Month','6 Month','Away','Rating'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${history.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
  function renderPanel(){
    const old=document.querySelector('#lmGlobalTrackerPanel'); if(old)old.remove();
    const unlocked=hasPaidAccess();
    const mount=document.createElement('section');mount.id='lmGlobalTrackerPanel';mount.className='lm-global-panel';
    mount.innerHTML=`<div class="lm-global-head"><div><div class="lm-eyebrow">LasersMarket Private Signals App</div><p>Market rows are analytics and research only. They do not execute trades, guarantee performance, or recommend a buy/sell decision. Paid access unlocks the full private app view.</p></div><div class="lm-lock">${accessLabel()}</div></div>${!isRegistered()?'<div class="lm-pay-card"><strong>Register first</strong><p>Enter email and phone in the login panel to create a verified member account.</p></div>':(!unlocked?`<div class="lm-pay-card"><strong>Payment required</strong><p>Registration is complete. Checkout unlocks the whole LasersMarket private app.</p><a href="${CHECKOUT_URL}" target="_blank" rel="noopener">Checkout for Private App</a><button data-lm-mark-paid>Mark Paid After Checkout</button></div>`:'<div class="lm-verified-banner">Private app unlocked for this verified account.</div>')}<h2>Live tracked feed - 4 to 5 at a time</h2><div class="${unlocked?'':'lm-locked-blur'}">${tableHtml(rows)}<h2>Historical values - separate 10 day competition</h2>${historyHtml()}</div><div class="lm-actions"><button data-lm-refresh>Refresh Reading</button>${unlocked?'<button class="ghost" data-lm-edit>Switch Account</button>':`<a href="${CHECKOUT_URL}" target="_blank" rel="noopener">Go to Checkout</a>`}</div>`;
    const main=document.querySelector('main.dashboard')||document.body;main.prepend(mount)
  }
  function rerender(){renderLogin();renderPanel()}
  document.addEventListener('click',e=>{const provider=e.target.closest('[data-lm-provider]');if(provider){const box=document.querySelector('#lmLoginBox');if(box)box.dataset.provider=provider.dataset.lmProvider;alert(provider.dataset.lmProvider+' selected. Connect OAuth credentials server-side for live provider login.')}if(e.target.closest('[data-lm-save]')){const box=document.querySelector('#lmLoginBox');const email=box.querySelector('[data-lm-email]')?.value||'';const ph=box.querySelector('[data-lm-phone]')?.value||'';saveLogin(email,ph,box.dataset.provider||'email');rerender()}if(e.target.closest('[data-lm-mark-paid]')){markPaid();rerender()}if(e.target.closest('[data-lm-edit]')){localStorage.removeItem(LOGIN_KEY);localStorage.removeItem('lasersMarketPaidAccess');rerender()}if(e.target.closest('[data-lm-refresh]'))renderPanel();});
  function init(){css();rerender()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
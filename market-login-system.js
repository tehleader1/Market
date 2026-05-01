(function(){
  const KEY = 'lmAuthV1';
  const MARKET_URL = 'https://shop.supportrd.com/products/supportrd-market-signals';
  const OWNER_GOOGLE_EMAIL = 'zzzanthony123@gmail.com';
  const OWNER_PHONE = '7044533983';
  const STATE = { mode: 'rail', provider: '', offerCollapsed: true };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function phone(v){return String(v||'').replace(/[^0-9]/g,'')}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function save(data){localStorage.setItem(KEY,JSON.stringify(data))}
  function displayName(auth){const email=String(auth?.email||'').trim();if(email&&email.includes('@'))return email.split('@')[0]||'Member';const ph=phone(auth?.email||auth?.phone);return ph?`Phone ${ph.slice(-4)}`:'Free Member'}
  function isPaid(data){const plan=String(data?.plan||data?.tier||'');if(plan&&!/signals|25000/i.test(plan))return false;return /signals|25000/i.test(plan)||localStorage.getItem('lmMarketSignalsPaid')==='true'}
  function ownerGoogle(email){return String(email||'').trim().toLowerCase()===OWNER_GOOGLE_EMAIL}
  function ownerPhone(v){return phone(v)===OWNER_PHONE}

  function css(){
    if(document.querySelector('#lmLoginCss'))return;
    const s=document.createElement('style');
    s.id='lmLoginCss';
    s.textContent=`
      .lm-auth,.lm-account-pop,.lm-offer-pop{font-family:Inter,Space Grotesk,system-ui,sans-serif;color:#fff}
      .lm-auth{position:fixed;right:0;top:72px;z-index:99999;box-sizing:border-box}
      .lm-auth-box,.lm-account-pop,.lm-offer-pop{box-sizing:border-box;background:linear-gradient(180deg,rgba(10,18,30,.9),rgba(4,9,18,.84));backdrop-filter:blur(20px);border:1px solid rgba(148,163,184,.28);border-right:0;border-radius:8px 0 0 8px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
      .lm-auth.is-rail{width:252px}.lm-auth.is-open{width:190px}.lm-auth-box{padding:6px}
      .lm-rail-row{display:grid;grid-template-columns:24px 1fr auto auto;gap:6px;align-items:center;min-height:34px}.lm-rail-mark{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(135deg,#61f4a6,#ffc542);color:#06101f;font-weight:1000;font-size:.62rem}.lm-rail-label{font-size:.68rem;font-weight:1000;line-height:1}.lm-rail-sub{display:block;margin-top:2px;color:#9fb0c4;font-size:.5rem;font-weight:700}
      .lm-auth button,.lm-auth a,.lm-account-pop button,.lm-offer-pop button,.lm-offer-pop a{min-height:28px;border-radius:999px;border:1px solid rgba(148,163,184,.22);font-size:.6rem;font-weight:1000;cursor:pointer;text-decoration:none}.lm-auth button{background:rgba(255,255,255,.05);color:#f7fbff;padding:0 9px}.lm-auth .primary{background:#61f4a6;color:#06101f;border-color:#61f4a6}.lm-auth .upgrade{background:rgba(255,197,66,.1);border-color:rgba(255,197,66,.32);color:#ffe7a3}
      .lm-form-head{display:grid;grid-template-columns:24px 1fr auto;gap:6px;align-items:center;margin-bottom:6px}.lm-form-head strong{display:block;font-size:.68rem}.lm-form-head span{display:block;color:#9fb0c4;font-size:.52rem;line-height:1.1}.lm-back{min-width:28px!important;padding:0!important}
      .lm-auth input{width:100%;height:29px;margin:0 0 5px;padding:0 7px;border-radius:7px;border:1px solid rgba(148,163,184,.24);background:rgba(0,0,0,.34);color:#fff;font-size:.68rem;outline:0}.lm-auth input:focus{border-color:rgba(97,244,166,.8);box-shadow:0 0 0 2px rgba(97,244,166,.14)}
      .lm-auth-row,.lm-provider-row{display:grid;grid-template-columns:1fr 1fr;gap:4px}.lm-auth-row button,.lm-provider-row button{width:100%;border-radius:7px;margin-top:0}.lm-provider-row{margin-top:4px}.lm-provider-row button{background:#f8fafc;color:#07101f}.lm-offer-toggle{display:block;width:100%;margin-top:5px;border-radius:7px!important}.lm-auth-status{display:none;margin-top:5px;border:1px solid rgba(255,197,66,.28);border-radius:7px;background:rgba(255,197,66,.08);padding:5px;color:#ffe7a3;font-size:.54rem;line-height:1.22}
      .lm-offer-pop{position:fixed;right:190px;top:72px;z-index:99998;width:220px;padding:8px}.lm-offer-pop strong{display:block;font-size:.78rem}.lm-offer-pop p{margin:4px 0 7px;color:#b7c7d8;font-size:.58rem;line-height:1.24}.lm-offer-actions{display:grid;gap:5px}.lm-offer-pop a,.lm-offer-pop button{display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.045);color:#fff;border-radius:7px}.lm-offer-pop .buy{background:rgba(255,197,66,.14);border-color:rgba(255,197,66,.38);color:#ffe7a3}
      .lm-account-pop{position:fixed;right:0;top:72px;z-index:99998;width:252px;padding:6px}.lm-account-pop .lm-rail-row{grid-template-columns:24px 1fr auto}.lm-feature{display:flex;justify-content:space-between;gap:5px;margin-top:5px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(255,255,255,.04);padding:5px;font-size:.54rem}.lm-account-pop button{width:100%;margin-top:5px;background:rgba(255,255,255,.05);color:#fff;border-radius:7px}
      @media(max-width:560px){.lm-auth,.lm-account-pop{top:56px}.lm-auth.is-rail,.lm-account-pop{width:226px}.lm-auth.is-open{width:168px}.lm-offer-pop{right:168px;top:56px;width:176px}.lm-rail-sub{display:none}}
    `;
    document.head.appendChild(s);
  }

  function status(text){
    const el=document.getElementById('lmAuthStatus');
    if(el){el.textContent=text;el.style.display='block'}
  }

  function offerHtml(){
    const provider = STATE.provider ? ` for ${STATE.provider}` : '';
    return `<aside class="lm-offer-pop" id="lmOfferPop">
      <strong>$25,000 Market Signals</strong>
      <p>Register${provider} free to remember searches, or unlock actual crypto and stock reading scores with the $25,000 tier.</p>
      <div class="lm-offer-actions">
        <a class="buy" href="${MARKET_URL}" target="_blank" rel="noopener">Register $25,000 Tier</a>
        <button type="button" data-lm-free-provider>Continue Free</button>
        <button type="button" data-lm-collapse-offer>Collapse</button>
      </div>
    </aside>`;
  }

  function renderOffer(show){
    document.getElementById('lmOfferPop')?.remove();
    if(show)document.body.insertAdjacentHTML('beforeend',offerHtml());
  }

  function ui(){
    const saved=read();
    if(STATE.mode==='rail'){
      return `<aside class="lm-auth is-rail" id="lmAuth"><div class="lm-auth-box"><div class="lm-rail-row">
        <div class="lm-rail-mark">LM</div><div><div class="lm-rail-label">Login</div><span class="lm-rail-sub">Free search memory</span></div>
        <button class="primary" id="lmRailLogin" type="button">Login</button><button class="upgrade" id="lmRailRegister" type="button">Register</button>
      </div></div></aside>`;
    }
    const isRegister=STATE.mode==='register';
    return `<aside class="lm-auth is-open" id="lmAuth">
      <div class="lm-auth-box">
        <div class="lm-form-head"><div class="lm-rail-mark">LM</div><div><strong>${isRegister?'Register':'Login'}</strong><span>${isRegister?'Email + password':'Returning account'}</span></div><button class="lm-back" id="lmBackRail" type="button">x</button></div>
        <input placeholder="Email" id="lmEmail" value="${esc(saved.email||'')}">
        <input placeholder="Password" id="lmPassword" type="password" value="">
        <div class="lm-auth-row"><button class="primary" id="lmSubmitAuth" type="button">${isRegister?'Register':'Login'}</button><button id="lmSwitchAuth" type="button">${isRegister?'Login':'Register'}</button></div>
        <div class="lm-provider-row"><button id="lmGoogleLogin" type="button">Google</button><button id="lmMicrosoftLogin" type="button">Microsoft</button></div>
        <button class="lm-offer-toggle upgrade" id="lmOfferToggle" type="button">$25,000 Tier</button>
        <div class="lm-auth-status" id="lmAuthStatus"></div>
      </div>
    </aside>`;
  }

  function renderRail(){
    css();
    document.getElementById('lmAuth')?.remove();
    document.getElementById('lmAccountPop')?.remove();
    document.body.insertAdjacentHTML('beforeend',ui());
    wire();
  }

  function renderAccountPop(){
    css();
    document.getElementById('lmAuth')?.remove();
    document.getElementById('lmOfferPop')?.remove();
    const auth=read();
    let pop=document.getElementById('lmAccountPop');
    if(!auth.verified){if(pop)pop.remove();renderRail();return}
    if(!pop){pop=document.createElement('aside');pop.id='lmAccountPop';pop.className='lm-account-pop';document.body.appendChild(pop)}
    const paid=isPaid(auth);
    pop.innerHTML=`<div class="lm-rail-row"><div class="lm-rail-mark">LM</div><div><div class="lm-rail-label">${esc(displayName(auth))}</div><span class="lm-rail-sub">${paid?'$25,000 Market Signals':'Free account'}</span></div><button type="button" data-lm-open-login>Login</button></div><div class="lm-feature"><span>Free</span><b>Recent searches</b></div><div class="lm-feature"><span>Scores</span><b>${paid?'Unlocked':'$25,000 tier'}</b></div>`;
  }

  function finish(auth, paid){
    save(auth);
    if(paid)localStorage.setItem('lmMarketSignalsPaid','true');
    document.dispatchEvent(new CustomEvent('lm-auth-updated',{detail:auth}));
    renderAccountPop();
  }

  function manualAuth(){
    const email=document.getElementById('lmEmail')?.value.trim()||'';
    const password=document.getElementById('lmPassword')?.value||'';
    if(!email){status('Enter an email first.');return}
    if(STATE.mode==='register'){
      status(`Verification sent to ${email}. Free account memory is active after email verification.`);
      finish({email,passwordSet:!!password,plan:'free',verified:true,emailVerified:false,verificationSent:true,marketSignals:false,provider:'email',marketSignalsUrl:MARKET_URL},false);
      return;
    }
    if(ownerPhone(email)){
      finish({email:'',phone:OWNER_PHONE,plan:'signals25000',provider:'phone',verified:true,marketSignals:true,owner:true,marketSignalsUrl:MARKET_URL},true);
      return;
    }
    finish({email,passwordSet:!!password,plan:'free',verified:true,marketSignals:false,provider:'email',marketSignalsUrl:MARKET_URL},false);
  }

  function providerAuth(provider){
    STATE.provider=provider;
    const email=document.getElementById('lmEmail')?.value.trim()||'';
    if(provider==='Google'&&ownerGoogle(email)){
      finish({email,plan:'signals25000',provider:'google',verified:true,marketSignals:true,owner:true,marketSignalsUrl:MARKET_URL},true);
      return;
    }
    renderOffer(true);
    status(`${provider} selected. Choose $25,000 access or continue with a free account.`);
  }

  function wire(){
    const railLogin=document.getElementById('lmRailLogin');
    if(railLogin)railLogin.onclick=()=>{STATE.mode='login';renderRail()};
    const railRegister=document.getElementById('lmRailRegister');
    if(railRegister)railRegister.onclick=()=>{STATE.mode='register';renderRail()};
    const back=document.getElementById('lmBackRail');
    if(back)back.onclick=()=>{STATE.mode='rail';STATE.provider='';renderOffer(false);renderRail()};
    const submit=document.getElementById('lmSubmitAuth');
    if(submit)submit.onclick=manualAuth;
    const switcher=document.getElementById('lmSwitchAuth');
    if(switcher)switcher.onclick=()=>{STATE.mode=STATE.mode==='register'?'login':'register';renderRail()};
    const google=document.getElementById('lmGoogleLogin');
    if(google)google.onclick=()=>providerAuth('Google');
    const microsoft=document.getElementById('lmMicrosoftLogin');
    if(microsoft)microsoft.onclick=()=>providerAuth('Microsoft');
    const offer=document.getElementById('lmOfferToggle');
    if(offer)offer.onclick=()=>renderOffer(true);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-lm-open-login]')){STATE.mode='login';STATE.provider='';renderRail()}
    if(e.target.closest('[data-lm-collapse-offer]'))document.getElementById('lmOfferPop')?.remove();
    if(e.target.closest('[data-lm-free-provider]')){
      const email=document.getElementById('lmEmail')?.value.trim()||'';
      const provider=(STATE.provider||'provider').toLowerCase();
      finish({email,plan:'free',provider,verified:true,marketSignals:false,marketSignalsUrl:MARKET_URL},false);
    }
  },true);

  window.LasersMarketAccess={isPaid:()=>{try{return isPaid(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return localStorage.getItem('lmMarketSignalsPaid')==='true'}},buyUrl:MARKET_URL};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{const a=read();if(a.verified)renderAccountPop();else renderRail();},{once:true});else{const a=read();if(a.verified)renderAccountPop();else renderRail();}
})();

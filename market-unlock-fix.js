(function(){
  const LOGIN_KEY='lasersMarketLoginV1';
  const OWNER_EMAIL='zzzanthony123@gmail.com';
  const OWNER_PHONES=['7044533983','9802306202'];
  const phone=v=>String(v||'').replace(/[^0-9]/g,'');
  function read(){try{return JSON.parse(localStorage.getItem(LOGIN_KEY)||'{}')}catch{return {}}}
  function isOwner(l){return String(l.email||'').toLowerCase().trim()===OWNER_EMAIL||OWNER_PHONES.includes(phone(l.phone))}
  function forceUnlock(){
    const l=read();
    if(!isOwner(l)) return false;
    const next={...l,verified:true,paid:true,access:'paid',tier:'Private Signals App Access',username:'DYGENRJE',paidAt:l.paidAt||new Date().toISOString()};
    localStorage.setItem(LOGIN_KEY,JSON.stringify(next));
    localStorage.setItem('lasersMarketPaidAccess','true');
    localStorage.setItem('lmPaidAccess','true');
    localStorage.setItem('marketSignalsPaid','true');
    return true;
  }
  function unlockUi(){
    if(!forceUnlock()) return;
    document.querySelector('#lmLoginBox')?.remove();
    document.querySelectorAll('.lm-locked-blur').forEach(el=>el.classList.remove('lm-locked-blur'));
    document.querySelectorAll('.lm-lock').forEach(el=>el.textContent='Private app unlocked');
    document.querySelectorAll('.lm-pay-card').forEach(el=>{el.className='lm-verified-banner';el.innerHTML='Private app unlocked for verified owner access.'});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-lm-save]')) setTimeout(unlockUi,80);
  },true);
  window.lasersMarketOwnerUnlock=()=>{forceUnlock();unlockUi();return read()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(unlockUi,150),{once:true});
  else setTimeout(unlockUi,150);
})();
(function(){
  const KEY='lmAuthV1';
  function save(data){localStorage.setItem(KEY,JSON.stringify(data))}
  function css(){if(document.querySelector('#lmLoginCss'))return;const s=document.createElement('style');s.id='lmLoginCss';s.textContent=`
  .lm-auth{position:fixed;inset:0;background:#050b16;display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-family:Space Grotesk}
  .lm-auth-box{width:420px;background:#0b1324;border-radius:18px;padding:1.4rem;border:1px solid rgba(255,255,255,.12)}
  .lm-auth h2{margin:.2rem 0}.lm-plan{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.7rem;margin:.4rem 0;cursor:pointer}
  .lm-plan.active{border-color:#61f4a6;background:rgba(97,244,166,.08)}
  .lm-auth input{width:100%;margin:.3rem 0;padding:.6rem;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#000;color:#fff}
  .lm-auth button{width:100%;margin-top:.6rem;padding:.7rem;border-radius:12px;background:#61f4a6;border:0;font-weight:900}
  `;document.head.appendChild(s)}
  function ui(){
    return `<div class="lm-auth" id="lmAuth">
      <div class="lm-auth-box">
        <h2>LasersMarket Access</h2>
        <p>Select your plan</p>
        <div class="lm-plan" data-plan="free">Free<br><small>View limited scanners</small></div>
        <div class="lm-plan" data-plan="premium">Premium / Pro<br><small>Full signals + live scanners</small></div>
        <div class="lm-plan" data-plan="studio">+ Studio Jake<br><small>Advanced AI trading + audio tools</small></div>
        <input placeholder="Email" id="lmEmail">
        <input placeholder="Phone" id="lmPhone">
        <button id="lmSubmit">Continue</button>
      </div>
    </div>`;
  }
  function mount(){css();if(document.querySelector('#lmAuth'))return;document.body.insertAdjacentHTML('beforeend',ui());let plan='free';document.querySelectorAll('[data-plan]').forEach(p=>p.onclick=()=>{document.querySelectorAll('[data-plan]').forEach(x=>x.classList.remove('active'));p.classList.add('active');plan=p.dataset.plan});document.getElementById('lmSubmit').onclick=()=>{const email=document.getElementById('lmEmail').value;const phone=document.getElementById('lmPhone').value;save({email,phone,plan,verified:true});if(plan!=='free'){window.open('https://shop.supportrd.com/products/supportrd-market-signals','_blank')}document.getElementById('lmAuth').remove();};}
  if(!localStorage.getItem(KEY))document.addEventListener('DOMContentLoaded',mount,{once:true});})();
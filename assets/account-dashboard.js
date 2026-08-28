(() => {
  const root=document.getElementById('customerDashboard');
  if(!root)return;
  const buttons=[...root.querySelectorAll('[data-account-tab]')];
  const panels=[...root.querySelectorAll('[data-account-panel]')];
  function openTab(name,{updateHash=true}={}){
    const target=panels.find(p=>p.dataset.accountPanel===name)?name:'overview';
    buttons.forEach(b=>{const active=b.dataset.accountTab===target;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
    panels.forEach(p=>p.classList.toggle('active',p.dataset.accountPanel===target));
    if(updateHash)history.replaceState(null,'','#'+target);
    if(window.innerWidth<951)root.querySelector('[data-account-panel].active')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  buttons.forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.accountTab)));
  root.querySelectorAll('[data-open-account-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.openAccountTab)));
  const requested=location.hash.replace('#','');
  openTab(requested||'overview',{updateHash:false});
  window.addEventListener('hashchange',()=>openTab(location.hash.replace('#','')||'overview',{updateHash:false}));
})();
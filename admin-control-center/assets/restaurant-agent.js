'use strict';
(() => {
 const active=panel=>state.token && isFullAdmin() && root.contains(panel);
 const date=value=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Kabul'}):'Not yet';
 function mount(){
  if(!state.token||!isFullAdmin()||!['restaurants','workers'].includes(state.view)||root.querySelector('#restaurant-agent-panel'))return;
  const panel=document.createElement('section');panel.id='restaurant-agent-panel';panel.className='panel wide space-top-md';
  panel.innerHTML='<div class="panel-head"><div><h2>Restaurant maintenance agent</h2><p>Automatic profile housekeeping and restaurant data checks</p></div><div class="button-stack"><button type="button" class="button button-secondary" data-agent-refresh>Refresh agent</button><button type="button" class="button button-secondary" data-agent-run>Run agent now</button><button type="button" class="button button-secondary" data-agent-toggle disabled>Loading…</button></div></div><div class="panel-body"><p>Runs every 15 minutes while the API is running, checking up to 100 restaurants per batch in rotation. Automatically trims profile text and removes empty or repeated cuisine tags. Missing facts require verified restaurant information. Prices, hours, contact details, ownership, availability, verification and payments are never changed by this agent.</p><p role="status" data-agent-status>Loading agent status…</p><div data-agent-content></div></div>';
  root.prepend(panel);let data=null,busy=false;
  const status=panel.querySelector('[data-agent-status]'),content=panel.querySelector('[data-agent-content]');
  async function load(){
   const token=state.token;
   try {const result=await query('restaurantAgent.snapshot',null);if(!active(panel)||token!==state.token)return;data=result;
    const s=result.settings,t=result.totals;
    status.textContent=`${s.enabled?'Running automatically':'Paused'} · Last successful batch: ${date(s.last_success_at)} Kabul${s.last_status==='failure'?' · Last attempt failed; previous successful information retained.':''}`;
    panel.querySelector('[data-agent-toggle]').textContent=s.enabled?'Pause agent':'Enable agent';panel.querySelector('[data-agent-toggle]').disabled=false;
    const openSections=[...content.querySelectorAll(':scope > details')].map(d=>d.open);
    content.innerHTML=`<p>${number(t.checked)} of ${number(t.total)} profiles checked · ${number(t.flagged)} need verified information · ${number(t.held)} paused individually. Last batch: ${number(s.summary?.checked||0)} checked, ${number(s.summary?.changed||0)} tidied.</p><details><summary>Restaurants needing attention</summary><p>Latest ${number(result.limits.profiles)} records at most. Each result shows when it was checked; changes after that check appear in the next scan.</p>${result.profiles.length?result.profiles.map(p=>`<article class="review-card"><h3>${esc(p.name)}</h3><p>Checked ${esc(date(p.checked_at))} Kabul${p.hold_edits?' · Automatic edits paused after undo':''}</p><ul>${p.issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul><div class="button-stack"><button type="button" class="button button-secondary button-small" data-agent-edit="${attr(p.restaurant_id)}">Review restaurant</button>${p.hold_edits?`<button type="button" class="button button-secondary button-small" data-agent-resume="${attr(p.restaurant_id)}">Resume profile housekeeping</button>`:''}</div></article>`).join(''):'<p>No missing information flagged in the checked profiles.</p>'}</details><details class="space-top-md"><summary>Automatic edit history</summary><p>Latest ${number(result.limits.changes)} changes. Undo restores only the recorded fields and pauses further automatic edits for that restaurant. A newer edit to those fields prevents undo.</p>${result.changes.length?result.changes.map(c=>`<article class="review-card"><h3>${esc(c.restaurant_name)}</h3><p>${esc(date(c.created_at))} Kabul${c.undone_at?' · Undone':''}</p>${Object.keys(c.after_fields).map(field=>`<p><strong>${esc(field.replaceAll('_',' '))}</strong></p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">Before: ${esc(JSON.stringify(c.before_fields[field]))}\nAfter: ${esc(JSON.stringify(c.after_fields[field]))}</pre>`).join('')}${!c.undone_at?`<button type="button" class="button button-secondary button-small" data-agent-undo="${attr(c.id)}">Undo this change</button>`:''}</article>`).join(''):'<p>No automatic changes recorded.</p>'}</details>`;
    content.querySelectorAll(':scope > details').forEach((d,i)=>{d.open=Boolean(openSections[i])});
   }catch(error){if(active(panel)&&token===state.token){status.textContent='Agent status unavailable. Refresh to retry.';data=null;}}
  }
  async function command(path,input){if(busy)return;busy=true;const token=state.token;panel.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Updating restaurant agent…';try{await mutate(path,input);if(active(panel)&&token===state.token)await load();}catch(error){if(active(panel)&&token===state.token)status.textContent=error.message||'The request could not be completed. Refresh before trying again.';}finally{busy=false;if(active(panel)&&token===state.token)panel.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  panel.addEventListener('click',event=>{
   const b=event.target.closest('button');if(!b||busy)return;
   if(b.hasAttribute('data-agent-refresh'))void load();
   else if(b.hasAttribute('data-agent-run'))void command('restaurantAgent.runNow',null);
   else if(b.hasAttribute('data-agent-toggle')&&data)void command('restaurantAgent.setEnabled',{enabled:!data.settings.enabled});
   else if(b.dataset.agentUndo)void command('restaurantAgent.undo',{changeId:b.dataset.agentUndo});
   else if(b.dataset.agentResume)void command('restaurantAgent.resumeProfile',{restaurantId:b.dataset.agentResume});
   else if(b.dataset.agentEdit){if(window.adminFreshness?.isDirty()){toast('Save or discard your current edits before opening another restaurant.','error');return;}state.restaurantEditId=b.dataset.agentEdit;if(state.view==='restaurants')void renderRestaurants();else location.hash='restaurants';}
  });
  void load();
 }
 new MutationObserver(()=>mount()).observe(root,{childList:true});mount();
})();

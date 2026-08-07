async function loadPortalListingAdmin(){
  if(typeof opsQuery!=='function'||typeof AEOPS==='undefined'||!AEOPS.token)return;
  let host=document.getElementById('portalListingAccess');
  const base=document.getElementById('portalAccess');
  if(!host&&base){host=document.createElement('div');host.id='portalListingAccess';host.className='portal-card';host.style.marginTop='16px';base.insertAdjacentElement('afterend',host)}
  if(!host)return;
  try{
    const accounts=await opsQuery('portal.adminAccounts',null,true),owners=(accounts||[]).filter(a=>a.role==='owner'&&a.restaurant_id);
    host.innerHTML=`<h3>Restaurant listing activation</h3><p class="muted">Portal access and public ordering are separate controls. Activate a listing only after the menu, pricing and delivery setup have been checked.</p><div class="portal-list">${owners.length?owners.map(a=>`<div class="access-row"><div><b>${portalEsc(a.restaurant_name||'Restaurant')}</b><div>${portalEsc(a.username)}</div><small>Listing: ${portalEsc(a.restaurant_status||'pending')} · store switch: ${a.restaurant_is_open?'open':'closed'}</small></div><div class="portal-actions"><span class="status-badge status-${portalEsc(a.restaurant_status||'pending')}">${portalEsc(a.restaurant_status||'pending')}</span>${a.restaurant_status==='active'?`<button class="btn btn-light btn-sm" onclick="setRestaurantListing('${portalEsc(a.restaurant_id)}','inactive')">Pause listing</button>`:`<button class="btn btn-primary btn-sm" onclick="setRestaurantListing('${portalEsc(a.restaurant_id)}','active')">Activate listing</button>`}</div></div>`).join(''):'<div class="portal-empty">No restaurant owner accounts yet.</div>'}</div>`;
  }catch(e){host.innerHTML=`<div class="notice error">${portalEsc(e.message)}</div>`}
}
window.setRestaurantListing=async function(id,status){
  if(status==='active'&&!confirm('Activate this restaurant for public online ordering? Confirm that menu prices and delivery setup have been checked.'))return;
  try{await opsMutation('restaurants.adminToggleStatus',{id,status},true);await loadPortalAdmin();await loadPortalListingAdmin()}catch(e){alert(e.message)}
}
const originalPortalAdmin=window.loadPortalAdmin;
if(originalPortalAdmin){window.loadPortalAdmin=async function(){await originalPortalAdmin();await loadPortalListingAdmin()}}
document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('portalAccess'))setTimeout(loadPortalListingAdmin,900)});

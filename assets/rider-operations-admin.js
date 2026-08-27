const AERIDEROPSADMIN={board:null,platform:null,dispatch:null,support:[]};

function roaEsc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}
function roaAfghanDate(value){if(!value)return'—';try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kabul',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))}catch{return String(value)}}
function roaKabulIso(value){if(!value)throw new Error('Choose a date and time');const normalized=value.length===16?`${value}:00`:value;const date=new Date(`${normalized}+04:30`);if(Number.isNaN(date.getTime()))throw new Error('Invalid Afghanistan date/time');return date.toISOString()}

function renderMarketControl(){
  const el=document.getElementById('marketControlState');if(!el)return;
  const c=AERIDEROPSADMIN.platform?.controls||{},open=c.ordering_enabled!==false;
  el.innerHTML=`<div class="portal-card"><div class="ops-panel-head"><div><h3>Marketplace ordering</h3><p class="muted">This is the master switch for accepting new customer orders. Existing orders continue through delivery when the market is closed.</p></div><span class="status-badge ${open?'status-approved':'status-rejected'}">${open?'OPEN':'CLOSED'}</span></div><button class="btn ${open?'btn-danger':'btn-primary'}" onclick="toggleAfghanEatsMarket(${!open})">${open?'Close market':'Open market'}</button></div>`;
}
async function toggleAfghanEatsMarket(open){
  const c=AERIDEROPSADMIN.platform?.controls||{};
  const action=open?'OPEN Afghan Eats ordering':'CLOSE Afghan Eats ordering';
  if(!confirm(`${action} now?`))return;
  const messageEn=open?null:'Ordering is temporarily paused by Afghan Eats operations. Please try again later.';
  const messageDari=open?null:'ثبت سفارش به طور موقت از سوی عملیات افغان ایتس متوقف شده است. لطفاً بعداً دوباره تلاش کنید.';
  await opsMutation('platform.adminUpdateControls',{
    orderingEnabled:open,orderingMessageEn:messageEn,orderingMessageDari:messageDari,
    bannerEnabled:Boolean(c.banner_enabled),bannerLevel:c.banner_level||'info',
    bannerTitleEn:c.banner_title_en||null,bannerTitleDari:c.banner_title_dari||null,
    bannerBodyEn:c.banner_body_en||null,bannerBodyDari:c.banner_body_dari||null,
  },true);
  await loadRiderOperationsAdmin();
}

function renderAutoDispatch(){
  const el=document.getElementById('autoDispatchState');if(!el)return;
  const d=AERIDEROPSADMIN.dispatch||{},enabled=Boolean(d.auto_dispatch_enabled);
  el.innerHTML=`<div class="portal-card"><div class="ops-panel-head"><div><h3>Automatic rider assignment</h3><p class="muted">Only active riders who are inside an approved shift, marked available, and free of another delivery are eligible.</p></div><span class="status-badge ${enabled?'status-approved':'status-inactive'}">${enabled?'ON':'OFF'}</span></div><div class="ops-security">Acceptance window: <b>${Number(d.acceptance_timeout_seconds||180)} seconds</b> · maximum reassignments: <b>${Number(d.max_reassignments||3)}</b></div><button class="btn ${enabled?'btn-light':'btn-primary'}" style="margin-top:10px" onclick="setAutoDispatch(${!enabled})">${enabled?'Turn off auto assignment':'Turn on auto assignment'}</button></div>`;
}
async function setAutoDispatch(enabled){
  if(enabled&&!confirm('Turn ON automatic rider assignment? Eligible free riders may receive new live delivery jobs automatically.'))return;
  await opsMutation('dispatch.adminUpdateSettings',{autoDispatchEnabled:enabled},true);
  await loadRiderOperationsAdmin();
}

function renderShiftRiders(){
  const select=document.getElementById('roaShiftRider');if(!select)return;
  const riders=AERIDEROPSADMIN.board?.riders||[];
  select.innerHTML='<option value="">Open shift — any eligible rider may claim</option>'+riders.map(r=>`<option value="${roaEsc(r.id)}">${roaEsc(r.fullName)} · ${roaEsc(r.vehicle||'rider')} · ${roaEsc(r.serviceArea||'Herat')}</option>`).join('');
}
async function createRiderOpsShift(event){
  event.preventDefault();const f=event.currentTarget,d=new FormData(f),out=document.getElementById('roaShiftResult');
  try{
    const startsAt=roaKabulIso(String(d.get('startsAt')||'')),endsAt=roaKabulIso(String(d.get('endsAt')||''));
    if(new Date(endsAt)<=new Date(startsAt))throw new Error('Shift end must be after shift start');
    const riderId=String(d.get('riderId')||'')||null;
    const result=await opsMutation('riderOperations.adminCreateShift',{
      title:String(d.get('title')||'Rider shift'),serviceArea:String(d.get('serviceArea')||'Herat city'),
      startsAt,endsAt,riderId,note:String(d.get('note')||'')||undefined
    },true);
    if(out){out.className='notice success';out.textContent=`Shift created: ${result.status}`;}
    f.reset();await loadRiderOperationsAdmin();
  }catch(error){if(out){out.className='notice error';out.textContent=error.message||'Could not create shift.'}}
}

function renderAvailabilityReview(){
  const el=document.getElementById('opsRiderAvailability');if(!el)return;
  const items=AERIDEROPSADMIN.board?.availability||[];
  el.innerHTML=items.length?items.map(a=>`<div class="ops-row ops-row-wide"><div><b>${roaEsc(a.riderName)}</b><div>${roaEsc(a.date)} · ${roaEsc(a.allDay?'All day':`${a.start}–${a.end}`)}</div><small>${roaEsc(a.vehicle||'')} · ${roaEsc(a.serviceArea||'')}</small></div><div><span class="status-badge status-${roaEsc(a.status)}">${roaEsc(a.status)}</span></div><div class="ops-actions">${a.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="reviewRiderAvailability('${roaEsc(a.id)}','approved')">Approve & schedule</button><button class="btn btn-danger btn-sm" onclick="reviewRiderAvailability('${roaEsc(a.id)}','rejected')">Reject</button>`:''}</div></div>`).join(''):'<div class="empty-state">No rider availability requests yet.</div>';
}
async function reviewRiderAvailability(id,status){
  const action=status==='approved'?'Approve this availability and create the rider shift?':'Reject this availability request?';
  if(!confirm(action))return;
  await opsMutation('riderOperations.adminReviewAvailability',{id,status},true);
  await loadRiderOperationsAdmin();
}

function renderRiderShifts(){
  const el=document.getElementById('opsRiderShifts');if(!el)return;
  const shifts=AERIDEROPSADMIN.board?.shifts||[];
  el.innerHTML=shifts.length?shifts.map(s=>`<div class="ops-row ops-row-wide"><div><b>${roaEsc(s.title||'Rider shift')}</b><div>${roaEsc(s.riderName||'Open shift')}</div><small>${roaEsc(roaAfghanDate(s.startsAt))} → ${roaEsc(roaAfghanDate(s.endsAt))} · Afghanistan time</small></div><div><span class="status-badge status-${roaEsc(s.status)}">${roaEsc(s.status)}</span><div class="muted">${roaEsc(s.serviceArea||'')}</div></div><div class="ops-actions">${['open','assigned'].includes(s.status)?`<button class="btn btn-danger btn-sm" onclick="cancelRiderShift('${roaEsc(s.id)}')">Cancel shift</button>`:''}</div></div>`).join(''):'<div class="empty-state">No rider shifts have been created.</div>';
}
async function cancelRiderShift(id){if(!confirm('Cancel this rider shift?'))return;await opsMutation('riderOperations.adminCancelShift',{id},true);await loadRiderOperationsAdmin()}

function renderRiderTimeOff(){
  const el=document.getElementById('opsRiderTimeOff');if(!el)return;
  const items=AERIDEROPSADMIN.board?.timeOff||[];
  el.innerHTML=items.length?items.map(x=>`<div class="ops-row ops-row-wide"><div><b>${roaEsc(x.riderName)}</b><div>${roaEsc(x.startDate)} → ${roaEsc(x.endDate)}</div><small>${roaEsc(x.reason)}${x.note?` · ${roaEsc(x.note)}`:''}</small></div><div><span class="status-badge status-${roaEsc(x.status)}">${roaEsc(x.status)}</span></div><div class="ops-actions">${x.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="reviewRiderTimeOff('${roaEsc(x.id)}','approved')">Approve</button><button class="btn btn-danger btn-sm" onclick="reviewRiderTimeOff('${roaEsc(x.id)}','rejected')">Reject</button>`:''}</div></div>`).join(''):'<div class="empty-state">No rider time-off requests.</div>';
}
async function reviewRiderTimeOff(id,status){if(!confirm(`${status==='approved'?'Approve':'Reject'} this time-off request?`))return;await opsMutation('riderOperations.adminReviewTimeOff',{id,status},true);await loadRiderOperationsAdmin()}

function renderRiderSupportThreads(){
  const el=document.getElementById('opsRiderSupport');if(!el)return;
  const items=AERIDEROPSADMIN.support||[];
  el.innerHTML=items.length?items.map(t=>`<div class="ops-row"><div><b>${roaEsc(t.riderName)}</b><div>${roaEsc(t.phone||'')}</div><small>${Number(t.messageCount||0)} messages${t.lastMessageAt?` · ${roaEsc(roaAfghanDate(t.lastMessageAt))}`:''}</small></div><div><span class="status-badge status-${roaEsc(t.status)}">${roaEsc(t.status)}</span></div><div class="ops-actions"><button class="btn btn-light btn-sm" onclick="openRiderSupportThread('${roaEsc(t.id)}')">Open</button></div></div>`).join(''):'<div class="empty-state">No rider support conversations yet.</div>';
}
async function openRiderSupportThread(threadId){
  const data=await opsQuery('riderChat.adminSupportThread',{threadId},true),el=document.getElementById('riderSupportConversation');if(!el)return;
  el.classList.remove('hidden');
  el.innerHTML=`<div class="portal-card"><div class="ops-panel-head"><div><h3>${roaEsc(data.thread.riderName)}</h3><p class="muted">${roaEsc(data.thread.phone||'')} · ${roaEsc(data.thread.status)}</p></div><button class="btn btn-light btn-sm" onclick="closeRiderSupportThread()">Close view</button></div><div class="portal-list" style="max-height:340px;overflow:auto">${(data.messages||[]).map(m=>`<div class="access-row"><div><b>${roaEsc(m.sender)}</b><p>${roaEsc(m.body)}</p><small>${roaEsc(roaAfghanDate(m.createdAt))}</small></div></div>`).join('')||'<div class="portal-empty">No messages yet.</div>'}</div><form style="margin-top:12px" onsubmit="replyRiderSupport(event,'${roaEsc(threadId)}')"><label class="field"><span>Reply to rider</span><textarea name="body" minlength="1" maxlength="4000" rows="3" required></textarea></label><button class="btn btn-primary" style="margin-top:9px" type="submit">Send reply</button></form></div>`;
  el.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeRiderSupportThread(){const el=document.getElementById('riderSupportConversation');if(el){el.classList.add('hidden');el.innerHTML=''}}
async function replyRiderSupport(event,threadId){event.preventDefault();const f=event.currentTarget,body=String(new FormData(f).get('body')||'').trim();if(!body)return;await opsMutation('riderChat.adminSupportReply',{threadId,body},true);f.reset();await openRiderSupportThread(threadId);await loadRiderOperationsAdmin()}

async function loadRiderOperationsAdmin(){
  if(typeof opsQuery!=='function'||typeof AEOPS==='undefined'||!AEOPS.token)return;
  const err=document.getElementById('riderOpsAdminError');
  try{
    const [platform,dispatch,board,support]=await Promise.all([
      opsQuery('platform.adminStatus',null,true),
      opsQuery('dispatch.adminSettings',null,true),
      opsQuery('riderOperations.adminBoard',null,true),
      opsQuery('riderChat.adminSupportThreads',null,true),
    ]);
    AERIDEROPSADMIN.platform=platform;AERIDEROPSADMIN.dispatch=dispatch;AERIDEROPSADMIN.board=board;AERIDEROPSADMIN.support=support||[];
    err?.classList.add('hidden');renderMarketControl();renderAutoDispatch();renderShiftRiders();renderAvailabilityReview();renderRiderShifts();renderRiderTimeOff();renderRiderSupportThreads();
  }catch(error){if(err){err.className='notice error';err.textContent=error.message||'Rider operations data could not be loaded.'}}
}
window.loadRiderOperationsAdmin=loadRiderOperationsAdmin;
window.toggleAfghanEatsMarket=toggleAfghanEatsMarket;
window.setAutoDispatch=setAutoDispatch;
window.createRiderOpsShift=createRiderOpsShift;
window.reviewRiderAvailability=reviewRiderAvailability;
window.cancelRiderShift=cancelRiderShift;
window.reviewRiderTimeOff=reviewRiderTimeOff;
window.openRiderSupportThread=openRiderSupportThread;
window.closeRiderSupportThread=closeRiderSupportThread;
window.replyRiderSupport=replyRiderSupport;

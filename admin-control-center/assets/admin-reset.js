'use strict';

const API_BASE='https://afghaneats-api.onrender.com';
const form=document.getElementById('admin-reset-form');
const out=document.getElementById('admin-reset-result');
const token=new URLSearchParams(location.search).get('token') || '';
form.elements.token.value=token;

function validPassword(value){
  return value.length>=14 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}
function result(message,type='error'){
  out.className=`notice notice-${type}`;
  out.textContent=message;
}
async function resetPassword(token,newPassword){
  const response=await fetch(`${API_BASE}/api/trpc/auth.resetPassword`,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({json:{token,newPassword}})
  });
  const raw=await response.text();
  let payload={};
  try{payload=JSON.parse(raw)}catch{throw new Error(raw||`Request failed (${response.status})`)}
  if(!response.ok||payload?.error)throw new Error(payload?.error?.json?.message||payload?.error?.message||`Request failed (${response.status})`);
  return payload?.result?.data?.json??payload?.result?.data??payload;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(form),resetToken=String(data.get('token')||''),newPassword=String(data.get('newPassword')||''),confirmPassword=String(data.get('confirmPassword')||'');
  if(!resetToken)return result('This reset link is incomplete or has expired.');
  if(!validPassword(newPassword))return result('Use at least 14 characters with uppercase and lowercase letters, a number and a symbol.');
  if(newPassword!==confirmPassword)return result('The passwords do not match.');
  const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Updating…';
  try{
    await resetPassword(resetToken,newPassword);
    history.replaceState({},document.title,'/admin-reset');
    form.reset();form.classList.add('hidden');
    out.className='notice notice-success';
    out.innerHTML='Password updated and earlier administrator sessions were signed out. <a href="/"><b>Continue to Control Center sign in</b></a>.';
  }catch(error){result(error.message||'This reset link is invalid or has expired.')}
  finally{button.disabled=false;button.textContent='Set new password';}
});
if(!token)result('This reset link is incomplete. Open the private reset link provided by the administrator recovery process.');
'use strict';
(async()=>{
 const id=new URLSearchParams(location.search).get('id');if(!id)return;
 try{
  const base=(window.AFGHAN_EATS_CONFIG||{}).apiBaseUrl||'',r=await fetch(`${base}/api/trpc/restaurants.getById?input=${encodeURIComponent(JSON.stringify({json:{id}}))}`);if(!r.ok)return;const j=await r.json(),d=j.result?.data?.json??j.result?.data,u=new URL(d?.introduction_video_url);
  if(u.protocol!=='https:'||u.username||u.password)return;
  const target=document.getElementById('menuContent');if(!target)return;
  const box=document.createElement('section');box.className='card';box.style.cssText='padding:20px;margin-bottom:20px';const title=document.createElement('h2');title.textContent=localStorage.getItem('ae_lang')==='fa'?'معرفی رستورانت':'Meet the restaurant';box.append(title);
  if(/\.mp4$/i.test(u.pathname)){const video=document.createElement('video');video.src=u.href;video.controls=true;video.preload='none';video.playsInline=true;video.style.cssText='width:100%;max-height:420px;border-radius:14px';box.append(video);}else{const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.className='btn btn-light';a.textContent=localStorage.getItem('ae_lang')==='fa'?'تماشای ویدیو ↗':'Watch introduction video ↗';box.append(a);}target.before(box);
 }catch{}
})();

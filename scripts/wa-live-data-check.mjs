import fs from 'node:fs/promises';

const api='https://afghaneats-api.onrender.com/api/trpc/restaurants.list?input=%7B%22json%22%3A%7B%7D%7D';
const res=await fetch(api,{headers:{Accept:'application/json'}});
const data=await res.json();
const items=data?.result?.data?.json||[];
const char=items.find(x=>/char fasl/i.test(String(x?.name||'')))||null;
const research=await fetch('https://afghaneats.net/data/researched-herat-restaurants.json',{cache:'no-store'}).then(r=>r.json());
const rows=Array.isArray(research)?research:(research?.entries||research?.restaurants||[]);
const charResearch=rows.find(x=>/char fasl/i.test(JSON.stringify(x)))||null;
const candidates=items.filter(x=>x?.status==='active'&&(x?.whatsapp||x?.whatsapp_number||x?.phone)).map(x=>({
  id:x.id,name:x.name,status:x.status,phone:x.phone||null,whatsapp:x.whatsapp||null,whatsapp_number:x.whatsapp_number||null
})).slice(0,20);
const out={charLive:char?{
  id:char.id,name:char.name,status:char.status,phone:char.phone||null,phone2:char.phone2||null,
  whatsapp:char.whatsapp||null,whatsapp_number:char.whatsapp_number||null,
  phone_numbers:char.phone_numbers||null,has_delivery:char.has_delivery,has_takeaway:char.has_takeaway
}:null,charResearch,candidates};
console.log('===WA_LIVE_DATA_CHECK===');
console.log(JSON.stringify(out,null,2));
await fs.writeFile('/tmp/wa-live-data.json',JSON.stringify(out,null,2));

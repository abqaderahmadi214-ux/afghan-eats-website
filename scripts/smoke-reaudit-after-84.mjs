import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync=promisify(execFile);

const wf=await fs.readFile('.github/workflows/production-smoke.yml','utf8');
const lines=wf.split(/\r?\n/);
const rows=[];

function parseRetry(line){
  const m=line.match(/retry_contains\s+"([^"]+)"\s+"((?:\\.|[^"])*)"\s+(\S+)/);
  if(!m) return null;
  return {
    url:m[1],
    marker:m[2].replace(/\\"/g,'"').replace(/\\\\/g,'\\'),
    out:m[3]
  };
}

for(let i=0;i<lines.length;i++){
  const p=parseRetry(lines[i]);
  if(p) rows.push({line:i+1,...p});
}

const cache=new Map();
async function fetchUrl(url){
  if(cache.has(url)) return cache.get(url);
  const safe='/tmp/reaudit-'+Buffer.from(url).toString('base64url').slice(0,90);
  let status='000', ok=false, error='';
  try{
    const {stdout}=await execFileAsync('curl',[
      '-fsS','--connect-timeout','10','--max-time','30','-o',safe,'-w','%{http_code}',url
    ],{maxBuffer:20*1024*1024});
    status=stdout.trim();
    ok=true;
  }catch(e){
    status=String(e.stdout||'').trim()||'000';
    error=String(e.stderr||e.message||e).trim();
  }
  let body='';
  try{body=await fs.readFile(safe,'utf8')}catch{}
  const result={status,ok,error,body};
  cache.set(url,result);
  return result;
}

for(const row of rows){
  const res=await fetchUrl(row.url);
  row.httpStatus=res.status;
  row.fetchOk=res.ok;
  row.count=res.body.split(row.marker).length-1;
  row.present=row.count>0;
  row.error=res.error?.slice(0,500)||'';
}

const appDownloads=await fetchUrl('https://afghaneats.net/assets/app-downloads.js');
const home=await fetchUrl('https://afghaneats.net/');
const extra={
  appDownloads:{
    status:appDownloads.status,
    customerAndroidDownloadCount:appDownloads.body.split('customerAndroidDownload').length-1,
    length:appDownloads.body.length
  },
  home:{
    mobileAppsComingSoonCount:home.body.split('Mobile apps coming soon').length-1,
    matchingText:[...home.body.matchAll(/Mobile apps[^<]*/g)].map(m=>m[0]).slice(0,20),
    flipdishCount:home.body.split('ie.flipdish.br11970').length-1
  }
};

await fs.mkdir('reaudit-output',{recursive:true});
await fs.writeFile('reaudit-output/report.json',JSON.stringify({
  generatedAt:new Date().toISOString(),
  total:rows.length,
  failing:rows.filter(r=>!r.present),
  extra
},null,2));

console.log('===REAUDIT_AFTER_84===');
console.log(JSON.stringify({
  total:rows.length,
  failing:rows.filter(r=>!r.present),
  extra
},null,2));

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
  return {url:m[1], marker:m[2].replace(/\\"/g,'"').replace(/\\\\/g,'\\'), out:m[3]};
}

for(let i=0;i<lines.length;i++){
  const p=parseRetry(lines[i]);
  if(p) rows.push({line:i+1,...p});
}

const cache=new Map();
async function fetchUrl(url){
  if(cache.has(url)) return cache.get(url);
  const safe='/tmp/audit-'+Buffer.from(url).toString('base64url').slice(0,80);
  let status='000', ok=false, error='';
  try{
    const {stdout}=await execFileAsync('curl',['-fsS','--connect-timeout','10','--max-time','30','-o',safe,'-w','%{http_code}',url],{maxBuffer:1024*1024*10});
    status=stdout.trim();
    ok=true;
  }catch(e){
    status=String(e.stdout||'').trim()||'000';
    error=String(e.stderr||e.message||e).trim();
  }
  let body='';
  try{body=await fs.readFile(safe,'utf8')}catch{}
  const result={status,ok,error,body,path:safe};
  cache.set(url,result);
  return result;
}

for(const row of rows){
  const res=await fetchUrl(row.url);
  row.httpStatus=res.status;
  row.fetchOk=res.ok;
  row.count=res.body.split(row.marker).length-1;
  row.present=row.count>0;
  row.bodyLength=res.body.length;
  if(!res.ok) row.error=res.error.slice(0,500);
}

await fs.mkdir('audit-output',{recursive:true});
await fs.writeFile('audit-output/report.json',JSON.stringify({generatedAt:new Date().toISOString(),rows},null,2));

const tsv=['Line\tURL\tMarker\tHTTP\tCount\tPresent'];
for(const r of rows){
  tsv.push([r.line,r.url,r.marker.replaceAll('\t',' '),r.httpStatus,r.count,r.present?'YES':'NO'].join('\t'));
}
await fs.writeFile('audit-output/report.tsv',tsv.join('\n'));

console.log('===SMOKE_ASSERTION_AUDIT===');
console.log(JSON.stringify({generatedAt:new Date().toISOString(),total:rows.length,missing:rows.filter(r=>!r.present),rows},null,2));

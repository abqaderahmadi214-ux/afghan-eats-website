import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir='diagnostic-output';
await fs.mkdir(outDir,{recursive:true});
const device=devices['Pixel 5'];
const context=await chromium.launchPersistentContext('/tmp/ae-pwa-profile',{
  headless:false,
  ...device
});
const page=context.pages()[0] || await context.newPage();
const consoleMessages=[];
const pageErrors=[];
page.on('console',m=>consoleMessages.push({type:m.type(),text:m.text()}));
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
await page.addInitScript(()=>{
  window.__aeBeforeInstallPromptSeen=false;
  window.addEventListener('beforeinstallprompt',()=>{window.__aeBeforeInstallPromptSeen=true;},{capture:true});
});
let navigationError=null;
try{
  await page.goto('https://deploy-preview-78--afghaneats.netlify.app/',{waitUntil:'networkidle',timeout:30000});
}catch(error){navigationError=String(error?.message||error)}
await page.waitForTimeout(8000);
const cdp=await context.newCDPSession(page);
let installabilityErrors=[];
let manifest=null;
try{installabilityErrors=(await cdp.send('Page.getInstallabilityErrors')).installabilityErrors||[]}catch(error){installabilityErrors=[{errorId:'cdp-unavailable',errorArguments:[{name:'message',value:String(error?.message||error)}]}]}
try{manifest=await cdp.send('Page.getAppManifest')}catch(error){manifest={error:String(error?.message||error)}}
const state=await page.evaluate(async()=>{
  const regs='serviceWorker' in navigator?await navigator.serviceWorker.getRegistrations():[];
  return {
    beforeInstallPromptSeen:Boolean(window.__aeBeforeInstallPromptSeen),
    bannerPresent:Boolean(document.getElementById('aePwaInstall')),
    bannerText:document.getElementById('aePwaInstall')?.innerText||'',
    manifestHref:document.querySelector('link[rel="manifest"]')?.href||'',
    serviceWorkers:regs.map(reg=>({scope:reg.scope,scriptURL:reg.active?.scriptURL||reg.waiting?.scriptURL||reg.installing?.scriptURL||''}))
  };
});
const report={navigationError,...state,installabilityErrors,manifest,consoleMessages,pageErrors};
await page.screenshot({path:`${outDir}/preview78-pwa-headful-mobile.png`,fullPage:true});
await fs.writeFile(`${outDir}/pwa-installability.json`,JSON.stringify(report,null,2));
console.log('===PWA_INSTALLABILITY===');
console.log(JSON.stringify(report,null,2));
await context.close();

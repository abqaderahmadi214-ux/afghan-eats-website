import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir='sticky-header-review';
await fs.mkdir(outDir,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:375,height:812},
  deviceScaleFactor:2,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 Chrome/154.0 Mobile Safari/537.36'
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));

const url='https://deploy-preview-84--afghaneats.netlify.app/restaurant.html?id=darbar-herat';
await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('.directory-public-menu .public-menu-item',{timeout:20000});
await page.waitForTimeout(1200);

const checkpoints=[];
const maxY=await page.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
for(const fraction of [0,.12,.25,.4,.55,.7,.85,1]){
  const y=Math.round(maxY*fraction);
  await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
  await page.waitForTimeout(220);
  const state=await page.evaluate(()=>{
    const header=document.querySelector('.header');
    const hr=header?.getBoundingClientRect();
    const hs=header?getComputedStyle(header):null;
    const visibleInteractive=[...document.querySelectorAll('.directory-public-menu .premium-menu-card, .directory-public-menu .menu-category-option, .directory-primary-actions a')]
      .filter(el=>{
        const r=el.getBoundingClientRect();
        const s=getComputedStyle(el);
        return s.display!=='none' && s.visibility!=='hidden' && r.bottom>0 && r.top<innerHeight;
      })
      .map(el=>{
        const r=el.getBoundingClientRect();
        return {
          tag:el.tagName,
          cls:el.className,
          text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),
          top:r.top,bottom:r.bottom,left:r.left,right:r.right,
          overlapsHeader:Boolean(hr && r.top < hr.bottom && r.bottom > hr.top)
        };
      });
    const obscured=visibleInteractive.filter(x=>x.overlapsHeader && x.bottom<=hr.bottom+2);
    const partial=visibleInteractive.filter(x=>x.overlapsHeader && x.bottom>hr.bottom+2);
    return {
      scrollY:window.scrollY,
      viewportHeight:innerHeight,
      header:hr?{
        top:hr.top,bottom:hr.bottom,height:hr.height,
        position:hs.position,
        zIndex:hs.zIndex
      }:null,
      obscured,
      partialOverlaps:partial
    };
  });
  checkpoints.push(state);
}

await page.evaluate(()=>window.scrollTo({top:Math.round(document.documentElement.scrollHeight*.55),behavior:'instant'}));
await page.waitForTimeout(250);
await page.screenshot({path:`${outDir}/sticky-header-mid-scroll.png`,fullPage:false});

const report={
  url,
  checkpoints,
  anyFullyObscured:checkpoints.some(c=>c.obscured.length>0),
  maxPartialOverlap:Math.max(0,...checkpoints.map(c=>c.partialOverlaps.length)),
  errors
};
await fs.writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));
console.log('===STICKY_HEADER_REVIEW===');
console.log(JSON.stringify(report,null,2));

await context.close();
await browser.close();

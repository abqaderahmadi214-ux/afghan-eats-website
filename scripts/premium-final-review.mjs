import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir='premium-final-review';
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
await page.waitForSelector('.ae-skip-link',{timeout:15000});
await page.waitForSelector('.directory-store-hero',{timeout:20000});
await page.waitForSelector('.directory-public-menu .menu-category-option',{timeout:20000});
await page.waitForTimeout(1200);

async function skipState(){
  return await page.evaluate(()=>{
    const link=document.querySelector('.ae-skip-link');
    const r=link?.getBoundingClientRect();
    const s=link?getComputedStyle(link):null;
    return {
      text:link?.textContent?.trim()||'',
      active:document.activeElement===link,
      left:s?.left||'',
      top:s?.top||'',
      position:s?.position||'',
      rect:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,
      inViewport:Boolean(r && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight)
    };
  });
}

const hiddenDefault=await skipState();
await page.screenshot({path:`${outDir}/skip-link-hidden-default.png`,fullPage:false});

await page.keyboard.press('Tab');
await page.waitForTimeout(250);
const focused=await skipState();
await page.screenshot({path:`${outDir}/skip-link-visible-focus.png`,fullPage:false});

await page.keyboard.press('Tab');
await page.waitForTimeout(250);
const hiddenAfterTab=await skipState();

const category=await page.evaluate(()=>{
  const scroller=document.querySelector('.directory-public-menu .menu-category-options');
  const active=scroller?.querySelector('.menu-category-option.active');
  if(!scroller||!active)return null;
  scroller.scrollLeft=0;
  const sr=scroller.getBoundingClientRect();
  const ar=active.getBoundingClientRect();
  const label=active.querySelector('span')?.textContent?.trim()||active.textContent?.trim()||'';
  return {
    label,
    scroller:{left:sr.left,right:sr.right,width:sr.width,paddingLeft:getComputedStyle(scroller).paddingLeft,paddingRight:getComputedStyle(scroller).paddingRight},
    active:{left:ar.left,right:ar.right,width:ar.width},
    fullyVisible:ar.left>=sr.left && ar.right<=sr.right
  };
});

await page.locator('.directory-store-hero').screenshot({path:`${outDir}/darbar-hero-updated.png`});
await page.locator('.directory-public-menu').screenshot({path:`${outDir}/menu-category-updated.png`});

const hero=await page.evaluate(()=>{
  const ph=document.querySelector('.directory-store-hero .store-photo-placeholder');
  return ph?{
    backgroundImage:getComputedStyle(ph).backgroundImage,
    backgroundColor:getComputedStyle(ph).backgroundColor
  }:null;
});

const report={
  generatedAt:new Date().toISOString(),
  url,
  hiddenDefault,
  focused,
  hiddenAfterTab,
  category,
  hero,
  errors
};
await fs.writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));
console.log('===PREMIUM_FINAL_REVIEW===');
console.log(JSON.stringify(report,null,2));
await context.close();
await browser.close();

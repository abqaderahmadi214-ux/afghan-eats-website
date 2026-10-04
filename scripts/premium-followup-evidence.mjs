import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir='premium-followup-evidence';
await fs.mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true});

const BASES={
  before:'https://afghaneats.net',
  after:'https://deploy-preview-84--afghaneats.netlify.app'
};

async function mobilePage(base,width=360,height=820){
  const context=await browser.newContext({
    viewport:{width,height},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 Chrome/154.0 Mobile Safari/537.36'
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  return {context,page,errors};
}

async function openReady(page,url,waitSelector){
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector(waitSelector,{timeout:20000});
  await page.waitForTimeout(1200);
}

async function captureCategories(base,label){
  const {context,page,errors}=await mobilePage(base);
  await openReady(page,base+'/', '.ae-cuisine-section');
  const data=await page.evaluate(()=>{
    const section=document.querySelector('.ae-cuisine-section');
    const afghan=[...document.querySelectorAll('.ae-cuisine')].find(x=>/Afghan|افغانی/.test(x.textContent||''));
    const img=afghan?.querySelector('img');
    const circles=[...document.querySelectorAll('.ae-cuisine-photo')].map(el=>{
      const r=el.getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),bg:getComputedStyle(el).backgroundImage};
    });
    return {
      afghanSrc:img?.getAttribute('src')||'',
      afghanLoaded:Boolean(img?.complete&&img?.naturalWidth),
      circles,
      sectionText:section?.innerText||''
    };
  });
  await page.locator('.ae-cuisine-section').screenshot({path:`${outDir}/${label}-homepage-categories.png`});
  await context.close();
  return {...data,errors};
}

async function captureQoqnoos(base,label){
  const {context,page,errors}=await mobilePage(base);
  await openReady(page,base+'/restaurants.html','#restaurantGrid .restaurant-card');
  const card=page.locator('#restaurantGrid .restaurant-card').filter({hasText:'Qoqnoos Restaurant'}).first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const data=await card.evaluate(el=>{
    const media=el.querySelector('.restaurant-image');
    const placeholder=el.querySelector('.restaurant-photo-placeholder');
    const img=media?.querySelector('img');
    const phStyle=placeholder?getComputedStyle(placeholder):null;
    return {
      mediaVisibleText:(media?.innerText||'').trim(),
      containsPhotoComingSoon:/photo coming soon/i.test(media?.innerText||''),
      imageSrc:img?.getAttribute('src')||'',
      imageHidden:Boolean(img?.hidden),
      placeholderDisplay:phStyle?.display||'',
      placeholderBg:phStyle?.backgroundImage||'',
      placeholderFontSize:phStyle?.fontSize||''
    };
  });
  await card.screenshot({path:`${outDir}/${label}-qoqnoos-card.png`});
  await context.close();
  return {...data,errors};
}

async function darbarOverlap(base,width){
  const {context,page,errors}=await mobilePage(base,width,780);
  await openReady(page,base+'/restaurant.html?id=darbar-herat','.directory-store-hero');
  const data=await page.evaluate(()=>{
    const pill=document.querySelector('.directory-store-hero .status-pill.directory');
    const title=document.querySelector('.directory-store-hero h1');
    const ph=document.querySelector('.directory-store-hero .store-photo-placeholder');
    const badge=document.querySelector('.directory-store-hero .status-pill.directory');
    const pr=pill?.getBoundingClientRect();
    const tr=title?.getBoundingClientRect();
    const overlaps=Boolean(pr&&tr&&!(pr.bottom<=tr.top||pr.top>=tr.bottom||pr.right<=tr.left||pr.left>=tr.right));
    return {
      pill:pr?{top:pr.top,bottom:pr.bottom,left:pr.left,right:pr.right,width:pr.width,height:pr.height}:null,
      title:tr?{top:tr.top,bottom:tr.bottom,left:tr.left,right:tr.right,width:tr.width,height:tr.height}:null,
      overlaps,
      pillBg:badge?getComputedStyle(badge).backgroundColor:'',
      placeholderBg:ph?getComputedStyle(ph).backgroundImage:''
    };
  });
  await context.close();
  return {...data,errors};
}

async function captureDarbar(base,label){
  const {context,page,errors}=await mobilePage(base);
  await openReady(page,base+'/restaurant.html?id=darbar-herat','.directory-store-hero');
  const data=await page.evaluate(()=>{
    const hero=document.querySelector('.directory-store-hero');
    const ph=hero?.querySelector('.store-photo-placeholder');
    const pill=hero?.querySelector('.status-pill.directory');
    return {
      placeholderBg:ph?getComputedStyle(ph).backgroundImage:'',
      pillBg:pill?getComputedStyle(pill).backgroundColor:'',
      pillText:pill?.textContent?.trim()||'',
      pillAfter:pill?getComputedStyle(pill,'::after').content:''
    };
  });
  await page.locator('.directory-store-hero').screenshot({path:`${outDir}/${label}-darbar-hero.png`});
  await context.close();
  return {...data,errors};
}

async function captureMenu(base,label){
  const {context,page,errors}=await mobilePage(base);
  await openReady(page,base+'/restaurant.html?id=darbar-herat','.directory-public-menu .public-menu-item');
  const section=page.locator('.directory-public-menu').first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const data=await section.evaluate(el=>({
    text:el.innerText.slice(0,2500),
    yellowBadge:[...el.querySelectorAll('.directory-kicker,.public-menu-status')].some(x=>{
      const bg=getComputedStyle(x).backgroundColor;
      return bg==='rgb(255, 241, 201)'||bg==='rgb(255, 244, 220)';
    }),
    kickerBg:getComputedStyle(el.querySelector('.directory-kicker')).backgroundColor,
    visiblePhotoComingSoon:[...el.querySelectorAll('.menu-photo-placeholder')].some(x=>getComputedStyle(x).display!=='none' && /photo coming soon/i.test(x.innerText||''))
  }));
  await section.screenshot({path:`${outDir}/${label}-menu-section.png`});
  await context.close();
  return {...data,errors};
}

const report={generatedAt:new Date().toISOString(),before:{},after:{}};
for(const [label,base] of Object.entries(BASES)){
  report[label].categories=await captureCategories(base,label);
  report[label].qoqnoos=await captureQoqnoos(base,label);
  report[label].darbar=await captureDarbar(base,label);
  report[label].menu=await captureMenu(base,label);
}
report.after.darbar320=await darbarOverlap(BASES.after,320);
report.after.darbar375=await darbarOverlap(BASES.after,375);

await fs.writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));
console.log('===PREMIUM_FOLLOWUP_REPORT===');
console.log(JSON.stringify(report,null,2));
await browser.close();

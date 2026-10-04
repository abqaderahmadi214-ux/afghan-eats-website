import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir='premium-design-evidence';
await fs.mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const pixel=devices['Pixel 5'];

const targets=[
  {name:'homepage-hero',path:'/',selector:'.ae-hero'},
  {name:'restaurant-grid',path:'/restaurants.html',selector:'#restaurantGrid'},
  {name:'darbar-page',path:'/restaurant.html?id=darbar-herat',selector:'body'},
  {name:'darbar-menu',path:'/restaurant.html?id=darbar-herat',selector:'.directory-public-menu'}
];

async function waitReady(page,selector){
  if(selector==='#restaurantGrid'){
    await page.waitForSelector('#restaurantGrid .restaurant-card',{timeout:20000});
  }else if(selector==='.directory-public-menu'){
    await page.waitForSelector('.directory-public-menu .public-menu-item',{timeout:20000});
  }else if(selector==='body' && page.url().includes('darbar-herat')){
    await page.waitForSelector('.directory-detail',{timeout:20000});
  }else{
    await page.waitForSelector(selector,{timeout:20000});
  }
  await page.waitForTimeout(1200);
}

async function capture(base,label){
  const context=await browser.newContext({...pixel});
  const report={label,base,pages:{},checks:{}};
  for(const t of targets){
    const page=await context.newPage();
    const consoleErrors=[];
    const pageErrors=[];
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
    page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
    const url=base+t.path;
    let navigationError=null;
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      await waitReady(page,t.selector);
    }catch(error){
      navigationError=String(error?.message||error);
    }

    if(t.name==='darbar-page'){
      await page.evaluate(()=>document.querySelector('.directory-public-menu')?.scrollIntoView({block:'end'}));
      await page.waitForTimeout(250);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(250);
    }

    const file=`${outDir}/${label}-${t.name}.png`;
    try{
      if(t.selector==='body'){
        await page.screenshot({path:file,fullPage:true});
      }else{
        const loc=page.locator(t.selector).first();
        await loc.screenshot({path:file});
      }
    }catch(error){
      consoleErrors.push('screenshot: '+String(error?.message||error));
    }

    const visibleText=await page.locator('body').innerText().catch(()=> '');
    report.pages[t.name]={
      url,
      navigationError,
      title:await page.title().catch(()=> ''),
      consoleErrors,
      pageErrors,
      visiblePhotoComingSoon:/Photo coming soon/i.test(visibleText),
      visibleGooglePlay:/Google Play/i.test(visibleText),
      visibleAppStore:/App Store/i.test(visibleText)
    };

    if(t.name==='homepage-hero'){
      report.checks.hero=await page.evaluate(()=>{
        const feast=document.querySelector('.ae-feast');
        const cap=document.querySelector('.ae-hero-visual figcaption');
        return {
          heroImageSrc:feast?.getAttribute('src')||'',
          heroImageComplete:Boolean(feast?.complete && feast?.naturalWidth),
          captionBackground:cap?getComputedStyle(cap).backgroundColor:'',
          captionColor:cap?getComputedStyle(cap).color:''
        };
      });
      report.checks.categories=await page.evaluate(()=>{
        return [...document.querySelectorAll('.ae-cuisine-photo')].map(el=>{
          const r=el.getBoundingClientRect();
          const img=el.querySelector('img');
          return {w:Math.round(r.width),h:Math.round(r.height),hasImage:Boolean(img),objectFit:img?getComputedStyle(img).objectFit:null};
        });
      });
      report.checks.footer=await page.evaluate(()=>({
        appBadges:document.querySelectorAll('.app-download-btn').length,
        comingSoonText:document.querySelector('.mobile-apps-coming-soon')?.textContent?.trim()||''
      }));
    }

    if(t.name==='restaurant-grid'){
      report.checks.grid=await page.evaluate(()=>{
        const placeholders=[...document.querySelectorAll('.restaurant-photo-placeholder')];
        const q=[...document.querySelectorAll('.restaurant-card')].find(card=>/Qoqnoos/i.test(card.textContent||''));
        const qi=q?.querySelector('.restaurant-image img');
        return {
          placeholderCount:placeholders.length,
          visiblePlaceholderText:placeholders.some(el=>/Photo coming soon/i.test(el.innerText||'')),
          qoqnoosImageSrc:qi?.getAttribute('src')||'',
          qoqnoosImageHidden:Boolean(qi?.hidden)
        };
      });
    }

    if(t.name==='darbar-page'){
      report.checks.darbar=await page.evaluate(()=>{
        const pill=document.querySelector('.directory-store-hero .status-pill.directory');
        const summary=document.querySelector('.directory-summary');
        const h2=summary?.querySelector('h2');
        const desc=summary?.querySelector(':scope > div:first-child > p');
        const actions=document.querySelector('.directory-primary-actions');
        return {
          pillAfter:pill?getComputedStyle(pill,'::after').content:'',
          pillBg:pill?getComputedStyle(pill).backgroundColor:'',
          giantNoticeVisible:Boolean(h2 && getComputedStyle(h2).display!=='none'),
          descriptionVisible:Boolean(desc && getComputedStyle(desc).display!=='none'),
          contactNoteBefore:actions?getComputedStyle(actions,'::before').content:'',
          callButtonText:actions?.querySelector('.btn-primary')?.textContent?.trim()||'',
          phoneText:[...actions?.querySelectorAll('a')||[]].map(a=>a.textContent.trim()).filter(Boolean)
        };
      });
    }

    if(t.name==='darbar-menu'){
      report.checks.menu=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('.directory-public-menu .premium-menu-card')].filter(el=>getComputedStyle(el).display!=='none');
        const heights=cards.map(el=>Math.round(el.getBoundingClientRect().height));
        const placeholders=[...document.querySelectorAll('.directory-public-menu .menu-photo-placeholder')];
        const prices=[...document.querySelectorAll('.directory-public-menu .menu-price')].map(el=>({
          text:el.textContent?.trim()||'',
          color:getComputedStyle(el).color,
          weight:getComputedStyle(el).fontWeight
        }));
        const kicker=document.querySelector('.directory-public-menu .directory-kicker');
        return {
          cardCount:cards.length,
          heights,
          maxHeightDelta:heights.length?Math.max(...heights)-Math.min(...heights):0,
          gap:getComputedStyle(document.querySelector('.directory-menu-grid')||document.body).gap,
          visiblePlaceholderText:placeholders.some(el=>/Photo coming soon/i.test(el.innerText||'')),
          prices,
          kickerBg:kicker?getComputedStyle(kicker).backgroundColor:'',
          kickerColor:kicker?getComputedStyle(kicker).color:''
        };
      });
    }

    await page.close();
  }
  await context.close();
  return report;
}

const before=await capture('https://afghaneats.net','before');
const after=await capture('https://deploy-preview-84--afghaneats.netlify.app','after');

const summary={generatedAt:new Date().toISOString(),before,after};
await fs.writeFile(`${outDir}/report.json`,JSON.stringify(summary,null,2));
console.log('===PREMIUM_DESIGN_REPORT===');
console.log(JSON.stringify(summary,null,2));
await browser.close();

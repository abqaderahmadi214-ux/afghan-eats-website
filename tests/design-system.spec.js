const {test,expect}=require('@playwright/test');
for(const route of ['/','/restaurants','/checkout','/owner','/rider-portal']){
 test(`shared action palette and narrow layout: ${route}`,async({page})=>{
  await page.route('https://afghaneats-api.onrender.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{data:{json:[]}}})}));
  await page.goto(route);
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ae-action').trim())).toBe('#0d4a3a');
  const button=page.locator('.btn-primary').first();
  await expect(button).toBeAttached();
  await expect.poll(()=>button.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(13, 74, 58)');
  const size=await button.boundingBox();
  if(size) expect(size.height).toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}

for (const route of ['/owner','/rider-portal']) {
 for (const width of [320,390]) {
  for (const language of ['en','fa']) {
   test(`worker controls fit after live city selection: ${route} ${width} ${language}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const city={city_key:'herat',name_en:'Herat',name_dari:'هرات',ordering_enabled:true};
    await page.route('https://afghaneats-api.onrender.com/**',request=>{
     const url=request.request().url();
     const data=url.includes('cities.publicCatalog')?[city]:url.includes('cities.publicContext')?{city,areas:[]}:[];
     return request.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{data:{json:data}}})});
    });
    await page.goto(route);
    await expect(page.locator('#aeCitySelect')).toBeVisible();
    if(language==='fa') await page.locator('.header .lang').click();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const controls=page.locator('.header .actions button,.header .actions select');
    for(const control of await controls.all()) {
     const bounds=await control.boundingBox();
     expect(bounds).toBeTruthy();
     expect(bounds.x).toBeGreaterThanOrEqual(0);
     expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
     expect(bounds.height).toBeGreaterThanOrEqual(40);
    }
   });
  }
 }
}

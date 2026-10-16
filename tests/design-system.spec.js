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

const {test,expect}=require('@playwright/test');
test('offers shelf displays real campaign conditions and links to its restaurant',async({page})=>{
 await page.route('**/api/trpc/growth.publicMarketplace?**',r=>r.fulfill({json:{result:{data:{json:{offers:[{id:'campaign-1',restaurantId:'r1',restaurantName:'Kitchen',name:'Lunch savings',campaignType:'percent_discount',discountValue:15,code:'LUNCH15',scopeType:'order',minOrder:300}],sponsored:[]}}}}}));
 await page.goto('/restaurants');await page.getByRole('heading',{name:'Offers from restaurants'}).waitFor();const card=page.locator('#aeGrowthMarketplace .growth-card');await expect(card).toContainText('15% off');await expect(card).toHaveAttribute('href','/restaurant.html?id=r1&offer=LUNCH15');
});
test('restaurant introduction is lazy and does not autoplay',async({page})=>{
 await page.route('**/api/trpc/restaurants.getById?**',r=>r.fulfill({json:{result:{data:{json:{id:'r1',name:'Kitchen',introduction_video_url:'https://video.example/intro.mp4'}}}}}));
 await page.goto('/restaurant.html?id=r1');await expect(page.getByRole('heading',{name:'Meet the restaurant'})).toBeVisible();await expect(page.locator('video')).toHaveAttribute('preload','none');await expect(page.locator('video')).not.toHaveAttribute('autoplay');
});

test('expired homepage promotions returned by the API are not displayed',async({page})=>{
 const expired=new Date(Date.now()-24*60*60*1000).toISOString();
 const current=new Date(Date.now()+24*60*60*1000).toISOString();
 await page.route('**/api/trpc/growth.publicMarketplace?**',r=>r.fulfill({json:{result:{data:{json:{offers:[
  {id:'expired-parmis',restaurantId:'r-old',restaurantName:'Parmis Restaurant',name:'30% off',campaignType:'percent_discount',discountValue:30,endsAt:expired},
  {id:'current-offer',restaurantId:'r-current',restaurantName:'Open Kitchen',name:'Lunch savings',campaignType:'percent_discount',discountValue:15,endsAt:current}
],sponsored:[]}}}}}));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Offers from restaurants'})).toBeVisible();
 const cards=page.locator('#aeGrowthMarketplace .growth-card');
 await expect(cards).toHaveCount(1);
 await expect(cards.first()).toContainText('Lunch savings');
 await expect(page.locator('#aeGrowthMarketplace')).not.toContainText('Parmis Restaurant');
});

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const restaurant = {
  id:'test-restaurant',name:'Herat Kitchen',name_dari:'آشپزخانه هرات',description:'Afghan food',description_dari:'غذای افغانی',
  cuisine_tags:['Afghan','Kebab'],category_primary:'Afghan',address:'Gulha Circle, Herat',district:'Gulha',city:'Herat',
  cover_image_url:null,logo_url:null,has_delivery:true,has_takeaway:true,delivery_time_min:20,delivery_time_max:35,
  delivery_fee_min:null,min_order_amount:0,status:'active',is_open:true,rating:4.8,total_reviews:12,verification_status:'owner_confirmed'
};
const menu = {categories:[{id:'main',name:'Main dishes',name_dari:'غذاهای اصلی'}],items:[{id:'kebab',category_id:'main',name:'Kebab',name_dari:'کباب',description:'Freshly prepared kebab',price:250,image_url:null,is_available:true,is_popular:true}]};
const quote = {restaurantId:restaurant.id,fulfillment:'delivery',deliveryFee:60,minimumOrder:0,etaMin:25,etaMax:40,zone:{id:'gulha',name:'Gulha',nameDari:'گل‌ها'},source:'zone'};
const directoryListing = {
  id:'jumeirah-fast-food-herat',name:'Jumeirah Fast Food',name_dari:'فست‌فود جمیرا',description:'Public restaurant listing',description_dari:'فهرست عمومی رستورانت',
  cuisine_tags:['Fast Food','Pizza'],category_primary:'Fast Food',address:'Mokhaberat Road, Herat',address_dari:'هرات، جاده مخابرات',district:'Jade Mokhaberat',city:'Herat',
  phone:'+93 728 778 355',phone2:'+93 728 213 595',phone_numbers:['+93 728 778 355','+93 728 213 595','+93 790 810 167'],source_url:'https://www.instagram.com/jumeirah____fastfood/',source_label:'Official Instagram profile',source_checked_at:'2026-08-09',
  cover_image_url:null,logo_url:null,has_delivery:false,has_takeaway:false,status:'pending',is_open:false,rating:null,total_reviews:0,verification_status:'public_seeded',partnership_status:'prospect',listing_mode:'directory',public_menu_item_count:2
};

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}
async function mockApi(page,{deliveryUnavailable=false,orderingEnabled=false,restaurants:restaurantRows=[restaurant,directoryListing],quoteHandler,menuData=menu,menuPreviewRows=[],browseMenuData=menuData}={}){
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route=>{
    const path = new URL(route.request().url()).pathname;
    let data=[];
    if(path.endsWith('/platform.publicStatus'))data={orderingEnabled};
    else if(path.endsWith('/restaurants.listBrowsePreviews'))data=menuPreviewRows;
    else if(path.endsWith('/restaurants.getBrowseMenu'))data=browseMenuData;
    else if(path.endsWith('/restaurants.list'))data=restaurantRows;
    else if(path.endsWith('/restaurants.getMenu'))data=menuData;
    else if(path.endsWith('/orders.quote')){
      const input=JSON.parse(new URL(route.request().url()).searchParams.get('input')||'{"json":{}}').json||{};
      if(quoteHandler){await quoteHandler(route,input);return}
      if(deliveryUnavailable&&input.fulfillment!=='pickup'){
        await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Delivery is not available for this address'}}})});
        return;
      }
      data=input.fulfillment==='pickup'?{...quote,fulfillment:'pickup',deliveryFee:0,zone:null,source:'pickup'}:quote;
    }
    else if(path.endsWith('/orders.place'))data={success:true,replayed:false,orderId:'33333333-3333-4333-8333-333333333333',orderNumber:'AE-20260827-4242',message:'Order placed successfully',pricing:{subtotal:250,deliveryFee:60,serviceFee:8,discount:0,tipAmount:0,total:318},promo:null,loyalty:null,logistics:quote,customerLinked:false,scheduledFor:null};
    else if(path.endsWith('/catalog.publicModifiers'))data={groups:[],options:[],links:[]};
    else if(path.endsWith('/merchant.publicAvailability'))data={restaurantId:restaurant.id,acceptingNow:true,acceptingScheduled:true,operationMode:'normal',scheduleConfigured:false};
    else if(path.endsWith('/merchant.publicAvailabilityBatch'))data=[];
    else if(path.endsWith('/merchant.publicMenuAvailability'))data=[];
    else if(path.endsWith('/cities.publicCatalog'))data=[];
    else if(path.endsWith('/discovery.trending'))data=[];
    else if(path.endsWith('/operations.applyRestaurantClaim'))data={success:true,duplicate:false,reference:'AEC-20260811-TEST01',status:'pending',restaurantName:directoryListing.name,emailVerified:false,verificationEmailSent:true};
    else if(path.endsWith('/operations.restaurantClaimStatus'))data={reference:'AEC-20260811-TEST01',status:'pending',restaurant_name:directoryListing.name};
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
}

async function stampFixtureLabel(page){
  await page.evaluate(()=>{
    document.getElementById('aeReviewFixtureLabel')?.remove();
    const header=document.querySelector('.header');
    const top=Math.ceil(header?.getBoundingClientRect().bottom||70)+5;
    const badge=document.createElement('div');
    badge.id='aeReviewFixtureLabel';
    badge.textContent='REVIEW FIXTURE · NOT LIVE DATA';
    Object.assign(badge.style,{
      position:'fixed',zIndex:'2147483647',top:`${top}px`,
      left:document.documentElement.dir==='rtl'?'auto':'10px',
      right:document.documentElement.dir==='rtl'?'10px':'auto',
      padding:'4px 8px',border:'1px solid #e0c887',borderRadius:'999px',
      background:'rgba(255,246,224,.97)',color:'#69480c',
      font:'800 10px/1.15 system-ui,sans-serif',letterSpacing:'.02em',
      boxShadow:'0 2px 8px rgba(32,32,0,.1)',pointerEvents:'none'
    });
    document.body.append(badge);
  });
}

test('homepage area browse to separate delivery quote dialog and mobile checkout', async ({page})=>{
  await mockApi(page,{orderingEnabled:true});
  await page.goto('/');
  await page.locator('#aeHomeArea').fill('Gulha Circle');
  await page.locator('#aeHomeAreaSubmit').click();
  await expect(page).toHaveURL(/\/restaurants\?area=Gulha\+Circle$/);
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('published location details match');
  const card=page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'}).first();
  await expect(card).toBeVisible();
  await expect(page.locator('.restaurant-card').filter({hasText:'Jumeirah Fast Food'})).toHaveCount(0);

  await page.locator('#aeBrowseAreaTrigger').click();
  const deliveryDialog=page.locator('#aeBrowseAreaDialog');
  await expect(deliveryDialog).toBeVisible();
  await deliveryDialog.locator('#aeBrowseAreaInput').fill('Gulha Circle');
  const quoteRequest=page.waitForRequest(request=>request.url().includes('/orders.quote'));
  await deliveryDialog.locator('#aeBrowseAreaForm button[type="submit"]').click();
  await quoteRequest;
  await expect(deliveryDialog.locator('#aeBrowseAreaStatus')).toContainText('Address check complete');
  await expect(card).toContainText('AFN 60');
  await deliveryDialog.getByRole('button', { name: 'Close' }).click();
  await expect(deliveryDialog).toBeHidden();

  await card.click();
  await expect(page.locator('#menuContent')).toContainText('Kebab');
  await page.locator('.add-btn').click();
  await expect(page.locator('#itemModal')).toHaveClass(/open/);
  await expect(page.locator('#itemModal')).toHaveAttribute('role','dialog');
  await expect(page.locator('#itemModal')).toHaveAttribute('aria-modal','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#itemModal')).not.toHaveClass(/open/);
  await page.locator('.add-btn').click();
  await expect(page.locator('#itemModal button[onclick="addCurrent()"]')).toBeEnabled();
  await page.locator('#itemModal button[onclick="addCurrent()"]') .click();
  await expect(page.locator('#mobileBasketBar')).toHaveClass(/show/);
  await page.locator('#mobileBasketBar').click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Delivery confirmed');
  await expect(page.locator('#cartDelivery')).toContainText('60');
  await page.locator('label:has(input[name="fulfillment"][value="pickup"])').click();
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Pickup selected');
  await expect(page.locator('.delivery-only').first()).toHaveClass(/hidden/);
});

test('manual delivery address refreshes restaurant quotes without basket or order data', async ({page})=>{
  const quoteRequests=[];
  const orderWrites=[];
  const address='Tank Markaz Street, Herat';
  await mockApi(page,{quoteHandler:async(route,input)=>{
    quoteRequests.push({method:route.request().method(),input});
    await route.fulfill({status:200,contentType:'application/json',body:trpc({...quote,restaurantId:input.restaurantId})});
  }});
  page.on('request',request=>{
    if(new URL(request.url()).pathname.endsWith('/orders.place'))orderWrites.push(request);
  });
  await page.addInitScript(()=>localStorage.setItem('ae_mode','pickup'));
  await page.goto('/restaurants');
  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  const cartBefore=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  await expect(page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'}).first()).toBeVisible();
  await page.locator('#aeBrowseAreaTrigger').click();
  const dialog=page.locator('#aeBrowseAreaDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('does not use your basket or place an order');
  await expect(dialog).toContainText('ordering remains paused');
  await expect(page.locator('#aeBrowseAreaInput')).toHaveAttribute('autocomplete','street-address');
  await page.locator('#aeBrowseAreaInput').fill(address);
  const quoteRequest=page.waitForRequest(request=>new URL(request.url()).pathname.endsWith('/orders.quote'));
  await page.locator('#aeBrowseAreaForm button[type="submit"]').click();
  const request=await quoteRequest;
  expect(request.method()).toBe('GET');
  const input=JSON.parse(new URL(request.url()).searchParams.get('input')).json;
  expect(Object.keys(input).sort()).toEqual(['deliveryAddress','deliveryArea','fulfillment','restaurantId']);
  expect(input).toMatchObject({restaurantId:restaurant.id,fulfillment:'delivery',deliveryArea:address,deliveryAddress:address});
  await expect(dialog.locator('#aeBrowseAreaStatus')).toContainText('Address check complete');
  await expect(page.locator('#aeBrowseAreaName')).toHaveText(address);
  const card=page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'}).first();
  await expect(card).toContainText('AFN 60');
  await expect(card).toContainText('Delivery 25–40 min');
  expect(await page.evaluate(()=>localStorage.getItem('ae_address'))).toBe(address);
  expect(await page.evaluate(()=>localStorage.getItem('ae_mode'))).toBe('delivery');
  expect(await page.evaluate(()=>localStorage.getItem('ae_cart'))).toBe(cartBefore);
  expect(quoteRequests.length).toBeGreaterThan(0);
  for(const entry of quoteRequests){
    expect(entry.method).toBe('GET');
    expect(Object.keys(entry.input).sort()).toEqual(['deliveryAddress','deliveryArea','fulfillment','restaurantId']);
    expect(entry.input.fulfillment).toBe('delivery');
    expect(entry.input.deliveryArea).toBe(address);
    expect(entry.input.deliveryAddress).toBe(address);
  }
  expect(orderWrites).toHaveLength(0);
});

test('an unavailable quote for a changed address cannot leave a previous fee visible', async ({page})=>{
  const oldAddress='Previous street, Herat';
  const newAddress='New unconfirmed street';
  const quotedAddresses=[];
  await mockApi(page,{quoteHandler:async(route,input)=>{
    quotedAddresses.push(input.deliveryAddress);
    if(input.deliveryAddress===oldAddress){
      await route.fulfill({status:200,contentType:'application/json',body:trpc({...quote,restaurantId:input.restaurantId})});
      return;
    }
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Delivery is not available for this address'}}})});
  }});
  await page.addInitScript(({address})=>{
    localStorage.setItem('ae_mode','delivery');
    localStorage.setItem('ae_address',address);
  },{address:oldAddress});
  await page.goto('/restaurants');
  const card=page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'}).first();
  await expect(card).toContainText('AFN 60');
  await page.locator('#aeBrowseAreaTrigger').click();
  await page.locator('#aeBrowseAreaInput').fill(newAddress);
  await page.locator('#aeBrowseAreaForm button[type="submit"]').click();
  await expect(page.locator('#aeBrowseAreaStatus')).toContainText('No current address-specific quote was returned');
  await expect.poll(()=>page.evaluate(id=>{
    const current=typeof restaurants==='undefined'?null:restaurants.find(row=>row.id===id);
    return Boolean(current?._deliveryQuote);
  },restaurant.id)).toBe(false);
  await expect(page.locator('.restaurant-card').filter({hasText:'Jumeirah Fast Food'})).toBeVisible();
  expect(quotedAddresses).toContain(oldAddress);
  expect(quotedAddresses).toContain(newAddress);
});

test('a changed address supersedes an in-flight quote for the previous address', async ({page})=>{
  const oldAddress='Slow previous street, Herat';
  const newAddress='Fresh new street, Herat';
  let releaseOldQuote;
  let signalOldStarted;
  let signalNewStarted;
  const oldQuoteGate=new Promise(resolve=>{releaseOldQuote=resolve});
  const oldStarted=new Promise(resolve=>{signalOldStarted=resolve});
  const newStarted=new Promise(resolve=>{signalNewStarted=resolve});
  await mockApi(page,{quoteHandler:async(route,input)=>{
    if(input.deliveryAddress===oldAddress){
      signalOldStarted();
      await oldQuoteGate;
      await route.fulfill({status:200,contentType:'application/json',body:trpc({...quote,restaurantId:input.restaurantId,deliveryFee:99})});
      return;
    }
    signalNewStarted(input);
    await route.fulfill({status:200,contentType:'application/json',body:trpc({...quote,restaurantId:input.restaurantId,deliveryFee:60})});
  }});
  await page.addInitScript(({address})=>{
    localStorage.setItem('ae_mode','delivery');
    localStorage.setItem('ae_address',address);
  },{address:oldAddress});
  await page.goto('/restaurants');
  await oldStarted;
  await page.locator('#aeBrowseAreaTrigger').click();
  await page.locator('#aeBrowseAreaInput').fill(newAddress);
  await page.locator('#aeBrowseAreaForm button[type="submit"]').click();
  const newInput=await newStarted;
  expect(newInput.deliveryAddress).toBe(newAddress);
  await expect(page.locator('#aeBrowseAreaStatus')).toContainText('Address check complete');
  const card=page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'}).first();
  await expect(card).toContainText('AFN 60');
  const oldRequestFinished=page.waitForEvent('requestfinished',request=>{
    try {
      const url=new URL(request.url());
      return url.pathname.endsWith('/orders.quote') && JSON.parse(url.searchParams.get('input')).json.deliveryAddress===oldAddress;
    } catch { return false; }
  });
  releaseOldQuote();
  await oldRequestFinished;
  await expect(card).toContainText('AFN 60');
  await expect(card).not.toContainText('AFN 99');
});

test('photo-free dishes receive bilingual local illustrations without remote image requests', async ({page})=>{
  const photoFreeMenu={categories:menu.categories,items:[
    {...menu.items[0],image_url:null},
    {...menu.items[0],id:'kebab-empty-image',name:'Kebab without image URL',image_url:''}
  ]};
  const imageRequests=[];
  page.on('request',request=>{if(request.resourceType()==='image'&&!new URL(request.url()).pathname.endsWith('/food-placeholder.svg'))imageRequests.push(request.url())});
  await mockApi(page,{orderingEnabled:true,menuData:photoFreeMenu});
  await page.goto('/restaurant.html?id=test-restaurant');
  const menuCards=page.locator('.menu-item');
  await expect(menuCards).toHaveCount(2);
  const menuImages=page.locator('.menu-item-media img');
  await expect(menuImages).toHaveCount(2);
  await expect(page.locator('.menu-image-illustration')).toHaveCount(2);
  await expect(menuCards.first()).toContainText('Illustration · تصویر نمونه');
  await expect(menuCards.first()).toContainText('Not an actual dish photo · عکس واقعی غذا نیست');
  const pageOrigin=new URL(page.url()).origin;
  for(const image of await menuImages.all()){
    const imageUrl=new URL(await image.evaluate(node=>node.src));
    expect(imageUrl.origin).toBe(pageOrigin);
    expect(imageUrl.pathname).toMatch(/^\/assets\/menu-item-images\//);
    await expect(image).toHaveJSProperty('complete',true);
    await expect.poll(()=>image.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
  }
  await menuCards.first().locator('.add-btn').click();
  await expect(page.locator('#itemModal')).toHaveClass(/open/);
  await expect(page.locator('#itemModal img')).toHaveCount(0);
  await page.locator(`#itemModal button[onclick="addCurrent()"]`).click();
  await expect(page.locator('#mobileBasketBar')).toHaveClass(/show/);
  expect(imageRequests.length).toBeGreaterThan(0);
  for(const url of imageRequests){
    const imageUrl=new URL(url);
    expect(imageUrl.origin).toBe(pageOrigin);
    expect(imageUrl.pathname).toMatch(/^\/assets\/menu-item-images\//);
  }
});

test('checkout submits a real order payload and opens order confirmation', async ({page})=>{
  await mockApi(page,{orderingEnabled:true});
  await page.addInitScript(({restaurant,menu})=>{
    localStorage.setItem('ae_cart',JSON.stringify([{id:menu.items[0].id,restaurantId:restaurant.id,restaurantName:restaurant.name,name:menu.items[0].name,price:menu.items[0].price,qty:1,selections:[]} ]));
    localStorage.setItem('ae_mode','delivery');
    localStorage.setItem('ae_address','Gulha Circle');
  },{restaurant,menu});
  await page.goto('/checkout');
  await page.locator('input[name="name"]').fill('Test Customer');
  await page.locator('input[name="phone"]').fill('+93 700 000 123');
  await page.locator('select[name="district"]').selectOption('Gulha');
  await page.locator('input[name="address"]').fill('Gulha Circle');
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Delivery confirmed');
  const orderRequest=page.waitForRequest(request=>request.url().endsWith('/orders.place')&&request.method()==='POST');
  await page.getByRole('button',{name:'Place order'}).click();
  const request=await orderRequest;
  const payload=request.postDataJSON().json;
  expect(payload).toMatchObject({
    restaurantId:restaurant.id,
    customerName:'Test Customer',
    customerPhone:'+93 700 000 123',
    deliveryArea:'Gulha',
    deliveryAddress:'Gulha Circle',
    fulfillment:'delivery',
    items:[{id:'kebab',quantity:1,selections:[]}]
  });
  expect(payload.clientRequestId).toBeTruthy();
  await expect(page).toHaveURL(/\/order(?:\.html)?\?id=33333333-3333-4333-8333-333333333333$/);
});

test('a late quote cannot replace the fee for the latest checkout address', async ({page})=>{
  const requests=[];
  await mockApi(page,{orderingEnabled:true,quoteHandler:async(route,input)=>{
    if(input.fulfillment!=='delivery'||!['Gulha Circle','Tank Markaz Street'].includes(input.deliveryAddress)){
      const value=input.fulfillment==='pickup'?{...quote,fulfillment:'pickup',deliveryFee:0,zone:null,source:'pickup'}:quote;
      await route.fulfill({status:200,contentType:'application/json',body:trpc(value)});
      return;
    }
    let finish;
    const completed=new Promise(resolve=>{finish=resolve});
    let responded=false;
    requests.push({input,respond:async value=>{
      if(responded)return;
      responded=true;
      await route.fulfill({status:200,contentType:'application/json',body:trpc(value)});
      finish();
    }});
    return completed;
  }});
  await page.addInitScript(({restaurant,menu})=>{
    localStorage.setItem('ae_cart',JSON.stringify([{id:menu.items[0].id,restaurantId:restaurant.id,restaurantName:restaurant.name,name:menu.items[0].name,price:menu.items[0].price,qty:1,selections:[]} ]));
    localStorage.setItem('ae_mode','delivery');
    localStorage.setItem('ae_address','Gulha Circle');
  },{restaurant,menu});
  await page.goto('/checkout');
  await expect.poll(()=>requests.some(request=>request.input.deliveryAddress==='Gulha Circle')).toBe(true);
  await page.locator('input[name="name"]').fill('Test Customer');
  await page.locator('input[name="phone"]').fill('+93 700 000 123');
  await page.locator('input[name="address"]').fill('Tank Markaz Street');
  await expect.poll(()=>requests.some(request=>request.input.deliveryAddress==='Tank Markaz Street')).toBe(true);
  await page.waitForTimeout(300);
  const oldRequests=requests.filter(request=>request.input.deliveryAddress==='Gulha Circle');
  const newRequests=requests.filter(request=>request.input.deliveryAddress==='Tank Markaz Street');
  const oldRequest=oldRequests[oldRequests.length-1];
  const newRequest=newRequests[newRequests.length-1];
  expect(oldRequest).toBeTruthy();
  expect(newRequest).toBeTruthy();
  const submit=page.getByRole('button',{name:'Place order'});
  await expect(submit).toBeDisabled();

  const latestQuote={...quote,deliveryFee:25,zone:{id:'tank-markaz',name:'Tank Markaz',nameDari:'تانک مرکز'}};
  const staleQuote={...quote,deliveryFee:95,zone:{id:'gulha',name:'Gulha',nameDari:'گل‌ها'}};
  await newRequest.respond(latestQuote);
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Tank Markaz');
  await expect(page.locator('#cartDelivery')).toContainText('25');
  await expect(submit).toBeEnabled();
  await oldRequest.respond(staleQuote);

  await expect(page.locator('#deliveryQuotePanel')).toContainText('Tank Markaz');
  await expect(page.locator('#deliveryQuotePanel')).not.toContainText('Gulha');
  await expect(page.locator('#cartDelivery')).toContainText('25');
  await Promise.all(requests.map(request=>request.respond(request.input.deliveryAddress==='Tank Markaz Street'?latestQuote:staleQuote)));
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Tank Markaz');
  await expect(page.locator('#cartDelivery')).toContainText('25');
  await expect(submit).toBeEnabled();
});

test('Dari customer chrome and discovery stay localized', async ({page})=>{
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('.lang')).toHaveAccessibleName('Switch language to Dari');
  await page.evaluate(()=>{localStorage.setItem('ae_lang','fa');localStorage.setItem('ae_mode','pickup')});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('.lang')).toHaveAccessibleName('تغییر زبان به انگلیسی');
  await page.goto('/restaurants');
  await expect(page.locator('.mode-tabs button[data-mode="pickup"]')).toContainText('دریافت حضوری');
  await expect(page.locator('.restaurant-card').first()).toContainText('آشپزخانه هرات');
  await expect(page.locator('.restaurant-card').first()).toContainText('افغانی');
  await expect(page.locator('#search')).toHaveAttribute('placeholder',/رستورانت/);
  await expect(page.locator('.lang')).toHaveAccessibleName('تغییر زبان به انگلیسی');
  await page.goto('/checkout');
  await expect(page.locator('.lang')).toHaveAccessibleName('تغییر زبان به انگلیسی');
});

test('recommended discovery prioritizes orderable restaurants and hides test inventory', async ({page})=>{
  const testListing={...directoryListing,id:'test-row-uuid',slug:'test-one-resturant',name:'Test One Resturant',name_dari:'رستورانت آزمایشی'};
  await mockApi(page,{restaurants:[directoryListing,testListing,restaurant]});
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card').first()).toContainText('Herat Kitchen');
  await expect(page.getByText('Test One Resturant',{exact:true})).toHaveCount(0);
  await expect(page.locator('#resultCount')).toContainText('listings');
  await expect(page.locator('#resultCount')).not.toContainText('available to order');
});

test('focused homepage omits duplicate restaurant cards while public menu browsing remains available', async ({page})=>{
  const preview={...restaurant,id:'preview-only',slug:'preview-only',name:'Preview Only Restaurant',verification_status:'public_seeded',menu_preview_only:true};
  const testListing={...restaurant,id:'test-row-uuid',slug:'test-one-resturant',name:'Test One Resturant',verification_status:'public_seeded'};
  await mockApi(page,{restaurants:[preview,testListing,restaurant]});
  await page.goto('/');
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#homeRestaurants')).toHaveCount(1);
  await page.waitForTimeout(1200);
  await expect(page.getByText('Preview Only Restaurant',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Test One Resturant',{exact:true})).toHaveCount(0);
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card').filter({hasText:'Herat Kitchen'})).toBeVisible();
  await expect(page.locator('.restaurant-card').filter({hasText:'Preview Only Restaurant'})).toBeVisible();
  await expect(page.getByText('Test One Resturant',{exact:true})).toHaveCount(0);
});

test('stable restaurant slugs resolve the live record and remain canonical', async ({page})=>{
  const liveCharFasl={...restaurant,id:'d490f576-1690-42c9-a548-c58831a07b9c',slug:'char-fasl-restaurant',name:'Char Fasl Restaurant',name_dari:'رستورانت چهار فصل',verification_status:'public_seeded'};
  await mockApi(page,{restaurants:[liveCharFasl]});
  await page.goto('/restaurant.html?id=char-fasl-restaurant');
  await expect(page.locator('#storeHero')).toContainText('Char Fasl Restaurant');
  expect(await page.evaluate(()=>window.currentRestaurant?.id)).toBe(liveCharFasl.id);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://afghaneats.net/restaurant?id=char-fasl-restaurant');
});

test('unknown restaurant links show a real not-found state', async ({page})=>{
  await mockApi(page);
  await page.goto('/restaurant.html?id=missing-restaurant');
  await expect(page.locator('.restaurant-not-found')).toContainText('Restaurant not found');
  await expect(page.locator('.restaurant-not-found a')).toHaveAttribute('href','/restaurants');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');
  expect(await page.evaluate(()=>window.currentRestaurant)).toBeNull();
});

test('failed restaurant images reveal a branded fallback instead of an empty card', async ({page})=>{
  const broken={...restaurant,id:'broken-photo-restaurant',slug:'broken-photo-restaurant',name:'Broken Photo Kitchen',cover_image_url:'https://images.example.invalid/missing.jpg'};
  await page.route('https://images.example.invalid/**',route=>route.abort());
  await mockApi(page,{restaurants:[broken]});
  await page.goto('/restaurants');
  const card=page.locator('.restaurant-card').filter({hasText:'Broken Photo Kitchen'});
  await expect(card.locator('img')).toBeHidden();
  await expect(card.locator('.media-fallback')).toBeVisible();
  await expect(card.locator('.media-fallback')).toContainText('Broken Photo Kitchen');
});

test('checkout schedule language does not leak across English and Dari', async ({page})=>{
  await mockApi(page,{orderingEnabled:true});
  await page.goto('/checkout');
  const later=page.locator('label:has(input[name="scheduleMode"][value="later"]) > span');
  await expect(later).toHaveText('Later');
  await expect(page.getByText('بعداً',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));
  await page.reload();
  await expect(later).toHaveText('بعداً');
});

test('public Herat directory listings retain sourced menus when no live catalog exists', async ({page})=>{
  await mockApi(page);
  await page.route('https://afghaneats-api.onrender.com/api/trpc/restaurants.getMenu**',async route=>route.fulfill({status:200,contentType:'application/json',body:trpc({categories:[],items:[]})}));
  await page.goto('/restaurants');
  const search=page.locator('#search');
  await search.fill('Jumeirah');
  await expect(page.locator('.restaurant-card')).toHaveCount(1);
  const listing=page.locator('.restaurant-card').first();
  await expect(listing).toContainText('Jumeirah Fast Food');
  await expect(listing).toContainText('Public listing');
  await expect(listing).toContainText('Ordering not active yet');
  await expect(listing.locator('img')).toHaveAttribute('src',/Jumeirah%20Fast%20Food/);
  await listing.click();
  await expect(page.locator('.directory-detail')).toContainText('Ordering not active yet');
  await expect(page.locator('.directory-detail a[href^="tel:"]')).toHaveCount(3);
  await expect(page.locator('.directory-contact-list a[target="_blank"]')).toHaveCount(0);
  await expect(page.locator('.directory-menu-head a[target="_blank"]')).toHaveCount(0);
  await expect(page.locator('.directory-detail')).toContainText('Items and prices below were copied from a public restaurant source.');
  await expect(page.locator('.directory-detail')).toContainText('Public menu');
  await expect(page.locator('.directory-detail')).toContainText('Jumeirah Special Burger');
  await expect(page.locator('.directory-detail')).toContainText('؋ 200');
  await expect(page.locator('.directory-detail .add-btn')).toHaveCount(0);
  await expect(page.locator('.cart-panel')).toHaveClass(/hidden/);
});

test('a claimed restaurant uses its owner-managed menu instead of the public source seed', async ({page})=>{
  const claimed={...directoryListing,status:'active',listing_mode:null,is_open:true,has_delivery:true,has_takeaway:true,verification_status:'owner_confirmed'};
  await mockApi(page,{restaurants:[restaurant,claimed]});
  await page.goto('/restaurant.html?id=jumeirah-fast-food-herat');
  await expect(page.locator('#menuContent')).toContainText('Kebab');
  await expect(page.locator('.directory-detail')).toHaveCount(0);
  await expect(page.locator('.add-btn')).toHaveCount(1);
});

test('a public listing can be claimed without creating or activating another restaurant', async ({page})=>{
  await mockApi(page);
  await page.goto('/claim?restaurant=jumeirah-fast-food-herat');
  await expect(page.locator('#claimRestaurantSummary')).toContainText('Jumeirah Fast Food');
  await page.locator('input[name="claimantName"]').fill('Restaurant Owner');
  await page.locator('#restaurantClaimForm input[name="phone"]').fill('+93 700 000 001');
  await page.locator('#restaurantClaimForm input[name="email"]').fill('owner@example.com');
  await page.locator('textarea[name="evidenceNotes"]').fill('I own this restaurant. Please call the published restaurant number in the afternoon.');
  await page.getByRole('button',{name:'Submit verified claim'}).click();
  await expect(page.locator('#restaurantClaimResult')).toContainText('AEC-20260811-TEST01');
  await expect(page.locator('#restaurantClaimResult')).toContainText('published restaurant number');
});

test('a scoped restaurant owner can build a menu and maintain the public profile', async ({page})=>{
  test.setTimeout(90_000);
  const ownerRestaurant={...restaurant,status:'pending',is_open:false,opening_hours:{monday:'09:00-22:00',tuesday:'09:00-22:00',wednesday:'09:00-22:00',thursday:'09:00-22:00',friday:'closed',saturday:'09:00-22:00',sunday:'09:00-22:00'}};
  const ownerMenu={categories:[...menu.categories],items:[...menu.items]};
  await page.addInitScript(()=>{sessionStorage.setItem('ae_portal_token','owner-test-token');sessionStorage.setItem('ae_portal_role','owner');sessionStorage.setItem('ae_portal_account',JSON.stringify({role:'owner'}))});
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**',async route=>{
    const path=new URL(route.request().url()).pathname.split('/').pop();
    const input=route.request().method()==='POST'?JSON.parse(route.request().postData()||'{"json":{}}').json:null;
    let data=[];
    if(path==='portal.me')data={id:'owner-account',username:'+93700000001',role:'owner',restaurantId:ownerRestaurant.id};
    else if(path==='portal.ownerDashboard')data={restaurant:ownerRestaurant,orders:[],stats:{orders_today:0,delivered_gmv:0,cancelled_today:0}};
    else if(path==='portal.ownerMenu')data=ownerMenu;
    else if(path==='portal.ownerChangeHistory')data=[];
    else if(path==='portal.ownerUploadImage')data={url:'https://images.example.com/bolani.webp'};
    else if(path==='portal.ownerUpsertMenuItem'){
      ownerMenu.items.push({id:'new-bolani',restaurant_id:ownerRestaurant.id,category_id:input.categoryId,name:input.name,name_dari:input.nameDari,description:input.description,description_dari:input.descriptionDari,price:input.price,image_url:input.imageUrl,is_available:input.isAvailable,is_popular:input.isPopular,is_vegetarian:input.isVegetarian,is_spicy:input.isSpicy,sort_order:input.sortOrder,archived_at:null});
      data={success:true,item:ownerMenu.items.at(-1)};
    }
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
  await page.route('**/portal.ownerUpdateRestaurantContent',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:trpc({success:true})});
  });
  await page.goto('/owner');
  await expect(page.locator('#ownerTitle')).toHaveText('Herat Kitchen');
  await expect(page.locator('#ownerActivationNotice')).toContainText('still in onboarding');
  await page.getByRole('button',{name:'Menu'}).click();
  await page.locator('#ownerItemForm input[name="name"]').fill('Bolani');
  await page.locator('#ownerItemForm input[name="nameDari"]').fill('بولانی');
  await page.locator('#ownerItemForm textarea[name="description"]').fill('Filled flatbread');
  await page.locator('#ownerItemForm input[name="price"]').fill('120');
  await page.locator('#ownerItemForm select[name="categoryId"]').selectOption('main');
  expect(await page.locator('#ownerItemForm').evaluate(form=>form.checkValidity())).toBe(true);
  await page.locator('#ownerItemImageFile').setInputFiles({name:'bolani.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJxQAAAAASUVORK5CYII=','base64')});
  await expect(page.locator('#ownerItemForm input[name="imageUrl"]')).toHaveValue('https://images.example.com/bolani.webp');
  const menuSaveRequest=page.waitForRequest(request=>request.url().endsWith('/portal.ownerUpsertMenuItem'));
  await page.locator('#ownerItemForm').getByRole('button',{name:'Save item'}).click();
  const menuRequest=await menuSaveRequest;
  expect(menuRequest.postDataJSON().json).toMatchObject({name:'Bolani',nameDari:'بولانی',price:120,categoryId:'main',isAvailable:true,imageUrl:'https://images.example.com/bolani.webp'});
  await page.getByRole('button',{name:'Store & profile'}).click();
  const profileForm=page.locator('#ownerProfileForm');
  await profileForm.evaluate(form=>{
    const values={name:'Herat Kitchen',nameDari:'آشپزخانه هرات',description:'Family Afghan restaurant',descriptionDari:'رستورانت خانوادگی افغانی',address:'Gulha Circle, Herat',addressDari:'هرات، گل‌ها',district:'Gulha',phone:'+93 700 000 111',logoUrl:'https://images.example.com/logo.jpg',coverImageUrl:'https://images.example.com/cover.jpg'};
    for(const [name,value] of Object.entries(values)){const control=form.elements.namedItem(name);if(control)control.value=value;}
  });
  expect(await profileForm.evaluate(form=>form.checkValidity())).toBe(true);
  await expect(profileForm.getByRole('button',{name:'Save restaurant profile'})).toBeEnabled();
  expect(await page.evaluate(()=>typeof window.saveOwnerProfile)).toBe('function');
});

test('a rider can complete a protected delivery without exposing closed-job customer details', async ({page})=>{
  test.setTimeout(45_000);
  const rider={id:'rider-test',full_name:'Farid Rider',phone:'+93 700 000 091',vehicle:'motorcycle',service_area:'Herat City',status:'active',is_available:false,total_deliveries:17,cash_balance:850};
  const assignment={id:'11111111-1111-4111-8111-111111111111',order_id:'22222222-2222-4222-8222-222222222222',order_number:'AE-1051',status:'on_the_way',items:[{quantity:2,name:'Bolani'}],total:410,delivery_address:'Gulha Circle, Herat',delivery_phone:'+93 700 000 033',order_notes:'Call at the gate',restaurant_name:'Herat Kitchen',restaurant_address:'Jada-e-Maiwand, Herat',restaurant_phone:'+93 700 000 044',assigned_at:new Date().toISOString(),picked_up_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const proof={active:{assignmentId:assignment.id,orderId:assignment.order_id,orderNumber:assignment.order_number,status:assignment.status,address:assignment.delivery_address,location:{latitude:34.3529,longitude:62.2040,accuracyM:15,updatedAt:new Date().toISOString()},pinEnabled:true,pinVerified:false,distanceKm:1.2,roughEtaMinutes:7}};
  let pinPayload=null,deliveryPayload=null;
  await page.addInitScript(()=>{sessionStorage.setItem('ae_portal_token','rider-test-token');sessionStorage.setItem('ae_portal_role','rider');sessionStorage.setItem('ae_portal_account',JSON.stringify({role:'rider'}))});
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**',async route=>{
    const path=new URL(route.request().url()).pathname.split('/').pop(),input=route.request().method()==='POST'?JSON.parse(route.request().postData()||'{"json":{}}').json:null;
    let data=[];
    if(path==='portal.me')data={id:'rider-account',username:rider.phone,role:'rider',riderId:rider.id};
    else if(path==='portal.riderDashboard')data={rider,assignments:[assignment]};
    else if(path==='dispatch.riderSla')data={active:assignment,performance:{deliveries:17,deliveries30d:9,avgAcceptMinutes:1.8,avgDeliveryMinutes:21.4}};
    else if(path==='lastmile.riderContext')data=proof;
    else if(path==='lastmile.riderVerifyPin'){pinPayload=input;proof.active.pinVerified=true;data={success:true,verified:true};}
    else if(path==='portal.riderUpdateAssignment'){deliveryPayload=input;assignment.status=input.status;assignment.updated_at=new Date().toISOString();if(input.status==='delivered'){assignment.delivered_at=new Date().toISOString();rider.total_deliveries+=1;}proof.active=null;data={success:true};}
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
  await page.goto('/rider-portal');
  await expect(page.locator('#riderName')).toHaveText('Farid Rider');
  await expect(page.locator('#riderActive')).toContainText('Herat Kitchen');
  await expect(page.locator('#riderActive')).toContainText('Call at the gate');
  await expect(page.locator('#riderActive').getByRole('button',{name:'Confirm delivered'})).toBeDisabled();
  await page.locator('.rider-pin-form input[name="pin"]').fill('4821');
  await page.locator('.rider-pin-form').getByRole('button',{name:'Verify'}).click();
  expect(pinPayload).toEqual({assignmentId:assignment.id,pin:'4821'});
  await expect(page.locator('#riderActive')).toContainText('Customer code verified');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#riderActive').getByRole('button',{name:'Confirm delivered'}).click();
  expect(deliveryPayload).toEqual({assignmentId:assignment.id,status:'delivered'});
  await expect(page.locator('#riderActive')).toContainText('No active delivery');
  await page.getByRole('button',{name:'Delivery history'}).click();
  await expect(page.locator('#riderPast')).toContainText('AE-1051');
  await expect(page.locator('#riderPast')).not.toContainText('+93 700 000 033');
  await expect(page.locator('#riderPast')).not.toContainText('Gulha Circle');
  await page.getByRole('button',{name:'Performance & safety'}).click();
  await expect(page.locator('#riderPerformance')).toContainText('21.4 min');
  await expect(page.locator('#riderServiceProfile')).toContainText('Herat City');
});

test('saved checkout addresses can be reused without a client-invented promo discount', async ({page})=>{
  await mockApi(page,{orderingEnabled:true});
  await page.addInitScript(({restaurant,menu})=>{
    localStorage.setItem('ae_cart',JSON.stringify([{id:menu.items[0].id,restaurantId:restaurant.id,restaurantName:restaurant.name,name:menu.items[0].name,price:menu.items[0].price,qty:1}]));
    localStorage.setItem('ae_addresses',JSON.stringify([{label:'Home',district:'Gulha',address:'Gulha Circle',landmark:'Near the clinic'}]));
    localStorage.setItem('ae_mode','delivery');
  },{restaurant,menu});
  await page.goto('/checkout');
  const saved=page.locator('#savedAddressChoices button').first();
  await expect(saved).toContainText('Home');
  await saved.click();
  await expect(page.locator('input[name="address"]')).toHaveValue('Gulha Circle');
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Delivery confirmed');
  await page.locator('#promo').fill('WELCOME100');
  await page.getByRole('button',{name:'Apply'}).click();
  await expect(page.locator('#promoMsg')).toContainText('Invalid promo');
  await expect(page.locator('#cartDiscount')).toContainText('0');
});

test('an unavailable delivery address stays separate from area browsing and keeps public menus available', async ({page})=>{
  await mockApi(page,{orderingEnabled:true,deliveryUnavailable:true});
  await page.goto('/restaurants');
  await page.locator('#aeBrowseAreaTrigger').click();
  const dialog=page.locator('#aeBrowseAreaDialog');
  await dialog.locator('#aeBrowseAreaInput').fill('Outside delivery area');
  await dialog.locator('#aeBrowseAreaForm button[type="submit"]').click();
  await expect(dialog.locator('#aeBrowseAreaStatus')).toContainText('No current address-specific quote was returned');
  await expect(dialog.locator('#aeBrowseAreaStatus')).toContainText('Delivery availability is not confirmed');
  const notice=page.locator('.delivery-inline-notice');
  await expect(notice).toContainText('Delivery is not active at this address yet.');
  await expect(notice.getByRole('button',{name:'Change address'})).toBeVisible();
  await expect(page.locator('.delivery-empty')).toHaveCount(0);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toBeVisible();
});

test('one-time admin reset removes its token after a successful password change', async ({page})=>{
  let resetPayload=null;
  await page.route('https://afghaneats-api.onrender.com/api/trpc/auth.resetPassword',async route=>{
    resetPayload=JSON.parse(route.request().postData()||'{}').json;
    await route.fulfill({status:200,contentType:'application/json',body:trpc({success:true})});
  });
  await page.goto('/admin-reset?token=single-use-test-token');
  await page.locator('input[name="newPassword"]').fill('SecureAdmin!2026Herat');
  await page.locator('input[name="confirmPassword"]').fill('SecureAdmin!2026Herat');
  await page.getByRole('button',{name:'Set password'}).click();
  await expect(page.locator('#adminResetResult')).toContainText('Password updated');
  await expect(page).toHaveURL(/\/admin-reset$/);
  expect(resetPayload).toEqual({token:'single-use-test-token',newPassword:'SecureAdmin!2026Herat'});
  await expect(page.locator('#adminResetForm')).toHaveClass(/hidden/);
});


test('Mawlana preview shows the live menu without enabling ordering', async ({page})=>{
  const preview={...restaurant,id:'d273c5f8-d994-4f29-8f1b-fd36851d42d1',slug:'mawlana-restaurant',name:'Mawlana Restaurant',verification_status:'public_seeded',partnership_status:'prospect',owner_confirmed:false,menu_preview_only:true};
  const liveMenu={
    categories:Array.from({length:21},(_,i)=>({id:`live-category-${i}`,name:`Live category ${i}`,name_dari:`دسته ${i}`})),
    items:Array.from({length:165},(_,i)=>({id:`live-dish-${i}`,category_id:`live-category-${i%21}`,name:`Live dish ${i}`,name_dari:`غذای ${i}`,description:'Owner menu photo entry',price:100+i,is_available:true}))
  };
  let menuRequests=0,mutationRequests=0;
  await mockApi(page,{restaurants:[preview]});
  await page.route('https://afghaneats-api.onrender.com/api/trpc/restaurants.getMenu**',async route=>{
    menuRequests++;
    const input=JSON.parse(new URL(route.request().url()).searchParams.get('input')).json;
    expect(input.restaurantId).toBe(preview.id);
    await route.fulfill({status:200,contentType:'application/json',body:trpc(liveMenu)});
  });
  page.on('request',request=>{if(request.method()!=='GET'&&request.url().includes('/api/trpc/'))mutationRequests++});
  await page.goto('/restaurant.html?id=mawlana-restaurant');
  await expect(page.locator('#menuContent .public-menu-item')).toHaveCount(165);
  await expect(page.locator('#directoryMenuBrowser [role="tab"]')).toHaveCount(21);
  await expect(page.getByRole('heading',{name:'Live dish 0',exact:true})).toBeVisible();
  await expect(page.locator('#menuContent')).toContainText('؋ 100');
  await expect(page.locator('#menuContent .add-btn')).toHaveCount(0);
  await expect(page.locator('.cart-panel')).toBeHidden();
  await expect(page.locator('#menuContent')).toContainText('ordering remains disabled');
  expect(await page.evaluate(()=>window.currentRestaurant.menu_preview_only)).toBe(true);
  expect(menuRequests).toBeGreaterThan(0);
  expect(mutationRequests).toBe(0);
});


test('public directory pages prefer the current API catalog over stale source snapshots', async ({page})=>{
  const currentCatalog={
    categories:[{id:'current-directory-category',name:'Current catalog',name_dari:'منوی تازه'}],
    items:[
      {id:'current-directory-item-1',category_id:'current-directory-category',name:'Live Catalog Lamb',name_dari:'بره تازه',description:'Current menu item',price:725,image_url:null,is_available:true},
      {id:'current-directory-item-2',category_id:'current-directory-category',name:'Live Catalog Rice',name_dari:'برنج تازه',description:'Current menu item',price:510,image_url:null,is_available:true}
    ]
  };
  let queriedRestaurantId=null,mutationRequests=0;
  await mockApi(page);
  await page.route('https://afghaneats-api.onrender.com/api/trpc/restaurants.getMenu**',async route=>{
    const input=JSON.parse(new URL(route.request().url()).searchParams.get('input')||'{}').json||{};
    queriedRestaurantId=input.restaurantId;
    await route.fulfill({status:200,contentType:'application/json',body:trpc(currentCatalog)});
  });
  page.on('request',request=>{if(request.method()!=='GET'&&request.url().includes('/api/trpc/'))mutationRequests++});
  await page.goto('/restaurant.html?id=jumeirah-fast-food-herat');
  await expect(page.locator('#storeHero')).toContainText('Public listing');
  await expect(page.locator('.directory-detail')).toContainText('Ordering not active yet');
  await expect(page.locator('.directory-detail')).toContainText('Public menu');
  await expect(page.locator('#menuContent .public-menu-item')).toHaveCount(2);
  await expect(page.locator('#directoryMenuBrowser [role="tab"]')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Live Catalog Lamb',exact:true})).toBeVisible();
  await expect(page.locator('.directory-detail')).toContainText('؋ 725');
  await expect(page.locator('.directory-detail')).not.toContainText('Jumeirah Special Burger');
  await expect(page.locator('.directory-detail .add-btn')).toHaveCount(0);
  await expect(page.locator('.cart-panel')).toHaveClass(/hidden/);
  expect(queriedRestaurantId).toBe(directoryListing.id);
  expect(mutationRequests).toBe(0);
});


const approvedBrowseRestaurants = [
  ['5df516b2-52d2-4c81-b90e-d7e55a034344', 'Arghawan Restaurant'],
  ['char-fasl-food-complex', 'Char Fasl Food Complex'],
  ['5062b505-812d-48be-8079-712fd67a5361', 'Hazar Dastan Café'],
  ['4539c17d-8118-4e62-a112-05d57e2ec330', 'Isteqlal Restaurant'],
  ['e388bc40-04b3-4da7-8d20-35559f65d923', 'Mahtab Restaurant'],
  ['maza-biryani-herat', 'Maza Biryani'],
  ['mr-burger-herat', 'Mr Burger Herat'],
  ['d3008f38-f9a4-4b1c-b8d5-e39be529fb5f', 'Sar Ashpaz'],
  ['dee417e2-7c95-4b4a-8683-0034cec2dccc', 'Shabha-ye Tehran Restaurant'],
  ['683181f3-eac8-4b8e-b609-6007e10a69e7', 'Duniya Kabab'],
  ['a0af9735-5ea0-4dde-aa44-0c5fbb208c2b', 'Navid Restaurant'],
  ['9b3eed54-f239-4d6c-9cc9-9bf10bee3413', 'Padehda Restaurant'],
  ['f0c6fbb1-7e3c-4989-b745-feefa717cc2b', 'Uranus Restaurant'],
].map(([id, name]) => ({
  id,
  slug: id,
  name,
  name_dari: null,
  status: 'active',
  is_open: false,
  has_delivery: id === 'dee417e2-7c95-4b4a-8683-0034cec2dccc',
  has_takeaway: false,
  city: 'Herat',
  address: 'Herat',
  cuisine_tags: ['Afghan'],
  verification_status: 'public_seeded',
  partnership_status: 'prospect',
  public_menu_item_count: 24,
}));

async function clearPublicRestaurantFallbacks(page) {
  for (const file of ['fallback-restaurants.json', 'public-herat-directory.json', 'researched-herat-restaurants.json']) {
    await page.route(`**/data/${file}`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }));
  }
}

test('all 13 approved active restaurants appear as clearly browse-only directory cards', async ({page}) => {
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page, {
    restaurants: approvedBrowseRestaurants,
    menuPreviewRows: approvedBrowseRestaurants.map((restaurant) => ({ id: restaurant.id, menu_item_count: 24 })),
  });
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card.preview-card')).toHaveCount(13);
  for (const restaurant of approvedBrowseRestaurants) {
    await expect(page.getByRole('heading', { name: restaurant.name, exact: true })).toBeVisible();
  }
  await expect(page.locator('.restaurant-card .browse-card-meta').first()).toContainText('Browse only; delivery and online ordering are unavailable');
  await expect(page.locator('.restaurant-card .status-pill')).toHaveCount(13);
  await expect(page.locator('.restaurant-card .add-btn')).toHaveCount(0);
});

test('browse-only restaurant menus show unavailable items but expose no cart or ordering actions', async ({page}) => {
  const target = approvedBrowseRestaurants.find((restaurant) => restaurant.name === 'Duniya Kabab');
  const browseMenu = {
    categories: [{ id: 'duniya-menu', name: 'Menu', name_dari: 'منو', sort_order: 0 }],
    items: [
      { id: 'duniya-dish-1', category_id: 'duniya-menu', name: 'Unavailable Kabab', name_dari: 'کباب ناموجود', description: 'Current menu item', price: 420, is_available: false, sort_order: 0 },
      { id: 'duniya-dish-2', category_id: 'duniya-menu', name: 'Unavailable Rice', name_dari: 'برنج ناموجود', description: 'Current menu item', price: 180, is_available: false, sort_order: 1 },
    ],
  };
  let previewMenuRequests = 0;
  let mutationRequests = 0;
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page, {
    restaurants: [target],
    menuPreviewRows: [{ id: target.id, menu_item_count: 56 }],
    browseMenuData: browseMenu,
  });
  await page.route('https://afghaneats-api.onrender.com/api/trpc/restaurants.getBrowseMenu**', async (route) => {
    previewMenuRequests++;
    const input = JSON.parse(new URL(route.request().url()).searchParams.get('input') || '{}').json || {};
    expect(input.restaurantId).toBe(target.id);
    await route.fulfill({ status: 200, contentType: 'application/json', body: trpc(browseMenu) });
  });
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/trpc/')) mutationRequests++;
  });
  await page.goto(`/restaurant.html?id=${encodeURIComponent(target.id)}`);
  await expect(page.locator('.menu-preview-browse-only')).toContainText('Menu preview · browse only. Delivery and online ordering are unavailable.');
  await expect(page.locator('#menuContent .public-menu-item')).toHaveCount(2);
  await expect(page.locator('#menuContent .menu-item-unavailable')).toHaveCount(2);
  await expect(page.locator('#menuContent .ae-soldout')).toHaveCount(2);
  await expect(page.locator('#menuContent .add-btn')).toHaveCount(0);
  await expect(page.locator('.cart-panel')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.currentMenuItems.every((item) => item.is_available === false))).toBe(true);
  expect(previewMenuRequests).toBeGreaterThan(0);
  expect(mutationRequests).toBe(0);
});

test('zero-item candidates and pending empty-directory records stay hidden', async ({page}) => {
  const zeroItemApprovedCandidate = {
    ...approvedBrowseRestaurants.find((restaurant) => restaurant.name === 'Shabha-ye Tehran Restaurant'),
    public_menu_item_count: 0,
  };
  const zeroItemPendingDirectory = {
    id: 'zero-item-pending-directory',
    name: 'Empty Menu Restaurant',
    status: 'pending',
    listing_mode: 'directory',
    is_open: false,
    has_delivery: false,
    has_takeaway: false,
    public_menu_item_count: 0,
    _items: [],
  };
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page, { restaurants: [zeroItemApprovedCandidate, zeroItemPendingDirectory], menuPreviewRows: [] });
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card')).toHaveCount(0);
  await expect(page.locator('#restaurantGrid')).toContainText('No matches. Try a dish, cuisine or fewer filters.');
});

test('empty, rejected and archived static fallback listings stay hidden', async ({page}) => {
  const staticFallback = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fallback-restaurants.json'), 'utf8'));
  const qoqnoos = staticFallback.find((entry) => entry.restaurant?.id === 'qoqnoos-restaurant');
  expect(qoqnoos).toBeTruthy();
  const fallbackMenu = [{ id: 'fallback-item', category_id: 'fallback-menu', name: 'Fallback item', price: 100, is_available: false }];
  const fallbackRow = (id, name, restaurantFields = {}) => ({
    restaurant: { id, name, status: 'pending', listing_mode: 'directory', is_open: false, has_delivery: false, has_takeaway: false, ...restaurantFields },
    categories: [{ id: 'fallback-menu', name: 'Menu' }],
    items: fallbackMenu,
  });
  const rows = [
    qoqnoos,
    fallbackRow('visible-fallback', 'Nonempty fallback listing'),
    fallbackRow('rejected-fallback', 'Rejected fallback listing', { status: 'active', application_status: 'rejected' }),
    fallbackRow('archived-status-fallback', 'Archived fallback listing', { status: 'archived' }),
    fallbackRow('archived-date-fallback', 'Archived-date fallback listing', { status: 'active', archived_at: '2026-10-31T00:00:00.000Z' }),
  ];
  await page.route('**/data/fallback-restaurants.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(rows),
  }));
  await page.route('**/data/public-herat-directory.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await mockApi(page, { restaurants: [], menuPreviewRows: [] });
  await page.goto('/restaurants');
  await expect(page.getByRole('heading', { name: 'Qoqnoos Restaurant', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Rejected fallback listing', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Archived fallback listing', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Archived-date fallback listing', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nonempty fallback listing', exact: true })).toBeVisible();
});

test('a rejected approved-candidate listing stays hidden even if an old menu snapshot exists', async ({page}) => {
  const rejected = {
    ...approvedBrowseRestaurants.find((restaurant) => restaurant.name === 'Arghawan Restaurant'),
    application_status: 'rejected',
    _items: [{ id: 'stale-item', name: 'Stale snapshot', is_available: true }],
  };
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page, { restaurants: [rejected], menuPreviewRows: [] });
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card')).toHaveCount(0);
  await expect(page.locator('#restaurantGrid')).not.toContainText('Arghawan Restaurant');
});


test('restaurant discovery shows only quoted delivery facts and keeps public menus browsable while ordering is paused', async ({page})=>{
  const noRatings={...restaurant,rating:null,total_reviews:0,delivery_time_min:20,delivery_time_max:35,delivery_fee_min:50};
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{orderingEnabled:false,restaurants:[noRatings]});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/restaurants');

  const card=page.locator('#restaurantGrid .restaurant-card').first();
  await expect(card).toContainText('Herat Kitchen');
  await expect(card.locator('.browse-card-meta')).toContainText('Delivery time pending');
  await expect(card.locator('.browse-card-meta')).toContainText('Fee needs address confirmation');
  await expect(card.locator('.browse-card-meta')).not.toContainText('20–35');
  await expect(card.locator('.browse-card-meta')).not.toContainText('؋ 50');
  await expect(card.locator('.browse-card-reviews')).toContainText('No verified customer rating');
  await expect(page.locator('.restaurant-filter-rail')).toBeVisible();
  await expect(page.locator('#restaurantFilterRail [data-filter="open"]')).toBeVisible();
  await expect(page.locator('#restaurantFilterRail [data-filter="verified"]')).toBeVisible();
  await expect(page.locator('.restaurants-page .mode-tabs button').first()).toBeEnabled();
  await expect(page.locator('.restaurants-page .mode-tabs button[data-mode="pickup"]')).toBeEnabled();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');

  await card.locator('.restaurant-card-link').click();
  await expect(page.locator('#menuContent')).toContainText('Kebab');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  await expect(page.locator('.add-btn:not([disabled])')).toHaveCount(0);
});

test('mobile filters stage before applying and manual address quotes preserve the filtered public list', async ({page})=>{
  const noRatings={...restaurant,rating:null,total_reviews:0};
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[noRatings,directoryListing]});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/restaurants');

  const openFilter=page.locator('#restaurantFilterRail [data-filter="open"]');
  await expect(openFilter).not.toHaveAttribute('hidden');
  await expect(page.locator('#aeMobileFilterOpen')).toBeVisible();
  await page.locator('#aeMobileFilterOpen').click();
  const dialog=page.locator('#aeMobileFiltersDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-stage-filter="open"]').click();
  await expect(dialog.locator('#aeMobileFilterApply')).toContainText('Show 1 restaurant');
  await dialog.locator('[data-stage-reset]').click();
  await expect(dialog.locator('#aeMobileFilterApply')).toContainText('Show 2 restaurants');
  await dialog.locator('[data-stage-filter="open"]').click();
  await dialog.locator('#aeMobileFilterApply').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  await expect(openFilter).toHaveClass(/active/);
  await expect(page.locator('#aeFilterCount')).toHaveText('1');

  await page.locator('[data-restaurant-view="map"]').click();
  await expect(page.locator('#restaurantDiscoveryMapView')).toBeVisible();
  await page.locator('[data-restaurant-view="list"]').click();
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  await expect(openFilter).toHaveClass(/active/);

  await page.locator('#aeBrowseAreaTrigger').click();
  const areaDialog=page.locator('#aeBrowseAreaDialog');
  await expect(areaDialog).toContainText('does not use your basket or place an order');
  await expect(areaDialog).toContainText('ordering remains paused');
  await areaDialog.locator('#aeBrowseAreaInput').fill('Gulha Circle');
  await areaDialog.locator('button[type="submit"]').click();
  await expect(areaDialog.locator('#aeBrowseAreaStatus')).toContainText('Address check complete');
  await expect(page.locator('#aeBrowseAreaName')).toHaveText('Gulha Circle');
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  await expect(page.locator('#aeListingAreaNote')).toContainText('address-specific quote');
});

test('homepage presents premium top-level departments while restaurant cuisines stay on the Restaurants page', async ({page})=>{
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[restaurant,directoryListing]});
  let orderSubmissions=0;
  page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/orders.place'))orderSubmissions+=1;});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  const departments=page.getByRole('navigation',{name:'Marketplace departments'});
  await expect(departments).toBeVisible();
  await expect(departments.locator('[data-department]')).toHaveCount(7);
  await expect(departments.locator('[data-department="alcohol"]')).toHaveCount(0);
  const departmentKeys=await departments.locator('[data-department]').evaluateAll(nodes=>nodes.map(node=>node.dataset.department));
  expect(departmentKeys).toEqual(['restaurants','groceries','health-beauty','convenience','pet-supplies','electronics','gifts']);
  await expect(page.locator('.ae-cuisine-section')).toHaveCount(0);
  await expect(page.locator('.dish-category-row')).toHaveCount(0);
  await expect(departments.locator('a')).toHaveCount(7);
  const restaurantsTile=departments.locator('[data-department="restaurants"]');
  await expect(restaurantsTile).toHaveAttribute('href','/restaurants');
  await expect(restaurantsTile).toContainText('Browse restaurants');
  const restaurantPhoto=departments.locator('img.emblem');
  await expect(restaurantPhoto).toHaveAttribute('src','/assets/market-orbit/emblem.webp');
  await restaurantPhoto.scrollIntoViewIfNeeded();
  await expect.poll(()=>restaurantPhoto.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  const futureDepartments=[
    ['groceries','Groceries','groceries.jpg'],['health-beauty','Health & Beauty','health-beauty.jpg'],
    ['convenience','Convenience','convenience.jpg'],['gifts','Gifts','gifts.jpg'],
    ['electronics','Electronics','electronics.jpg'],['pet-supplies','Pet Supplies','pet-supplies.jpg']
  ];
  for(const [key,label,imageName] of futureDepartments){
    const tile=departments.locator(`[data-department="${key}"]`);
    await expect(tile).toHaveAttribute('href',`/${key}`);
    await expect(tile).toContainText(label);
    await expect(tile.locator('..')).toContainText('Coming soon');
    const photo=tile.locator('..').locator('img');
    await expect(photo).toHaveAttribute('src',`/assets/market-orbit/${key}.webp`);
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(()=>photo.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  }
  await page.setViewportSize({width:390,height:844});
  const mobileDepartmentLayout=await page.evaluate(()=>{
    const row=document.querySelector('ae-market-orbit').shadowRoot.querySelector('ul');
    return{viewport:window.innerWidth,pageWidth:document.documentElement.scrollWidth,rowClientWidth:row.clientWidth,rowScrollWidth:row.scrollWidth,snap:getComputedStyle(row).scrollSnapType};
  });
  expect(mobileDepartmentLayout.pageWidth).toBeLessThanOrEqual(mobileDepartmentLayout.viewport+1);
  expect(mobileDepartmentLayout.rowScrollWidth).toBeGreaterThan(mobileDepartmentLayout.rowClientWidth);
  expect(mobileDepartmentLayout.snap).toContain('x');
  await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const departmentsFa=page.getByRole('navigation',{name:'بخش‌های فروشگاه'});
  await expect(departmentsFa).toBeVisible();
  await expect(departmentsFa.locator('[data-department="restaurants"]')).toContainText('رستورانت‌ها');
  await expect(departmentsFa.locator('[data-department="restaurants"]')).toContainText('دیدن رستورانت‌ها');
  const futureLabelsFa=[
    ['groceries','مواد خوراکی'],['health-beauty','صحت و زیبایی'],
    ['convenience','ضروریات روزانه'],['gifts','هدایا'],['electronics','لوازم الکترونیکی'],['pet-supplies','لوازم حیوانات خانگی']
  ];
  for(const [key,label] of futureLabelsFa){
    const tile=departmentsFa.locator(`[data-department="${key}"]`);
    await expect(tile).toHaveAttribute('href',`/${key}`);
    await expect(tile).toContainText(label);
    await expect(tile.locator('..')).toContainText('به‌زودی');
  }
  await page.goto('/restaurants');
  await expect(page.locator('ae-market-orbit')).toHaveCount(0);
  await expect(page.locator('#aeMarketplaceTabs [data-department]')).toHaveCount(7);
  await expect(page.locator('.dish-category-row')).toBeVisible();
  await expect(page.locator('.dish-category-chip[data-dish-category="kebab"]')).toContainText('کباب');
  expect(orderSubmissions).toBe(0);
});

test('discovery review frames cover English and Dari at desktop, tablet, mobile and 360 px stress widths', async ({page})=>{
  const noRatings={...restaurant,rating:null,total_reviews:0,delivery_time_min:20,delivery_time_max:35,delivery_fee_min:50};
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[noRatings,directoryListing]});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/restaurants');
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(2);
  await expect(page.locator('.ae-department-nav')).toHaveCount(0);
  await expect(page.locator('.dish-category-row')).toBeVisible();
  fs.mkdirSync(path.join(__dirname,'../visual-proof'),{recursive:true});
  const captureWidths=async(locale)=>{
    for(const [width,height,label] of [[1440,1000,'desktop'],[768,1024,'tablet'],[390,844,'mobile'],[360,800,'stress']]){
      await page.setViewportSize({width,height});
      await page.waitForTimeout(100);
      if(width<=390){
        const mobileLayout=await page.evaluate(()=>{
          const tile=document.querySelector('.dish-category-chip')?.getBoundingClientRect();
          const departmentRow=document.querySelector('.ae-department-row');
          const sortGroup=document.querySelector('.restaurant-sort-label')?.getBoundingClientRect();
          const sort=document.querySelector('#sort')?.getBoundingClientRect();
          return{tileFullyVisible:Boolean(tile&&tile.left>=0&&tile.right<=window.innerWidth),sortGroupWidth:sortGroup?.width||0,sortWidth:sort?.width||0,departmentsAbsent:!departmentRow,pageWidth:document.documentElement.scrollWidth};
        });
        expect(mobileLayout.tileFullyVisible).toBe(true);
        expect(mobileLayout.sortGroupWidth).toBeGreaterThanOrEqual(138);
        expect(mobileLayout.sortWidth).toBeGreaterThanOrEqual(90);
        expect(mobileLayout.departmentsAbsent).toBe(true);
        expect(mobileLayout.pageWidth).toBeLessThanOrEqual(width+1);
      }
      await stampFixtureLabel(page);
      await page.screenshot({path:path.join(__dirname,`../visual-proof/restaurant-discovery-review-fixture-${locale}-${label}-${width}x${height}.png`),animations:'disabled'});
    }
  };
  await captureWidths('en');
  const captureAddressDialog=async(locale,label,width,height)=>{
    await page.setViewportSize({width,height});
    await page.locator('#aeBrowseAreaTrigger').click();
    const dialog=page.locator('#aeBrowseAreaDialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(locale==='fa'?'جریان خواندنی نرخ':'read-only quote flow');
    await expect(dialog.locator('#aeBrowseAreaInput')).toHaveAttribute('autocomplete','street-address');
    await dialog.locator('#aeBrowseAreaInput').fill('Gulha Circle, Herat');
    await stampFixtureLabel(page);
    await page.screenshot({path:path.join(__dirname,`../visual-proof/restaurant-discovery-address-dialog-${locale}-${label}-${width}x${height}.png`),animations:'disabled'});
    await dialog.locator('[data-dialog-close]').first().click();
    await expect(dialog).toBeHidden();
  };
  await captureAddressDialog('en','desktop',1440,1000);
  await captureAddressDialog('en','mobile',390,844);
  await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(2);
  await expect(page.locator('#search')).toHaveAttribute('placeholder','رستورانت‌ها، غذاها و دسته‌بندی‌ها');
  await expect(page.locator('.dish-category-chip[data-dish-category="kebab"]')).toContainText('کباب');
  await expect(page.locator('.ae-department-nav')).toHaveCount(0);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('آشپزخانه هرات');
  await expect(page.locator('#restaurantGrid .browse-card-meta').first()).toContainText('زمان ارسال در انتظار تأیید');
  await expect(page.locator('#restaurantGrid .browse-card-meta').first()).not.toContainText('۲۰–۳۵');
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport+1);
  await captureWidths('fa');
  await captureAddressDialog('fa','mobile',390,844);
  const stressWidths=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  expect(stressWidths.document).toBeLessThanOrEqual(stressWidths.viewport+1);
});

test('a late dish-search response cannot replace results for a newer query', async ({page})=>{
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[restaurant]});
  await page.route('https://afghaneats-api.onrender.com/api/dishes**',async route=>{
    const query=new URL(route.request().url()).searchParams.get('q');
    if(query==='kebab') await new Promise(resolve=>setTimeout(resolve,650));
    const dish=query==='kebab'
      ? {name:'Old Kebab Result',restaurantId:restaurant.id,restaurantName:restaurant.name}
      : {name:'Current Pizza Result',restaurantId:restaurant.id,restaurantName:restaurant.name};
    try { await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({dishes:[dish]})}); } catch {}
  });
  await page.goto('/restaurants');
  const search=page.locator('#search');
  const firstRequest=page.waitForRequest(request=>request.url().includes('/api/dishes?q=kebab'));
  await search.fill('kebab');
  await firstRequest;
  await search.fill('pizza');
  await expect(page.locator('#dishResults')).toContainText('Current Pizza Result');
  await page.waitForTimeout(750);
  await expect(page.locator('#dishResults')).not.toContainText('Old Kebab Result');
});


test('phone browse keeps department navigation visible and labels unavailable sort criteria Coming soon', async ({page})=>{
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[{...restaurant,rating:null,total_reviews:0}]});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/restaurants');
  await expect(page.locator('#search')).toHaveAttribute('placeholder','Search restaurants, items, and categories');
  await expect(page.locator('#search')).toHaveAttribute('aria-label','Search restaurants, items, and categories');
  await expect(page.locator('#aeMarketplaceTabs')).toBeVisible();
  await expect(page.locator('#aeMarketplaceTabs [data-department]')).toHaveCount(7);
  await expect(page.locator('.restaurant-sort-label .en-copy')).toBeVisible();
  await expect(page.locator('.restaurant-sort-label')).toContainText('Sort by');
  await expect(page.locator('#sort')).toHaveAttribute('aria-label','Sort by');
  const sortLabelBox=await page.locator('.restaurant-sort-label').boundingBox();
  const sortSelectBox=await page.locator('#sort').boundingBox();
  expect(sortLabelBox.width).toBeGreaterThanOrEqual(138);
  expect(sortSelectBox.width).toBeGreaterThanOrEqual(90);
  for(const value of ['rating','distance','fastest','min-order','fee']){
    const option=page.locator(`#sort option[value="${value}"]`);
    await expect(option).toHaveJSProperty('disabled',true);
    await expect(option).toContainText('Coming soon');
  }
  await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));
  await page.goto('/restaurants');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#sort')).toHaveAttribute('aria-label','مرتب‌سازی بر اساس');
  await expect(page.locator('.restaurant-sort-label .fa-copy')).toBeVisible();
  await expect(page.locator('.restaurant-sort-label .fa-copy')).toContainText('مرتب‌سازی');
  await expect(page.locator('#sort option[value="distance"]')).toContainText('به‌زودی');
});

test('Reviews, ETA, minimum order, and delivery costs sort on known data with unknown values last', async ({page})=>{
  const moreReviews={...restaurant,id:'sort-more-reviews',name:'More Reviews Kitchen',rating:4.7,total_reviews:30};
  const higherQuotes={...restaurant,id:'sort-higher-quotes',name:'Higher Quote Kitchen',rating:4.9,total_reviews:12};
  const unquoted={...restaurant,id:'sort-unquoted',name:'Unquoted Kitchen',rating:null,total_reviews:0};
  const values={
    'sort-more-reviews':{minimumOrder:100,deliveryFee:45,etaMin:20},
    'sort-higher-quotes':{minimumOrder:300,deliveryFee:80,etaMin:35},
    'sort-unquoted':{minimumOrder:null,deliveryFee:null,etaMin:null}
  };
  await page.addInitScript(()=>localStorage.setItem('ae_address','Gulha Circle'));
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[moreReviews,higherQuotes,unquoted],quoteHandler:async(route,input)=>{
    await route.fulfill({status:200,contentType:'application/json',body:trpc({...quote,...values[input.restaurantId],restaurantId:input.restaurantId})});
  }});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/restaurants');
  const cards=page.locator('#restaurantGrid .restaurant-card');
  await expect(cards).toHaveCount(3);
  for(const value of ['rating','fastest','min-order','fee']) await expect(page.locator(`#sort option[value="${value}"]`)).toBeEnabled();
  await page.locator('#sort').selectOption('rating');
  await expect(cards.first()).toContainText('More Reviews Kitchen');
  await expect(cards.last()).toContainText('Unquoted Kitchen');
  for(const value of ['fastest','min-order','fee']){
    await page.locator('#sort').selectOption(value);
    await expect(cards.first()).toContainText('More Reviews Kitchen');
    await expect(cards.last()).toContainText('Unquoted Kitchen');
  }
});

test('pickup never reuses the app delivery ETA as preparation time and delivery-only sort options are hidden', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ae_mode','pickup'));
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[{...restaurant,min_order_amount:500}]});
  await page.goto('/restaurants');
  const meta=page.locator('#restaurantGrid .restaurant-card .browse-card-meta').first();
  await expect(meta).toContainText('Pickup timing not confirmed');
  await expect(meta).not.toContainText('25 min');
  await expect(meta).not.toContainText('Free delivery');
  await expect(meta).not.toContainText('500');
  await expect(page.locator('#sort option[value="fastest"]')).toBeHidden();
  await expect(page.locator('#sort option[value="fee"]')).toBeHidden();
  await expect(page.locator('#sort option[value="min-order"]')).toBeHidden();
});

test('a positive minimum order is shown only when supplied by the matching address quote', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ae_address','Gulha Circle'));
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[{...restaurant,min_order_amount:900}],quoteHandler:async(route,input)=>{
    const value=input.fulfillment==='pickup'
      ? {...quote,fulfillment:'pickup',source:'pickup',pickupEtaMin:12,pickupEtaMax:18,minimumOrder:150}
      : {...quote,minimumOrder:200};
    await route.fulfill({status:200,contentType:'application/json',body:trpc(value)});
  }});
  await page.goto('/restaurants');
  const meta=page.locator('#restaurantGrid .restaurant-card .browse-card-meta').first();
  await expect(meta).toContainText('Minimum order');
  await expect(meta).toContainText('200');
  await expect(meta).not.toContainText('900');
});

test('an unavailable delivery address is distinct from public menu browsing', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ae_address','Outside Herat service area'));
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{deliveryUnavailable:true,restaurants:[restaurant,directoryListing]});
  await page.goto('/restaurants');
  await expect(page.locator('#restaurantGrid .delivery-inline-notice')).toContainText('Delivery is not active at this address yet.');
  await expect(page.locator('#restaurantGrid .directory-results')).toContainText('Jumeirah Fast Food');
  await expect(page.locator('#aeListingAreaNote')).toContainText('Fees and times appear only when a restaurant returns an address-specific quote');
});

test('sparse and unavailable-area review frames are clearly named fixture states', async ({page})=>{
  const sparseListing={...restaurant,rating:null,total_reviews:0,delivery_time_min:null,delivery_time_max:null,delivery_fee_min:null};
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[sparseListing]});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/restaurants');
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  fs.mkdirSync(path.join(__dirname,'../visual-proof'),{recursive:true});
  await stampFixtureLabel(page);
  await page.screenshot({path:path.join(__dirname,'../visual-proof/restaurant-discovery-review-fixture-sparse-en-desktop-1440x1000.png'),animations:'disabled'});

  await page.addInitScript(()=>localStorage.setItem('ae_address','Outside Herat service area'));
  await mockApi(page,{deliveryUnavailable:true,restaurants:[restaurant,directoryListing]});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/restaurants');
  await expect(page.locator('#restaurantGrid .delivery-inline-notice')).toContainText('Delivery is not active at this address yet.');
  await expect(page.locator('#restaurantGrid .directory-results')).toContainText('Jumeirah Fast Food');
  await expect(page.locator('#aeListingAreaNote')).toContainText('address-specific quote');
  await expect(page.locator('#restaurantGrid .directory-card').first()).toBeVisible();
  await page.setViewportSize({width:390,height:1400});
  await stampFixtureLabel(page);
  await page.screenshot({path:path.join(__dirname,'../visual-proof/restaurant-discovery-review-fixture-unavailable-address-en-mobile-full-page.png'),fullPage:true,animations:'disabled'});
});

test('browser Back from a public menu restores discovery search and active filters', async ({page})=>{
  await clearPublicRestaurantFallbacks(page);
  await mockApi(page,{restaurants:[restaurant,directoryListing]});
  await page.setViewportSize({width:1440,height:1000});
  await page.route('https://afghaneats-api.onrender.com/api/dishes**',async route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({dishes:[{name:'Kebab',restaurantId:restaurant.id,restaurantName:restaurant.name}]})
  }));
  await page.goto('/restaurants');
  await page.locator('#search').fill('kebab');
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  const openFilter=page.locator('#restaurantFilterRail [data-filter="open"]');
  await openFilter.click();
  await expect(openFilter).toHaveClass(/active/);
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
  await page.locator('#restaurantGrid .restaurant-card-link').click();
  await expect(page).toHaveURL(/\/restaurant\.html\?id=/);
  await expect(page.locator('#menuContent')).toContainText('Kebab');
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ae_restaurant_discovery_return')||'null'));
  expect(saved?.filters).toContain('open');
  await page.goBack();
  await expect(page).toHaveURL(/\/restaurants(?:\?.*)?$/);
  await expect(page.locator('#search')).toHaveValue('kebab');
  await expect(page.locator('#restaurantFilterRail [data-filter="open"]')).toHaveClass(/active/);
  await expect(page.locator('#restaurantGrid .restaurant-card')).toHaveCount(1);
});

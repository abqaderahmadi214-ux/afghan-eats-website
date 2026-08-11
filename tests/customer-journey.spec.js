const { test, expect } = require('@playwright/test');

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
  cover_image_url:null,logo_url:null,has_delivery:false,has_takeaway:false,status:'pending',is_open:false,rating:null,total_reviews:0,verification_status:'public_seeded',partnership_status:'prospect',listing_mode:'directory'
};

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}
async function mockApi(page,{deliveryUnavailable=false}={}){
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route=>{
    const path = new URL(route.request().url()).pathname;
    let data=[];
    if(path.endsWith('/restaurants.list'))data=[restaurant,directoryListing];
    else if(path.endsWith('/restaurants.getMenu'))data=menu;
    else if(path.endsWith('/orders.quote')){
      const input=JSON.parse(new URL(route.request().url()).searchParams.get('input')||'{"json":{}}').json||{};
      if(deliveryUnavailable&&input.fulfillment!=='pickup'){
        await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Delivery is not available for this address'}}})});
        return;
      }
      data=input.fulfillment==='pickup'?{...quote,fulfillment:'pickup',deliveryFee:0,zone:null,source:'pickup'}:quote;
    }
    else if(path.endsWith('/catalog.publicModifiers'))data={groups:[],options:[],links:[]};
    else if(path.endsWith('/merchant.publicAvailabilityBatch'))data=[];
    else if(path.endsWith('/merchant.publicMenuAvailability'))data=[];
    else if(path.endsWith('/cities.publicCatalog'))data=[];
    else if(path.endsWith('/discovery.trending'))data=[];
    else if(path.endsWith('/operations.applyRestaurantClaim'))data={success:true,duplicate:false,reference:'AEC-20260811-TEST01',status:'pending',restaurantName:directoryListing.name};
    else if(path.endsWith('/operations.restaurantClaimStatus'))data={reference:'AEC-20260811-TEST01',status:'pending',restaurant_name:directoryListing.name};
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
}

test('homepage to restaurant to mobile basket to quoted checkout', async ({page})=>{
  await mockApi(page);
  await page.goto('/');
  await page.locator('.address-box input[name="address"]').fill('Gulha Circle');
  await page.locator('.address-box button').click();
  await expect(page).toHaveURL(/\/restaurants(?:\?.*)?$/);
  const card=page.locator('.restaurant-card').first();
  await expect(card).toContainText('Herat Kitchen');
  await expect(card).toContainText('؋ 60');
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

test('Dari customer chrome and discovery stay localized', async ({page})=>{
  await mockApi(page);
  await page.goto('/');
  await page.evaluate(()=>{localStorage.setItem('ae_lang','fa');localStorage.setItem('ae_mode','pickup')});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('.mode-tabs button[data-mode="pickup"]')).toContainText('دریافت حضوری');
  await page.goto('/restaurants');
  await expect(page.locator('.restaurant-card').first()).toContainText('آشپزخانه هرات');
  await expect(page.locator('.restaurant-card').first()).toContainText('افغانی');
  await expect(page.locator('#search')).toHaveAttribute('placeholder',/رستورانت/);
});

test('public Herat directory listings remain distinct from active Afghan Eats ordering', async ({page})=>{
  await mockApi(page);
  await page.goto('/restaurants');
  const search=page.locator('#search');
  await search.fill('Jumeirah');
  await expect(page.locator('.restaurant-card')).toHaveCount(1);
  const listing=page.locator('.restaurant-card').first();
  await expect(listing).toContainText('Jumeirah Fast Food');
  await expect(listing).toContainText('Public listing');
  await expect(listing).toContainText('Ordering not active yet');
  await listing.click();
  await expect(page.locator('.directory-detail')).toContainText('Ordering not active yet');
  await expect(page.locator('.directory-detail a[href^="tel:"]')).toHaveCount(3);
  await expect(page.locator('.directory-detail a[target="_blank"]')).toHaveAttribute('href',/instagram\.com\/jumeirah/);
  await expect(page.locator('.cart-panel')).toHaveClass(/hidden/);
});

test('a public listing can be claimed without creating or activating another restaurant', async ({page})=>{
  await mockApi(page);
  await page.goto('/claim?restaurant=jumeirah-fast-food-herat');
  await expect(page.locator('#claimRestaurantSummary')).toContainText('Jumeirah Fast Food');
  await page.locator('input[name="claimantName"]').fill('Restaurant Owner');
  await page.locator('#restaurantClaimForm input[name="phone"]').fill('+93 700 000 001');
  await page.locator('textarea[name="evidenceNotes"]').fill('I own this restaurant. Please call the published restaurant number in the afternoon.');
  await page.getByRole('button',{name:'Submit verified claim'}).click();
  await expect(page.locator('#restaurantClaimResult')).toContainText('AEC-20260811-TEST01');
  await expect(page.locator('#restaurantClaimResult')).toContainText('published restaurant number');
});

test('a scoped restaurant owner can build a menu and maintain the public profile', async ({page})=>{
  test.setTimeout(45_000);
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
    else if(path==='portal.ownerUpsertMenuItem'){
      ownerMenu.items.push({id:'new-bolani',restaurant_id:ownerRestaurant.id,category_id:input.categoryId,name:input.name,name_dari:input.nameDari,description:input.description,description_dari:input.descriptionDari,price:input.price,image_url:input.imageUrl,is_available:input.isAvailable,is_popular:input.isPopular,is_vegetarian:input.isVegetarian,is_spicy:input.isSpicy,sort_order:input.sortOrder,archived_at:null});
      data={success:true,item:ownerMenu.items.at(-1)};
    }
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
  await page.route('https://afghaneats-api.onrender.com/api/trpc/portal.ownerUpdateRestaurantContent',async route=>{
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
  const menuSaveRequest=page.waitForRequest(request=>request.url().endsWith('/portal.ownerUpsertMenuItem'));
  await page.locator('#ownerItemForm').getByRole('button',{name:'Save item'}).click();
  const menuRequest=await menuSaveRequest;
  expect(menuRequest.postDataJSON().json).toMatchObject({name:'Bolani',nameDari:'بولانی',price:120,categoryId:'main',isAvailable:true});
  await expect(page.locator('#ownerToast')).toContainText('Menu item saved');
  await expect(page.locator('#ownerMenu')).toContainText('Bolani');
  await page.getByRole('button',{name:'Store & profile'}).click();
  await page.locator('#ownerProfileForm textarea[name="description"]').fill('Family Afghan restaurant');
  await page.locator('#ownerProfileForm input[name="logoUrl"]').fill('https://images.example.com/logo.jpg');
  const profileSaveRequest=page.waitForRequest(request=>request.url().endsWith('/portal.ownerUpdateRestaurantContent'));
  const profileSaveResponse=page.waitForResponse(response=>response.url().endsWith('/portal.ownerUpdateRestaurantContent'));
  await page.locator('#ownerProfileForm').getByRole('button',{name:'Save public profile'}).click();
  const [profileRequest,profileResponse]=await Promise.all([profileSaveRequest,profileSaveResponse]);
  expect(profileRequest.postDataJSON().json).toMatchObject({description:'Family Afghan restaurant',logoUrl:'https://images.example.com/logo.jpg'});
  expect(profileResponse.ok()).toBe(true);
  await expect(page.locator('#ownerToast')).toContainText('Restaurant profile and opening hours saved');
});

test('saved checkout addresses can be reused without a client-invented promo discount', async ({page})=>{
  await mockApi(page);
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

test('an unavailable delivery address offers a clear pickup path', async ({page})=>{
  await mockApi(page,{deliveryUnavailable:true});
  await page.goto('/');
  await page.locator('.address-box input[name="address"]').fill('Outside delivery area');
  await page.locator('.address-box button').click();
  await expect(page.locator('#restaurantGrid')).toContainText('Delivery is not available to this address yet');
  await page.getByRole('button',{name:'Show pickup restaurants'}).click();
  await expect(page.locator('.restaurant-card').first()).toContainText('Herat Kitchen');
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

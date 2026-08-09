const { test, expect } = require('@playwright/test');

const restaurant = {
  id:'test-restaurant',name:'Herat Kitchen',name_dari:'آشپزخانه هرات',description:'Afghan food',description_dari:'غذای افغانی',
  cuisine_tags:['Afghan','Kebab'],category_primary:'Afghan',address:'Gulha Circle, Herat',district:'Gulha',city:'Herat',
  cover_image_url:null,logo_url:null,has_delivery:true,has_takeaway:true,delivery_time_min:20,delivery_time_max:35,
  delivery_fee_min:null,min_order_amount:0,status:'active',is_open:true,rating:4.8,total_reviews:12,verification_status:'owner_confirmed'
};
const menu = {categories:[{id:'main',name:'Main dishes',name_dari:'غذاهای اصلی'}],items:[{id:'kebab',category_id:'main',name:'Kebab',name_dari:'کباب',description:'Freshly prepared kebab',price:250,image_url:null,is_available:true,is_popular:true}]};
const quote = {restaurantId:restaurant.id,fulfillment:'delivery',deliveryFee:60,minimumOrder:0,etaMin:25,etaMax:40,zone:{id:'gulha',name:'Gulha',nameDari:'گل‌ها'},source:'zone'};

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}
async function mockApi(page){
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route=>{
    const path = new URL(route.request().url()).pathname;
    let data=[];
    if(path.endsWith('/restaurants.list'))data=[restaurant];
    else if(path.endsWith('/restaurants.getMenu'))data=menu;
    else if(path.endsWith('/orders.quote'))data=quote;
    else if(path.endsWith('/catalog.publicModifiers'))data={groups:[],options:[],links:[]};
    else if(path.endsWith('/merchant.publicAvailabilityBatch'))data=[];
    else if(path.endsWith('/merchant.publicMenuAvailability'))data=[];
    else if(path.endsWith('/cities.publicCatalog'))data=[];
    else if(path.endsWith('/discovery.trending'))data=[];
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
  await page.locator('input[name="fulfillment"][value="pickup"]').check();
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

const { test, expect } = require('@playwright/test');

const restaurant = {
  id:'test-restaurant',
  name:'Herat Kitchen',
  name_dari:'آشپزخانه هرات',
  cuisine_tags:['Afghan','Kebab'],
  category_primary:'Afghan',
  address:'Gulha Circle, Herat',
  district:'Gulha',
  city:'Herat',
  has_delivery:true,
  has_takeaway:true,
  delivery_time_min:20,
  delivery_time_max:35,
  delivery_fee_min:60,
  min_order_amount:0,
  status:'active',
  is_open:true,
  rating:4.8,
  total_reviews:12,
  verification_status:'owner_confirmed'
};
const menu = {
  categories:[{id:'main',name:'Main dishes',name_dari:'غذاهای اصلی'}],
  items:[{
    id:'kebab',
    category_id:'main',
    name:'Kebab',
    name_dari:'کباب',
    description:'Freshly prepared kebab',
    price:250,
    image_url:null,
    is_available:true,
    is_popular:true
  }]
};
const quote = {
  restaurantId:restaurant.id,
  fulfillment:'delivery',
  deliveryFee:60,
  minimumOrder:0,
  etaMin:25,
  etaMax:40,
  zone:{id:'gulha',name:'Gulha',nameDari:'گل‌ها'},
  source:'zone'
};

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}

async function mockApi(page){
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    let data=[];
    if(path.endsWith('/restaurants.list')) data=[restaurant];
    else if(path.endsWith('/restaurants.getMenu')) data=menu;
    else if(path.endsWith('/orders.quote')){
      let input={};
      try{input=JSON.parse(url.searchParams.get('input')||'{"json":{}}').json||{}}catch{}
      data=input.fulfillment==='pickup'
        ? {...quote,fulfillment:'pickup',deliveryFee:0,zone:null,source:'pickup'}
        : quote;
    }
    else if(path.endsWith('/catalog.publicModifiers')) data={groups:[],options:[],links:[]};
    else if(path.endsWith('/merchant.publicAvailabilityBatch')) data=[];
    else if(path.endsWith('/merchant.publicMenuAvailability')) data=[];
    else if(path.endsWith('/cities.publicCatalog')) data=[];
    else if(path.endsWith('/discovery.trending')) data=[];
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
}

test('ae_cart survives add, reload, cross-page navigation and checkout hydration', async ({page})=>{
  await mockApi(page);
  await page.goto('/restaurant.html?id=test-restaurant');
  await expect(page.locator('#menuContent')).toContainText('Kebab');

  await page.locator('.add-btn').first().click();
  await page.locator('#itemModal button[onclick="addCurrent()"]').click();

  const afterAdd=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  console.log('[CART_PERSISTENCE] after_add='+afterAdd);
  expect(JSON.parse(afterAdd)).toEqual([{
    id:'kebab',
    restaurantId:'test-restaurant',
    restaurantName:'Herat Kitchen',
    name:'Kebab',
    price:250,
    qty:1
  }]);
  await expect(page.locator('.cart-count').first()).toHaveText('1');

  await page.reload();
  const afterReload=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  console.log('[CART_PERSISTENCE] after_reload='+afterReload);
  expect(afterReload).toBe(afterAdd);
  await expect(page.locator('.cart-count').first()).toHaveText('1');

  await page.goto('/restaurants');
  const afterNavigation=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  console.log('[CART_PERSISTENCE] after_restaurants='+afterNavigation);
  expect(afterNavigation).toBe(afterAdd);
  await expect(page.locator('.cart-count').first()).toHaveText('1');

  await page.goto('/checkout');
  const atCheckout=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  console.log('[CART_PERSISTENCE] at_checkout='+atCheckout);
  expect(atCheckout).toBe(afterAdd);
  await expect(page.locator('#cartItems')).toContainText('Kebab');
  await expect(page.locator('.cart-count').first()).toHaveText('1');

  await page.evaluate(async()=>{
    if(!('serviceWorker' in navigator))return;
    const registrations=await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration=>registration.unregister()));
  });
  await page.reload();

  const withoutSw=await page.evaluate(()=>localStorage.getItem('ae_cart'));
  console.log('[CART_PERSISTENCE] after_sw_unregister='+withoutSw);
  expect(withoutSw).toBe(afterAdd);
  await expect(page.locator('#cartItems')).toContainText('Kebab');
  await expect(page.locator('.cart-count').first()).toHaveText('1');
});

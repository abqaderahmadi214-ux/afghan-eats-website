const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT=path.join('test-results','visual-proof');
const orderId='33333333-3333-4333-8333-333333333333';
const active={
  id:'test-restaurant',name:'Herat Kitchen',name_dari:'آشپزخانه هرات',description:'Afghan food',description_dari:'غذای افغانی',
  cuisine_tags:['Afghan','Kebab'],category_primary:'Afghan',address:'Gulha Circle, Herat',district:'Gulha',city:'Herat',
  phone:'+93 700 000 044',cover_image_url:null,logo_url:null,has_delivery:true,has_takeaway:true,delivery_time_min:20,delivery_time_max:35,
  delivery_fee_min:60,min_order_amount:0,status:'active',is_open:true,rating:4.8,total_reviews:12,verification_status:'owner_confirmed',
  _categories:[{id:'main',name:'Main dishes',name_dari:'غذاهای اصلی'}],
  _items:[{id:'kebab',category_id:'main',name:'Kebab',name_dari:'کباب',description:'Freshly prepared kebab',price:250,image_url:null,is_available:true,is_popular:true}]
};
const directory={
  id:'jumeirah-fast-food-herat',name:'Jumeirah Fast Food',name_dari:'فست‌فود جمیرا',description:'Public restaurant listing',description_dari:'فهرست عمومی رستورانت',
  cuisine_tags:['Fast Food','Pizza'],category_primary:'Fast Food',address:'Mokhaberat Road, Herat',address_dari:'هرات، جاده مخابرات',district:'Jade Mokhaberat',city:'Herat',
  phone:'+93 728 778 355',phone2:'+93 728 213 595',phone_numbers:['+93 728 778 355','+93 728 213 595','+93 790 810 167'],
  source_url:'https://www.instagram.com/jumeirah____fastfood/',public_menu_source_url:'https://mizbanapp.com/en/herat/restaurant/jumeirah-fast-food/',
  source_checked_at:'2026-08-09',public_menu_checked_at:'2026-08-09',cover_image_url:null,logo_url:null,has_delivery:false,has_takeaway:false,
  status:'pending',is_open:false,rating:null,total_reviews:0,verification_status:'public_seeded',partnership_status:'prospect',listing_mode:'directory',
  _categories:[{id:'burgers',name:'Burgers',name_dari:'برگر'}],
  _items:[{id:'jum-special',category_id:'burgers',name:'Jumeirah Special Burger',name_dari:'برگر مخصوص جمیرا',description:'Public menu sample',price:200,image_url:null,is_available:true}]
};
const quote={restaurantId:active.id,fulfillment:'delivery',deliveryFee:60,minimumOrder:0,etaMin:25,etaMax:40,zone:{id:'gulha',name:'Gulha',nameDari:'گل‌ها'},source:'zone'};
const order={
  id:orderId,orderId,order_number:'AE-4242',orderNumber:'AE-4242',status:'confirmed',restaurant_name:'Herat Kitchen',restaurantName:'Herat Kitchen',
  restaurant_phone:'+93 700 000 044',delivery_address:'Gulha Circle, Herat',delivery_phone:'+93 700 000 123',payment_method:'cash_on_delivery',
  subtotal:500,delivery_fee:60,service_fee:8,total:568,eta_min:70,eta_max:82,
  items:[{id:'kebab',name:'Kebab',name_dari:'کباب',quantity:2,price:250}]
};
function trpc(data){return JSON.stringify({result:{data:{json:data}}})}
async function mock(page,{deliveryUnavailable=false}={}){
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**',async route=>{
    const u=new URL(route.request().url()),p=u.pathname.split('/').pop();
    if(p==='orders.quote'&&deliveryUnavailable){
      await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Delivery is not available for this address'}}})});return;
    }
    let data=[];
    if(p==='restaurants.list')data=[active,directory];
    else if(p==='restaurants.getMenu')data={categories:active._categories,items:active._items};
    else if(p==='orders.quote')data=quote;
    else if(p==='orders.track')data=order;
    else if(p==='portal.liveTracking')data={status:'confirmed',delivery:null};
    else if(p==='timeline.customer')data={order,events:[],nextCursor:0,pollAfterMs:60000};
    else if(p==='lastmile.customerContext')data={location:null,pin:{enabled:false,verified:false},rider:null};
    else if(p==='catalog.publicModifiers')data={groups:[],options:[],links:[]};
    else if(p==='merchant.publicAvailabilityBatch'||p==='merchant.publicMenuAvailability'||p==='cities.publicCatalog'||p==='discovery.trending')data=[];
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
  await page.route('https://afghaneats-api.onrender.com/api/orders/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({latitude:34.352,longitude:62.204})}));
}
async function snap(page,name){
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(OUT,name),type:'jpeg',quality:76,fullPage:false});
}
test('visual proof 390x844',async({page})=>{
  test.setTimeout(120000);
  fs.mkdirSync(OUT,{recursive:true});
  await mock(page);

  await page.goto('/');
  await page.waitForTimeout(1200);
  await snap(page,'home.jpg');

  await page.addInitScript(()=>{localStorage.setItem('ae_address','Outside delivery area');localStorage.setItem('ae_mode','delivery')});
  await page.unroute('https://afghaneats-api.onrender.com/api/trpc/**');
  await mock(page,{deliveryUnavailable:true});
  await page.goto('/restaurants');
  await page.waitForTimeout(1800);
  await snap(page,'restaurants.jpg');

  await page.unroute('https://afghaneats-api.onrender.com/api/trpc/**');
  await mock(page);
  await page.goto('/restaurant.html?id=jumeirah-fast-food-herat');
  await expect(page.locator('.directory-detail')).toBeVisible();
  await page.waitForTimeout(700);
  await snap(page,'directory.jpg');

  await page.addInitScript(({orderId})=>{
    localStorage.setItem('ae_last_order',JSON.stringify({orderId,customerPhone:'+93 700 000 123',restaurantName:'Herat Kitchen',total:568,subtotal:500,deliveryFee:60,etaMin:70,etaMax:82,items:[{id:'kebab',name:'Kebab',quantity:2,price:250}]}));
    localStorage.setItem('ae_track_phone','+93 700 000 123');
  },{orderId});
  await page.goto('/order.html?id='+orderId);
  await page.waitForTimeout(2800);
  await snap(page,'order.jpg');
});
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const restaurant = {
  id:'11111111-1111-4111-8111-111111111111',
  slug:'herat-kitchen',
  name:'Herat Kitchen',
  name_dari:'آشپزخانه هرات',
  cuisine_tags:['Afghan'],
  category_primary:'Afghan',
  address:'Herat City',
  district:'Herat',
  city:'Herat',
  status:'active',
  is_open:true,
  has_delivery:true,
  has_takeaway:true,
  delivery_fee_min:60,
  min_order_amount:0,
  verification_status:'field_verified',
  location:{lat:34.3422,lng:62.2011,accuracy:'verified',place_id:'test-place'}
};
const menu={categories:[{id:'main',name:'Main'}],items:[{id:'kebab',restaurant_id:restaurant.id,category_id:'main',name:'Kebab',price:250,is_available:true}]};
const quote={restaurantId:restaurant.id,fulfillment:'delivery',deliveryFee:60,minimumOrder:0,etaMin:25,etaMax:40,source:'zone'};
const orderId='33333333-3333-4333-8333-333333333333';

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}

async function mockApi(page,{trackedOrder=null,riderLocation=null}={}){
  await page.route('https://afghaneats-api.onrender.com/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    if(path.includes('/api/orders/')&&path.endsWith('/rider-location')){
      if(!riderLocation){
        await route.fulfill({status:404,contentType:'application/json',body:'{}'});
        return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(riderLocation)});
      return;
    }
    if(!path.includes('/api/trpc/')){
      await route.fulfill({status:404,contentType:'application/json',body:'{}'});
      return;
    }
    let data=[];
    if(path.endsWith('/restaurants.list'))data=[restaurant];
    else if(path.endsWith('/restaurants.getMenu'))data=menu;
    else if(path.endsWith('/orders.quote'))data=quote;
    else if(path.endsWith('/orders.place'))data={success:true,orderId,orderNumber:'AE-2026-4242',pricing:{subtotal:250,deliveryFee:60,total:310}};
    else if(path.endsWith('/orders.track'))data=trackedOrder||[];
    else if(path.endsWith('/catalog.publicModifiers'))data={groups:[],options:[],links:[]};
    else if(path.endsWith('/merchant.publicAvailabilityBatch'))data=[];
    else if(path.endsWith('/merchant.publicMenuAvailability'))data=[];
    else if(path.endsWith('/cities.publicCatalog'))data=[];
    else if(path.endsWith('/discovery.trending'))data=[];
    await route.fulfill({status:200,contentType:'application/json',body:trpc(data)});
  });
}

async function mockGoogleMaps(page){
  await page.route('**/config.js**',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace('__GMAPS_KEY__','test-browser-key');
    await route.fulfill({response,body});
  });
  await page.route('https://maps.googleapis.com/maps/api/js**',async route=>{
    await route.fulfill({
      status:200,
      contentType:'application/javascript',
      body:`
(function(){
  class FakeMap{
    constructor(el,opts){this.el=el;this.zoom=opts.zoom||13;el.innerHTML='<div class="fake-gmap-label">Google Maps preview</div>';el.style.position='relative';el.style.background='linear-gradient(135deg,#eef2ef,#e2e8e5)'}
    fitBounds(){this.zoom=14}
    getZoom(){return this.zoom}
    setZoom(z){this.zoom=z}
  }
  class FakeMarker{
    constructor(opts){this.position=opts.position;this.map=opts.map;this.title=opts.title||'';this.visible=opts.visible!==false;this.node=null;this.render()}
    render(){if(this.node){this.node.remove();this.node=null}if(!this.map||!this.visible)return;const n=document.createElement('div');n.className='fake-gmap-pin';n.title=this.title;n.textContent='●';n.style.position='absolute';n.style.fontSize='34px';n.style.lineHeight='1';n.style.textShadow='0 2px 4px rgba(0,0,0,.2)';const meta=this.title==='Restaurant'?['24%','54%','#dc2626']:this.title==='Your address'?['70%','34%','#16a34a']:['48%','43%','#2563eb'];n.style.left=meta[0];n.style.top=meta[1];n.style.color=meta[2];this.map.el.appendChild(n);this.node=n}
    setPosition(p){this.position=p;this.render()}
    getPosition(){return this.position}
    setVisible(v){this.visible=v;this.render()}
    getVisible(){return this.visible}
    setMap(m){this.map=m;this.render()}
  }
  class FakePolyline{constructor(opts){this.map=opts.map}setMap(m){this.map=m}}
  class FakeBounds{extend(){}getCenter(){return {lat:function(){return 34.35},lng:function(){return 62.2}}}}
  window.google={maps:{Map:FakeMap,Marker:FakeMarker,Polyline:FakePolyline,LatLngBounds:FakeBounds,event:{addListenerOnce(_m,_e,cb){setTimeout(cb,0)}}}};
  window.__initTrackingMap&&window.__initTrackingMap();
})();`
    });
  });
}

test.beforeEach(()=>fs.mkdirSync('visual-proof',{recursive:true}));

test('checkout captures GPS and sends deliveryLocation',async({page})=>{
  await mockApi(page);
  await page.addInitScript(({restaurant,menu})=>{
    localStorage.setItem('ae_cart',JSON.stringify([{id:menu.items[0].id,restaurantId:restaurant.id,restaurantName:restaurant.name,name:menu.items[0].name,price:menu.items[0].price,qty:1,selections:[]}]));
    localStorage.setItem('ae_mode','delivery');
    localStorage.setItem('ae_address','Gulha Circle');
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){success({coords:{latitude:34.3501,longitude:62.2002}})}}});
  },{restaurant,menu});
  await page.goto('/checkout');
  await page.locator('#checkoutLocationPrompt').scrollIntoViewIfNeeded();
  await page.screenshot({path:'visual-proof/checkout-location-prompt-390x844.jpg',type:'jpeg',quality:88});
  await page.locator('#checkoutLocationPrompt').click();
  await expect(page.locator('#checkoutLocationState')).toContainText('Location captured ✓');
  await page.locator('input[name="name"]').fill('Test Customer');
  await page.locator('input[name="phone"]').fill('+93 700 000 123');
  await page.locator('select[name="district"]').selectOption('Gulha');
  await page.locator('input[name="address"]').fill('Gulha Circle');
  await expect(page.locator('#deliveryQuotePanel')).toContainText('Delivery confirmed');
  await expect.poll(()=>page.evaluate(()=>window.AE_DELIVERY_LOCATION)).toEqual({lat:34.3501,lng:62.2002});
  await expect(page.locator('input[name="fulfillment"]:checked')).toHaveValue('delivery');
  const orderRequest=page.waitForRequest(r=>r.url().endsWith('/orders.place')&&r.method()==='POST');
  await page.getByRole('button',{name:'Place order'}).click();
  const request=await orderRequest;
  expect(request.postDataJSON().json.deliveryLocation).toEqual({lat:34.3501,lng:62.2002});
});

test('tracking map renders restaurant, customer and rider pins',async({page})=>{
  const tracked={
    id:orderId,order_number:'AE-4242',status:'confirmed',total:310,
    restaurant:{name:'Herat Kitchen',location:{lat:34.3422,lng:62.2011}},
    deliveryLocation:{lat:34.3501,lng:62.2002},
    delivery_address:'Gulha Circle',delivery_phone:'+93 700 000 123',
    items:[{id:'kebab',name:'Kebab',quantity:1,price:250}]
  };
  await mockApi(page,{trackedOrder:tracked,riderLocation:{lat:34.3462,lng:62.2051}});
  await mockGoogleMaps(page);
  await page.addInitScript(({orderId})=>localStorage.setItem('ae_last_order',JSON.stringify({orderId,orderNumber:'AE-4242',customerPhone:'+93 700 000 123',status:'confirmed',total:310})),{orderId});
  await page.goto(`/order?id=${orderId}`);
  const geo=page.locator('#trackingGeo');
  await expect(geo).toHaveAttribute('data-restaurant-location',JSON.stringify(tracked.restaurant.location));
  await expect(geo).toHaveAttribute('data-customer-location',JSON.stringify(tracked.deliveryLocation));
  await expect(page.locator('.fake-gmap-pin')).toHaveCount(3);
  await page.screenshot({path:'visual-proof/tracking-map-3-pins-390x844.jpg',type:'jpeg',quality:88});
});

test('tracking map ignores unresolved zero restaurant coordinates',async({page})=>{
  const tracked={
    id:orderId,order_number:'AE-4242',status:'confirmed',total:310,
    restaurant:{name:'Unresolved Restaurant',location:{lat:0,lng:0,accuracy:'unresolved'}},
    deliveryLocation:{lat:34.3501,lng:62.2002},
    delivery_address:'Gulha Circle',delivery_phone:'+93 700 000 123',items:[]
  };
  await mockApi(page,{trackedOrder:tracked});
  await mockGoogleMaps(page);
  await page.addInitScript(({orderId})=>localStorage.setItem('ae_last_order',JSON.stringify({orderId,orderNumber:'AE-4242',customerPhone:'+93 700 000 123',status:'confirmed',total:310})),{orderId});
  await page.goto(`/order?id=${orderId}`);
  const geo=page.locator('#trackingGeo');
  await expect(geo).not.toHaveAttribute('data-restaurant-location',/.+/);
  await expect(geo).toHaveAttribute('data-customer-location',JSON.stringify(tracked.deliveryLocation));
  await expect(page.locator('.fake-gmap-pin')).toHaveCount(1);
});

test('tracking map shows bilingual-safe fallback when Google Maps is unavailable',async({page})=>{
  const tracked={id:orderId,order_number:'AE-4242',status:'confirmed',total:310,delivery_address:'Gulha Circle',delivery_phone:'+93 700 000 123',items:[]};
  const mapsRequests=[];
  const invalidKeyErrors=[];
  page.on('request',request=>{if(request.url().startsWith('https://maps.googleapis.com/maps/api/js'))mapsRequests.push(request.url())});
  page.on('console',message=>{if(message.type()==='error'&&message.text().includes('InvalidKeyMapError'))invalidKeyErrors.push(message.text())});
  await mockApi(page,{trackedOrder:tracked});
  await page.addInitScript(({orderId})=>localStorage.setItem('ae_last_order',JSON.stringify({orderId,orderNumber:'AE-4242',customerPhone:'+93 700 000 123',status:'confirmed',total:310})),{orderId});
  await page.goto(`/order?id=${orderId}`);
  await expect(page.locator('#riderMapStatus')).toContainText('Map unavailable');
  await expect(page.locator('.rider-map-fallback')).toContainText('Rider location will be sent by WhatsApp.');
  expect(mapsRequests).toHaveLength(0);
  expect(invalidKeyErrors).toHaveLength(0);
  await page.screenshot({path:'visual-proof/tracking-map-fallback-390x844.jpg',type:'jpeg',quality:88});
});

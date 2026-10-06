const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function mockApi(page) {
  await page.route('https://afghaneats-api.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/api/trpc/')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    let data = [];
    if (url.pathname.endsWith('/restaurants.list')) data = [];
    else if (url.pathname.endsWith('/cities.publicCatalog')) data = [];
    else if (url.pathname.endsWith('/discovery.trending')) data = [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { data: { json: data } } })
    });
  });
}

async function mockRuntimeConfig(page) {
  await page.route('**/config.js**', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('__GMAPS_KEY__', 'test-browser-key');
    await route.fulfill({ response, body });
  });
}

async function mockGoogleMaps(page) {
  await page.route('https://maps.googleapis.com/maps/api/js**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: String.raw`
(function(){
  const style=document.createElement('style');
  style.textContent=[
    '#restaurantDiscoveryMap{position:relative;overflow:hidden;background:#e9efe9}',
    '.fake-map-surface{position:absolute;inset:0;background:linear-gradient(25deg,transparent 48%,rgba(255,255,255,.92) 49%,rgba(255,255,255,.92) 52%,transparent 53%),linear-gradient(115deg,transparent 45%,rgba(255,255,255,.78) 46%,rgba(255,255,255,.78) 49%,transparent 50%),linear-gradient(160deg,transparent 48%,rgba(211,221,215,.8) 49%,rgba(211,221,215,.8) 51%,transparent 52%),#e8eee9;background-size:240px 180px,320px 220px,190px 160px,auto}',
    '.fake-map-district{position:absolute;color:#8a9790;font:700 12px system-ui;letter-spacing:.02em}',
    '.fake-discovery-pin{position:absolute;transform:translate(-50%,-50%);border:0;background:transparent;cursor:pointer;padding:0;z-index:3}',
    '.fake-discovery-pin-dot{display:grid;place-items:center;width:28px;height:28px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:#b91c1c;color:white;box-shadow:0 3px 9px rgba(0,0,0,.22);border:2px solid white}',
    '.fake-discovery-pin-dot span{transform:rotate(45deg);font:800 11px system-ui}',
    '.fake-discovery-pin-label{position:absolute;left:32px;top:-6px;white-space:nowrap;background:rgba(255,255,255,.95);border:1px solid #d8e1dc;border-radius:8px;padding:4px 7px;color:#173f2c;font:800 11px system-ui;box-shadow:0 2px 7px rgba(31,58,45,.12)}',
    '.fake-info-window{position:absolute;right:18px;top:18px;z-index:5;background:white;border:1px solid #dbe4de;border-radius:14px;padding:12px;box-shadow:0 8px 24px rgba(31,58,45,.18);max-width:280px}'
  ].join('');
  document.head.appendChild(style);

  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function project(pos){
    const x=clamp(8+((Number(pos.lng)-62.192)/0.030)*84,8,92);
    const y=clamp(90-((Number(pos.lat)-34.338)/0.023)*80,10,90);
    return {x,y};
  }

  class FakeMap{
    constructor(el,opts){
      this.el=el; this.zoom=opts.zoom||13;
      el.innerHTML='<div class="fake-map-surface"></div><span class="fake-map-district" style="left:12%;top:18%">Shahr-e Naw</span><span class="fake-map-district" style="right:9%;bottom:16%">Herat City</span><span class="fake-map-district" style="left:46%;bottom:25%">Mustofiat</span>';
    }
    fitBounds(){this.zoom=14}
    panTo(){}
    getZoom(){return this.zoom}
    setZoom(v){this.zoom=v}
    setCenter(){}
  }

  class FakeMarker{
    constructor(opts){
      this.position=opts.position;
      this.map=opts.map;
      this.title=opts.title||'';
      this.label=opts.label?.text||this.title;
      this.node=null;
      this.listeners={};
      this.render();
    }
    render(){
      if(this.node){this.node.remove();this.node=null}
      if(!this.map)return;
      const p=project(this.position);
      const b=document.createElement('button');
      b.className='fake-discovery-pin';
      b.type='button';
      b.title=this.title;
      b.style.left=p.x+'%';
      b.style.top=p.y+'%';
      const dot=document.createElement('span');
      dot.className='fake-discovery-pin-dot';
      const inner=document.createElement('span');
      inner.textContent='AE';
      dot.appendChild(inner);
      const label=document.createElement('span');
      label.className='fake-discovery-pin-label';
      label.textContent=this.label;
      b.append(dot,label);
      Object.entries(this.listeners).forEach(([name,cb])=>b.addEventListener(name,cb));
      this.map.el.appendChild(b);
      this.node=b;
    }
    addListener(name,cb){this.listeners[name]=cb;if(this.node)this.node.addEventListener(name,cb)}
    getPosition(){return this.position}
    setMap(map){this.map=map;this.render()}
  }

  class FakeInfoWindow{
    constructor(){this.content='';this.node=null}
    setContent(content){this.content=content}
    open({map}){if(this.node)this.node.remove();const n=document.createElement('div');n.className='fake-info-window';n.innerHTML=this.content;map.el.appendChild(n);this.node=n}
  }

  class FakeBounds{extend(){}}

  window.google={maps:{
    Map:FakeMap,
    Marker:FakeMarker,
    InfoWindow:FakeInfoWindow,
    LatLngBounds:FakeBounds,
    event:{addListenerOnce(_m,_e,cb){setTimeout(cb,0)}}
  }};
  window.__initRestaurantDiscoveryMap&&window.__initRestaurantDiscoveryMap();
})();`
    });
  });
}

async function openMap(page, viewport) {
  await page.setViewportSize(viewport);
  await mockApi(page);
  await mockRuntimeConfig(page);
  await mockGoogleMaps(page);
  await page.goto('/restaurants');
  await page.locator('[data-restaurant-view="map"]').click();
  await expect(page.locator('#restaurantDiscoveryMapView')).toBeVisible();
  await expect.poll(() => page.locator('.fake-discovery-pin').count()).toBeGreaterThanOrEqual(9);
}

test.beforeEach(() => fs.mkdirSync('visual-proof', { recursive: true }));

test('restaurant discovery map mobile visual proof', async ({ page }) => {
  await openMap(page, { width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('.fake-discovery-pin')?.click());
  await expect(page.locator('.fake-info-window')).toBeVisible();
  await page.screenshot({
    path: 'visual-proof/restaurant-discovery-map-390x844.png',
    fullPage: false
  });
});

test('restaurant discovery map desktop visual proof', async ({ page }) => {
  await openMap(page, { width: 1280, height: 800 });
  await page.locator('.restaurant-map-list-item').first().click();
  await expect(page.locator('.fake-info-window')).toBeVisible();
  await page.screenshot({
    path: 'visual-proof/restaurant-discovery-map-1280x800.png',
    fullPage: false
  });
});

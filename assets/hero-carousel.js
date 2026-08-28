(() => {
  const root = document.getElementById('heroCarousel');
  const track = document.getElementById('heroCarouselTrack');
  const dots = document.getElementById('heroCarouselDots');
  if (!root || !track || !dots) return;

  const state = { index: 0, timer: null, slides: [], pointerX: null };
  const AUTOPLAY_MS = 3500;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const text = (en, fa) => document.documentElement.lang === 'fa' ? (fa || en) : en;
  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function safeUrl(value) {
    if (!value) return '';
    try {
      const u = new URL(String(value), location.origin);
      return u.protocol === 'https:' || u.origin === location.origin ? u.href : '';
    } catch { return ''; }
  }

  function offerLabel(c) {
    if (c.campaignType === 'percent_discount') return text(`${Number(c.discountValue || 0)}% off`, `${Number(c.discountValue || 0)}٪ تخفیف`);
    if (c.campaignType === 'free_delivery') return text('Free delivery','ارسال رایگان');
    return text(`${Number(c.discountValue || 0).toLocaleString()} AFN off`, `${Number(c.discountValue || 0).toLocaleString('fa-AF')} افغانی تخفیف`);
  }

  function restaurantSlide(r, index) {
    const real = safeUrl(r.cover_image_url || r.logo_url);
    const image = real || safeUrl(r.illustrative_image_url);
    if (!image) return null;
    const name = text(r.name, r.name_dari);
    const cuisine = Array.isArray(r.cuisine_tags) ? r.cuisine_tags.slice(0, 3).join(' · ') : '';
    return {
      id: `restaurant-${r.id || index}`,
      image,
      alt: name,
      kicker: text('Featured in Herat','ویژه در هرات'),
      title: name,
      subtitle: cuisine || text('Discover this restaurant on Afghan Eats','این رستورانت را در افغان ایتس ببینید'),
      href: `/restaurant.html?id=${encodeURIComponent(r.id || '')}`,
      cta: text('View restaurant','دیدن رستورانت'),
      source: real ? '' : text('Illustrative food image','تصویر نمونه غذا'),
      priority: real ? 20 : 40
    };
  }

  function offerSlide(c, index) {
    if (!c?.restaurantId) return null;
    const image = safeUrl(c.coverImageUrl) || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=82';
    const code = String(c.code || '');
    return {
      id: `offer-${c.id || index}`,
      image,
      alt: text(c.restaurantName || 'Restaurant offer', c.restaurantNameDari || c.restaurantName || 'Restaurant offer'),
      badge: offerLabel(c),
      kicker: text('Restaurant offer','پیشنهاد رستورانت'),
      title: text(c.restaurantName || c.name || 'Special offer', c.restaurantNameDari || c.restaurantName || c.name || 'Special offer'),
      subtitle: c.name || text('Verified again at checkout','هنگام پرداخت دوباره تأیید می‌شود'),
      href: `/restaurant.html?id=${encodeURIComponent(c.restaurantId)}${code ? `&offer=${encodeURIComponent(code)}` : ''}`,
      cta: text('See offer','دیدن پیشنهاد'),
      source: text('Merchant-funded offer · eligibility checked at checkout','پیشنهاد تأمین‌شده توسط رستورانت · شرایط در پرداخت بررسی می‌شود'),
      priority: 0
    };
  }

  function marketingFallbacks() {
    return [
      {
        id:'discover-afghan',
        image:'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=1400&q=84',
        alt:'Afghan food',
        kicker:text('Discover Herat','کشف هرات'),
        title:text('Afghan favourites, close to home','غذاهای افغانی، نزدیک شما'),
        subtitle:text('Explore local restaurants and familiar flavours.','رستورانت‌های محلی و طعم‌های آشنا را کشف کنید.'),
        href:'/restaurants?c=Afghan',
        cta:text('Explore Afghan food','دیدن غذاهای افغانی'),
        priority:60
      },
      {
        id:'discover-fast-food',
        image:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=82',
        alt:'A table of food',
        kicker:text('More choice','انتخاب بیشتر'),
        title:text('Something for every craving','برای هر میل، یک انتخاب'),
        subtitle:text('Browse restaurants, dishes and pickup options across Herat.','رستورانت‌ها، غذاها و گزینه‌های دریافت حضوری را در هرات ببینید.'),
        href:'/restaurants',
        cta:text('Browse all restaurants','دیدن همه رستورانت‌ها'),
        priority:70
      }
    ];
  }

  function slideMarkup(s, active=false) {
    return `<article class="hero-slide${active ? ' is-active' : ''}" data-slide-id="${esc(s.id)}">
      <img src="${esc(s.image)}" alt="${esc(s.alt || s.title)}" loading="${active ? 'eager' : 'lazy'}" decoding="async">
      <div class="hero-slide-overlay"><div>
        ${s.badge ? `<span class="hero-slide-badge">${esc(s.badge)}</span>` : ''}
        <span class="hero-slide-kicker">${esc(s.kicker || '')}</span>
        <h2>${esc(s.title)}</h2>
        ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
        <a class="hero-slide-cta" href="${esc(s.href)}">${esc(s.cta)} <span aria-hidden="true">→</span></a>
        ${s.source ? `<small class="hero-slide-source">${esc(s.source)}</small>` : ''}
      </div></div>
    </article>`;
  }

  function render(slides) {
    state.slides = slides.slice(0, 6);
    state.index = 0;
    track.innerHTML = state.slides.map((s,i) => slideMarkup(s, i===0)).join('');
    dots.innerHTML = state.slides.map((_,i) => `<button class="hero-carousel-dot${i===0?' is-active':''}" type="button" data-hero-dot="${i}" aria-label="${esc(text(`Show slide ${i+1}`, `نمایش اسلاید ${i+1}`))}" aria-current="${i===0?'true':'false'}"></button>`).join('');
    root.classList.toggle('is-single', state.slides.length < 2);
    start();
  }

  function show(index, user=false) {
    if (!state.slides.length) return;
    const n = (index + state.slides.length) % state.slides.length;
    const slides = [...track.querySelectorAll('.hero-slide')];
    const buttons = [...dots.querySelectorAll('.hero-carousel-dot')];
    slides.forEach((el,i) => el.classList.toggle('is-active', i===n));
    buttons.forEach((el,i) => {
      el.classList.toggle('is-active', i===n);
      el.setAttribute('aria-current', i===n ? 'true' : 'false');
    });
    state.index = n;
    if (user) restart();
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }
  function start() {
    stop();
    if (reduceMotion || state.slides.length < 2) return;
    state.timer = setInterval(() => show(state.index + 1), AUTOPLAY_MS);
  }
  function restart() { stop(); start(); }

  root.querySelector('[data-hero-prev]')?.addEventListener('click', () => show(state.index - 1, true));
  root.querySelector('[data-hero-next]')?.addEventListener('click', () => show(state.index + 1, true));
  dots.addEventListener('click', e => {
    const btn = e.target.closest('[data-hero-dot]');
    if (btn) show(Number(btn.dataset.heroDot), true);
  });

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) start(); });

  root.addEventListener('pointerdown', e => { state.pointerX = e.clientX; });
  root.addEventListener('pointerup', e => {
    if (state.pointerX == null) return;
    const delta = e.clientX - state.pointerX;
    state.pointerX = null;
    if (Math.abs(delta) < 38) return;
    const rtl = document.documentElement.dir === 'rtl';
    show(state.index + (delta < 0 ? (rtl ? -1 : 1) : (rtl ? 1 : -1)), true);
  });

  async function load() {
    const fallbackPromise = fetch('/data/fallback-restaurants.json',{cache:'no-store'})
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    const base = window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '';
    const city = window.AFGHAN_EATS_CONFIG?.launchCity || 'Herat';
    const q = encodeURIComponent(JSON.stringify({json:{city}}));
    const offersPromise = base
      ? fetch(`${base}/api/trpc/growth.publicMarketplace?input=${q}`,{headers:{Accept:'application/json'}})
          .then(async r => {
            if (!r.ok) return null;
            const j = await r.json();
            return j?.result?.data?.json ?? j?.result?.data ?? null;
          }).catch(() => null)
      : Promise.resolve(null);

    const [entries, market] = await Promise.all([fallbackPromise, offersPromise]);
    const offers = Array.isArray(market?.offers) ? market.offers.map(offerSlide).filter(Boolean) : [];
    const restaurants = (Array.isArray(entries) ? entries : [])
      .map(x => x?.restaurant)
      .filter(r => r && r.status === 'active')
      .map(restaurantSlide)
      .filter(Boolean)
      .sort((a,b) => a.priority - b.priority);

    const selectedRestaurants = [];
    const imageSet = new Set();
    for (const s of restaurants) {
      if (imageSet.has(s.image)) continue;
      imageSet.add(s.image);
      selectedRestaurants.push(s);
      if (selectedRestaurants.length >= 4) break;
    }

    const slides = [...offers.slice(0,2), ...selectedRestaurants, ...marketingFallbacks()]
      .filter((s, i, all) => all.findIndex(x => x.id === s.id) === i)
      .slice(0,6);

    if (slides.length) render(slides);
  }

  render(marketingFallbacks());
  load();
})();
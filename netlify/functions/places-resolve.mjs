const API_BASE = 'https://afghaneats-api.onrender.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u200c\u200f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(value) {
  const stop = new Set(['herat','afghanistan','restaurant','fast','food','branch','road','street','opposite','near','beside','park','square','chaharahi']);
  return norm(value).split(/\s+/).filter(x => x && !stop.has(x));
}

function overlapScore(a, b) {
  const aa = new Set(tokens(a));
  const bb = new Set(tokens(b));
  if (!aa.size || !bb.size) return 0;
  let hit = 0;
  for (const t of aa) if (bb.has(t)) hit++;
  return hit / Math.max(aa.size, bb.size);
}

function nameScore(queryName, displayName) {
  const a = norm(queryName);
  const b = norm(displayName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  return overlapScore(a, b);
}

function inHeratBounds(location) {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 34.0 && lat <= 34.5 && lng >= 62.0 && lng <= 62.4;
}

async function loadJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function loadLiveRestaurants() {
  const input = encodeURIComponent(JSON.stringify({ json: {} }));
  const raw = await loadJson(`${API_BASE}/api/trpc/restaurants.list?input=${input}`);
  return raw?.result?.data?.json ?? raw?.result?.data ?? raw ?? [];
}

async function searchPlace(apiKey, item) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress,places.id'
    },
    body: JSON.stringify({ textQuery: `${item.name} Herat Afghanistan` })
  });
  if (!res.ok) {
    return { ...item, status: 'error', error: `Places API ${res.status}` };
  }
  const body = await res.json();
  const candidates = Array.isArray(body.places) ? body.places : [];
  const scored = candidates
    .filter(p => inHeratBounds(p.location))
    .map(p => {
      const displayName = p.displayName?.text || '';
      const nScore = nameScore(item.name, displayName);
      const aScore = item.address ? overlapScore(item.address, p.formattedAddress || '') : 0;
      const heratAddress = /herat/i.test(String(p.formattedAddress || ''));
      const score = nScore * 0.75 + (item.address ? aScore * 0.25 : (heratAddress ? 0.15 : 0));
      return {
        id: p.id || null,
        displayName,
        formattedAddress: p.formattedAddress || '',
        location: p.location || null,
        nameScore: Number(nScore.toFixed(3)),
        addressScore: Number(aScore.toFixed(3)),
        score: Number(score.toFixed(3))
      };
    })
    .sort((a,b) => b.score - a.score);

  const best = scored[0] || null;
  const confident = Boolean(
    best &&
    best.nameScore >= 0.55 &&
    (!item.address || best.addressScore >= 0.08 || /herat/i.test(best.formattedAddress))
  );

  return {
    ...item,
    status: confident ? 'resolved' : 'unresolved',
    best,
    candidates: scored.slice(0, 5)
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  const apiKey = Netlify.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'GOOGLE_MAPS_API_KEY is not configured for this deploy context' }, 503);

  try {
    const origin = new URL(request.url).origin;
    const [research, directory, live] = await Promise.all([
      loadJson(`${origin}/data/researched-herat-restaurants.json`),
      loadJson(`${origin}/data/public-herat-directory.json`),
      loadLiveRestaurants().catch(error => ({ __error: error.message }))
    ]);

    const rows = [];
    const add = (restaurant, source) => {
      if (!restaurant?.name) return;
      rows.push({
        source,
        id: restaurant.id || restaurant.research_key || null,
        name: restaurant.name,
        name_dari: restaurant.name_dari || null,
        address: restaurant.address || restaurant.address_en || null
      });
    };

    for (const entry of Array.isArray(research) ? research : []) add(entry.restaurant || entry, 'research');
    for (const entry of Array.isArray(directory) ? directory : []) add(entry.restaurant || entry, 'directory');
    if (Array.isArray(live)) for (const restaurant of live) add(restaurant, 'api');

    const seen = new Set();
    const unique = rows.filter(row => {
      const key = `${row.id || ''}|${norm(row.name)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results = [];
    for (const item of unique) {
      results.push(await searchPlace(apiKey, item));
    }

    return json({
      counts: {
        research: Array.isArray(research) ? research.length : 0,
        directory: Array.isArray(directory) ? directory.length : 0,
        api: Array.isArray(live) ? live.length : 0,
        unique: unique.length
      },
      apiError: live?.__error || null,
      results
    });
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
};

/*
 * Mapa sin conexión: guarda en el teléfono la aplicación (página, código, estilos, tipografía y logos)
 * para que quien ya la abrió una vez la vuelva a abrir aunque la señal falle.
 *
 * Lo que NUNCA se guarda ni se sirve desde aquí: los partidos. El archivo de partidos (data/…), el
 * marcador en vivo (otro dominio, WebSocket) y las métricas van siempre directo a la red; sin red no
 * hay partidos y la interfaz lo avisa (ver OfflineBanner en src/ui/Overlays.tsx).
 *
 *  · la página (index.html): primero la red, para que una versión nueva llegue en cuanto hay señal;
 *    si la red no contesta en 4 s o falla, la copia guardada;
 *  · assets/ (nombres con huella, no cambian): primero la copia guardada;
 *  · logos, fotos y demás archivos del mapa: la copia guardada y se renueva por detrás.
 *
 * `?sw=off` en la dirección lo desinstala (ver src/offline.ts).
 */
const CACHE = 'mapa-fip-v1';
const SCOPE = self.registration.scope;
const INDEX = SCOPE;
const EXTRA = ['logos/courtbit-icon.png', 'logos/courtbit-logo-white.svg', 'logos/courtbit-logo.svg'];

const assetsIn = (html) => [...new Set([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => m[1]))];

/** baja la página y todo lo que necesita para arrancar; borra el código de versiones anteriores */
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(INDEX, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.clone().text();
  await cache.put(INDEX, res);
  const assets = assetsIn(html);
  const fonts = [];
  await Promise.all(
    assets.map(async (path) => {
      const url = new URL(path, SCOPE).href;
      let hit = await cache.match(url);
      if (!hit) {
        hit = await fetch(url);
        if (!hit.ok) throw new Error(`HTTP ${hit.status} ${path}`);
        await cache.put(url, hit.clone());
      }
      // la tipografía va dentro de la hoja de estilos
      if (path.endsWith('.css')) for (const m of (await hit.text()).matchAll(/url\(([^)]+\.woff2)\)/g)) fonts.push(new URL(m[1].replace(/["']/g, ''), url).href);
    }),
  );
  await Promise.all(
    [...fonts, ...EXTRA.map((p) => new URL(p, SCOPE).href)].map(async (url) => {
      if (await cache.match(url)) return;
      const r = await fetch(url).catch(() => null);
      if (r && r.ok) await cache.put(url, r);
    }),
  );
  const keep = new Set(assets.map((p) => new URL(p, SCOPE).href).concat(fonts));
  for (const req of await cache.keys()) if (req.url.startsWith(`${SCOPE}assets/`) && !keep.has(req.url)) await cache.delete(req);
}

self.addEventListener('install', (ev) => {
  ev.waitUntil(precache().then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mapa-fip-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function page(ev) {
  const cache = await caches.open(CACHE);
  const net = fetch(INDEX, { cache: 'no-store' }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // con la página nueva se baja también su código, para que la copia guardada quede completa
    ev.waitUntil(precache().catch(() => {}));
    return res;
  });
  net.catch(() => {});
  const saved = await cache.match(INDEX);
  if (!saved) return net;
  try {
    return await Promise.race([net, timeout(4000)]);
  } catch {
    return saved;
  }
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // otro dominio (marcador, métricas, mapas) o fuera de la carpeta del mapa: no se toca
  if (!req.url.startsWith(SCOPE)) return;
  const path = req.url.slice(SCOPE.length).split('?')[0];
  // los partidos van siempre a la red; tampoco se guarda este archivo
  if (path.startsWith('data/') || path === 'sw.js' || url.searchParams.has('nocache')) return;
  if (req.mode === 'navigate') {
    if (path === '' || path === 'index.html') ev.respondWith(page(ev));
    return;
  }
  ev.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req.url);
      const refresh = () =>
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') cache.put(req.url, res.clone());
          return res;
        });
      if (!hit) return refresh();
      // lo que lleva huella en el nombre no cambia; lo demás se renueva por detrás
      if (!path.startsWith('assets/')) ev.waitUntil(refresh().catch(() => {}));
      return hit;
    }),
  );
});

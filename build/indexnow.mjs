// Avisa a los motores que usan IndexNow (Bing, Yandex, Seznam, Naver, Yep) que
// las URLs del sitio cambiaron, en vez de esperar a que las rastreen solas.
// Importa sobre todo para Bing: su indice es el que alimenta ChatGPT Search.
//
// Uso:
//   node build/indexnow.mjs              → envia todas las URLs del sitemap
//   node build/indexnow.mjs /clubes/ /   → envia solo esas rutas
//   node build/indexnow.mjs --dry-run    → imprime lo que enviaria, sin llamar
//
// Correrlo DESPUES de que el deploy este en vivo: los motores verifican la clave
// y visitan cada URL, asi que si el contenido nuevo todavia no esta publicado el
// aviso se desperdicia.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HOST = 'www.courtbit.com.mx';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // limite del protocolo por peticion

// La clave vive en el .txt de la raiz: ese archivo ES la prueba de propiedad,
// asi que se lee de ahi en lugar de duplicar el valor en el codigo.
function readKey() {
  const files = readdirSync(ROOT).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (files.length !== 1) {
    throw new Error(
      `Se esperaba exactamente un archivo de clave IndexNow en la raiz, hay ${files.length}: ${files.join(', ') || '(ninguno)'}`,
    );
  }
  const key = files[0].replace(/\.txt$/, '');
  const contents = readFileSync(path.join(ROOT, files[0]), 'utf8').trim();
  if (contents !== key) {
    throw new Error(`${files[0]} debe contener exactamente "${key}", contiene "${contents}"`);
  }
  return key;
}

function sitemapUrls() {
  const xml = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function normalize(arg) {
  if (arg.startsWith('http')) return arg;
  return ORIGIN + (arg.startsWith('/') ? arg : `/${arg}`);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const paths = args.filter((a) => a !== '--dry-run');

const key = readKey();
const urlList = (paths.length ? paths.map(normalize) : sitemapUrls()).slice(0, MAX_URLS);

const foreign = urlList.filter((u) => !u.startsWith(`${ORIGIN}/`) && u !== ORIGIN);
if (foreign.length) {
  throw new Error(`IndexNow rechaza URLs de otro host. Fuera de ${ORIGIN}: ${foreign.join(', ')}`);
}

const payload = { host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList };

console.log(`clave      : ${key}`);
console.log(`keyLocation: ${payload.keyLocation}`);
console.log(`URLs       : ${urlList.length}`);
for (const u of urlList) console.log(`  ${u}`);

if (dryRun) {
  console.log('\n--dry-run: no se envio nada.');
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
const body = await res.text();

// 200 = aceptado. 202 = aceptado pero la clave aun no se ha validado (normal en
// el primer envio). 4xx = algo esta mal y conviene fallar ruidosamente.
console.log(`\nHTTP ${res.status} ${res.statusText}`);
if (body.trim()) console.log(body.trim());

if (res.status === 200) console.log('OK: URLs aceptadas.');
else if (res.status === 202) console.log('OK: aceptadas, pendiente de validar la clave (normal la primera vez).');
else {
  console.error('FALLO: revisa que el archivo de clave este publicado y que el host coincida.');
  process.exit(1);
}

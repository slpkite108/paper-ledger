const SUPPORTED_DOI = /^10\.32604\/[a-z][a-z0-9.\-]{2,160}$/i;
const PUBLISHER_HOSTS = new Set(['www.techscience.com', 'techscience.com']);
const DOI_HOSTS = new Set(['doi.org', 'www.doi.org', 'dx.doi.org']);
const MAX_BYTES = 1_000_000;
const TTL = 24 * 60 * 60;

function normalizeDoi(value) { return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase(); }
function headers(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'X-Content-Type-Options': 'nosniff', ...extra }; }
function json(value, status = 200, extra) { return new Response(JSON.stringify(value), { status, headers: headers(extra) }); }
function decode(value) { return value.replace(/&amp;/gi, '&').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (all, hex, dec) => { const n = parseInt(hex || dec, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all; }); }

export function parsePublisherDate(html, doi, url) {
  const metadata = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3])]));
    const name = attrs.get('name')?.toLowerCase(); if (name) metadata.set(name, attrs.get('content') || '');
  }
  if (normalizeDoi(metadata.get('citation_doi') || '') !== doi) throw new Error('DOI_MISMATCH');
  for (const field of ['citation_publication_date', 'citation_online_date']) {
    const match = (metadata.get(field) || '').match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
    if (!match) continue;
    const year = +match[1], month = +match[2], day = match[3] ? +match[3] : undefined;
    if (year < 1000 || year > 2100 || month < 1 || month > 12 || (day !== undefined && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()))) continue;
    const date = [year, month, ...(day === undefined ? [] : [day])].map((v, i) => i ? String(v).padStart(2, '0') : String(v)).join('-');
    return { doi, source: 'publisher-metadata', date, url, checkedOn: new Date().toISOString().slice(0, 10), note: 'Tech Science Press · ' + field + ' · DOI 일치' };
  }
  throw new Error('DATE_NOT_FOUND');
}

async function readBounded(response) {
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw new Error('TOO_LARGE');
  const reader = response.body?.getReader(); if (!reader) throw new Error('EMPTY_BODY');
  const decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('TOO_LARGE'); } text += decoder.decode(item.value, { stream: true }); }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function lookupPublisherDate(doi, fetcher = fetch) {
  if (!SUPPORTED_DOI.test(doi)) throw new Error('UNSUPPORTED_DOI');
  let url = new URL('https://doi.org/' + doi); const signal = AbortSignal.timeout(15000);
  for (let redirects = 0; redirects < 6; redirects++) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || (!PUBLISHER_HOSTS.has(url.hostname) && !DOI_HOSTS.has(url.hostname))) throw new Error('UNSUPPORTED_REDIRECT');
    const response = await fetcher(url.href, { redirect: 'manual', signal, headers: { Accept: 'text/html', 'User-Agent': 'PaperLedger-DateMetadata/1.0 (+https://github.com/slpkite108/paper-ledger)' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location'); await response.body?.cancel(); if (!location) throw new Error('MISSING_REDIRECT'); url = new URL(location, url); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 429 ? 'UPSTREAM_LIMITED' : 'UPSTREAM_FAILED'); }
    if (!PUBLISHER_HOSTS.has(url.hostname)) { await response.body?.cancel(); throw new Error('UNSUPPORTED_REDIRECT'); }
    return parsePublisherDate(await readBounded(response), doi, url.href);
  }
  throw new Error('TOO_MANY_REDIRECTS');
}

export function createDateService({ fetcher = fetch, now = Date.now, edgeCache } = {}) {
  const memory = new Map(), pending = new Map(), limits = new Map();
  return { async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() });
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.pathname === '/') return json({ service: 'Paper Ledger publication dates', endpoint: '/api/publication-date?doi=10.32604/...', publishers: ['Tech Science Press'], storesUserAccounts: false });
    if (url.pathname !== '/api/publication-date') return json({ error: 'NOT_FOUND' }, 404);
    const doi = normalizeDoi(url.searchParams.get('doi') || '');
    if (!SUPPORTED_DOI.test(doi)) return json({ error: 'UNSUPPORTED_DOI', supported: false }, 422);
    const cached = memory.get(doi); if (cached && cached.until > now()) return json(cached.value);
    const cache = edgeCache || globalThis.caches?.default;
    const key = new Request(url.origin + '/__publication_date_cache/v1/' + encodeURIComponent(doi));
    try { const hit = await cache?.match(key); if (hit) return new Response(hit.body, { status: hit.status, headers: headers({ 'Cache-Control': 'public, max-age=86400' }) }); } catch { /* Cache must not break public metadata lookup. */ }
    const ip = request.headers.get('CF-Connecting-IP') || 'shared';
    let limit = limits.get(ip); if (!limit || limit.until <= now()) { limit = { count: 0, until: now() + 60000 }; if (limits.size >= 2000) limits.delete(limits.keys().next().value); limits.set(ip, limit); }
    if (++limit.count > 60) return json({ error: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
    let promise = pending.get(doi);
    if (!promise) { promise = lookupPublisherDate(doi, fetcher); pending.set(doi, promise); }
    try {
      const value = await promise;
      if (memory.size >= 500) memory.delete(memory.keys().next().value);
      memory.set(doi, { value, until: now() + TTL * 1000 });
      const response = json(value, 200, { 'Cache-Control': 'public, max-age=86400' });
      try { await cache?.put(key, response.clone()); } catch { /* Memory remains usable. */ }
      return response;
    } catch (error) {
      const code = ['DOI_MISMATCH', 'DATE_NOT_FOUND', 'UNSUPPORTED_REDIRECT', 'UPSTREAM_LIMITED'].includes(error.message) ? error.message : 'UPSTREAM_UNAVAILABLE';
      return json({ error: code }, code === 'UPSTREAM_LIMITED' ? 429 : code === 'DATE_NOT_FOUND' ? 404 : 502, code === 'UPSTREAM_LIMITED' ? { 'Retry-After': '60' } : undefined);
    } finally { if (pending.get(doi) === promise) pending.delete(doi); }
  } };
}

export default createDateService();

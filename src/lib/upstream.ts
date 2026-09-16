export type UpstreamOptions = { apiKey?: string; cacheOrigin?: string };
type ErrorInfo = { code?: string; provider?: string; retryAt?: number };
export class ApiError extends Error {
  status: number;
  info: ErrorInfo;
  constructor(message: string, status = 502, info: ErrorInfo = {}) { super(message); this.status = status; this.info = info; }
}

const TTL = 60 * 60;
const MAX_BYTES = 8 * 1024 * 1024;
type CacheLike = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
type Dependencies = { fetcher?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; edgeCache?: CacheLike | null };
function platformCache(): CacheLike | undefined {
  if (typeof caches === 'undefined') return;
  return (caches as unknown as { default?: CacheLike }).default;
}
async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function retryDelay(headers: Headers, now: number): number | null {
  const retry = headers.get('Retry-After');
  if (retry !== null) {
    if (/^\d+(\.\d+)?$/.test(retry.trim())) return Math.ceil(Number(retry) * 1000);
    const when = Date.parse(retry); if (Number.isFinite(when)) return Math.max(0, when - now);
  }
  return null;
}
function resetDelay(headers: Headers, now: number): number | null {
  const raw = headers.get('X-RateLimit-Reset');
  if (!raw || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return Math.max(0, n > 1e12 ? n - now : n > 1e9 ? n * 1000 - now : n * 1000);
}

export function createUpstream(deps: Dependencies = {}) {
  const fetcher = deps.fetcher ?? ((input, init) => fetch(input, init));
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const memory = new Map<string, { body: string; until: number; bytes: number }>();
  const pending = new Map<string, Promise<string>>();
  const cooldown = new Map<string, ApiError>();
  let usedBytes = 0;
  function remember(key: string, body: string) {
    const bytes = body.length * 2;
    if (bytes > MAX_BYTES) return;
    const old = memory.get(key); if (old) { usedBytes -= old.bytes; memory.delete(key); }
    while (memory.size >= 24 || usedBytes + bytes > MAX_BYTES) {
      const first = memory.keys().next().value; if (first === undefined) break;
      usedBytes -= memory.get(first)!.bytes; memory.delete(first);
    }
    memory.set(key, { body, bytes, until: now() + TTL * 1000 }); usedBytes += bytes;
  }
  return async function upstream<T>(url: URL, options: UpstreamOptions = {}): Promise<T> {
    const isOpenAlex = url.hostname === 'api.openalex.org';
    const provider = isOpenAlex ? 'OpenAlex' : 'Crossref';
    const apiKey = isOpenAlex ? options.apiKey?.trim() || '' : '';
    // Credentials only leave in the upstream Authorization header, never URLs/cache names.
    const scope = await digest(url.hostname + '\n' + apiKey);
    const key = await digest(url.href + '\n' + scope);
    const cached = memory.get(key);
    if (cached && cached.until > now()) return JSON.parse(cached.body) as T;
    if (cached) { usedBytes -= cached.bytes; memory.delete(key); }
    const edge = deps.edgeCache === null ? undefined : deps.edgeCache ?? platformCache();
    const cacheRequest = options.cacheOrigin ? new Request(new URL('/__scholarly_cache/v2/' + key, options.cacheOrigin)) : null;
    if (edge && cacheRequest) {
      try { const hit = await edge.match(cacheRequest); if (hit?.ok) { const body = await hit.text(); const value = JSON.parse(body) as T; remember(key, body); return value; } } catch { /* Cache availability must not break a lookup. */ }
    }
    const limited = cooldown.get(scope);
    if (limited && (limited.info.retryAt ?? 0) > now()) throw limited;
    cooldown.delete(scope);
    const existing = pending.get(key); if (existing) return JSON.parse(await existing) as T;

    async function run() {
      for (let attempt = 0; attempt < 3; attempt++) {
        const headers = new Headers({ Accept: 'application/json' });
        if (apiKey) headers.set('Authorization', 'Bearer ' + apiKey);
        let response: Response;
        try { response = await fetcher(url, { signal: AbortSignal.timeout(15000), headers }); }
        catch { throw new ApiError(provider + '에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'); }
        if (response.ok) {
          const body = await response.text();
          try { JSON.parse(body); } catch { throw new ApiError(provider + '의 응답 형식이 올바르지 않습니다.'); }
          remember(key, body);
          if (edge && cacheRequest) {
            try { await edge.put(cacheRequest, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + TTL } })); } catch { /* Memory cache remains usable. */ }
          }
          return body;
        }
        if (response.status === 429) {
          const body = (await response.text()).slice(0, 4000);
          const remaining = response.headers.get('X-RateLimit-Remaining');
          const daily = (remaining !== null && Number(remaining) === 0) || /daily|budget|credits? (?:exceeded|exhausted)|per day/i.test(body);
          const delay = retryDelay(response.headers, now()) ?? (daily ? resetDelay(response.headers, now()) : null) ?? (daily ? 86400000 - now() % 86400000 : 60000);
          if (!daily && delay <= 5000 && attempt < 1) { await sleep(Math.max(delay, 1000)); continue; }
          const retryAt = now() + Math.max(1000, delay);
          const advice = isOpenAlex && !apiKey ? ' 검색 설정에서 무료 개인 API 키를 적용하면 개인 한도로 조회할 수 있습니다.' : ' 표시된 시간 이후 다시 시도하거나 서비스의 사용량을 확인하세요.';
          const error = new ApiError(provider + (daily ? '의 일일 사용 한도를 모두 사용했습니다.' : '에서 요청을 일시적으로 제한했습니다.') + advice, 429, { code: daily ? 'DAILY_LIMIT' : 'RATE_LIMITED', provider, retryAt });
          if (cooldown.size >= 64) cooldown.delete(cooldown.keys().next().value!);
          cooldown.set(scope, error); throw error;
        }
        if (response.status === 404) throw new ApiError('해당 자료를 찾지 못했습니다.', 404);
        if (response.status === 401 || response.status === 403) throw new ApiError(provider + (apiKey ? ' API 키가 거절되었습니다. 검색 설정에서 키를 확인하세요.' : '에서 접근을 제한했습니다. 검색 설정에서 개인 API 키를 적용해 주세요.'), 401, { code: 'API_ACCESS_DENIED', provider });
        const wait = retryDelay(response.headers, now()) ?? 750 * 2 ** attempt;
        if (response.status >= 500 && attempt < 2 && wait <= 5000) { await sleep(wait); continue; }
        throw new ApiError(provider + ' 조회에 실패했습니다. 잠시 후 다시 시도하세요.');
      }
      throw new ApiError(provider + ' 조회에 실패했습니다.');
    }
    const promise = run(); pending.set(key, promise);
    try { return JSON.parse(await promise) as T; } finally { pending.delete(key); }
  };
}
export const upstream = createUpstream();
export function apiFailure(error: unknown) {
  const known = error instanceof ApiError ? error : new ApiError('자료를 처리하지 못했습니다. 다시 시도하세요.');
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (known.info.retryAt) headers.set('Retry-After', String(Math.max(1, Math.ceil((known.info.retryAt - Date.now()) / 1000))));
  return Response.json({ error: known.message, ...known.info }, { status: known.status, headers });
}
export function dataResponse(data: unknown) { return Response.json(data, { headers: { 'Cache-Control': 'private, max-age=300' } }); }

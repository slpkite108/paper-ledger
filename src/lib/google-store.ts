import { favoriteSchema, type Favorite, type FavoritePayload } from './favorites';
import { layoutSchema, type Layout } from './layouts';
import googleConfig from './google-config.json';

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; scope?: string };
type GoogleIdentity = { accounts: { oauth2: {
  initTokenClient: (options: { client_id: string; scope: string; callback: (value: TokenResponse) => void; error_callback: () => void }) => { requestAccessToken: (options: { prompt: string }) => void };
  hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean;
} } };
type ConfiguredWindow = Window & { google?: GoogleIdentity; PAPER_LEDGER_CONFIG?: { googleClientId?: string } };
export type GoogleUser = { name: string; email: string; sub: string; hasSavedKey: boolean };
const scope = 'https://www.googleapis.com/auth/drive.appdata';
const sessionKey = 'paper-ledger-google-session-v1';
type Connection = 'disconnected' | 'restoring' | 'connected' | 'expired';
type SavedSession = { clientId: string; token: string; expiresAt: number; subject: string };
let accessToken = ''; let expiresAt = 0; let currentUser: GoogleUser | null = null;
let connection: Connection = 'disconnected'; let generation = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let restorePromise: Promise<GoogleUser | null> | null = null;
let scriptReady: Promise<void> | null = null; const listeners = new Set<() => void>();
export function googleUser() { return currentUser; }
export function googleConnection() { return connection; }
export function subscribeGoogle(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() { listeners.forEach(listener => listener()); }
function clearSavedSession() { try { window.sessionStorage.removeItem(sessionKey); } catch { /* Storage may be blocked. */ } }
function clearSession(next: Connection) {
  ++generation; clearTimeout(expiryTimer); expiryTimer = undefined;
  accessToken = ''; expiresAt = 0; currentUser = null; connection = next;
  clearSavedSession(); notify();
}
export function disconnectGoogle() { clearSession('disconnected'); }
export function ensureGoogleStorageReady() {
  if (connection === 'restoring') throw new Error('Google 연결을 복원 중입니다. 잠시 후 다시 시도하세요.');
  if (connection === 'expired') throw new Error('Google 연결이 만료되었거나 확인되지 않았습니다. 검색 설정에서 다시 연결하거나 연결을 종료하세요.');
}
function checkGeneration(expected: number) {
  if (expected !== generation) throw new Error('Google 계정 연결이 변경되었습니다. 다시 시도하세요.');
}
function activateSession(user: GoogleUser, expected: number) {
  checkGeneration(expected);
  if (expiresAt <= Date.now()) { clearSession('expired'); throw new Error('Google 연결이 만료되었습니다. 다시 연결하세요.'); }
  currentUser = user; connection = 'connected';
  // A short-lived token stays only in this tab's session storage. API keys are never cached here.
  try { window.sessionStorage.setItem(sessionKey, JSON.stringify({clientId: googleClientId(), token: accessToken, expiresAt, subject: user.sub})); } catch { /* The in-memory connection still works. */ }
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => { if (expected === generation) clearSession('expired'); }, Math.min(expiresAt - Date.now(), 2147483647));
  notify(); return user;
}
async function readIdentity(expected: number): Promise<GoogleUser> {
  const profile = await googleRequest<{sub?: string; email?: string; name?: string}>('/oauth2/v3/userinfo', {}, expected);
  if (!profile.sub || !profile.email) throw new Error('Google 계정 정보를 확인하지 못했습니다.');
  return {sub: profile.sub, email: profile.email, name: profile.name || profile.email, hasSavedKey: false};
}
export function restoreGoogleSession(): Promise<GoogleUser | null> {
  if (restorePromise) return restorePromise;
  if (currentUser) return Promise.resolve(currentUser);
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') return Promise.resolve(null);
  let saved: SavedSession;
  try {
    const raw = window.sessionStorage.getItem(sessionKey);
    if (!raw) return Promise.resolve(null);
    saved = JSON.parse(raw);
    if (!saved || saved.clientId !== googleClientId() || typeof saved.token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(saved.token)
      || typeof saved.subject !== 'string' || !saved.subject || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()
      || saved.expiresAt > Date.now() + 3600000) { clearSession('expired'); return Promise.resolve(null); }
  } catch { clearSavedSession(); return Promise.resolve(null); }
  const expected = ++generation;
  connection = 'restoring'; accessToken = saved.token; expiresAt = saved.expiresAt; notify();
  const pending = (async () => {
    try {
      const user = await readIdentity(expected);
      if (user.sub !== saved.subject) throw new Error('저장된 Google 계정과 일치하지 않습니다. 다시 연결하세요.');
      return activateSession(user, expected);
    } catch (error) {
      if (expected === generation) clearSession('expired');
      throw error;
    }
  })();
  restorePromise = pending;
  void pending.finally(() => { if (restorePromise === pending) restorePromise = null; }).catch(() => {});
  return pending;
}
export function googleClientId() {
  const configured = typeof window === 'undefined' ? '' : (window as ConfiguredWindow).PAPER_LEDGER_CONFIG?.googleClientId?.trim() || '';
  // The deployed app configuration owns OAuth setup; old browser overrides are ignored.
  return configured || googleConfig.googleClientId;
}
export function prepareGoogle() {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise<void>((resolve, reject) => {
    if ((window as ConfiguredWindow).google?.accounts.oauth2) { resolve(); return; }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { script.remove(); scriptReady = null; reject(new Error('Google 로그인 모듈을 불러오지 못했습니다. 네트워크를 확인하세요.')); };
    document.head.appendChild(script);
  });
  return scriptReady;
}
async function googleRequest<T>(path: string, init: RequestInit = {}, expected = generation): Promise<T> {
  checkGeneration(expected);
  if (!accessToken || Date.now() >= expiresAt) {
    if (accessToken) clearSession('expired');
    throw new Error('Google 연결이 만료되었습니다. 검색 설정에서 Google 계정으로 다시 연결하세요.');
  }
  const response = await fetch('https://www.googleapis.com' + path, { ...init, cache: 'no-store', headers: { ...init.headers, Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(20000) });
  checkGeneration(expected);
  if (response.status === 401) { clearSession('expired'); throw new Error('Google 연결이 만료되었습니다. Google 계정으로 다시 연결하세요.'); }
  if (response.status === 403) throw new Error('Google 저장소 권한을 확인하세요. 프로젝트에서 Drive API를 활성화하고 앱 전용 저장 권한을 허용해야 합니다.');
  if (response.status === 429) throw new Error('Google Drive 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.');
  if (!response.ok) throw new Error('Google 저장소 요청을 완료하지 못했습니다. 입력은 유지됩니다. 다시 시도하세요.');
  const data = response.status === 204 ? undefined as T : await response.json() as T;
  checkGeneration(expected); return data;
}
export function connectGoogle(): Promise<GoogleUser> {
  const id = googleClientId(); const api = (window as ConfiguredWindow).google?.accounts.oauth2;
  if (!id) return Promise.reject(new Error('Google 연결 설정을 불러오지 못했습니다. 페이지를 새로고침하세요.'));
  if (window.location.protocol === 'file:') return Promise.reject(new Error('Google 연결은 GitHub Pages의 HTTPS 주소에서 사용하세요. HTML 파일에서는 브라우저 즐겨찾기를 사용할 수 있습니다.'));
  if (!api) return Promise.reject(new Error('Google 모듈을 준비 중입니다. 잠시 후 다시 눌러주세요.'));
  disconnectGoogle(); const expected = generation;
  return new Promise((resolve, reject) => {
    const client = api.initTokenClient({ client_id: id, scope: 'openid email profile ' + scope,
      error_callback: () => reject(new Error('로그인 창이 닫혔거나 열리지 않았습니다. 팝업 허용 여부를 확인하고 다시 시도하세요.')),
      callback: async token => {
        if (expected !== generation) { reject(new Error('Google 연결 요청이 취소되었습니다.')); return; }
        if (token.error || !token.access_token) { reject(new Error('Google 연결이 취소되었거나 거절되었습니다.')); return; }
        if (!api.hasGrantedAllScopes(token, scope)) { reject(new Error('즐겨찾기를 저장하려면 Google Drive 앱 전용 저장 권한이 필요합니다.')); return; }
        // Google authenticates every Drive request. Userinfo is for display only.
        accessToken = token.access_token; expiresAt = Date.now() + Math.max(0, Math.min(Number(token.expires_in) || 3600, 3600) - 60) * 1000;
        try {
          resolve(activateSession(await readIdentity(expected), expected));
        } catch (error) { if (expected === generation) disconnectGoogle(); reject(error); }
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
type DriveFile = { id: string; appProperties?: Record<string, string> };
async function files(kind: 'favorite' | 'key' | 'preset', expected = generation) {
  const query = `trashed = false and appProperties has { key='paper-ledger' and value='v1' } and appProperties has { key='kind' and value='${kind}' }`;
  const results: DriveFile[] = []; let cursor = '';
  do {
    const params = new URLSearchParams({ spaces: 'appDataFolder', q: query, pageSize: '100', orderBy: 'modifiedTime desc', fields: 'files(id,appProperties),nextPageToken', ...(cursor ? { pageToken: cursor } : {}) });
    const page = await googleRequest<{ files?: DriveFile[]; nextPageToken?: string }>('/drive/v3/files?' + params, {}, expected); results.push(...page.files || []); cursor = page.nextPageToken || '';
  } while (cursor && results.length < 500);
  return results;
}
async function readFile<T>(id: string, expected: number) { return googleRequest<T>('/drive/v3/files/' + encodeURIComponent(id) + '?alt=media', {}, expected); }
async function writeFile(kind: 'favorite' | 'key' | 'preset', value: unknown, id: string | undefined, expected: number) {
  if (id) return googleRequest('/upload/drive/v3/files/' + encodeURIComponent(id) + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }, expected);
  const boundary = 'paper_ledger_' + crypto.randomUUID().replaceAll('-', '');
  const metadata = { name: 'paper-ledger-' + kind + '.json', parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { 'paper-ledger': 'v1', kind, ...(kind === 'favorite' ? { favoriteId: (value as Favorite).id } : kind === 'preset' ? { presetId: (value as Layout).id } : {}) } };
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(value) + '\r\n--' + boundary + '--';
  return googleRequest('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, expected);
}
export async function readGoogleFavorites() {
  const expected = generation; const stored = await files('favorite', expected); const favorites: Favorite[] = [];
  // Bounded sequential reads avoid burst requests and preserve API errors.
  for (const file of stored) favorites.push(favoriteSchema.parse(await readFile(file.id, expected)));
  return favorites.sort((a, b) => b.createdAt - a.createdAt);
}
export async function createGoogleFavorite(name: string, payload: FavoritePayload) {
  const expected = generation;
  if ((await files('favorite', expected)).length >= 50) throw new Error('Google 즐겨찾기는 50개까지 저장할 수 있습니다.');
  const favorite = favoriteSchema.parse({ id: crypto.randomUUID(), name, payload, createdAt: Date.now() });
  await writeFile('favorite', favorite, undefined, expected); return favorite;
}
export async function deleteGoogleFavorite(id: string) {
  const expected = generation; const stored = await files('favorite', expected); const matches = stored.filter(f => f.appProperties?.favoriteId === id);
  for (const file of matches) await googleRequest('/drive/v3/files/' + encodeURIComponent(file.id), { method: 'DELETE' }, expected);
}
export async function readGoogleKey() {
  const expected = generation; const stored = await files('key', expected);
  const data = stored[0] ? await readFile<{ apiKey?: string }>(stored[0].id, expected) : null;
  checkGeneration(expected);
  const key = typeof data?.apiKey === 'string' && /^[\x21-\x7e]{8,512}$/.test(data.apiKey) ? data.apiKey : '';
  if (data && !key) throw new Error('저장된 키 형식이 올바르지 않습니다. 새 키로 다시 저장하세요.');
  if (currentUser) { currentUser = { ...currentUser, hasSavedKey: Boolean(key) }; notify(); }
  return key;
}
export async function saveGoogleKey(apiKey: string) {
  if (!/^[\x21-\x7e]{8,512}$/.test(apiKey)) throw new Error('OpenAlex API 키 형식을 확인하세요.');
  const expected = generation; const stored = await files('key', expected); await writeFile('key', { apiKey }, stored[0]?.id, expected);
  checkGeneration(expected);
  if (currentUser) { currentUser = { ...currentUser, hasSavedKey: true }; notify(); }
}
export async function deleteGoogleKey() {
  const expected = generation;
  for (const file of await files('key', expected)) await googleRequest('/drive/v3/files/' + encodeURIComponent(file.id), { method: 'DELETE' }, expected);
  checkGeneration(expected);
  if (currentUser) { currentUser = { ...currentUser, hasSavedKey: false }; notify(); }
}
export async function readGoogleLayouts() {
  const expected = generation; const stored = await files('preset', expected); const result: Layout[] = [];
  for (const file of stored) result.push(layoutSchema.parse(await readFile(file.id, expected)));
  return result;
}
export async function saveGoogleLayout(value: Layout) {
  const expected = generation; const layout = layoutSchema.parse(value); const stored = await files('preset', expected);
  const existing = stored.find(f => f.appProperties?.presetId === layout.id);
  if (!existing && stored.length >= 50) throw new Error('Google 프리셋은 50개까지 저장할 수 있습니다.');
  await writeFile('preset', layout, existing?.id, expected);
}
export async function deleteGoogleLayout(id: string) {
  const expected = generation; const stored = await files('preset', expected);
  for (const file of stored.filter(f => f.appProperties?.presetId === id)) {
    await googleRequest('/drive/v3/files/' + encodeURIComponent(file.id), { method: 'DELETE' }, expected);
  }
}

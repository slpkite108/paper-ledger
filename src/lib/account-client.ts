import { isStandalone } from './client-api';
import { favoritesSchema, favoriteSchema, type Favorite } from './favorites';
import { googleUser, readGoogleFavorites, createGoogleFavorite, deleteGoogleFavorite, restoreGoogleSession, ensureGoogleStorageReady } from './google-store';
export type AccountInfo = { user: { displayName: string; email: string } | null; hasSavedKey: boolean; storageReady: boolean; keyStorageReady: boolean };
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || '계정 저장 요청을 완료하지 못했습니다. 다시 시도하세요.');
  return data;
}
const localKey = 'paper-ledger-author-favorites-v1';
export async function readFavorites(): Promise<Favorite[]> {
  if (!isStandalone()) return (await accountRequest<{ favorites: Favorite[] }>('/api/favorites')).favorites;
  await restoreGoogleSession(); ensureGoogleStorageReady();
  if (googleUser()) return readGoogleFavorites();
  try { return favoritesSchema.parse(JSON.parse(localStorage.getItem(localKey) || '[]')); }
  catch { throw new Error('이 브라우저의 즐겨찾기를 읽을 수 없습니다. 브라우저 저장 허용 여부를 확인하세요.'); }
}
export async function createFavorite(name: string, payload: Favorite['payload']): Promise<Favorite> {
  if (!isStandalone()) return (await accountRequest<{ favorite: Favorite }>('/api/favorites', 'POST', { name, payload })).favorite;
  await restoreGoogleSession(); ensureGoogleStorageReady();
  if (googleUser()) return createGoogleFavorite(name, payload);
  const prior = await readFavorites();
  if (prior.length >= 50) throw new Error('즐겨찾기는 50개까지 저장할 수 있습니다.');
  const favorite = favoriteSchema.parse({ id: crypto.randomUUID(), name, payload, createdAt: Date.now() });
  try { localStorage.setItem(localKey, JSON.stringify([favorite, ...prior])); }
  catch { throw new Error('브라우저에 저장하지 못했습니다. 저장 공간과 권한을 확인하세요.'); }
  return favorite;
}
export async function deleteFavorite(id: string) {
  if (!isStandalone()) { await accountRequest('/api/favorites?id=' + encodeURIComponent(id), 'DELETE'); return; }
  await restoreGoogleSession(); ensureGoogleStorageReady();
  if (googleUser()) { await deleteGoogleFavorite(id); return; }
  const prior = await readFavorites();
  try { localStorage.setItem(localKey, JSON.stringify(prior.filter(f => f.id !== id))); }
  catch { throw new Error('즐겨찾기를 삭제하지 못했습니다. 다시 시도하세요.'); }
}

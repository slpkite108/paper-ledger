import { ApiError, upstream } from './upstream';
import type { Author, Work } from './papers';
import { crossrefData, type CrossrefMessage } from './crossref-data';

export class ClientApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export function isStandalone() {
  return typeof window !== 'undefined' && Boolean((window as Window & { __PAPER_LEDGER_LOCAL__?: boolean }).__PAPER_LEDGER_LOCAL__);
}
function withRetryTime(message: string, retryAt?: number) {
  return message + (retryAt ? ' 다시 시도 가능: ' + new Date(retryAt).toLocaleString('ko-KR') : '');
}
export async function localData(path: string, apiKey = ''): Promise<unknown> {
  const local = new URL(path, 'https://paper-ledger.local');
  const p = local.searchParams;
  if (local.pathname === '/api/search-settings') return { serverKeyConfigured: false };
  if (local.pathname === '/api/authors') {
    const q = (p.get('q') ?? '').trim(); const page = Number(p.get('page') ?? 1);
    if (q.length < 2 || q.length > 150 || !Number.isInteger(page) || page < 1 || page > 500) throw new ApiError('검색어와 페이지를 확인하세요.', 400);
    const url = new URL('https://api.openalex.org/authors');
    const orcid = q.replace(/^https:\/\/orcid.org\//, '');
    if (/^(https:\/\/openalex.org\/)?A\d+$/.test(q)) url.searchParams.set('filter', 'openalex:' + q.split('/').pop());
    else if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(orcid)) url.searchParams.set('filter', 'orcid:https://orcid.org/' + orcid);
    else url.searchParams.set('search', q);
    url.searchParams.set('page', String(page)); url.searchParams.set('per_page', '20');
    url.searchParams.set('select', 'id,display_name,orcid,works_count,last_known_institutions');
    const d = await upstream<{ results: Author[]; meta?: { count?: number } }>(url, { apiKey });
    if (!Array.isArray(d.results)) throw new ApiError('저자 응답 형식이 올바르지 않습니다.');
    return { authors: d.results, total: d.meta?.count ?? 0, page };
  }
  if (local.pathname === '/api/works') {
    const author = p.get('author') ?? ''; const cursor = p.get('cursor') || '*'; const from = p.get('from') ?? ''; const to = p.get('to') ?? '';
    if (!/^A\d+$/.test(author) || cursor.length > 2000) throw new ApiError('저자를 다시 선택하세요.', 400);
    for (const y of [from, to]) if (y && (!/^\d{4}$/.test(y) || +y < 1000 || +y > 2100)) throw new ApiError('연도는 1000~2100 범위로 입력하세요.', 400);
    if (from && to && +from > +to) throw new ApiError('시작 연도를 확인하세요.', 400);
    const url = new URL('https://api.openalex.org/works'); const filters = ['authorships.author.id:' + author];
    if (from || to) filters.push('publication_year:' + (from || '1000') + '-' + (to || '2100'));
    url.searchParams.set('filter', filters.join(',')); url.searchParams.set('cursor', cursor); url.searchParams.set('per_page', '100'); url.searchParams.set('sort', 'publication_date:desc');
    url.searchParams.set('select', 'id,doi,title,publication_date,publication_year,type,primary_location,biblio,authorships,is_authors_truncated');
    const d = await upstream<{ results: Work[]; meta?: { count?: number; next_cursor?: string | null } }>(url, { apiKey });
    if (!Array.isArray(d.results)) throw new ApiError('논문 응답 형식이 올바르지 않습니다.');
    return { works: d.results, total: d.meta?.count ?? 0, cursor: d.results.length ? d.meta?.next_cursor ?? null : null };
  }
  if (local.pathname === '/api/crossref') {
    const doi = (p.get('doi') ?? '').replace(/^https?:\/\/(dx\.)?doi.org\//i, '');
    if (!/^10\.\d{4,9}\/\S+$/i.test(doi) || doi.length > 500) throw new ApiError('유효한 DOI가 필요합니다.', 400);
    const { message: m } = await upstream<{ message: CrossrefMessage }>(new URL('https://api.crossref.org/works/' + encodeURIComponent(doi)));
    if (!m?.DOI) throw new ApiError('Crossref 서지정보가 없습니다.', 404);
    return crossrefData(m);
  }
  throw new ApiError('지원하지 않는 조회입니다.', 404);
}
export async function getData<T>(path: string, apiKey = ''): Promise<T> {
  if (isStandalone()) {
    try { return await localData(path, apiKey) as T; }
    catch (e) { if (e instanceof ApiError) throw new ClientApiError(withRetryTime(e.message, e.info.retryAt), e.status); throw e; }
  }
  const useKey = apiKey && /^\/api\/(authors|works)\?/.test(path);
  const response = await fetch(path, { cache: 'no-store', ...(useKey ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) } : {}) });
  const data = await response.json() as T & { error?: string; retryAt?: number };
  if (!response.ok) throw new ClientApiError(withRetryTime(data.error || '자료를 불러오지 못했습니다.', data.retryAt), response.status);
  return data;
}

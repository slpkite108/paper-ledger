import { openAlexKind, isArxiv, type KindInfo } from './publications';
import type { RecognitionEvidence } from './recognition';
import type { ConferenceInfo } from './conference-data';
import { applyPublicationDates, initialPublicationDates, type PublicationDates } from './publication-dates';
export const fields = [
  { key: 'professor', label: '참여교수', manual: false },
  { key: 'firstAuthor', label: '주저자명 (제 1저자)', manual: false },
  { key: 'coauthors', label: '공동저자명', manual: false },
  { key: 'category', label: '구분 (SCIE/BK인정/h5-index 50 이상)', manual: true },
  { key: 'title', label: '논문명', manual: false },
  { key: 'pages', label: '논문페이지 (시작/끝)', manual: false },
  { key: 'volume', label: '볼륨번호', manual: false },
  { key: 'published', label: '출판년월', manual: false },
  { key: 'authorCount', label: '저자수', manual: false },
  { key: 'assistants', label: '연구보조원수', manual: true },
  { key: 'isLead', label: '참여교수 주저자여부', manual: true },
  { key: 'venue', label: '학술지명 혹은 학술대회명', manual: false },
  { key: 'impactFactor', label: '학술지 IF (단, CS우수학술대회의 경우 인정 IF 입력)', manual: true },
  { key: 'link', label: 'DOI 번호/ISBN 등 관련 인터넷 link 주소', manual: false },
  { key: 'issn', label: 'ISSN', manual: false },
  { key: 'contribution', label: '기여율', manual: true },
  { key: 'funders', label: '사사 기관 수', manual: true },
] as const;
export type FieldKey = typeof fields[number]['key'];
export type Author = { id: string; display_name: string; works_count?: number; orcid?: string | null; last_known_institutions?: { display_name: string }[] | null };
type Authorship = { author?: { id?: string; display_name?: string }; author_position?: string; is_corresponding?: boolean };
export type Work = { id: string; doi?: string | null; title?: string | null; publication_date?: string; publication_year?: number; type?: string; authorships?: Authorship[]; is_authors_truncated?: boolean; biblio?: { first_page?: string | null; last_page?: string | null; volume?: string | null }; primary_location?: { landing_page_url?: string | null; source?: { id?: string; type?: string; display_name?: string; issn?: string[] | null; issn_l?: string | null } | null } | null };
export type Paper = KindInfo & { journalSource?: 'hcis' | 'crossref'; supplementalSource?: string; conference?: ConferenceInfo; venueManual?: boolean; id: string; authorId: string; doi: string; type: string; source: string; publicationDate: string; publicationDates?: PublicationDates; arxiv: boolean; warnings: string[]; role: string; verified: boolean; values: Record<FieldKey, string>; customValues?: Record<string, string>; evidence?: RecognitionEvidence; recognitionCategoryManual?: boolean; recognitionManual?: (keyof RecognitionEvidence)[]; automaticRecognition?: { category?: string; evidence: Partial<RecognitionEvidence> } };
export function safeUrl(value: string | null | undefined): string {
  if (!value) return '';
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function shortId(id: string) { return id.split('/').pop() ?? id; }
export function toPaper(work: Work, author: Author, professor: string): Paper {
  const authors = work.authorships ?? [];
  const first = authors.find(a => a.author_position === 'first');
  const self = authors.find(a => shortId(a.author?.id ?? '') === shortId(author.id));
  const source = work.primary_location?.source;
  const biblio = work.biblio;
  const values = Object.fromEntries(fields.map(f => [f.key, ''])) as Record<FieldKey, string>;
  Object.assign(values, {
    professor: professor.trim() || author.display_name,
    firstAuthor: first?.author?.display_name ?? '',
    coauthors: authors.filter(a => a !== first).map(a => a.author?.display_name).filter(Boolean).join('; '),
    title: work.title ?? '',
    pages: biblio?.first_page ? biblio.first_page + (biblio.last_page && biblio.last_page !== biblio.first_page ? ' / ' + biblio.last_page : '') : '',
    volume: biblio?.volume ?? '',
    published: '',
    authorCount: authors.length && !work.is_authors_truncated ? String(authors.length) : '',
    venue: source?.display_name ?? '',
    link: safeUrl(work.doi) || safeUrl(work.primary_location?.landing_page_url) || safeUrl(work.id),
    issn: source?.issn?.join('; ') || source?.issn_l || '',
  });
  return applyPublicationDates({ id: shortId(author.id) + ':' + shortId(work.id), authorId: author.id, doi: work.doi ?? '', type: work.type ?? '', source: work.id, values, verified: false, publicationDate: '', arxiv: isArxiv(work), ...openAlexKind(work),
    role: [self?.author_position === 'first' ? '제1저자' : '', self?.is_corresponding ? '교신저자' : ''].filter(Boolean).join(' · ') || '제1·교신저자 정보 미확인',
    warnings: [work.is_authors_truncated ? '저자 목록이 일부 생략되어 있습니다. 전체 저자와 저자수를 원문에서 확인하세요.' : '', !first ? '제1저자 순서 정보가 없습니다. 원문 확인이 필요합니다.' : ''].filter(Boolean) }, initialPublicationDates(work));
}
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+@\-\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function makeCsv(papers: Paper[]): string {
  return '\uFEFF' + [fields.map(f => csvCell(f.label)).join(','), ...papers.map(p => fields.map(f => csvCell(p.values[f.key])).join(','))].join('\r\n');
}
export function validationError(v: Record<FieldKey, string>): string {
  for (const key of ['authorCount', 'assistants', 'funders'] as const) if (v[key] && !/^\d+$/.test(v[key])) return '인원과 기관 수는 0 이상의 정수로 입력하세요.';
  if (v.contribution && (!/^\d+(\.\d+)?%?$/.test(v.contribution) || Number(v.contribution.replace('%', '')) > 100)) return '기여율은 0~100 범위로 입력하세요. (예: 25%)';
  if (v.impactFactor && !/^\d+(\.\d+)?$/.test(v.impactFactor)) return 'IF는 0 이상의 숫자로 입력하세요.';
  if (v.published && !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v.published)) return '출판년월은 YYYY-MM 형식으로 입력하세요. 월을 모르면 YYYY만 입력하세요.';
  return '';
}

import type { Paper, Work } from './papers';
import { publicationInRange, type PublicationRange } from './publication-range';
export const kindLabels = { journal: '저널', conference: '학술대회', preprint: '프리프린트', unknown: '미확인' } as const;
export type PublicationKind = keyof typeof kindLabels;
export type KindInfo = { publicationKind: PublicationKind; kindSource: string };
export function isArxiv(work: Work) {
  const source = work.primary_location?.source;
  const page = work.primary_location?.landing_page_url || '';
  let arxivHost = false;
  try { arxivHost = /(^|\.)arxiv\.org$/i.test(new URL(page).hostname); } catch { /* No landing page. */ }
  return source?.id === 'https://openalex.org/S4306400194' || /^arxiv\b/i.test(source?.display_name || '') || /^https?:\/\/(?:dx\.)?doi\.org\/10\.48550\/arxiv\./i.test(work.doi || '') || arxivHost;
}
export function openAlexKind(work: Work): KindInfo {
  const source = work.primary_location?.source?.type;
  if (source === 'conference' || ['proceedings-article', 'proceedings'].includes(work.type || '')) return { publicationKind: 'conference', kindSource: 'OpenAlex 출처' };
  if (work.type === 'preprint' || isArxiv(work)) return { publicationKind: 'preprint', kindSource: 'OpenAlex 출처' };
  if (source === 'journal' && ['article', 'review', 'journal-article'].includes(work.type || '')) return { publicationKind: 'journal', kindSource: 'OpenAlex 출처' };
  return { publicationKind: 'unknown', kindSource: '분류 정보 없음' };
}
export function crossrefKind(type?: string, eventName?: string): KindInfo {
  if (['proceedings-article', 'proceedings'].includes(type || '') || (type === 'book-chapter' && eventName)) return { publicationKind: 'conference', kindSource: 'Crossref 학술대회 메타데이터' };
  if (type === 'journal-article') return { publicationKind: 'journal', kindSource: 'Crossref journal-article' };
  if (type === 'posted-content') return { publicationKind: 'preprint', kindSource: 'Crossref posted-content' };
  return { publicationKind: 'unknown', kindSource: 'Crossref: ' + (type || '유형 없음') };
}
export function normalizedTitle(title: string) {
  return title.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}
function paperDate(p: Paper) {
  const editedMonth = p.values.published;
  return editedMonth && p.publicationDate?.startsWith(editedMonth) ? p.publicationDate : editedMonth;
}
export function latestByTitle(papers: Paper[]): Paper[] {
  const groups = new Map<string, Paper>();
  for (const paper of papers) {
    const title = normalizedTitle(paper.values.title);
    const key = paper.authorId + '\u0000' + paper.publicationKind + '\u0000' + (title || paper.id);
    const prior = groups.get(key);
    if (!prior || paperDate(paper) > paperDate(prior) || (paperDate(paper) === paperDate(prior) && paper.id.localeCompare(prior.id, 'en', { numeric: true }) > 0)) groups.set(key, paper);
  }
  const ids = new Set([...groups.values()].map(p => p.id));
  return papers.filter(p => ids.has(p.id));
}
export function conferenceCounterparts(papers:Paper[]):Set<string> {
  return new Set(papers.filter(p=>p.authorIdentity?.status!=='excluded' && p.publicationKind==='conference' && normalizedTitle(p.values.title)).map(p=>p.authorId+'\u0000'+normalizedTitle(p.values.title)));
}
export function visiblePublications(papers: Paper[], options: { excludeArxiv: boolean; mergeLatest: boolean; publicationKind: PublicationKind | 'all'; range?: PublicationRange; includeUnknownMonths?: boolean }) {
  const filtered = papers.filter(p => p.authorIdentity?.status !== 'excluded' && (!options.excludeArxiv || !p.arxiv) && (options.publicationKind === 'all' || p.publicationKind === options.publicationKind) && (!options.range || publicationInRange(p.values.published, options.range, options.includeUnknownMonths ?? true)));
  return options.mergeLatest ? latestByTitle(filtered) : filtered;
}

import type { Paper, Work } from './papers';
import verifiedDates from './verified-publication-dates.json';

export const dateLabels = {
  'conference-event': '학술대회 개최일',
  'publisher-issue': '출판사 권호 발행일',
  'publisher-metadata': '출판사 자동 확인',
  'publisher-citation': '가져온 인용정보 출판일',
  'crossref-print': 'Crossref 인쇄 발행일',
  'crossref-online': 'Crossref 온라인 공개일',
  'crossref-published': 'Crossref 출판일',
  'crossref-issued': 'Crossref 발행일',
  openalex: 'OpenAlex 출판일',
} as const;
export type DateSource = keyof typeof dateLabels;
export const dateBasisLabels = { issue: '권·호 발행일', online: '온라인 게재일' } as const;
export type DateBasis = keyof typeof dateBasisLabels;
export type DateCandidate = { source: DateSource; date: string; url: string; checkedOn?: string; note?: string; dateKind?: DateBasis | 'unspecified' };
export type PublicationDates = { candidates: DateCandidate[]; selected?: DateSource; manual?: boolean; basis?: DateBasis; crossrefChecked?: boolean; publisherChecked?: boolean };
export type DateParts = { 'date-parts'?: number[][] };
export type CrossrefDates = Partial<Record<'published-print' | 'published-online' | 'published' | 'issued', DateParts>>;

export function normalizedDoi(doi: string) { return doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase(); }

// Preserve the precision supplied by the source. Missing months are never January.
export function dateFromParts(value?: DateParts): string {
  const parts = value?.['date-parts']?.[0];
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 3 || !parts.every(Number.isInteger)) return '';
  const [year, month, day] = parts;
  if (year < 1000 || year > 2100 || (month !== undefined && (month < 1 || month > 12))) return '';
  if (day !== undefined && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())) return '';
  return parts.map((v, i) => i ? String(v).padStart(2, '0') : String(v)).join('-');
}
function validDate(value = '') {
  return /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value) ? dateFromParts({ 'date-parts': [value.split('-').map(Number)] }) : '';
}
export function initialPublicationDates(work: Work): PublicationDates {
  const candidates: DateCandidate[] = [];
  const date = validDate(work.publication_date) || dateFromParts({ 'date-parts': [[work.publication_year!]] });
  if (date) candidates.push({ source: 'openalex', date, url: work.id });
  const verified = (verifiedDates as Record<string, Omit<DateCandidate, 'source'>>)[normalizedDoi(work.doi || '')];
  if (verified) candidates.unshift({ ...verified, source: verified.dateKind==='unspecified'?'publisher-metadata':'publisher-issue' });
  return { candidates };
}
export function crossrefDateCandidates(m: CrossrefDates, doi: string): DateCandidate[] {
  return (['published-print', 'published-online', 'published', 'issued'] as const).flatMap(key => {
    const date = dateFromParts(m[key]);
    const source: DateSource = key === 'published-print' ? 'crossref-print' : key === 'published-online' ? 'crossref-online' : key === 'published' ? 'crossref-published' : 'crossref-issued';
    return date ? [{ source, date, url: 'https://api.crossref.org/works/' + encodeURIComponent(normalizedDoi(doi)) }] : [];
  });
}
export function candidateDateKind(c: DateCandidate): DateBasis | 'unspecified' {
  if(c.dateKind)return c.dateKind;
  if(c.source==='crossref-print'||c.source==='publisher-issue')return 'issue';
  if(c.source==='crossref-online')return 'online';
  // Only the explicitly named online field establishes this meaning.
  if(c.source==='publisher-metadata'&&/\bcitation_online_date\b/.test(c.note||''))return 'online';
  return 'unspecified';
}
function bestCandidate(candidates:DateCandidate[]) {
  const rank:Partial<Record<DateSource,number>>={'publisher-issue':0,'publisher-metadata':1,'publisher-citation':2,'crossref-print':3,'crossref-online':3,'crossref-published':4,'crossref-issued':5,openalex:6};
  return [...candidates].filter(c=>validDate(c.date)).sort((a,b)=>(rank[a.source]??9)-(rank[b.source]??9)||b.date.length-a.date.length||a.date.localeCompare(b.date))[0];
}
export function dateForBasis(info:PublicationDates|undefined,basis:DateBasis) {
  return bestCandidate((info?.candidates||[]).filter(c=>c.source!=='conference-event'&&candidateDateKind(c)===basis));
}
export function withDateBasis(paper:Paper,basis:DateBasis):Paper {
  return applyPublicationDates(paper,{...paper.publicationDates,candidates:paper.publicationDates?.candidates||[],basis});
}
export function dateResolution(paper:Paper):'preferred'|'fallback'|'unspecified'|'manual'|'missing'|'not-applicable' {
  if(paper.publicationKind!=='journal')return 'not-applicable';
  const info=paper.publicationDates;if(info?.manual)return 'manual';
  const c=info?.candidates.find(c=>c.source===info.selected);if(!c)return 'missing';
  const kind=candidateDateKind(c);return kind==='unspecified'?'unspecified':kind===(info?.basis||'issue')?'preferred':'fallback';
}
export function dateComparison(paper:Paper) {
  if(paper.publicationKind!=='journal')return '';
  const info=paper.publicationDates;
  return '권·호 '+(dateForBasis(info,'issue')?.date||'미확인')+' · 온라인 '+(dateForBasis(info,'online')?.date||'미확인');
}
export function preferredDate(info: PublicationDates, kind?: string): DateCandidate | undefined {
  if(kind==='conference')return info.candidates.find(c=>c.source==='conference-event');
  // Every path uses the same policy; source reliability ranks evidence only within a date kind.
  const basis=info.basis||'issue';
  return dateForBasis(info,basis)||dateForBasis(info,basis==='issue'?'online':'issue')||bestCandidate(info.candidates.filter(c=>c.source!=='conference-event'&&candidateDateKind(c)==='unspecified'));
}
export function applyPublicationDates(paper: Paper, info: PublicationDates): Paper {
  if (info.manual) return { ...paper, publicationDates: info };
  const selected = preferredDate(info,paper.publicationKind);
  const date = selected?.date || '';
  return { ...paper, verified: paper.verified && paper.values.published === date.slice(0, 7), publicationDates: { ...info, selected: selected?.source }, publicationDate: date, values: { ...paper.values, published: date.slice(0, 7) } };
}
export function setManualPublicationDate(paper: Paper, value: string): Paper {
  return { ...paper, publicationDate: value, publicationDates: { ...paper.publicationDates, candidates: paper.publicationDates?.candidates || [], selected: undefined, manual: true }, values: { ...paper.values, published: value } };
}
export function choosePublicationDate(paper: Paper, candidate: DateCandidate): Paper {
  return { ...setManualPublicationDate(paper, candidate.date.slice(0, 7)), publicationDate: candidate.date, publicationDates: { ...paper.publicationDates, candidates: paper.publicationDates?.candidates || [], selected: candidate.source, manual: true } };
}
export function dateSummary(paper: Paper) {
  const info = paper.publicationDates;
  if (info?.manual) return (info.selected ? dateLabels[info.selected]+' · ' : '')+'직접 지정'+(info.basis&&paper.publicationKind==='journal'?' · 기준 예외':'');
  const selected = info?.candidates.find(c => c.source === info.selected);
  if (!selected) return paper.publicationKind==='conference'?'개최일 미확인':'날짜 미확인';
  const resolution=dateResolution(paper);
  const reason=info?.basis&&paper.publicationKind==='journal'?(resolution==='fallback'?dateBasisLabels[candidateDateKind(selected) as DateBasis]+' 대체 · '+dateBasisLabels[info.basis]+' 없음 · ':resolution==='unspecified'?'종류 미확인 출판일 사용 · ':dateBasisLabels[info.basis]+' 기준 · '):'';
  const label = reason+dateLabels[selected.source];
  if (selected.date.length === 4) return label + ' · 월 미상';
  if (selected.source === 'openalex') return label + ' · 원문 확인 필요';
  return label;
}

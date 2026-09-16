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
export type DateCandidate = { source: DateSource; date: string; url: string; checkedOn?: string; note?: string };
export type PublicationDates = { candidates: DateCandidate[]; selected?: DateSource; manual?: boolean; crossrefChecked?: boolean; publisherChecked?: boolean };
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
  if (verified) candidates.unshift({ ...verified, source: 'publisher-issue' });
  return { candidates };
}
export function crossrefDateCandidates(m: CrossrefDates, doi: string): DateCandidate[] {
  return (['published-print', 'published-online', 'published', 'issued'] as const).flatMap(key => {
    const date = dateFromParts(m[key]);
    const source: DateSource = key === 'published-print' ? 'crossref-print' : key === 'published-online' ? 'crossref-online' : key === 'published' ? 'crossref-published' : 'crossref-issued';
    return date ? [{ source, date, url: 'https://api.crossref.org/works/' + encodeURIComponent(normalizedDoi(doi)) }] : [];
  });
}
export function preferredDate(info: PublicationDates, kind?: string): DateCandidate | undefined {
  if(kind==='conference')return info.candidates.find(c=>c.source==='conference-event');
  const livePublisher = info.candidates.find(c => c.source === 'publisher-metadata');
  if (livePublisher) return livePublisher;
  const publisher = info.candidates.find(c => c.source === 'publisher-issue');
  if (publisher) return publisher;
  const crossref = info.candidates.filter(c => c.source.startsWith('crossref-'));
  // Candidates are in print/online/published/issued order. Prefer a known month,
  // otherwise retain the registered year rather than an inferred OpenAlex month.
  return crossref.find(c => c.date.length >= 7) || crossref[0] || info.candidates.find(c => c.source === 'openalex');
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
  if (info?.manual) return info.selected ? dateLabels[info.selected] + ' · 직접 지정' : '직접 지정';
  const selected = info?.candidates.find(c => c.source === info.selected);
  if (!selected) return paper.publicationKind==='conference'?'개최일 미확인':'날짜 미확인';
  const label = dateLabels[selected.source];
  if (selected.date.length === 4) return label + ' · 월 미상';
  if (selected.source === 'openalex') return label + ' · 원문 확인 필요';
  return label;
}

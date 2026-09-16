import { crossrefKind, type KindInfo } from './publications';
import type { FieldKey, Paper } from './papers';
import { applyPublicationDates, crossrefDateCandidates, preferredDate, type CrossrefDates, type DateCandidate } from './publication-dates';
export type CrossrefMessage = CrossrefDates & { DOI?: string; type?: string; event?: { name?: string }; page?: string; volume?: string; 'container-title'?: string[]; ISSN?: string[] };
export type CrossrefData = Partial<Record<FieldKey, string>> & KindInfo & { dates: DateCandidate[] };
export function crossrefData(m: CrossrefMessage): CrossrefData {
  const dates = crossrefDateCandidates(m, m.DOI || '');
  return { dates, pages: typeof m.page === 'string' ? m.page.replace(/^(\S+)-(\S+)$/, '$1 / $2') : '', volume: m.volume || '', published: preferredDate({ candidates: dates })?.date.slice(0, 7) || '', venue: m['container-title']?.[0] || m.event?.name || '', issn: m.ISSN?.join('; ') || '', link: 'https://doi.org/' + m.DOI, ...crossrefKind(m.type, m.event?.name) };
}

export function applyCrossref(paper: Paper, data: CrossrefData, fillBlanks = false): Paper {
  const values = { ...paper.values, venue: paper.values.venue || data.venue || '' };
  if (fillBlanks) for (const key of ['pages', 'volume', 'venue', 'issn', 'link'] as const) if (!values[key] && data[key]) values[key] = data[key];
  const next = { ...paper, values, ...(paper.kindSource !== '직접 확인' && (data.publicationKind !== 'unknown' || paper.publicationKind === 'unknown') ? { publicationKind: data.publicationKind, kindSource: data.kindSource } : {}) };
  return applyPublicationDates(next, { ...paper.publicationDates, crossrefChecked: true, candidates: [...(paper.publicationDates?.candidates || []).filter(c => !c.source.startsWith('crossref-')), ...data.dates] });
}

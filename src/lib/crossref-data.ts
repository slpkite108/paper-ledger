import { crossrefKind, type KindInfo } from './publications';
import type { FieldKey, Paper } from './papers';
import { applyPublicationDates, crossrefDateCandidates, preferredDate, type CrossrefDates, type DateCandidate } from './publication-dates';
import { crossrefConference, conferenceCandidate, type ConferenceMetadata, type ConferenceInfo } from './conference-data';
import { allIdentifiers, applyIdentifiers, crossrefIdentifiers, mergeIdentifiers, issnList, type CrossrefIdentifiers, type JournalIdentifiers } from './journal-identifiers';
export type CrossrefMessage = CrossrefDates & ConferenceMetadata & CrossrefIdentifiers & { page?: string; volume?: string };
export type CrossrefData = Partial<Record<FieldKey, string>> & KindInfo & { dates: DateCandidate[]; conference?:ConferenceInfo; journalIdentifiers?: JournalIdentifiers };
export function crossrefData(m: CrossrefMessage): CrossrefData {
  const conference=crossrefConference(m),kind=crossrefKind(m.type,conference?.name),journalIdentifiers=crossrefIdentifiers(m);
  const dates = [...conferenceCandidate(conference),...crossrefDateCandidates(m, m.DOI || '')];
  return { dates, conference, journalIdentifiers, pages: typeof m.page === 'string' ? m.page.replace(/^(\S+)-(\S+)$/, '$1 / $2') : '', volume: m.volume || '', published: preferredDate({ candidates: dates },kind.publicationKind)?.date.slice(0, 7) || '', venue: kind.publicationKind==='conference' && conference ? conference.name+(conference.acronym?' ('+conference.acronym+')':'') : m['container-title']?.[0] || '', issn: allIdentifiers(journalIdentifiers).join('; '), link: 'https://doi.org/' + m.DOI, ...kind };
}

export function applyCrossref(paper: Paper, data: CrossrefData, fillBlanks = false): Paper {
  paper=applyIdentifiers(paper,data.journalIdentifiers||mergeIdentifiers({untyped:issnList(data.issn)}));
  const useConference=data.conference && data.publicationKind==='conference' && (paper.kindSource!=='직접 확인'||paper.publicationKind==='conference');
  const values = { ...paper.values, venue: useConference && !paper.venueManual ? data.venue || paper.values.venue : paper.values.venue || data.venue || '' };
  if (fillBlanks) for (const key of ['pages', 'volume', 'venue', 'link'] as const) if (!values[key] && data[key]) values[key] = data[key];
  const next = { ...paper, values, conference:data.conference, ...(paper.kindSource !== '직접 확인' && (data.publicationKind !== 'unknown' || paper.publicationKind === 'unknown') ? { publicationKind: data.publicationKind, kindSource: data.kindSource } : {}) };
  return applyPublicationDates(next, { ...paper.publicationDates, crossrefChecked: true, candidates: [...(paper.publicationDates?.candidates || []).filter(c => !c.source.startsWith('crossref-') && c.source!=='conference-event'), ...data.dates] });
}

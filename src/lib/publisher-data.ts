import type { Paper } from './papers';
import { applyPublicationDates, dateFromParts, normalizedDoi, type DateCandidate } from './publication-dates';

const endpoint = 'https://paper-ledger-publication-dates.slpkite108.chatgpt.site/api/publication-date';
export function supportsPublisherDate(doi: string) { return /^10\.32604\/[a-z][a-z0-9.\-]{2,160}$/i.test(normalizedDoi(doi)); }
export async function getPublisherDate(doi: string): Promise<DateCandidate | null> {
  const normalized = normalizedDoi(doi); if (!supportsPublisherDate(normalized)) return null;
  const response = await fetch(endpoint + '?' + new URLSearchParams({ doi: normalized }), { credentials: 'omit', signal: AbortSignal.timeout(22000) });
  if (!response.ok) throw new Error('출판사 날짜 확인 실패 (' + response.status + ')');
  const value = await response.json() as DateCandidate & { doi?: string };
  const date = /^\d{4}-\d{2}(?:-\d{2})?$/.test(value.date || '') ? dateFromParts({ 'date-parts': [value.date.split('-').map(Number)] }) : '';
  let validUrl = false;
  try { const url = new URL(value.url); validUrl = url.protocol === 'https:' && ['www.techscience.com', 'techscience.com'].includes(url.hostname) && !url.username && !url.password; } catch { /* Invalid provenance. */ }
  if (normalizedDoi(value.doi || '') !== normalized || !date || !validUrl || value.source !== 'publisher-metadata') throw new Error('출판사 날짜 응답의 DOI·날짜·출처를 확인하지 못했습니다.');
  return { source: 'publisher-metadata', date, url: value.url, checkedOn: value.checkedOn, note: value.note };
}
export function applyPublisherDate(paper: Paper, candidate: DateCandidate): Paper {
  return applyPublicationDates(paper, { ...paper.publicationDates, publisherChecked: true, candidates: [...(paper.publicationDates?.candidates || []).filter(c => c.source !== 'publisher-metadata'), candidate] });
}

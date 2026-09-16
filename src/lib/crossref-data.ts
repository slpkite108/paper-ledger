import { crossrefKind, type KindInfo } from './publications';
import type { FieldKey } from './papers';
type DateParts = { 'date-parts'?: number[][] };
export type CrossrefMessage = { DOI?: string; type?: string; event?: { name?: string }; page?: string; volume?: string; 'published-print'?: DateParts; published?: DateParts; issued?: DateParts; 'container-title'?: string[]; ISSN?: string[] };
export type CrossrefData = Partial<Record<FieldKey, string>> & KindInfo;
export function crossrefData(m: CrossrefMessage): CrossrefData {
  const date = (m['published-print'] || m.published || m.issued)?.['date-parts']?.[0];
  return { pages: typeof m.page === 'string' ? m.page.replace(/^(\S+)-(\S+)$/, '$1 / $2') : '', volume: m.volume || '', published: date?.[0] ? String(date[0]) + (date[1] ? '-' + String(date[1]).padStart(2, '0') : '') : '', venue: m['container-title']?.[0] || m.event?.name || '', issn: m.ISSN?.join('; ') || '', link: 'https://doi.org/' + m.DOI, ...crossrefKind(m.type, m.event?.name) };
}

import type { Paper } from './papers';

export type JournalIdentifiers = { electronic: string[]; print: string[]; linking: string[]; untyped: string[]; urls: string[] };
export type CrossrefIdentifiers = { ISSN?: string[]; 'issn-type'?: { type?: string; value?: string }[]; DOI?: string };
const unique = (values: string[]) => [...new Set(values)];
export function issnList(values: string | string[] | null | undefined): string[] {
  return unique((Array.isArray(values) ? values : [values || '']).flatMap(value => typeof value === 'string' ? (value.toUpperCase().match(/\b\d{4}-?\d{3}[\dX]\b/g) || []).map(v => v.replace('-', '')).map(v => v.slice(0,4)+'-'+v.slice(4)) : []));
}
export function mergeIdentifiers(...items: (Partial<JournalIdentifiers> | undefined)[]): JournalIdentifiers {
  const collect = (key: keyof JournalIdentifiers) => unique(items.flatMap(v => v?.[key] || []));
  const electronic = collect('electronic'), print = collect('print');
  // Conflicting media labels are kept as unknown; ordering never determines media.
  const conflict = electronic.filter(v => print.includes(v));
  return { electronic: electronic.filter(v => !conflict.includes(v)), print: print.filter(v => !conflict.includes(v)), linking: collect('linking'), untyped: unique([...collect('untyped'),...conflict]).filter(v => conflict.includes(v) || !electronic.includes(v) && !print.includes(v)), urls: collect('urls') };
}
export function crossrefIdentifiers(m: CrossrefIdentifiers): JournalIdentifiers {
  const typed = m['issn-type'] || [];
  return mergeIdentifiers({ electronic: typed.filter(v => v.type === 'electronic').flatMap(v => issnList(v.value)), print: typed.filter(v => v.type === 'print').flatMap(v => issnList(v.value)), untyped: issnList([...(m.ISSN || []),...typed.map(v => v.value || '')]), urls: m.DOI ? ['https://api.crossref.org/works/'+encodeURIComponent(m.DOI)] : [] });
}
export function allIdentifiers(ids: JournalIdentifiers): string[] {
  return unique([...ids.electronic,...ids.print,...ids.untyped,...ids.linking]);
}
export function paperIdentifiers(p: Paper): JournalIdentifiers {
  const ids = mergeIdentifiers(p.journalIdentifiers,{untyped:issnList(p.values.issn)});
  if (!p.issnManual) return ids;
  const retained = issnList(p.values.issn);
  return { ...ids, electronic: ids.electronic.filter(v => retained.includes(v)), print: ids.print.filter(v => retained.includes(v)), linking: ids.linking.filter(v => retained.includes(v)), untyped: ids.untyped.filter(v => retained.includes(v)) };
}
export function applyIdentifiers(p: Paper, incoming: JournalIdentifiers, incomingFirst = ''): Paper {
  const journalIdentifiers = mergeIdentifiers(p.journalIdentifiers,{untyped:issnList(p.values.issn)},incoming);
  const originalFirstIssn=p.originalFirstIssn || issnList(p.values.issn)[0] || issnList(incomingFirst)[0] || allIdentifiers(journalIdentifiers)[0] || '';
  return withIssnPreference({...p,journalIdentifiers,originalFirstIssn},p.preferIssnL || false);
}
export function primaryIssn(p: Paper): string {
  if(p.issnManual)return issnList(p.values.issn)[0] || '';
  return (p.preferIssnL && p.journalIdentifiers?.linking[0]) || p.originalFirstIssn || issnList(p.values.issn)[0] || '';
}
export function withIssnPreference(p: Paper, preferIssnL: boolean): Paper {
  const next={...p,preferIssnL,originalFirstIssn:p.originalFirstIssn || issnList(p.values.issn)[0] || ''};
  return {...next,values:{...p.values,issn:p.issnManual?p.values.issn:primaryIssn(next)}};
}
export function setManualIssn(p: Paper, value: string): Paper { return {...p,issnManual:true,values:{...p.values,issn:value}}; }
export function preferredIssn(p: Paper): string {
  const ids = paperIdentifiers(p);
  return (ids.electronic.length ? ids.electronic : ids.print.length ? ids.print : unique([...ids.untyped,...ids.linking])).join('; ');
}
export function issnSummary(p: Paper): string {
  const ids = paperIdentifiers(p),parts = [ids.electronic.length ? '온라인 eISSN '+ids.electronic.join('; ') : '', ids.print.length ? '인쇄 pISSN '+ids.print.join('; ') : '', ids.untyped.length ? '매체 미확인 '+ids.untyped.join('; ') : '', ids.linking.length ? 'ISSN-L '+ids.linking.join('; ') : ''].filter(Boolean);
  return parts.join(' · ') || 'ISSN 미확인';
}

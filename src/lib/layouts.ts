import { z } from 'zod';
import { primaryIssn, paperIdentifiers, preferredIssn, issnSummary } from './journal-identifiers';
import { fields, csvCell, type Paper } from './papers';
import { kindLabels } from './publications';
import { criteriaSchema, defaultCriteria } from './criteria';
import { dateFromParts, dateSummary, dateForBasis, dateBasisLabels } from './publication-dates';

export const sources = [...fields.map(f => ({ key: f.key as string, label: f.label as string })),
  { key: 'electronicIssn', label: '온라인 ISSN (eISSN)' }, { key: 'printIssn', label: '인쇄 ISSN (pISSN)' }, { key: 'linkingIssn', label: '연결 ISSN (ISSN-L)' }, { key: 'preferredIssn', label: 'ISSN (온라인 우선)' }, { key: 'issnDetails', label: 'ISSN 매체 구분' },
  { key: 'publicationKind', label: '학술유형 (저널/Conference)' }, { key: 'doi', label: 'DOI' },
  { key: 'publicationDateSource', label: '출판일·개최일 근거' },
  { key: 'issueDate', label: '권·호 발행일 (원본)' }, { key: 'onlineDate', label: '온라인 게재일 (원본)' }, { key: 'publicationDateBasis', label: '출판일 적용 기준' },
  { key: 'conferenceName', label: '학술대회 명칭' }, { key: 'conferenceDates', label: '학술대회 개최기간' }, { key: 'proceedings', label: '학술대회 논문집명' },
  { key: 'verified', label: '확인 상태' }, { key: 'scie', label: 'SCIE 확인 결과' }, { key: 'bk', label: 'BK 확인 결과' },
  { key: 'cs', label: 'CS 우수학술대회 확인 결과' }, { key: 'h5', label: '학술지·학술대회 h5-index' }, { key: 'evidence', label: '인정 근거·기준연도' },
  { key: 'rowNumber', label: '행 번호' }, { key: 'constant', label: '고정값 (모든 행 공통)' }, { key: 'manual', label: '사용자 항목 (논문별 입력)' }];
export const formats = { text: '텍스트', number: '숫자', decimal: '소수 둘째 자리', percent: '백분율 (25 → 25%)', year: '연도', month: '연-월' } as const;
const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const columnSchema = z.object({ id: idSchema, label: z.string().trim().min(1).max(150), source: z.string().refine(v => sources.some(s => s.key === v)), constant: z.string().max(2000).default(''), width: z.number().int().min(8).max(100), align: z.enum(['left', 'center', 'right']), format: z.enum(['text', 'number', 'decimal', 'percent', 'year', 'month']) });
export const sortSchema = z.object({ key: z.string().min(1).max(120), direction: z.enum(['asc', 'desc']) });
export const layoutSchema = z.object({ version: z.literal(1), id: idSchema, name: z.string().trim().min(1).max(80), columns: z.array(columnSchema).min(1).max(100), criteria: criteriaSchema, dateBasis: z.enum(['issue','online']).default('issue'),
  style: z.object({ headerColor: z.string().regex(/^#[0-9a-f]{6}$/i), fontSize: z.number().int().min(9).max(20), striped: z.boolean(), wrap: z.boolean() }), sort: z.array(sortSchema).max(3) })
  .refine(v => new Set(v.columns.map(c => c.id)).size === v.columns.length, '열 식별자가 중복됩니다.')
  .refine(v => v.sort.every(s => sources.some(f => !['manual', 'constant', 'rowNumber'].includes(f.key) && f.key === s.key) || v.columns.some(c => c.source !== 'rowNumber' && 'column:' + c.id === s.key)), '정렬 기준을 확인하세요.');
export type Layout = z.infer<typeof layoutSchema>;
export type Column = z.infer<typeof columnSchema>;
export type SortRule = z.infer<typeof sortSchema>;
export const defaultSort: SortRule[] = [{ key: 'published', direction: 'desc' }, { key: 'professor', direction: 'asc' }];
export function defaultLayout(): Layout { return { version: 1, id: 'default-17', dateBasis: 'issue', name: '기본 연구실적 17항목', criteria: structuredClone(defaultCriteria), columns: fields.map(f => ({ id: f.key, label: f.label, source: f.key, constant: '', width: ['title', 'coauthors', 'venue', 'link'].includes(f.key) ? 45 : 20, align: 'left', format: ['authorCount', 'assistants', 'funders'].includes(f.key) ? 'number' : 'text' })), style: { headerColor: '#234264', fontSize: 11, striped: true, wrap: true }, sort: defaultSort }; }
export function newColumn(label = '새 항목'): Column { return { id: crypto.randomUUID(), label, source: matchHeader(label), constant: '', width: 24, align: 'left', format: 'text' }; }
function normalize(s: string) { return s.normalize('NFKC').toLowerCase().replace(/<br\s*\/?\s*>/gi, '').replace(/[\s_()·/\-]/g, ''); }
const aliases: Record<string, string[]> = { electronicIssn: ['eISSN','e-ISSN','electronic ISSN','online ISSN','온라인 ISSN'], printIssn: ['pISSN','p-ISSN','print ISSN','인쇄 ISSN'], linkingIssn: ['ISSN-L'], title: ['제목', '논문제목', 'title', 'paper title'], professor: ['교수', '참여 교수', '연구자'], firstAuthor: ['제1저자', '주저자', 'first author'], coauthors: ['공저자', '공동저자', 'coauthors'], venue: ['학술지명', '학술대회명', '학회명', 'journal', 'conference', 'venue'], published: ['발행년월', '출판일', '출판연도', '발행연도', 'publication date', 'year'], authorCount: ['저자 수', 'authors count'], pages: ['페이지', 'pages'], volume: ['권', 'volume'], link: ['url', '링크', '인터넷 link 주소'], impactFactor: ['if', 'impact factor', '인정 if'], category: ['구분', '인정구분'], contribution: ['기여율(%)'], scie: ['scie', 'scie 여부'], bk: ['bk', 'bk인정'], h5: ['h5', 'h5-index'] };
export function matchHeader(label: string) { const n = normalize(label); return sources.find(f => normalize(f.label) === n || normalize(f.key) === n || aliases[f.key]?.some(a => normalize(a) === n))?.key || 'manual'; }

// Excel TSV quoting permits tabs and line breaks inside quoted cells.
export function parseTsv(text: string): string[][] {
  if (text.length > 1000000) throw new Error('붙여넣기는 1MB 이하로 나누어 주세요.');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const value = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < value.length; i++) { const ch = value[i];
    if (ch === '"' && (quoted || cell === '')) { if (quoted && value[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === '\t' || ch === '\n')) { row.push(cell); cell = ''; if (ch === '\n') { rows.push(row); row = []; } }
    else cell += ch;
  }
  if (quoted) throw new Error('닫히지 않은 따옴표가 있습니다. Excel의 머리글 셀을 다시 복사하세요.');
  row.push(cell); rows.push(row); return rows.filter(r => r.some(c => c.trim()));
}
export function headersFromTsv(text: string, orientation: 'row' | 'column') {
  const rows = parseTsv(text); const labels = (orientation === 'column' ? rows.map(r => r[0] || '') : rows[0] || []).map(v => v.trim()).filter(Boolean);
  if (!labels.length || labels.length > 100 || labels.some(s => s.length > 150)) throw new Error('이름이 있는 머리글 1~100개를 복사하세요. 이름은 150자 이내입니다.');
  return labels.map(label => newColumn(label));
}
export function sourceValue(p: Paper, source: string): string {
  if (source === 'issn') return primaryIssn(p);
  if (source === 'preferredIssn') return preferredIssn(p);
  if (source === 'issnDetails') return issnSummary(p);
  if (source === 'electronicIssn' || source === 'printIssn' || source === 'linkingIssn') return paperIdentifiers(p)[source==='electronicIssn'?'electronic':source==='printIssn'?'print':'linking'].join('; ');
  if (source in p.values) return p.values[source as keyof Paper['values']];
  if (source === 'issueDate' || source === 'onlineDate') return dateForBasis(p.publicationDates,source==='issueDate'?'issue':'online')?.date||'';
  if (source === 'publicationDateBasis') return p.publicationKind==='conference'?'학술대회 개최일':p.publicationKind==='journal'?dateBasisLabels[p.publicationDates?.basis||'issue']+' · '+dateSummary(p):'저널 외 문헌';
  if (source === 'publicationKind') return kindLabels[p.publicationKind];
  if (source === 'verified') return p.verified ? '확인 완료' : '검토 필요';
  if (source === 'doi') return p.doi;
  if (source === 'conferenceName') return p.conference?.name || '';
  if (source === 'conferenceDates') return p.conference ? [p.conference.start,p.conference.end].filter(Boolean).join(' ~ ') : '';
  if (source === 'proceedings') return p.conference?.proceedings || '';
  if (source === 'publicationDateSource') return (dateSummary(p) + ' ' + (p.publicationDates?.candidates.find(c => c.source === p.publicationDates?.selected)?.url || '')).trim();
  if (source === 'scie' || source === 'bk' || source === 'cs') return ({ yes: '해당', no: '비해당', unknown: '미확인' })[(source === 'cs' && p.evidence?.bk.status === 'yes' ? 'yes' : p.evidence?.[source]?.status) || 'unknown'];
  if (source === 'h5') return p.evidence?.h5.value || '';
  if (source === 'evidence') return p.evidence ? Object.entries(p.evidence).filter(([,e]) => e.year || e.url || e.note).map(([k,e]) => `${k.toUpperCase()}: ${e.year} ${e.url} ${e.note}`.trim()).join('\n') : '';
  return '';
}
export function columnValue(p: Paper, c: Column, index = 0) { return c.source === 'manual' ? p.customValues?.[c.id] || '' : c.source === 'constant' ? c.constant : c.source === 'rowNumber' ? String(index + 1) : sourceValue(p, c.source); }
export function numericValue(value: string): number | null { const text = value.trim().replace(/,/g, '').replace(/%$/, ''); return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null; }
export function displayValue(value: string, format: Column['format']) {
  if (!value.trim()) return '';
  if (format === 'year' && /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value)) return value.slice(0, 4);
  if (format === 'month' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return value.slice(0, 7);
  const n = numericValue(value); if (n === null) return value;
  return format === 'number' ? String(n) : format === 'decimal' ? n.toFixed(2) : format === 'percent' ? n + '%' : value;
}
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
export function isDateSort(layout: Layout, key: string): boolean {
  const column = layout.columns.find(c => 'column:' + c.id === key);
  return ['published','issueDate','onlineDate'].includes(key) || ['published','issueDate','onlineDate'].includes(column?.source||'') || column?.format === 'year' || column?.format === 'month';
}
function chronologicalParts(value: string): number[] | null {
  if (!/^\d{4}(?:-\d{1,2}){0,2}$/.test(value)) return null;
  const parts = value.split('-').map(Number);
  return dateFromParts({ 'date-parts': [parts] }) ? parts : null;
}
function compareChronologically(a: string, b: string, direction: SortRule['direction']): number {
  const left = chronologicalParts(a), right = chronologicalParts(b);
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    // Unknown precision follows known dates within the same year/month in either direction.
    if (left[i] === undefined || right[i] === undefined) return left[i] === right[i] ? 0 : left[i] === undefined ? 1 : -1;
    if (left[i] !== right[i]) return (left[i] - right[i]) * (direction === 'asc' ? 1 : -1);
  }
  return 0;
}
export function sortPapers(papers: Paper[], layout: Layout): Paper[] {
  return [...papers].sort((a, b) => { for (const rule of layout.sort) {
    const c = rule.key.startsWith('column:') ? layout.columns.find(c => 'column:' + c.id === rule.key) : undefined;
    const av = (c ? columnValue(a, c) : sourceValue(a, rule.key)).trim(); const bv = (c ? columnValue(b, c) : sourceValue(b, rule.key)).trim();
    if (!av || !bv) { if (av !== bv) return av ? -1 : 1; continue; } // Unknown is last in either direction.
    if (isDateSort(layout, rule.key)) {
      const compared = compareChronologically(av, bv, rule.direction);
      if (compared) return compared;
      continue;
    }
    const numeric = c ? ['number', 'decimal', 'percent'].includes(c.format) : ['authorCount', 'assistants', 'funders', 'impactFactor', 'contribution', 'h5'].includes(rule.key);
    const an = numericValue(av); const bn = numericValue(bv);
    const compared = numeric && an !== null && bn !== null ? an - bn : collator.compare(av, bv);
    if (compared) return rule.direction === 'asc' ? compared : -compared;
  } return 0; });
}
export function layoutCsv(papers: Paper[], layout: Layout) { return '\uFEFF' + [layout.columns.map(c => csvCell(c.label)).join(','), ...papers.map((p,i) => layout.columns.map(c => csvCell(displayValue(columnValue(p,c,i),c.format))).join(','))].join('\r\n'); }
const storageKey = 'paper-ledger-layouts-v1';
export function readLocalLayouts(): Layout[] { return z.array(layoutSchema).max(50).parse(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
export function saveLocalLayout(value: Layout) { const layout = layoutSchema.parse(value); const all = readLocalLayouts().filter(l => l.id !== layout.id); if (all.length >= 50) throw new Error('프리셋은 50개까지 저장할 수 있습니다.'); localStorage.setItem(storageKey, JSON.stringify([layout, ...all])); }
export function deleteLocalLayout(id: string) { localStorage.setItem(storageKey, JSON.stringify(readLocalLayouts().filter(l => l.id !== id))); }

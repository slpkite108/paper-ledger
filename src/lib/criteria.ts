import { z } from 'zod';
import bkCs from './bk-cs-data.json';
import type { Paper } from './papers';
import { emptyEvidence, recognizedCategory } from './recognition';

export const referenceRowSchema = z.object({ venue: z.string().trim().min(1).max(500), issn: z.string().max(100).default(''), alias: z.string().max(100).default(''), category: z.enum(['BK인정','SCIE','h5-index','참고']), value: z.string().max(100).default(''), impactFactor: z.string().max(30).default('') }).refine(r=>r.category!=='h5-index'||/^\d{1,5}$/.test(r.value),'h5-index는 0 이상의 정수여야 합니다.').refine(r=>!r.impactFactor||/^\d+(\.\d+)?$/.test(r.impactFactor),'인정 IF를 확인하세요.');
export const referenceSchema = z.object({ id:z.string().min(1).max(100), name:z.string().trim().min(1).max(100), year:z.string().regex(/^\d{4}$/), url:z.string().url().refine(v=>/^https?:\/\//.test(v)), rows:z.array(referenceRowSchema).min(1).max(5000) });
export type Reference = z.infer<typeof referenceSchema>;
export const bkUrl='https://kast.or.kr/kr/notice/notice.php?bbs_data=aWR4PTIzNDE4JnN0YXJ0UGFnZT0wJmxpc3RObz00ODgmdGFibGU9JmNvZGU9bm90aWNlJnNlYXJjaF9pdGVtPSZzZWFyY2hfb3JkZXI9%7C%7C&bgu=view&cate=&code=notice&idx=23418';
export const builtinBk:Reference={id:'bk-cs-2026',name:'CS · BK21 목록 (2026 공식 공고 첨부)',year:'2026',url:bkUrl,rows:bkCs.map(r=>({...r,issn:'',category:'BK인정',value:r.code}))};
export const criteriaOptions=[{key:builtinBk.id,label:builtinBk.name},{key:'kiise-2024',label:'CS · 한국정보과학회 우수학술대회 (2024 개편)'},{key:'scie-live',label:'전 분야 · SCIE 공식 목록 (현재 수록 상태)'},{key:'h5-cs-2025',label:'CS · Scholar Metrics (2025년 7월판)'},{key:'h5-all-2025',label:'전 분야 · Scholar Metrics (2025년 7월판)'}];
export const defaultCriteria={selected:builtinBk.id,custom:[] as Reference[]};
export const criteriaSchema=z.object({selected:z.string().min(1).max(100),custom:z.array(referenceSchema).max(10)}).refine(v=>criteriaOptions.some(o=>o.key===v.selected)||v.custom.some(r=>r.id===v.selected),'선택한 기준 자료가 없습니다.').refine(v=>new Set(v.custom.map(r=>r.id)).size===v.custom.length && v.custom.every(r=>!criteriaOptions.some(o=>o.key===r.id)),'기준표 식별자가 중복됩니다.').default(defaultCriteria);
export function venueKey(s:string) {return s.normalize('NFKC').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g,'').replace(/\b\d+(?:st|nd|rd|th)\b/g,'').replace(/\b(?:proceedings|of|the|annual)\b/g,'').replace(/[^\p{L}\p{N}]/gu,'');}
const issns=(s:string)=>s.toUpperCase().match(/\b\d{4}-?\d{3}[\dX]\b/g)?.map(v=>v.replace('-',''))||[];
export function matchReference(p:Paper,reference:Reference) {
  const key=venueKey(p.values.venue); const ids=issns(p.values.issn);
  return reference.rows.filter(row=>{
    if(row.category==='BK인정' && (p.arxiv || p.publicationKind==='journal' || p.publicationKind==='preprint')) return false;
    if(row.category==='SCIE' && p.publicationKind==='conference') return false;
    if(ids.length && issns(row.issn).some(id=>ids.includes(id))) return true;
    if(!key) return false;
    return key===venueKey(row.venue) || (!!row.alias && key===venueKey(row.alias));
  });
}
export function applyReference(p:Paper,reference:Reference,row:Reference['rows'][number]):Paper {
  const evidence=structuredClone(p.evidence||emptyEvidence()); const note=reference.name+' · '+row.venue+(row.value?' · '+row.value:'');
  if(row.category==='BK인정')evidence.bk={status:'yes',year:reference.year,url:reference.url,note};
  if(row.category==='SCIE')evidence.scie={status:'yes',year:reference.year,url:reference.url,note};
  if(row.category==='h5-index')evidence.h5={value:row.value,year:reference.year,url:reference.url,note};
  const additions=recognizedCategory(evidence).split(' / ').filter(Boolean);const previous=p.values.category.split(' / ').filter(v=>v && !(row.category==='h5-index' && v==='h5-index 50 이상'));const category=[...new Set([...previous,...additions])].join(' / ');
  return {...p,evidence,values:{...p.values,category,impactFactor:p.values.impactFactor||(row.category==='BK인정'?row.impactFactor:'')}};
}

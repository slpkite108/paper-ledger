import { z } from 'zod';
import bkCs from './bk-cs-data.json';
import ieeeScie from './ieee-scie-2026.json';
import type { Paper } from './papers';
import { completeEvidence, recognizedCategory, type RecognitionEvidence } from './recognition';

export const referenceRowSchema = z.object({ venue: z.string().trim().min(1).max(500), issn: z.string().max(100).default(''), alias: z.string().max(500).default(''), category: z.enum(['BK인정','CS우수학술대회','SCIE','h5-index','참고']), value: z.string().max(100).default(''), impactFactor: z.string().max(30).default('') }).refine(r=>r.category!=='h5-index'||/^\d{1,5}$/.test(r.value),'h5-index는 0 이상의 정수여야 합니다.').refine(r=>!r.impactFactor||/^\d+(\.\d+)?$/.test(r.impactFactor),'인정 IF를 확인하세요.');
export const referenceSchema = z.object({ id:z.string().min(1).max(100), name:z.string().trim().min(1).max(100), year:z.string().regex(/^\d{4}$/), url:z.string().url().refine(v=>/^https?:\/\//.test(v)), rows:z.array(referenceRowSchema).min(1).max(5000) });
export type Reference = z.infer<typeof referenceSchema>;
export function isSocietyRecommendation(reference:Reference) { return /(?:^|\.)(?:kiise\.or\.kr|aisociety\.kr|kmms\.or\.kr)$/.test(new URL(reference.url).hostname); }
export const bkUrl='https://kast.or.kr/kr/notice/notice.php?bbs_data=aWR4PTIzNDE4JnN0YXJ0UGFnZT0wJmxpc3RObz00ODgmdGFibGU9JmNvZGU9bm90aWNlJnNlYXJjaF9pdGVtPSZzZWFyY2hfb3JkZXI9%7C%7C&bgu=view&cate=&code=notice&idx=23418';
export const builtinBk:Reference={id:'bk-cs-2026',name:'CS · BK21 목록 (2026 공식 공고 첨부)',year:'2026',url:bkUrl,rows:bkCs.map(r=>({...r,alias:r.alias==='BIBM'?r.alias+'; IEEE International Conference on Bioinformatics and Biomedicine':r.alias,issn:'',category:'BK인정',value:r.code}))};
export const builtinIeee:Reference={id:'ieee-scie-2026-08',name:'SCIE · IEEE 공식 목록 (2026년 8월)',year:'2026',url:'https://open.ieee.org/wp-content/uploads/IEEE-Title-List-August-2026.xlsx',rows:ieeeScie.map(r=>({...r,category:'SCIE'}))};
const publisherReference=(id:string,venue:string,issn:string,url:string,alias=''):Reference=>({id,name:'SCIE · '+venue+' (2026-09-16 확인)',year:'2026',url,rows:[{venue,issn,alias,category:'SCIE',value:'',impactFactor:''}]});
export const builtinReferences:Reference[]=[builtinBk,builtinIeee,
  publisherReference('scie-cmc-2026','Computers, Materials & Continua','1546-2218;1546-2226','https://www.techscience.com/cmc/info/Indexed','Computers, Materials & Continua (Print)'),
  publisherReference('scie-cmes-2026','Computer Modeling in Engineering & Sciences','1526-1492;1526-1506','https://www.techscience.com/CMES/info/Indexed','CMES'),
  publisherReference('scie-apin-2026','Applied Intelligence','0924-669X;1573-7497','https://link.springer.com/journal/10489')];
export const criteriaOptions=[...builtinReferences.map(r=>({key:r.id,label:r.name})),{key:'kiise-2024',label:'참고만 · 한국정보과학회 권장 목록 (BK 판정 제외)'},{key:'scie-live',label:'전 분야 · SCIE 공식 목록 (현재 수록 상태)'},{key:'h5-cs-2025',label:'CS · Scholar Metrics (2025년 7월판)'},{key:'h5-all-2025',label:'전 분야 · Scholar Metrics (2025년 7월판)'}];
export const defaultCriteria={selected:builtinBk.id,custom:[] as Reference[],automatic:true,automaticSources:builtinReferences.map(r=>r.id)};
export const criteriaSchema=z.object({selected:z.string().min(1).max(100),custom:z.array(referenceSchema).max(10),automatic:z.boolean().default(true),automaticSources:z.array(z.string().min(1).max(100)).max(30).default(defaultCriteria.automaticSources)}).refine(v=>criteriaOptions.some(o=>o.key===v.selected)||v.custom.some(r=>r.id===v.selected),'선택한 기준 자료가 없습니다.').refine(v=>new Set(v.custom.map(r=>r.id)).size===v.custom.length && v.custom.every(r=>!criteriaOptions.some(o=>o.key===r.id)),'기준표 식별자가 중복됩니다.').refine(v=>v.automaticSources.every(id=>builtinReferences.some(r=>r.id===id)||v.custom.some(r=>r.id===id)),'자동 대조 자료가 없습니다.').default(defaultCriteria);
export type Criteria = z.infer<typeof criteriaSchema>;
export function venueKey(s:string) {return s.normalize('NFKC').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g,'').replace(/\b\d+(?:st|nd|rd|th)\b/g,'').replace(/\b(?:proceedings|of|the|annual)\b/g,'').replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');}
const issns=(s:string)=>s.toUpperCase().match(/\b\d{4}-?\d{3}[\dX]\b/g)?.map(v=>v.replace('-',''))||[];
export function matchReference(p:Paper,reference:Reference) {
  if(p.arxiv || p.publicationKind==='preprint')return [];
  const key=venueKey(p.values.venue); const ids=issns(p.values.issn);
  return reference.rows.filter(row=>{
    if(isSocietyRecommendation(reference) && ['BK인정','CS우수학술대회'].includes(row.category))return false;
    if(['BK인정','CS우수학술대회','h5-index'].includes(row.category) && p.publicationKind!=='conference')return false;
    if(row.category==='SCIE' && p.publicationKind!=='journal')return false;
    const rowIds=issns(row.issn);
    if(ids.length && rowIds.length) {
      if(!rowIds.some(id=>ids.includes(id)))return false;
      if(row.category==='SCIE')return true;
    }
    if(!key) return false;
    const aliases=row.alias.split(';').map(s=>s.trim()).filter(Boolean);
    const names=[row.venue,...aliases.filter(a=>row.category!=='SCIE'||venueKey(a).length>8)];
    if(names.some(n=>key===venueKey(n)))return true;
    const suffix=p.values.venue.match(/\s*\(([^()]*)\)\s*$/);
    return !!suffix && aliases.some(a=>venueKey(a)===venueKey(suffix[1])) && names.some(n=>venueKey(p.values.venue.slice(0,suffix.index))===venueKey(n));
  });
}
export function applyReference(p:Paper,reference:Reference,row:Reference['rows'][number]):Paper {
  if(isSocietyRecommendation(reference) && ['BK인정','CS우수학술대회'].includes(row.category))return p;
  const evidence=completeEvidence(p.evidence); const note=reference.name+' · '+row.venue+(row.value?' · '+row.value:'');
  if(row.category==='CS우수학술대회')evidence.cs={status:'yes',year:reference.year,url:reference.url,note};
  if(row.category==='BK인정')evidence.bk={status:'yes',year:reference.year,url:reference.url,note};
  if(row.category==='SCIE')evidence.scie={status:'yes',year:reference.year,url:reference.url,note};
  if(row.category==='h5-index')evidence.h5={value:row.value,year:reference.year,url:reference.url,note};
  const additions=recognizedCategory(evidence,p.publicationKind).split(' / ').filter(Boolean);const previous=p.values.category.split(' / ').filter(v=>v && !(row.category==='h5-index' && /^h5-index 50 이상/.test(v)));const category=[...new Set([...previous,...additions])].join(' / ');
  const key:keyof RecognitionEvidence|undefined=row.category==='BK인정'?'bk':row.category==='CS우수학술대회'?'cs':row.category==='SCIE'?'scie':row.category==='h5-index'?'h5':undefined;
  return {...p,evidence,verified:false,recognitionCategoryManual:true,recognitionManual:key?[...new Set([...(p.recognitionManual||[]),key])]:p.recognitionManual,values:{...p.values,category,impactFactor:p.values.impactFactor||(row.category==='BK인정'?row.impactFactor:'')}};
}

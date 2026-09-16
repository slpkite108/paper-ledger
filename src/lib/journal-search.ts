import { z } from 'zod';
import { upstream } from './upstream';
import { toPaper, shortId, safeUrl, type Author, type Paper } from './papers';
import { applyCrossref, crossrefData, type CrossrefMessage } from './crossref-data';
import { applyPublicationDates, normalizedDoi, type DateCandidate } from './publication-dates';
import { normalizedTitle } from './publications';
import { publicationInRange, type PublicationRange } from './publication-range';

export function normalizedIssn(value:string) { const v=value.replace(/[\s-]/g,'').toUpperCase();return /^\d{7}[\dX]$/.test(v)?v.slice(0,4)+'-'+v.slice(4):''; }
export function validIssn(value:string) { const v=normalizedIssn(value).replace('-','');return v.length===8&&[...v].reduce((n,c,i)=>n+(c==='X'?10:+c)*(8-i),0)%11===0; }
export const journalSourceSchema=z.object({name:z.string().trim().min(1).max(250),issn:z.string().refine(validIssn).transform(normalizedIssn),provider:z.enum(['crossref','hcis']),enabled:z.boolean().default(true)}).refine(s=>s.provider!=='hcis'||s.issn==='2192-1962');
export const journalSourcesSchema=z.array(journalSourceSchema).max(30).refine(a=>new Set(a.map(s=>s.issn)).size===a.length);
export type JournalSource=z.infer<typeof journalSourceSchema>;
export const defaultJournalSources:JournalSource[]=[{name:'Human-centric Computing and Information Sciences',issn:'2192-1962',provider:'hcis',enabled:true}];
export type JournalCandidate={id:string;title:string;authors:{name:string;orcid?:string;affiliation?:string}[];authorText:string;venue:string;issn:string[];volume:string;doi:string;date:string;url:string;provider:'hcis'|'crossref';checkedOn?:string;warning?:string;metadata?:CrossrefMessage};
export type JournalPage={works:JournalCandidate[];next:string|null;sourceUrl:string};
export type JournalResult={source:JournalSource;author:Author;query:string;range:PublicationRange;includeUnknownMonths:boolean;rows:JournalCandidate[];excluded:JournalCandidate[];next:string|null;url:string;error?:string};
export const journalResultKey=(r:Pick<JournalResult,'source'|'author'>)=>shortId(r.author.id)+':'+r.source.issn;
export const journalCandidateKey=(r:Pick<JournalResult,'source'|'author'>,c:JournalCandidate)=>journalResultKey(r)+':'+c.id;
export function journalResult(source:JournalSource,author:Author,query:string,range:PublicationRange,includeUnknownMonths:boolean,page:JournalPage):JournalResult {
  const rows:JournalCandidate[]=[],excluded:JournalCandidate[]=[];
  for(const c of page.works)(publicationInRange(candidateToPaper(c,author,author.display_name).values.published,range,includeUnknownMonths)?rows:excluded).push(c);
  return {source,author,query,range:{...range},includeUnknownMonths,rows,excluded,next:page.next,url:page.sourceUrl};
}
/** One first page per enabled journal and author; candidates require review before export. */
export async function discoverJournalCandidates(authors:Author[],sources:JournalSource[],range:PublicationRange,includeUnknownMonths:boolean,options:{onResult?:(r:JournalResult)=>void;onStatus?:(text:string)=>void;isCurrent?:()=>boolean}={},search:typeof searchJournal=searchJournal) {
  const results:JournalResult[]=[],cache=new Map<string,Promise<JournalPage>>();
  const blocked=new Set<JournalSource['provider']>();
  for(const author of authors)for(const source of sources.filter(s=>s.enabled)) {
    if(options.isCurrent&&!options.isCurrent())return results;
    const query=authorQuery(author.display_name),key=source.provider+':'+source.issn+':'+query.toLowerCase();
    options.onStatus?.(author.display_name+' · '+source.name);
    let result:JournalResult;
    try {
      if(!cache.has(key)) {
        if(blocked.has(source.provider))throw new Error('이 검색원의 요청 제한으로 나머지 조회를 중단했습니다. 잠시 후 다시 검색하세요.');
        cache.set(key,search(source,query,range));
      }
      result=journalResult(source,author,query,range,includeUnknownMonths,await cache.get(key)!);
    }catch(e){
      if((e as {status?:number}).status===429)blocked.add(source.provider);
      result={...journalResult(source,author,query,range,includeUnknownMonths,{works:[],next:null,sourceUrl:''}),error:(e as Error).message};
    }
    if(options.isCurrent&&!options.isCurrent())return results;
    results.push(result);options.onResult?.(result);
  }
  return results;
}
type CrossrefWork=CrossrefMessage&{title?:string[];author?:{given?:string;family?:string;ORCID?:string;affiliation?:{name?:string}[]}[];URL?:string};
export function authorQuery(value:string) {return value.normalize('NFKC').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();}
const normalizeName=(name:string)=>authorQuery(name).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function candidateMatch(c:JournalCandidate,author:Author,query:string) {
  const orcid=shortId(author.orcid||'');
  if(orcid&&c.authors.some(a=>shortId(a.orcid||'')===orcid))return 'ORCID 일치';
  if(c.authors.some(a=>normalizeName(a.name)===normalizeName(query)))return '이름 일치 · 소속 확인 필요';
  return '검색 후보 · 저자 확인 필요';
}
export async function registerJournal(name:string,issn:string):Promise<JournalSource> {
  const normalized=normalizedIssn(issn);
  if(!validIssn(normalized))throw new Error('ISSN 8자리와 검증 숫자를 확인하세요. 예: 2045-2322');
  if(normalized==='2192-1962')return {...defaultJournalSources[0]};
  const {message}=await upstream<{message:{title?:string}}>(new URL('https://api.crossref.org/journals/'+normalized));
  if(!message?.title)throw new Error('Crossref에서 이 ISSN의 저널을 확인하지 못했습니다. 전용 연결이 필요한 저널입니다.');
  return {name:name.trim()||message.title,issn:normalized,provider:'crossref',enabled:true};
}
export function crossrefCandidate(m:CrossrefWork):JournalCandidate {
  const metadata=crossrefData(m),authors=(m.author||[]).map(a=>({name:[a.given,a.family].filter(Boolean).join(' '),orcid:a.ORCID,affiliation:a.affiliation?.map(v=>v.name).filter(Boolean).join('; ')}));
  return {id:m.DOI||m.URL||'',title:m.title?.[0]||'',authors,authorText:authors.map(a=>a.name).join('; '),venue:m['container-title']?.[0]||'',issn:m.ISSN||[],volume:m.volume||'',doi:m.DOI||'',date:metadata.published||'',url:safeUrl(m.URL)||'https://doi.org/'+m.DOI,provider:'crossref',metadata:m};
}
export async function searchJournal(source:JournalSource,query:string,range:PublicationRange,next?:string):Promise<JournalPage> {
  const q=authorQuery(query);if(q.length<2||q.length>150)throw new Error('저자 검색명을 2~150자로 입력하세요.');
  if(source.provider==='hcis') {
    const params=new URLSearchParams({source:'hcis',author:q,from:range.from,to:range.to,page:next||'1'});
    const r=await fetch('https://paper-ledger-publication-dates.slpkite108.chatgpt.site/api/journal-search?'+params,{credentials:'omit',signal:AbortSignal.timeout(35000)});
    if(!r.ok)throw Object.assign(new Error(r.status===429?'HCIS 조회 한도에 도달했습니다. 잠시 후 다시 시도하세요.':'HCIS 검색에 실패했습니다. 기존 결과는 유지됩니다.'),{status:r.status});
    const d=await r.json();if(!Array.isArray(d.works))throw new Error('HCIS 응답을 확인하지 못했습니다.');
    return {works:d.works,next:d.nextPage?String(d.nextPage):null,sourceUrl:d.sourceUrl};
  }
  const url=new URL('https://api.crossref.org/journals/'+source.issn+'/works');
  url.searchParams.set('query.author',q);url.searchParams.set('rows','50');url.searchParams.set('cursor',next||'*');
  const filters=[];if(range.from)filters.push('from-pub-date:'+range.from+'-01-01');if(range.to)filters.push('until-pub-date:'+range.to+'-12-31');if(filters.length)url.searchParams.set('filter',filters.join(','));
  const {message:m}=await upstream<{message:{items:CrossrefWork[];'next-cursor'?:string}}>(url);
  if(!Array.isArray(m?.items))throw new Error('저널 검색 응답을 확인하지 못했습니다.');
  return {works:m.items.filter(w=>w.type==='journal-article'&&w.ISSN?.some(v=>normalizedIssn(v)===source.issn)).map(crossrefCandidate),next:m.items.length===50&&m['next-cursor']!==next?m['next-cursor']||null:null,sourceUrl:url.href};
}
export function candidateToPaper(c:JournalCandidate,author:Author,professor:string):Paper {
  const doi=normalizedDoi(c.doi),id=shortId(author.id)+':journal:'+encodeURIComponent(doi||c.id);
  let paper=toPaper({id:c.url,title:c.title,doi:doi?'https://doi.org/'+doi:null,type:'journal-article',primary_location:{landing_page_url:c.url,source:{type:'journal',display_name:c.venue,issn:c.issn}},biblio:{volume:c.volume},authorships:c.authors.map((a,i)=>({author:{display_name:a.name},author_position:i===0?'first':'middle'}))},author,professor);
  paper={...paper,id,source:c.url,journalSource:c.provider,kindSource:c.provider==='hcis'?'HCIS 저널 검색':'Crossref 저널 검색',warnings:['저널 저자 검색에서 선택한 후보입니다. 동명이인·저자 순서·소속을 원문에서 확인하세요.',...(c.warning?[c.warning]:[])]};
  if(c.metadata)paper=applyCrossref(paper,crossrefData(c.metadata),true);
  else {const candidates:DateCandidate[]=c.date?[{source:'publisher-issue',date:c.date,url:c.url,checkedOn:c.checkedOn,note:'HCIS 저널 검색 결과의 Published on'}]:[];paper=applyPublicationDates(paper,{candidates,publisherChecked:true});}
  return paper;
}
export function sameJournalPaper(a:Paper,b:Paper) {
  if(shortId(a.authorId)!==shortId(b.authorId)||a.publicationKind!==b.publicationKind)return false;
  const x=normalizedDoi(a.doi),y=normalizedDoi(b.doi);
  if(x&&y)return x===y;
  if(a.id===b.id||a.source===b.source)return true;
  return Boolean(normalizedTitle(a.values.title)&&normalizedTitle(a.values.title)===normalizedTitle(b.values.title)&&a.values.published.slice(0,4)===b.values.published.slice(0,4)&&a.values.issn.split(/[;,]/).some(v=>normalizedIssn(v)&&b.values.issn.includes(normalizedIssn(v))));
}
export function mergeJournalPapers(previous:Paper[],incoming:Paper[]) {const result=[...previous];for(const p of incoming)if(!result.some(v=>sameJournalPaper(v,p)))result.push(p);return result;}

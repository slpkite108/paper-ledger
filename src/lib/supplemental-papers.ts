import { toPaper, shortId, type Author, type Paper } from './papers';
import { applyPublicationDates, normalizedDoi } from './publication-dates';

// Audited bibliographic corrections, not a live publisher search or a name match.
// Publisher: https://hcisj.com/articles/?HCIS202515005 (checked 2026-09-16).
// KCI: ART003220804; DOI registration agency: KISTI. OpenAlex DOI/title queries
// had no result and Crossref returned 404. Inha affiliation and author identity
// were checked against the publisher biography and OpenAlex A5061420652.
export const hcisSupplement={
  doi:'10.22967/HCIS.2025.15.005',
  title:'Accelerating the Cloud-Based Visualization System for Digital Twin Applications: BVH-Based Rendering Optimization',
  authorId:'A5061420652',orcid:'0000-0001-7742-4846',
  url:'https://hcisj.com/articles/?HCIS202515005',
  kci:'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003220804',
  date:'2025-01-30',checkedOn:'2026-09-16',
};
export function supplementalPapers(author:Author,professor:string,years:{from:string;to:string}):Paper[] {
  const r=hcisSupplement,orcid=shortId(author.orcid||'');
  // Fail closed for a conflicting ORCID, even if a saved author id matches.
  if(orcid ? orcid!==r.orcid : shortId(author.id)!==r.authorId)return [];
  const year=r.date.slice(0,4);
  if((years.from&&year<years.from)||(years.to&&year>years.to))return [];
  const paper=toPaper({id:r.url,doi:'https://doi.org/'+r.doi,title:r.title,type:'journal-article',primary_location:{landing_page_url:r.url,source:{type:'journal',display_name:'Human-centric Computing and Information Sciences',issn:['2192-1962']}},biblio:{volume:'15',first_page:'24',last_page:'41'},authorships:[{author:{display_name:'Eun-Seok Lee'},author_position:'first'},{author:{id:author.id,display_name:'Byeong-Seok Shin'},author_position:'last',is_corresponding:true}]},author,professor);
  return [applyPublicationDates({...paper,id:shortId(author.id)+':supplement-hcis-2025-005',supplementalSource:r.url,kindSource:'출판사 원문 확인',warnings:[`출판사 원문으로 확인한 보완 자료 (${r.checkedOn}). KISTI DOI이며 OpenAlex·Crossref 미수록 확인.`, '페이지 24–41은 KCI 서지정보 기준이며 출판사 논문번호는 05입니다. '+r.kci]}, {candidates:[{source:'publisher-issue',date:r.date,url:r.url,checkedOn:r.checkedOn,note:'Publisher Published: 30 January 2025. Received/Accepted dates were not used.'}],publisherChecked:true})];
}
// Preserve the first copy (including edits) if an audited supplement later also
// appears in upstream results. Different authors and publication kinds stay apart.
export function mergePaperSources(previous:Paper[],incoming:Paper[]):Paper[] {
  const byId=new Map(previous.map(p=>[p.id,p]));for(const p of incoming)if(!byId.has(p.id))byId.set(p.id,p);
  const all=[...byId.values()];
  const key=(p:Paper)=>shortId(p.authorId)+'\0'+p.publicationKind+'\0'+normalizedDoi(p.doi);
  const supplemented=new Set(all.filter(p=>p.supplementalSource&&p.doi).map(key)),seen=new Set<string>();
  return all.filter(p=>{const k=key(p);if(!supplemented.has(k))return true;if(seen.has(k))return false;seen.add(k);return true;});
}

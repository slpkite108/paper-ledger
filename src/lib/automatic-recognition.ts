import { builtinReferences, matchReference, referenceEvidenceUrl, type Criteria, type Reference } from './criteria';
import { completeEvidence, recognizedCategory, type RecognitionEvidence } from './recognition';
import type { Paper } from './papers';

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type EvidenceKey=keyof RecognitionEvidence;
const keys:EvidenceKey[]=['scie','bk','cs','h5'];
const keyFor=(category:string):EvidenceKey|undefined=>({'SCIE':'scie','BK인정':'bk','CS우수학술대회':'cs','h5-index':'h5'} as Record<string,EvidenceKey>)[category];

export function recognitionLabel(p:Paper,criteria:Criteria):string {
  if(p.values.category)return p.values.category+(p.automaticRecognition?.category?' · 자동':'');
  if(p.publicationKind==='journal'&&p.evidence?.scie.status==='no')return 'SCIE 비해당 · 직접 확인';
  if(p.publicationKind==='journal'&&p.evidence?.scie.status==='yes')return 'SCIE 확인됨 · 구분 직접 설정';
  if(!criteria.automatic)return '인정 자동 대조 꺼짐';
  if(p.publicationKind==='unknown')return '인정 미확인 · 학술유형 확인 필요';
  if(p.publicationKind==='preprint'||p.arxiv)return '인정 자동 대조 대상 아님';
  return p.publicationKind==='journal'?'SCIE 근거 미확인 · 기준표 확인 필요':'인정 근거 미확인 · 기준표 확인 필요';
}

// Remove only values still owned by automation. Manual edits survive source changes.
export function clearAutomaticRecognition(p:Paper):Paper {
  if(!p.automaticRecognition)return p;
  const result={...p,values:{...p.values},evidence:completeEvidence(p.evidence)};
  const blank=completeEvidence();
  if(!p.recognitionCategoryManual && p.values.category===p.automaticRecognition.category)result.values.category='';
  for(const key of keys) {
    if(!p.recognitionManual?.includes(key) && p.automaticRecognition.evidence[key] && same(result.evidence[key],p.automaticRecognition.evidence[key]))Object.assign(result.evidence,{[key]:blank[key]});
  }
  delete result.automaticRecognition;
  return result;
}

export function automaticallyRecognize(paper:Paper,criteria:Criteria):Paper {
  const p=clearAutomaticRecognition(paper);
  if(!criteria.automatic)return paper.values.category!==p.values.category || !same(completeEvidence(paper.evidence),completeEvidence(p.evidence)) ? {...p,verified:false} : p;
  const evidence=completeEvidence(p.evidence),generated:Partial<RecognitionEvidence>={};
  const hits=new Map<EvidenceKey,{reference:Reference;row:Reference['rows'][number]}[]>();
  for(const reference of [...builtinReferences,...criteria.custom].filter(r=>criteria.automaticSources.includes(r.id))) {
    const matches=matchReference(p,reference);
    if(matches.length!==1)continue;
    const row=matches[0],key=keyFor(row.category);if(!key)continue;
    hits.set(key,[...(hits.get(key)||[]),{reference,row}]);
  }
  for(const [key,items] of hits) {
    if(p.recognitionManual?.includes(key))continue;
    const existing=evidence[key];
    if(existing.year||existing.url||existing.note||(key==='h5'?evidence.h5.value!=='':(existing as {status:string}).status!=='unknown'))continue;
    const year=Math.max(...items.map(i=>Number(i.reference.year)));
    const latest=items.filter(i=>Number(i.reference.year)===year);
    if(new Set(latest.map(i=>key==='h5'?i.row.value:'yes')).size!==1)continue;
    const {reference,row}=latest[0];
    const common={year:reference.year,url:referenceEvidenceUrl(reference,row),note:reference.name+' · '+row.venue+(row.value?' · '+row.value:'')+' · 기준표 자동 일치 (논문별 제출 요건 별도 확인)'};
    const value=key==='h5'?{...common,value:row.value}:{...common,status:'yes' as const};
    Object.assign(evidence,{[key]:value});Object.assign(generated,{[key]:value});
  }
  const category=!p.recognitionCategoryManual && !p.values.category ? recognizedCategory(evidence,p.publicationKind) : undefined;
  const result:Paper={...p,evidence,values:{...p.values,category:category||p.values.category},automaticRecognition:{evidence:generated,...(category?{category}:{})}};
  if(paper.values.category!==result.values.category || !same(completeEvidence(paper.evidence),evidence))result.verified=false;
  return result;
}

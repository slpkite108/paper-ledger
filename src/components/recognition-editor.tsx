'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Choice } from './layout-settings';
import { emptyEvidence, evidenceError, recognizedCategory, type RecognitionEvidence } from '@/lib/recognition';
import type { Paper } from '@/lib/papers';

export function RecognitionEditor({ paper, onChange, onError }: { paper:Paper; onChange:(p:Paper)=>void; onError:(s:string)=>void }) {
  const evidence=paper.evidence||emptyEvidence();
  function update(key:keyof RecognitionEvidence, patch:Record<string,string>) { onChange({...paper,evidence:{...evidence,[key]:{...evidence[key],...patch}}}); }
  return <details className="recognition-editor"><summary>SCIE · BK · h5-index 확인과 근거 기록</summary><p>학술지명: <strong>{paper.values.venue||'미확인'}</strong> · ISSN: <strong>{paper.values.issn||'미확인'}</strong></p>
    <div className="official-links"><a target="_blank" rel="noopener noreferrer" href="https://mjl.clarivate.com/">SCIE · Clarivate 공식 목록 ↗</a><a target="_blank" rel="noopener noreferrer" href="https://bk21four.nrf.re.kr/">BK21 사업 공지·자료 ↗</a><a target="_blank" rel="noopener noreferrer" href={'https://scholar.google.com/citations?view_op=search_venues&hl=ko&vq='+encodeURIComponent(paper.values.venue)}>Google Scholar Metrics 검색 ↗</a></div>
    <p>SCIE는 ISSN과 색인명을 확인하세요. BK는 제출 기관이 채택한 목록·적용연도·본 학회/워크숍을 대조하세요. h5는 학술지·학술대회 지표이며 저자의 h-index와 다릅니다. 검색되지 않은 결과는 미확인으로 둡니다.</p>
    <div className="evidence-grid">{(['scie','bk','h5'] as const).map(key=><fieldset key={key}><legend>{key==='scie'?'SCIE':key==='bk'?'BK 인정':'h5-index'}</legend>{key==='h5'?<Input type="number" min={0} max={99999} aria-label="h5-index 값" placeholder="확인한 h5-index" value={evidence.h5.value} onChange={e=>update(key,{value:e.target.value})}/>:<Choice label={key+' 확인 결과'} value={evidence[key].status} options={[{key:'unknown',label:'미확인'},{key:'yes',label:'해당'},{key:'no',label:'비해당'}]} onChange={status=>update(key,{status})}/>}<Input aria-label={key+' 기준연도'} value={evidence[key].year} onChange={e=>update(key,{year:e.target.value})} placeholder={key==='h5'?'Metrics 판 / 기준연도':'적용 기준연도 (YYYY)'} maxLength={4}/><Input aria-label={key+' 근거 링크'} value={evidence[key].url} onChange={e=>update(key,{url:e.target.value})} placeholder="공식 자료 / 기관 지침 링크" maxLength={2000}/><Input aria-label={key+' 확인 메모'} value={evidence[key].note} onChange={e=>update(key,{note:e.target.value})} placeholder="목록명, 수록기간, 발표 트랙 등" maxLength={2000}/></fieldset>)}</div>
    <Button variant="outline" onClick={()=>{const error=evidenceError(evidence);if(error){onError(error);return;}const category=recognizedCategory(evidence);if(!category){onError('해당으로 확인된 항목이 없습니다. 기존 구분은 유지합니다.');return;}onChange({...paper,evidence,values:{...paper.values,category}});onError('확인 결과를 구분에 반영했습니다. 변경사항 반영을 눌러 저장하세요.');}}>확인 결과를 구분 항목에 반영</Button><small>출처와 연도는 ‘인정 근거·기준연도’ 열로 내보낼 수 있습니다. 공식 서비스에 실시간 자동 조회한 결과가 아닙니다.</small>
  </details>;
}

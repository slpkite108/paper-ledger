'use client';
import { useRef, useState } from 'react';
import { BookOpen, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { authorQuery, candidateMatch, candidateToPaper, registerJournal, searchJournal, journalResult, journalResultKey, journalCandidateKey, sameJournalPaper, type JournalCandidate, type JournalSource, type JournalResult } from '@/lib/journal-search';
import { publicationRangeError, publicationRangeLabel, type PublicationRange } from '@/lib/publication-range';
import { safeUrl, type Author, type Paper } from '@/lib/papers';

type Result=JournalResult;
export function JournalSearch({automaticResults,existingPapers,authors,professorNames,sources,onSources,range,includeUnknownMonths,onAdd,disabled}:{automaticResults:JournalResult[];existingPapers:Paper[];authors:Author[];professorNames:Record<string,string>;sources:JournalSource[];onSources:(s:JournalSource[])=>void;range:PublicationRange;includeUnknownMonths:boolean;onAdd:(p:Paper[],range:PublicationRange)=>void;disabled:boolean}) {
  const [open,setOpen]=useState(false),[authorId,setAuthorId]=useState(''),[query,setQuery]=useState(''),[name,setName]=useState(''),[issn,setIssn]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[results,setResults]=useState<Result[]>([]),[selected,setSelected]=useState<Set<string>>(new Set());
  const [manual,setManual]=useState(false);
  const visibleResults=(manual?results:automaticResults).filter(r=>authors.some(a=>a.id===r.author.id));
  const present=(r:Result,c:JournalCandidate)=>existingPapers.some(p=>sameJournalPaper(p,candidateToPaper(c,r.author,r.author.display_name)));
  const pending=automaticResults.reduce((n,r)=>n+r.rows.filter(c=>!present(r,c)).length,0);
  const failures=automaticResults.filter(r=>r.error).length;
  const outside=automaticResults.reduce((n,r)=>n+r.excluded.length,0);
  const generation=useRef(0);
  const key=journalCandidateKey;
  function openDialog(){const a=authors.find(a=>a.id===authorId)||authors[0];setAuthorId(a?.id||'');setQuery(a?authorQuery(a.display_name):'');setResults([]);setSelected(new Set());setManual(false);setError('');setStatus('');setOpen(true);}
  async function addSource(){setBusy(true);setError('');try{if(sources.length>=30)throw new Error('저널은 최대 30개까지 등록할 수 있습니다.');const s=await registerJournal(name,issn);if(sources.some(v=>v.issn===s.issn))throw new Error('이미 등록한 ISSN입니다.');onSources([...sources,s]);setName('');setIssn('');setStatus(s.name+' 검색원을 추가했습니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function run(more?:Result){
    const author=more?.author||authors.find(a=>a.id===authorId),term=more?.query||query,period=more?.range||range,unknown=more?more.includeUnknownMonths:includeUnknownMonths;
    if(!author||!term)return;const issue=publicationRangeError(period);if(issue){setError(issue);return;}
    const targets=more?[more.source]:sources.filter(s=>s.enabled);if(!targets.length){setError('검색할 저널을 체크하세요.');return;}
    const seq=++generation.current;setBusy(true);setError('');setStatus('');
    setResults(more?visibleResults:[]);setManual(true);if(!more)setSelected(new Set());
    for(const source of targets){
      setStatus(source.name+'에서 저자 후보를 찾는 중…');
      try{
        const page=await searchJournal(source,term,period,more?.next||undefined);if(seq!==generation.current)return;
        const result=journalResult(source,author,term,period,unknown,page);
        setResults(prev=>{const old=prev.find(r=>journalResultKey(r)===journalResultKey(result));
          const unique=(items:JournalCandidate[])=>[...new Map(items.map(c=>[c.id,c])).values()];
          return [...prev.filter(r=>journalResultKey(r)!==journalResultKey(result)),{...result,rows:unique([...(more?old?.rows||[]:[]),...result.rows]),excluded:unique([...(more?old?.excluded||[]:[]),...result.excluded])}];});
      }catch(e){if(seq!==generation.current)return;
        const empty=journalResult(source,author,term,period,unknown,{works:[],next:null,sourceUrl:''});
        setResults(prev=>{const old=prev.find(r=>journalResultKey(r)===journalResultKey(empty));return [...prev.filter(r=>journalResultKey(r)!==journalResultKey(empty)),{...(old||empty),error:(e as Error).message}];});
      }
    }
    if(seq===generation.current){setBusy(false);setStatus('검색을 마쳤습니다. 저자와 소속을 확인한 논문을 선택하세요.');}
  }
  function add(){const chosen=visibleResults.flatMap(r=>r.rows.filter(c=>selected.has(key(r,c))&&!present(r,c)).map(c=>({r,p:candidateToPaper(c,r.author,professorNames[r.author.id]||r.author.display_name)})));if(!chosen.length)return;onAdd(chosen.map(v=>v.p),chosen[0].r.range);setSelected(new Set());setOpen(false);}
  return <><Button variant="outline" onClick={openDialog} disabled={disabled}><BookOpen size={16}/>{automaticResults.length?'저널 후보 확인'+(pending?' · '+pending+'건':''):'저널 추가 검색'}</Button>{automaticResults.length>0&&<span className="journal-discovery-status" role="status">등록 저널: 미추가 후보 {pending}건{failures?' · 조회 실패 '+failures+'건':''}{outside?' · 기간 제외 '+outside+'건':''} · 저자별 집계, 확인 후 대장 반영</span>}<Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="journal-dialog"><DialogHeader><DialogTitle>저널을 지정해 저자 논문 찾기</DialogTitle><DialogDescription>논문 불러오기에서 등록 저널도 자동 검색합니다. 후보를 확인해 대장에 추가하거나 이름을 바꿔 다시 검색할 수 있습니다. 검색 대상 등록은 SCIE 인정과 별개입니다.</DialogDescription></DialogHeader>
    <section className="journal-source-box"><strong>추가 검색 대상</strong><div className="journal-source-list">{sources.map(s=><div key={s.issn}><label><Checkbox checked={s.enabled} disabled={busy} onCheckedChange={v=>onSources(sources.map(x=>x.issn===s.issn?{...x,enabled:v===true}:x))}/><span>{s.name}<small>{s.issn} · {s.provider==='hcis'?'출판사 직접 검색':'Crossref 등록 논문'}</small></span></label><Button variant="ghost" size="icon" disabled={busy} aria-label={s.name+' 검색 대상 삭제'} onClick={()=>onSources(sources.filter(x=>x.issn!==s.issn))}><Trash2 size={16}/></Button></div>)}</div>
    <div className="journal-register"><label>저널 이름 (선택)<Input value={name} onChange={e=>setName(e.target.value)} maxLength={250} placeholder="예: Scientific Reports" disabled={busy}/></label><label>ISSN<Input value={issn} onChange={e=>setIssn(e.target.value)} maxLength={12} placeholder="2045-2322" disabled={busy}/></label><Button variant="outline" disabled={busy||!issn.trim()} onClick={()=>void addSource()}><Plus size={16}/>저널 등록</Button></div>
    <p className="field-hint">일반 저널은 ISSN으로 Crossref 수록분을 검색합니다. HCIS는 전용 출판사 검색을 사용합니다. 다른 미수록 저널은 전용 연결이 필요합니다. 등록 목록은 이 브라우저에 보관하며, 저자 즐겨찾기 저장 시 Google 저장소에도 함께 저장할 수 있습니다.</p></section>
    <div className="journal-query"><label>선택한 저자<select value={authorId} disabled={busy} onChange={e=>{setAuthorId(e.target.value);setQuery(authorQuery(authors.find(a=>a.id===e.target.value)?.display_name||''));setResults([]);setManual(true);setSelected(new Set());}}>{!authors.length&&<option value="">먼저 저자를 선택하세요</option>}{authors.map(a=><option key={a.id} value={a.id}>{a.display_name} · {a.last_known_institutions?.map(i=>i.display_name).join(', ')||'소속 미상'}</option>)}</select></label><label>저널에 실린 영문 저자명<Input value={query} maxLength={150} disabled={busy} onChange={e=>{setQuery(e.target.value);setResults([]);setManual(true);setSelected(new Set());}}/></label><Button onClick={()=>void run()} disabled={busy||!authorId||query.trim().length<2}>{busy?<Loader2 className="animate-spin" size={16}/>:<Search size={16}/>}등록 저널에서 찾기</Button></div>
    <p className="field-hint">조회 기간: {publicationRangeLabel(range)} · 소속: {authors.find(a=>a.id===authorId)?.last_known_institutions?.map(i=>i.display_name).join(', ')||'미상'}</p>
    {error&&<p className="error" role="alert">{error}</p>}{status&&<p role="status" className="field-hint">{status}</p>}
    <div className="journal-results">{visibleResults.map(r=><section key={journalResultKey(r)}><div className="journal-result-heading"><strong>{r.author.display_name} · {r.source.name} · {r.rows.length}편</strong>{r.url&&<a href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer">검색 출처 ↗</a>}</div><p className="field-hint">{r.author.last_known_institutions?.map(i=>i.display_name).join(', ')||'소속 미상'} · {r.author.id.split('/').pop()} · {publicationRangeLabel(r.range)}</p>{r.error&&<p className="error" role="alert">{r.error}</p>}{!r.error&&!r.rows.length&&<p className="field-hint">현재 페이지에 해당 기간의 후보가 없습니다.{r.next?' 다음 페이지도 확인하세요.':' 저자 표기를 바꿔 다시 검색할 수 있습니다.'}</p>}{r.excluded.length>0&&<details className="field-hint"><summary>기간 조건으로 제외된 후보 {r.excluded.length}편</summary>{r.excluded.map(c=><p key={c.id}>{c.date||'출판일 미상'} · {c.title}</p>)}</details>}{r.rows.map(c=><label className="journal-result" key={c.id}><Checkbox aria-label={c.title+' 추가 선택'} checked={selected.has(key(r,c))&&!present(r,c)} disabled={busy||present(r,c)} onCheckedChange={v=>setSelected(prev=>{const next=new Set(prev);v===true?next.add(key(r,c)):next.delete(key(r,c));return next;})}/><span><strong>{c.title}</strong><span>{c.authorText}</span><small>{c.date||'출판일 미상'} · {candidateMatch(c,r.author,r.query)}{present(r,c)?' · 이미 대장에 있음':''}</small>{c.authors.some(a=>a.affiliation)&&<small>{c.authors.filter(a=>a.affiliation).map(a=>a.name+': '+a.affiliation).join(' / ')}</small>}<a href={safeUrl(c.url)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>원문과 저자 확인 ↗</a></span></label>)}{r.next&&<Button variant="outline" disabled={busy} onClick={()=>void run(r)}>이 저널 다음 페이지</Button>}</section>)}</div>
    <div className="journal-actions"><p className="field-hint">이름 검색은 동명이인을 포함할 수 있습니다. 여러 저자 ID가 같은 사람인지도 확인하세요. 같은 DOI의 기존 행과 편집값은 유지합니다.</p><Button disabled={busy||!selected.size} onClick={add}>확인한 {selected.size}편 대장에 추가</Button></div>
  </DialogContent></Dialog></>;
}

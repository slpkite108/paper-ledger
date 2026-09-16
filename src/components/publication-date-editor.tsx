import type { Paper } from '@/lib/papers';
import { safeUrl } from '@/lib/papers';
import { applyPublicationDates, choosePublicationDate, dateLabels, dateSummary } from '@/lib/publication-dates';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { citationDate, fetchCitationDate } from '@/lib/citation-date';
import type { DateCandidate } from '@/lib/publication-dates';

export function PublicationDateEditor({ paper, onChange }: { paper: Paper; onChange: (p: Paper) => void }) {
  const info = paper.publicationDates;
  const [url, setUrl] = useState(''); const [text, setText] = useState('');
  const [candidate, setCandidate] = useState<DateCandidate | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => { ++seq.current; setCandidate(null); setError(''); setText(''); setUrl(''); setBusy(false); return () => { ++seq.current; }; }, [paper.id]);
  function parse(value: string) { ++seq.current; setBusy(false); setCandidate(null); setError(''); try { setCandidate(citationDate(value, paper.doi, url)); } catch (e) { setError((e as Error).message); } }
  async function fetchDate() { const current = ++seq.current; setBusy(true); setCandidate(null); setError(''); try { const result = await fetchCitationDate(url, paper.doi); if (current === seq.current) setCandidate(result); } catch (e) { if (current === seq.current) setError((e as Error).message); } finally { if (current === seq.current) setBusy(false); } }
  return <section className="publication-date-editor" aria-label="출판일 근거">
    <h3>출판일 근거 · {dateSummary(paper)}</h3>
    <p>출판사에서 확인한 권호 발행일을 우선합니다. 그 외에는 월이 등록된 Crossref 인쇄일 → 온라인일 → 출판일 → 발행일 순으로 적용하며, 모두 연도만 있으면 월을 추정하지 않습니다.</p>
    <ul>{info?.candidates.map(c => <li key={c.source}>
      <span><strong>{c.date}</strong> · {dateLabels[c.source]}{c.date.length === 4 && ' (월 미상)'}{c.checkedOn && <small>확인일 {c.checkedOn} · {c.note}</small>}</span>
      {safeUrl(c.url) && <a href={safeUrl(c.url)} target="_blank" rel="noopener noreferrer">출처 ↗</a>}
      <Button variant="outline" size="sm" onClick={() => onChange(choosePublicationDate(paper, c))}>이 날짜 적용</Button>
    </li>)}</ul>
    {!info?.crossrefChecked && paper.doi && !paper.arxiv && <p>Crossref 확인 전입니다. 아래 ‘Crossref 서지정보·날짜 확인’으로 재확인할 수 있습니다.</p>}
    {info?.selected === 'openalex' && !info.manual && <p>OpenAlex 날짜는 출처에서 보완한 값일 수 있습니다. 특히 1월 1일 표시는 실제 발행일인지 원문에서 확인하세요.</p>}
    <p>접수일·게재 승인일·DOI 등록일은 출판일로 사용하지 않습니다. 아래 출판년월을 직접 입력하거나 날짜를 선택하면 자동 조회로 덮어쓰지 않습니다.</p>
    {info?.manual && <Button variant="outline" size="sm" onClick={() => onChange(applyPublicationDates(paper, { ...info, manual: false }))}>자동 기준으로 되돌리기</Button>}
    <details><summary>Cite / 인용정보에서 날짜 가져오기</summary><div className="citation-import">
      <p>출판사 페이지 또는 RIS·BibTeX에서 출판일을 추출합니다. 현재 논문과 DOI가 일치하는 자료만 적용합니다. 월이 없는 인용정보는 연도만 가져옵니다.</p>
      <label>출처 URL<input aria-label="인용정보 출처 URL" type="url" value={url} placeholder="https://출판사/논문" onChange={e => { ++seq.current; setBusy(false); setCandidate(null); setUrl(e.target.value); }}/></label>
      <Button variant="outline" size="sm" disabled={busy || !paper.doi || !url} onClick={() => void fetchDate()}>{busy ? '확인 중…' : '출처에서 직접 가져오기'}</Button>
      <label>RIS · BibTeX · 논문 페이지 HTML 파일<input type="file" accept=".ris,.bib,.bibtex,.html,.htm,.txt" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const current = ++seq.current; setCandidate(null); setBusy(false); if (file.size > 1_000_000) { setError('파일은 1MB 이하로 가져오세요.'); return; } try { const value = await file.text(); if (current === seq.current) { setText(value); parse(value); } } catch { if (current === seq.current) setError('파일을 읽지 못했습니다. 다시 가져오세요.'); } e.target.value = ''; }}/></label>
      <label>또는 인용정보 붙여넣기<textarea rows={3} value={text} maxLength={1_000_000} onChange={e => { ++seq.current; setBusy(false); setCandidate(null); setText(e.target.value); }} placeholder="RIS / BibTeX / citation 메타데이터가 포함된 HTML"/></label>
      <div className="citation-import-actions"><Button variant="outline" size="sm" disabled={!text || !paper.doi} onClick={() => parse(text)}>붙여넣은 날짜 확인</Button>
      {candidate && <><strong>{candidate.date}{candidate.date.length === 4 && ' · 월 미상'} · {candidate.note}</strong><Button size="sm" onClick={() => { const next = { ...paper, publicationDates: { ...info, candidates: [...(info?.candidates || []).filter(c => c.source !== 'publisher-citation'), candidate] } }; onChange(choosePublicationDate(next, candidate)); setCandidate(null); }}>이 날짜 적용</Button></>}</div>
      {error && <p role="status">{error}</p>}
    </div></details>
  </section>;
}

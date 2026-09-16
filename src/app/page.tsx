'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Search, Download, ArrowUpRight, Pencil, Check, Loader2, Info, UserRound, Plus, CircleHelp, Library, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { fields, safeUrl, shortId, toPaper, validationError, type Author, type Paper, type Work, type FieldKey } from '@/lib/papers';

import { getData, ClientApiError, isStandalone } from '@/lib/client-api';
import { AuthorFavorites } from '@/components/author-favorites';
import { SearchSettings } from '@/components/search-settings';
import { GoogleSettings } from '@/components/google-settings';
import { GoogleConnectionStatus } from '@/components/google-connection-status';
import { accountRequest, type AccountInfo } from '@/lib/account-client';
import type { Favorite } from '@/lib/favorites';
import { conferenceCounterparts, normalizedTitle, kindLabels, visiblePublications, type PublicationKind } from '@/lib/publications';
import { applyCrossref, type CrossrefData } from '@/lib/crossref-data';
import { applyPublicationDates, dateSummary, normalizedDoi, setManualPublicationDate } from '@/lib/publication-dates';
import { PublicationDateEditor } from '@/components/publication-date-editor';
import { applyPublisherDate, getPublisherDate, supportsPublisherDate } from '@/lib/publisher-data';
import { PublicationRangeControls } from '@/components/publication-range-controls';
import { emptyPublicationRange, publicationRangeError, publicationRangeLabel } from '@/lib/publication-range';
import { LayoutSettings, SortControls } from '@/components/layout-settings';
import { RecognitionEditor } from '@/components/recognition-editor';
import { CriteriaPanel } from '@/components/criteria-panel';
import { columnValue, defaultLayout, displayValue, layoutCsv, sortPapers, type Layout } from '@/lib/layouts';
import { downloadBlob, headerTextColor, ledgerXlsx } from '@/lib/ledger-export';
import { evidenceError } from '@/lib/recognition';
import { automaticallyRecognize, recognitionLabel } from '@/lib/automatic-recognition';
import { journalLookupUrl } from '@/lib/criteria';
import { supplementalPapers, mergePaperSources } from '@/lib/supplemental-papers';
import { JournalSearch } from '@/components/journal-search';
import { defaultJournalSources, journalSourcesSchema, mergeJournalPapers, type JournalSource } from '@/lib/journal-search';
import type { PublicationRange } from '@/lib/publication-range';

function saveFile(content: string, filename: string) { const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const count = (n: number) => n.toLocaleString('ko-KR');

export default function Home() {
  const [layout, setLayout] = useState<Layout>(defaultLayout); const [exporting, setExporting] = useState(false);
  function sortBy(key: string) { setLayout(prev => ({ ...prev, sort: [{ key, direction: prev.sort[0]?.key === key && prev.sort[0].direction === 'asc' ? 'desc' : 'asc' }, ...prev.sort.filter(s => s.key !== key).slice(0, 2)] })); }
  const sortIndicator = (key: string) => { const i = layout.sort.findIndex(s => s.key === key); return i < 0 ? '' : ' ' + (layout.sort[i].direction === 'asc' ? '↑' : '↓') + (i + 1); };
  const [query, setQuery] = useState(''); const [searched, setSearched] = useState('');
  const [authors, setAuthors] = useState<Author[]>([]); const [authorTotal, setAuthorTotal] = useState(0); const [authorPage, setAuthorPage] = useState(1);
  const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState('');
  const [chosenAuthors, setChosenAuthors] = useState<Author[]>([]);
  const [journalSources,setJournalSources]=useState<JournalSource[]>(()=>{try {return journalSourcesSchema.parse(JSON.parse(localStorage.getItem('paper-ledger-journal-sources')||'null'));}catch{return defaultJournalSources;}});
  function changeJournalSources(sources:JournalSource[]){setJournalSources(sources);try{localStorage.setItem('paper-ledger-journal-sources',JSON.stringify(sources));}catch{setNotice('이 브라우저에 저널 목록을 저장하지 못했습니다. 즐겨찾기에 저장하세요.');}}
  const [professorNames, setProfessorNames] = useState<Record<string, string>>({});
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [fromMonth, setFromMonth] = useState(''); const [toMonth, setToMonth] = useState('');
  const [includeUnknownMonths, setIncludeUnknownMonths] = useState(true);
  const [excludeArxiv, setExcludeArxiv] = useState(false); const [mergeLatest, setMergeLatest] = useState(true);
  const [publicationKind, setPublicationKind] = useState<PublicationKind | 'all'>('all');
  const [account, setAccount] = useState<AccountInfo | null>(null); const [accountError, setAccountError] = useState('');
  const [classifying, setClassifying] = useState(false); const [classificationStatus, setClassificationStatus] = useState(''); const classificationSeq = useRef(0);
  const [papers, setPapers] = useState<Paper[]>([]); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false); const [paperError, setPaperError] = useState('');
  const [authorStats, setAuthorStats] = useState<Record<string, { total: number; loaded: number; cursor: string | null }>>({});
  const [loaded, setLoaded] = useState(false); const [workingAuthor, setWorkingAuthor] = useState('');
  const [applied, setApplied] = useState(emptyPublicationRange); const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Paper | null>(null); const [editError, setEditError] = useState(''); const [enriching, setEnriching] = useState(false);
  const [help, setHelp] = useState(false); const paperCache = useRef(new Map<string, Paper>()); const searchSeq = useRef(0); const worksSeq = useRef(0); const editSeq = useRef(0);
  const dirty = useRef(false);
  const apiKey = useRef('');
  const [keyActive, setKeyActive] = useState(false); const [serverKeyConfigured, setServerKeyConfigured] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => { getData<{ serverKeyConfigured: boolean }>('/api/search-settings').then(d => setServerKeyConfigured(d.serverKeyConfigured)).catch(() => {}); }, []);
  useEffect(() => { if (!isStandalone()) accountRequest<AccountInfo>('/api/account').then(setAccount).catch(e => setAccountError(e.message)); }, []);
  function applyKey(key: string) {
    apiKey.current = key; setKeyActive(Boolean(key)); setSearchError(''); setPaperError('');
    setNotice(key ? '이 탭에 개인 키를 적용했습니다. 다시 조회하세요.' : isStandalone() ? '이 탭의 개인 키를 해제했습니다.' : '이 탭의 개인 키를 해제했습니다. 계정에 저장된 키가 있으면 자동으로 사용합니다.');
  }
  function restoreFavorite(favorite: Favorite) {
    ++classificationSeq.current; setClassifying(false); setClassificationStatus('');
    const p = favorite.payload;
    if(p.journalSources)changeJournalSources(p.journalSources);
    setChosenAuthors(p.authors); setProfessorNames(p.professorNames); setFrom(p.from); setTo(p.to);
    setFromMonth(p.fromMonth); setToMonth(p.toMonth); setIncludeUnknownMonths(p.includeUnknownMonths);
    setExcludeArxiv(p.excludeArxiv); setMergeLatest(p.mergeLatest); setPublicationKind(p.publicationKind);
    setPapers([]); setSelected(new Set()); setAuthorStats({}); setLoaded(false); setPaperError('');
    setNotice(favorite.name + ' 목록을 불러왔습니다. 선택 저자 논문 불러오기를 눌러 조회하세요.');
  }
  async function classifyPapers(targets: Paper[]) {
    const candidates = targets.filter(p => p.doi && !p.arxiv && !p.supplementalSource);
    const dois = [...new Set(candidates.map(p => normalizedDoi(p.doi)))]; if (!dois.length) return;
    const seq = ++classificationSeq.current; setClassifying(true); let index = 0; let done = 0; let failed = 0; let stopped = false; let publisherDone = 0; let publisherFailed = 0;
    const run = async () => {
      while (index < dois.length && seq === classificationSeq.current && !stopped) {
        const doi = dois[index++];
        const updateMatching = (transform: (paper: Paper) => Paper) => {
          const update = (p: Paper) => normalizedDoi(p.doi) === doi ? transform(p) : p;
          paperCache.current.forEach((p, id) => paperCache.current.set(id, update(p)));
          setPapers(prev => prev.map(update)); setEditing(prev => prev ? update(prev) : prev);
        };
        try {
          const data = await getData<CrossrefData>('/api/crossref?' + new URLSearchParams({ doi }));
          if (seq !== classificationSeq.current) return;
          updateMatching(p => applyCrossref(p, data));
        } catch (e) { failed++; if (e instanceof ClientApiError && [429, 503].includes(e.status)) stopped = true; }
        if (seq !== classificationSeq.current) return;
        if (supportsPublisherDate(doi)) {
          try { const data = await getPublisherDate(doi); if (seq !== classificationSeq.current) return; if (data) { updateMatching(p => applyPublisherDate(p, data)); publisherDone++; } }
          catch { publisherFailed++; }
        }
        if (seq !== classificationSeq.current) return;
        setClassificationStatus('출판정보 자동 확인 ' + (++done) + ' / ' + dois.length + ' DOI · 출판사 ' + publisherDone + '건 확인');
      }
    };
    await Promise.all([run(), run()]);
    if (seq === classificationSeq.current) { setClassifying(false); setClassificationStatus('출판정보 확인 완료: ' + done + ' / ' + dois.length + ' DOI · 출판사 자동 확인 ' + publisherDone + '건' + (failed ? ' · Crossref ' + failed + '건 실패' : '') + (publisherFailed ? ' · 출판사 ' + publisherFailed + '건 확인 실패: 기존 날짜·월 미상 유지' : '') + (stopped ? ' · 요청 제한으로 중단됨' : '')); }
  }
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, []);
  const recognizedPapers = useMemo(() => papers.map(p => automaticallyRecognize(p, layout.criteria)), [papers, layout.criteria]);
  const visiblePapers = sortPapers(visiblePublications(recognizedPapers, { excludeArxiv, mergeLatest, publicationKind, range: applied, includeUnknownMonths }), layout);
  const conferenceTitles = useMemo(() => conferenceCounterparts(recognizedPapers), [recognizedPapers]);
  const selectedPapers = visiblePapers.filter(p => selected.has(p.id)); const verifiedCount = visiblePapers.filter(p => p.verified).length;
  const supplementalCount = papers.filter(p => p.supplementalSource).length;
  const upstreamLoaded = Object.values(authorStats).reduce((sum, s) => sum + s.loaded, 0);
  const total = Object.values(authorStats).reduce((sum, s) => sum + s.total, 0);
  const moreAvailable = chosenAuthors.some(a => !authorStats[a.id] || (authorStats[a.id].cursor && authorStats[a.id].loaded < authorStats[a.id].total));
  async function search(page = 1) {
    if (query.trim().length < 2) { setSearchError('이름이나 식별자를 2자 이상 입력하세요.'); return; }
    const seq = ++searchSeq.current; setSearching(true); setSearchError(''); const term = page === 1 ? query.trim() : searched;
    try { const data = await getData<{ authors: Author[]; total: number }>('/api/authors?' + new URLSearchParams({ q: term, page: String(page) }), apiKey.current); if (seq !== searchSeq.current) return;
      setAuthors(prev => page === 1 ? data.authors : [...prev, ...data.authors]); setAuthorTotal(data.total); setAuthorPage(page); setSearched(term);
    } catch(e) { if (seq === searchSeq.current) setSearchError((e as Error).message); }
    finally { if (seq === searchSeq.current) setSearching(false); }
  }
  function pickAuthor(a: Author) {
    if (loading) return;
    const removing = chosenAuthors.some(v => v.id === a.id);
    setChosenAuthors(prev => removing ? prev.filter(v => v.id !== a.id) : [...prev, a]);
    if (removing) {
      setPapers(prev => prev.filter(p => p.authorId !== a.id));
      setSelected(prev => new Set([...prev].filter(id => !id.startsWith(shortId(a.id) + ':'))));
      setAuthorStats(prev => { const next = { ...prev }; delete next[a.id]; return next; });
    }
    setLoaded(false); setPaperError(''); setNotice('');
  }
  function renameProfessor(a: Author, name: string) {
    setProfessorNames(prev => ({ ...prev, [a.id]: name }));
    const update = (p: Paper) => p.authorId === a.id ? { ...p, values: { ...p.values, professor: name.trim() || a.display_name } } : p;
    paperCache.current.forEach((p, key) => paperCache.current.set(key, update(p)));
    setPapers(prev => prev.map(update)); if (papers.length) dirty.current = true;
  }
  async function loadPapers(more = false) {
    if (!chosenAuthors.length || loading) return;
    const range = more ? applied : { from, to, fromMonth, toMonth };
    const rangeError = publicationRangeError(range);
    if (rangeError) { setPaperError(rangeError); return; }
    // Fetch whole source years: an upstream January placeholder must not hide a May publication.
    const years = { from: range.from, to: range.to };
    ++classificationSeq.current; setClassifying(false); setClassificationStatus('');
    const typeCandidates: Paper[] = [];
    const seq = ++worksSeq.current; setLoading(true); setPaperError(''); setNotice('');
    const targets = more ? chosenAuthors.filter(a => !authorStats[a.id] || (authorStats[a.id].cursor && authorStats[a.id].loaded < authorStats[a.id].total)) : chosenAuthors;
    const errors: string[] = []; let successes = 0;
    for (const a of targets) {
      setWorkingAuthor(a.display_name);
      try {
        const cursor = more ? authorStats[a.id]?.cursor : null;
        const data = await getData<{ works: Work[]; total: number; cursor: string | null }>('/api/works?' + new URLSearchParams({ author: shortId(a.id), ...years, ...(cursor ? { cursor } : {}) }), apiKey.current);
        if (seq !== worksSeq.current) return;
        if (!more && successes === 0) { setPapers(prev=>prev.filter(p=>p.journalSource)); setSelected(new Set(papers.filter(p=>p.journalSource&&selected.has(p.id)).map(p=>p.id))); setAuthorStats({}); }
        setApplied(range);
        const fromOpenAlex = data.works.map(w => { const p = toPaper(w, a, professorNames[a.id] ?? a.display_name); const cached = paperCache.current.get(p.id); return cached ? { ...cached, values: { ...cached.values, professor: professorNames[a.id]?.trim() || a.display_name } } : p; });
        const supplements = supplementalPapers(a, professorNames[a.id] ?? a.display_name, years).map(p => { const cached=paperCache.current.get(p.id); return cached ? {...cached,values:{...cached.values,professor:professorNames[a.id]?.trim()||a.display_name}} : p; });
        const candidates = [...fromOpenAlex, ...supplements];
        const next = mergePaperSources(candidates.filter(p=>paperCache.current.has(p.id)), candidates);
        next.forEach(p => paperCache.current.set(p.id, p)); typeCandidates.push(...next.filter(p => !p.supplementalSource && (!p.publicationDates?.crossrefChecked || (supportsPublisherDate(p.doi) && !p.publicationDates?.publisherChecked))));
        setPapers(prev => [...mergePaperSources(prev, next)].sort((a, b) => b.values.published.localeCompare(a.values.published) || a.values.professor.localeCompare(b.values.professor)));
        setSelected(prev => new Set([...prev, ...next.map(p => p.id)]));
        setAuthorStats(prev => ({ ...prev, [a.id]: { total: data.total, loaded: (more ? prev[a.id]?.loaded ?? 0 : 0) + data.works.length, cursor: data.cursor } }));
        successes++;
      } catch (e) {
        errors.push(a.display_name + ': ' + (e as Error).message);
        if (e instanceof ClientApiError && [429, 401, 403].includes(e.status)) { errors.push('남은 저자의 요청을 중단했습니다. 기존 조회 결과와 편집 내용은 유지됩니다.'); break; }
      }
    }
    if (seq === worksSeq.current) { setLoading(false); setWorkingAuthor(''); setLoaded(successes > 0); setPaperError(errors.join(' / ')); if (typeCandidates.length) void classifyPapers(typeCandidates); }
  }
  function openEdit(p: Paper) { ++editSeq.current; setEditing({ ...p, values: { ...p.values } }); setEditError(''); setEnriching(false); }
  function closeEdit() { ++editSeq.current; setEditing(null); setEnriching(false); }
  function setValue(key: FieldKey, value: string) { setEditing(prev => prev ? key === 'published' ? setManualPublicationDate(prev, value) : { ...prev, ...(key === 'category' ? { recognitionCategoryManual: true } : {}), ...(key === 'venue' ? { venueManual: true } : {}), values: { ...prev.values, [key]: value } } : null); }
  function commitEdit() { if (!editing) return; const error = validationError(editing.values) || (editing.evidence ? evidenceError(editing.evidence) : ''); if (error) { setEditError(error); return; } paperCache.current.set(editing.id, editing); setPapers(prev => prev.map(p => p.id === editing.id ? editing : p)); dirty.current = true; closeEdit(); setNotice('수정한 내용을 반영했습니다. 현재 양식에 연결된 값이 Excel/CSV에 포함됩니다.'); }
  async function enrich() {
    if (!editing) return; const seq = editSeq.current; setEnriching(true); setEditError('');
    try { const [crossref, publisher] = await Promise.allSettled([getData<CrossrefData>('/api/crossref?' + new URLSearchParams({ doi: editing.doi })), getPublisherDate(editing.doi)]); if (seq !== editSeq.current) return;
      setEditing(prev => { if (!prev) return prev; let next = crossref.status === 'fulfilled' ? applyCrossref(prev, crossref.value, true) : prev; if (publisher.status === 'fulfilled' && publisher.value) next = applyPublisherDate(next, publisher.value); return next; });
      setEditError('날짜 근거를 확인한 뒤 변경사항을 반영하세요. 직접 지정한 날짜는 유지됩니다.' + (crossref.status === 'rejected' ? ' Crossref 확인 실패.' : ' Crossref 확인 완료.') + (publisher.status === 'rejected' ? ' 출판사 확인 실패: 기존 날짜를 유지합니다.' : publisher.value ? ' 출판사 자동 확인 완료.' : ''));
    } catch(e) { if (seq === editSeq.current) setEditError((e as Error).message); } finally { if (seq === editSeq.current) setEnriching(false); }
  }
  function toggle(id: string, checked: boolean) { setSelected(prev => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; }); }
  function applyCriteria(values: Paper[]) { const updates = new Map(values.map(p => [p.id, p])); values.forEach(p => paperCache.current.set(p.id,p)); setPapers(prev => prev.map(p => updates.get(p.id) || p)); dirty.current = true; setNotice(values.length + '건에 확인한 인정 기준을 반영했습니다. Excel/CSV로 저장하세요.'); }
  function download() { saveFile(layoutCsv(selectedPapers, layout), '논문대장_' + new Date().toISOString().slice(0, 10) + '.csv'); setNotice('선택한 ' + count(selectedPapers.length) + '건을 현재 양식의 ' + layout.columns.length + '개 열로 내보냈습니다. CSV에는 색상·너비가 저장되지 않습니다.'); }
  function addJournalPapers(incoming:Paper[],range:PublicationRange){
    if(JSON.stringify(range)!==JSON.stringify(applied))setAuthorStats({});
    const merged=mergeJournalPapers(papers,incoming),added=merged.filter(p=>!papers.some(old=>old.id===p.id));
    added.forEach(p=>paperCache.current.set(p.id,p));setPapers(merged);setSelected(prev=>new Set([...prev,...added.map(p=>p.id)]));setApplied(range);setLoaded(true);dirty.current=true;
    setNotice('저널 검색에서 '+added.length+'편 추가 · 기존 논문 '+(incoming.length-added.length)+'편 유지. 같은 이름의 다른 연구자가 아닌지 원문을 확인하세요.');
  }
  async function downloadExcel() { setExporting(true); try { const buffer = await ledgerXlsx(selectedPapers, layout); downloadBlob(new Uint8Array(buffer).buffer, '논문대장_' + new Date().toISOString().slice(0,10) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); setNotice('선택한 ' + selectedPapers.length + '건을 정렬·서식과 함께 Excel로 내보냈습니다.'); } catch { setNotice('Excel 파일을 만들지 못했습니다. 행 수를 줄여 다시 시도하세요.'); } finally { setExporting(false); } }
  const checkboxAll = <Checkbox aria-label="표시된 논문 전체 선택" checked={visiblePapers.length > 0 && selectedPapers.length === visiblePapers.length ? true : selectedPapers.length ? 'indeterminate' : false} onCheckedChange={v => setSelected(prev => { const next = new Set(prev); visiblePapers.forEach(p => v === true ? next.add(p.id) : next.delete(p.id)); return next; })} disabled={!visiblePapers.length}/>;
  return <div className="app-shell">
    <header className="topbar"><a href={isStandalone() ? "#" : "/"} className="brand"><span className="brand-mark"><Library size={23}/></span>논문대장<span className="brand-caption">{isStandalone() ? "LOCAL EDITION" : "RESEARCH RECORDS"}</span></a><div className="topbar-right">{isStandalone() && <GoogleConnectionStatus onOpen={() => setSettings(true)}/>}<span className="source-label">OpenAlex · {keyActive ? "탭 키 적용" : account?.hasSavedKey ? "계정 키 사용" : serverKeyConfigured ? "서버 키 사용" : "키 없는 조회"}</span><Button variant="ghost" onClick={() => { setSettings(true); }} disabled={loading || searching}><Settings2 size={17}/>검색 설정</Button><Button variant="ghost" size="icon" aria-label="항목 작성 안내" onClick={() => setHelp(true)}><CircleHelp size={20}/></Button></div></header>
    <div className="workspace"><aside className="search-panel">
      <div className="step-label">01 / AUTHOR SEARCH</div><h1>어떤 저자의<br/>논문을 찾으시나요?</h1>
      <form onSubmit={e => { e.preventDefault(); search(); }}><label htmlFor="author-query">저자 이름 / ORCID</label><div className="search-input"><Search size={18}/><Input id="author-query" value={query} onChange={e => setQuery(e.target.value)} placeholder="예: Geoffrey Hinton" maxLength={150}/></div><Button className="search-button" type="submit" disabled={searching}>{searching ? <Loader2 className="animate-spin" size={17}/> : <Search size={17}/>}저자 검색</Button></form>
      <div className="api-key-hint"><Info size={15}/><span>{keyActive ? "개인 API 키가 이 탭에 적용되어 있습니다." : account?.hasSavedKey ? "계정에 저장된 개인 API 키로 조회합니다." : serverKeyConfigured ? "서버에 설정된 키로 조회합니다. 개인 키도 적용할 수 있습니다." : "조회 제한이 발생하면 검색 설정에서 무료 개인 API 키를 적용하세요."}</span><button onClick={() => { setSettings(true); }} disabled={loading || searching}>설정</button></div><p className="field-hint">저자를 체크한 뒤 다른 이름을 검색해 추가하세요. 이전 선택은 유지됩니다. 영문 이름·ORCID·OpenAlex ID로 검색할 수 있습니다.</p>
      {searchError && <p className="error" role="alert">{searchError}</p>}
      <div className="author-heading"><h2>저자 후보</h2><span>{searched ? count(authorTotal) + '명' : '소속을 확인해 주세요'}</span></div>
      {searching && !authors.length ? <div className="skeleton-stack"><Skeleton className="h-28 w-full"/><Skeleton className="h-28 w-full"/></div> : authors.length ? <div className="author-list">{authors.map(a => <label htmlFor={'author-' + shortId(a.id)} className={'author-card ' + (chosenAuthors.some(v => v.id === a.id) ? 'active' : '')} key={a.id}><div className="author-card-title"><strong>{a.display_name}</strong><Checkbox id={'author-' + shortId(a.id)} checked={chosenAuthors.some(v => v.id === a.id)} onCheckedChange={() => pickAuthor(a)} disabled={loading} aria-label={a.display_name + ' 저자 선택'}/></div><p>{a.last_known_institutions?.map(i => i.display_name).join(' · ') || '소속 정보 없음'}</p><span>{count(a.works_count ?? 0)}개 연구문헌 · {shortId(a.id)}</span>{a.orcid && <small>ORCID {shortId(a.orcid)}</small>}</label>)}{authors.length < authorTotal && authorPage < 500 && <Button variant="outline" className="w-full" onClick={() => search(authorPage + 1)} disabled={searching}>저자 후보 더 보기</Button>}</div> : <Empty className="author-empty"><EmptyHeader><EmptyMedia variant="icon"><UserRound/></EmptyMedia><EmptyTitle>{searched ? '검색된 저자가 없습니다' : '저자를 검색해 시작하세요'}</EmptyTitle><EmptyDescription>{searched ? '다른 영문 표기나 ORCID로 검색해 보세요.' : '같은 이름의 연구자를 소속과 식별자로 구분합니다.'}</EmptyDescription></EmptyHeader></Empty>}
      <div className="sidebar-note"><Info size={16}/><span>기본 저자 검색원은 OpenAlex입니다. 누락된 논문은 ‘저널 추가 검색’에서 찾아 보완할 수 있습니다. 조회 건수는 저자의 전체 논문 수를 보장하지 않습니다.</span></div>
    </aside><main className="main-panel">
      <div className="page-heading"><div><div className="step-label">02 / PUBLICATION RECORDS</div><h2>연구실적 정리</h2><p>여러 저자의 논문을 모아, 참여교수별 실적 양식으로 정리하세요.</p></div><div className="export-actions"><LayoutSettings layout={layout} onChange={setLayout} sample={visiblePapers[0]} onMessage={setNotice}/><Button variant="outline" disabled={!selectedPapers.length || exporting || loading || classifying} onClick={download}><Download size={17}/>CSV</Button><Button className="export-button" disabled={!selectedPapers.length || exporting || loading || classifying} onClick={() => void downloadExcel()}>{exporting ? <Loader2 size={17} className="animate-spin"/> : <Download size={17}/>}Excel 다운로드{selectedPapers.length > 0 && <span className="export-count">{count(selectedPapers.length)}</span>}</Button></div></div>
      <section className="query-bar" aria-label="논문 조회 조건"><div className="professor-field author-count-summary"><label>선택한 저자</label><strong><UserRound size={18}/>{chosenAuthors.length}명 <span>여러 명 선택 가능</span></strong></div><PublicationRangeControls value={{ from, to, fromMonth, toMonth }} onChange={range => { setFrom(range.from); setTo(range.to); setFromMonth(range.fromMonth); setToMonth(range.toMonth); }} disabled={loading}/><Button disabled={!chosenAuthors.length || loading} onClick={() => loadPapers()}>{loading ? <Loader2 size={17} className="animate-spin"/> : <Search size={17}/>}선택 저자 논문 불러오기</Button></section>
      <div className="publication-options"><label><Checkbox checked={excludeArxiv} onCheckedChange={v => setExcludeArxiv(v === true)}/>arXiv 제외</label><label title="연도는 범위에 걸치지만 월을 확인할 수 없는 자료를 함께 표시합니다. 전체 연도가 범위 안이면 항상 포함합니다."><Checkbox checked={includeUnknownMonths} onCheckedChange={v => setIncludeUnknownMonths(v === true)}/>기간 경계의 월 미상 포함</label><label><Checkbox checked={mergeLatest} onCheckedChange={v => setMergeLatest(v === true)}/>같은 제목·같은 유형 최신 1편</label><div className="kind-filter"><label htmlFor="kind-filter">학술유형</label><Select value={publicationKind} onValueChange={v => setPublicationKind(v as PublicationKind | 'all')}><SelectTrigger id="kind-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">전체 유형</SelectItem>{Object.entries(kindLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select></div><JournalSearch authors={chosenAuthors} professorNames={professorNames} sources={journalSources} onSources={changeJournalSources} range={{from,to,fromMonth,toMonth}} includeUnknownMonths={includeUnknownMonths} onAdd={addJournalPapers} disabled={loading||classifying}/><AuthorFavorites payload={{ journalSources, authors: chosenAuthors, professorNames: Object.fromEntries(chosenAuthors.map(a => [a.id, professorNames[a.id] || a.display_name])), from, to, fromMonth, toMonth, includeUnknownMonths, excludeArxiv, mergeLatest, publicationKind }} onRestore={restoreFavorite} disabled={loading}/></div>
      <p className="filter-description">arXiv 제외는 주 출처가 arXiv인 문헌에 적용합니다. 다른 곳에 정식 게재된 문헌은 유지합니다. 동일 제목은 참여교수·학술유형별로 최신 1편을 표시합니다. 학술대회판과 저널판은 각각 유지하며, 기간·유형 필터를 먼저 적용합니다.</p>
      <p className="filter-description">시작·종료 월을 포함해 조회합니다. 전체 월은 해당 연도 전체입니다. 월 미상 자료는 그 연도가 범위와 겹칠 때 포함할 수 있습니다. 조건 변경 후 논문 불러오기를 누르세요.{loaded && <strong> 적용된 범위: {publicationRangeLabel(applied)}</strong>}</p>
      {chosenAuthors.length > 0 && <section className="chosen-authors" aria-label="선택한 저자와 참여교수 표기명">{chosenAuthors.map(a => <div key={a.id} className="chosen-author"><div className="chosen-author-info"><strong>{a.display_name}</strong><span>{shortId(a.id)} · {authorStats[a.id] ? count(authorStats[a.id].loaded) + ' / ' + count(authorStats[a.id].total) + '편 조회' + (papers.some(p=>p.authorId===a.id&&p.supplementalSource)?' · 출판사 보완 '+papers.filter(p=>p.authorId===a.id&&p.supplementalSource).length+'편':'') : '조회 대기'}</span><div><a href={safeUrl(a.id)} target="_blank" rel="noopener noreferrer">저자 정보 ↗</a><a href={'https://scholar.google.com/scholar?q=' + encodeURIComponent('author:"' + a.display_name + '"')} target="_blank" rel="noopener noreferrer">Google Scholar ↗</a></div></div><div className="chosen-author-name"><label htmlFor={'name-' + shortId(a.id)}>참여교수 표기명</label><Input id={'name-' + shortId(a.id)} value={professorNames[a.id] ?? a.display_name} onChange={e => renameProfessor(a, e.target.value)} disabled={loading}/></div><Button variant="ghost" size="sm" onClick={() => pickAuthor(a)} disabled={loading} aria-label={a.display_name + ' 선택 해제'}>해제</Button></div>)}</section>}
      {paperError && <p className="error" role="alert">{paperError}</p>}{notice && <p className="notice" role="status"><Check size={16}/>{notice}</p>}
      <div className="stat-strip"><div><span>표시된 교수별 논문 행</span><strong>{count(visiblePapers.length)}<small> / 조회 {count(papers.length)}건</small></strong></div><div><span>직접 확인 완료</span><strong>{count(verifiedCount)}<small>건</small></strong></div><div><span>내보내기 항목</span><strong>{layout.columns.length}<small>개 열</small></strong></div><button onClick={() => setHelp(true)} className="guide-link"><Info size={17}/><span>자동 입력과<br/>직접 확인 항목 안내</span><ArrowUpRight size={16}/></button></div>
      <p className="field-hint">학술대회는 개최 시작 연월, 저널은 출판연월을 기준으로 정렬·기간 필터·내보내기에 반영합니다. 학술대회 개최일이 확인되면 표시 기간 밖으로 이동할 수 있습니다.</p><section className="records"><div className="active-layout"><span>현재 양식 · <strong>{layout.name}</strong></span><small>정렬과 열 설정은 양식·프리셋에서 저장할 수 있습니다.</small></div><SortControls layout={layout} onChange={setLayout}/><Tabs defaultValue="list"><div className="records-toolbar"><TabsList><TabsTrigger value="list">논문 목록</TabsTrigger><TabsTrigger value="form">내 양식 표 ({layout.columns.length})</TabsTrigger></TabsList><div className="record-actions"><CriteriaPanel layout={layout} onLayout={setLayout} papers={selectedPapers} onApply={applyCriteria}/><Button variant="outline" size="sm" disabled={loading || classifying || !papers.some(p => p.doi && !p.arxiv)} onClick={() => classifyPapers(papers)}>출판일·학술유형 재확인</Button><span>{count(selectedPapers.length)}건 선택됨</span></div></div>
      {(classificationStatus || classifying) && <div className="classification-status" role="status">{classifying && <Loader2 size={14} className="animate-spin"/>}{classificationStatus || 'DOI 출판일·학술유형을 확인하고 있습니다.'}{classifying && <Button variant="ghost" size="sm" onClick={() => { ++classificationSeq.current; setClassifying(false); setClassificationStatus('출판일·학술유형 확인을 중단했습니다. 완료된 결과는 유지됩니다. 미확인 날짜는 원문을 확인하세요.'); }}>중단</Button>}</div>}
      <p className="table-hint">DOI 문헌의 출판일·학술유형을 자동 확인합니다. Tech Science Press(10.32604)는 DOI로 출판사 페이지를 찾아 날짜까지 자동 보완합니다. 날짜 아래에서 근거를 확인하고 논문 편집에서 비교하세요. 연도만 등록된 자료는 월 미상으로 표시합니다. 후보는 OpenAlex 수록 연도 기준으로 가져오고, 기간 필터는 보완된 출판년월에 적용합니다. 출판사와 수록 연도가 다른 자료는 조회 연도를 넓혀 확인하세요.</p>
      {!visiblePapers.length ? <Empty className="paper-empty"><EmptyHeader><EmptyMedia className="paper-empty-icon"><BookOpen size={34}/></EmptyMedia><EmptyTitle>{loading ? '학술정보를 불러오고 있습니다' : papers.length ? '현재 필터에 맞는 문헌이 없습니다' : loaded ? '해당 기간에 수록된 문헌이 없습니다' : chosenAuthors.length ? '조회할 기간을 정하고 논문을 불러오세요' : '논문 목록이 여기에 표시됩니다'}</EmptyTitle><EmptyDescription>{loading ? workingAuthor + '의 저자와 출판정보를 확인하는 중입니다.' : papers.length ? '조회 기간·월 미상 포함·학술유형 조건을 바꾸거나 다음 논문을 불러오세요.' : loaded ? '조회 기간을 넓히거나 다른 저자 프로필을 확인해 보세요.' : '제목, 저자, 출판정보를 가져온 뒤 원하는 양식에 맞춰 실적 항목을 편집할 수 있습니다.'}</EmptyDescription></EmptyHeader>{loading && <Loader2 className="animate-spin text-primary"/>}</Empty> : <>
      <TabsContent value="list"><Table><TableHeader><TableRow><TableHead className="check-cell">{checkboxAll}</TableHead><TableHead><button className="sort-heading" onClick={() => sortBy('title')}>논문명 / 저자{sortIndicator('title')}</button></TableHead><TableHead><button className="sort-heading" onClick={() => sortBy('published')}>출판년월{sortIndicator('published')}</button></TableHead><TableHead><button className="sort-heading" onClick={() => sortBy('venue')}>학술지 · 학술대회{sortIndicator('venue')}</button></TableHead><TableHead><button className="sort-heading" onClick={() => sortBy('verified')}>확인 상태{sortIndicator('verified')}</button></TableHead><TableHead><span className="sr-only">수정</span></TableHead></TableRow></TableHeader><TableBody>{visiblePapers.map(p => <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}><TableCell className="check-cell"><Checkbox checked={selected.has(p.id)} onCheckedChange={v => toggle(p.id, v === true)} aria-label={p.values.title + ' 선택'}/></TableCell><TableCell className="paper-title-cell"><button className="paper-title" onClick={() => openEdit(p)}>{p.values.title || '제목 정보 없음'}</button><p className="participant-line">참여교수 · {p.values.professor}</p><p className="paper-byline">{p.values.firstAuthor || '제1저자 미확인'}{p.values.authorCount && Number(p.values.authorCount) > 1 && ' 외 ' + (Number(p.values.authorCount) - 1) + '명'}<span title={p.kindSource}>{kindLabels[p.publicationKind]}</span>{p.journalSource&&<a href={safeUrl(p.source)} target="_blank" rel="noopener noreferrer">저널 추가 검색 · {p.journalSource==='hcis'?'HCIS':'Crossref'} ↗</a>}{p.supplementalSource&&<a href={p.supplementalSource} target="_blank" rel="noopener noreferrer">출판사 확인 보완 ↗</a>}{p.publicationKind==='journal' && conferenceTitles.has(p.authorId+'\u0000'+normalizedTitle(p.values.title)) && <small className="publication-date-source">동일 제목 학술대회 기록 있음 · 두 유형 모두 유지</small>}</p></TableCell><TableCell>{p.values.published || '—'}<small className="publication-date-source">{dateSummary(p)}</small></TableCell><TableCell className="venue-cell">{p.values.venue || '정보 없음'}<small className="publication-date-source">{recognitionLabel(p,layout.criteria)}</small>{p.publicationKind==='journal'&&<a className="publication-date-source" href={journalLookupUrl(p.values.issn)} target="_blank" rel="noopener noreferrer">SCIE 공식 확인 ↗</a>}</TableCell><TableCell><span className={'status-tag ' + (p.verified ? 'verified' : '')}>{p.verified ? <Check size={12}/> : <Pencil size={12}/>} {p.verified ? '확인 완료' : '검토 필요'}</span></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={p.values.title + ' 항목 수정'} onClick={() => openEdit(p)}><Pencil size={16}/></Button></TableCell></TableRow>)}</TableBody></Table></TabsContent>
      <TabsContent value="form"><p className="table-hint">열 이름을 누르면 정렬합니다. 사용자 항목은 논문의 ‘수정’에서 입력하세요. 내보내기는 현재 표시되고 선택한 행만 포함합니다.</p><Table className="custom-table" style={{fontSize:layout.style.fontSize+'pt'}}><TableHeader><TableRow><TableHead>{checkboxAll}</TableHead><TableHead>수정</TableHead>{layout.columns.map(c => <TableHead key={c.id} style={{background:layout.style.headerColor,color:headerTextColor(layout.style.headerColor),minWidth:c.width+'ch',width:c.width+'ch',maxWidth:c.width+'ch',textAlign:c.align,whiteSpace:'normal'}}><button className="sort-heading" disabled={c.source==='rowNumber'} onClick={() => sortBy('column:'+c.id)}>{c.label}{sortIndicator('column:'+c.id)}</button></TableHead>)}</TableRow></TableHeader><TableBody>{visiblePapers.map((p,i) => <TableRow key={p.id} style={{background:layout.style.striped&&i%2===1?'#f2f5f9':undefined}}><TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={v => toggle(p.id, v === true)} aria-label={p.values.title + ' 선택'}/></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(p)}>수정</Button></TableCell>{layout.columns.map(c => <TableCell key={c.id} style={{textAlign:c.align,minWidth:c.width+'ch',maxWidth:c.width+'ch',whiteSpace:layout.style.wrap?'pre-wrap':'nowrap',overflowWrap:'anywhere'}}>{displayValue(columnValue(p,c,i),c.format)||'—'}</TableCell>)}</TableRow>)}</TableBody></Table></TabsContent></>}
      </Tabs>{papers.length > 0 && <div className="table-footer"><span>표시 {count(visiblePapers.length)}건 · OpenAlex 조회 {count(upstreamLoaded)} / {count(total)}건 · 저널 추가 {count(papers.filter(p=>p.journalSource).length)}건{supplementalCount>0&&<> · 출판사 보완 {supplementalCount}건</>} · 교수별 각 100편씩 조회{loading && ' · ' + workingAuthor + ' 조회 중'}</span>{moreAvailable && <Button variant="outline" size="sm" onClick={() => loadPapers(true)} disabled={loading}>{loading ? <Loader2 size={15} className="animate-spin"/> : <Plus size={15}/>}다음 / 미조회 논문 불러오기</Button>}</div>}</section>
      <div className="bottom-note"><Info size={16}/><p>인정 구분은 사용 중인 기준표와 일치하면 자동 입력됩니다. 학회 권장 목록은 BK 판정에 사용하지 않습니다. IF, 연구보조원 수, 주저자 여부, 기여율, 사사 기관 수는 직접 확인해 입력하세요. 조회 결과에는 논문 외 문헌도 포함될 수 있습니다. 공동 논문은 참여교수별로 한 행씩 표시되며, 총 건수도 교수별 행 기준입니다. <strong>조회 결과는 최대 1시간 캐싱됩니다. 논문 편집 내용은 이 탭에서만 유지됩니다. 저자 선택과 조회 조건은 즐겨찾기로 저장할 수 있습니다. 작업 후 Excel/CSV를 저장하세요.</strong></p></div>
    </main></div>
    <Dialog open={!!editing} onOpenChange={v => { if (!v) closeEdit(); }}><DialogContent className="edit-dialog"><DialogHeader><div className="step-label">PUBLICATION DETAILS</div><DialogTitle>논문 실적 항목 편집</DialogTitle><DialogDescription>자동 입력된 값도 수정할 수 있습니다. 빈칸은 CSV에서도 빈칸으로 유지됩니다.</DialogDescription></DialogHeader>{editing && <>
      <div className="edit-source"><span>저자 역할: <strong>{editing.role}</strong></span><a href={safeUrl(editing.source)} target="_blank" rel="noopener noreferrer">원자료 확인 <ArrowUpRight size={14}/></a>{safeUrl(editing.values.link) && <a href={safeUrl(editing.values.link)} target="_blank" rel="noopener noreferrer">논문 링크 <ArrowUpRight size={14}/></a>}</div>
      <div className="publication-kind-editor"><label htmlFor="edit-kind">학술유형</label><Select value={editing.publicationKind} onValueChange={v => setEditing(p => p ? applyPublicationDates({ ...p, publicationKind: v as PublicationKind, kindSource: '직접 확인' }, p.publicationDates || { candidates: [] }) : p)}><SelectTrigger id="edit-kind"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(kindLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select><small>분류 근거: {editing.kindSource} · 양식에서 학술유형 열을 추가할 수 있습니다.</small></div>
      <PublicationDateEditor paper={editing} onChange={setEditing}/>
      {editing.warnings.map(w => <p key={w} className="error">{w}</p>)}<div className="edit-form">{fields.map((f, i) => <div key={f.key} className={'edit-field ' + (['title', 'coauthors', 'link', 'venue'].includes(f.key) ? 'wide' : '')}><label htmlFor={'edit-' + f.key}><span className="field-number">{String(i + 1).padStart(2, '0')}</span>{f.label}{f.manual && <small>직접 확인</small>}</label>{f.key === 'isLead' ? <Select value={editing.values.isLead || 'unset'} onValueChange={v => setValue('isLead', v === 'unset' ? '' : v)}><SelectTrigger id="edit-isLead" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="unset">미입력</SelectItem><SelectItem value="Y">Y · 주저자</SelectItem><SelectItem value="N">N · 해당 없음</SelectItem></SelectContent></Select> : ['title', 'coauthors'].includes(f.key) ? <textarea id={'edit-' + f.key} value={editing.values[f.key]} onChange={e => setValue(f.key, e.target.value)} rows={2}/> : <Input id={'edit-' + f.key} value={editing.values[f.key]} onChange={e => setValue(f.key, e.target.value)} placeholder={f.key === 'published' ? 'YYYY-MM (월 미상: YYYY)' : f.key === 'contribution' ? '예: 25%' : f.key === 'category' ? '예: SCIE / CS우수학술대회 / h5-index 50 이상 학술대회' : f.manual ? '확인 후 입력' : '자료 없음'}/>}{f.key === 'isLead' && <p className="field-hint">제1·교신·공동주저자 인정은 기관 기준과 원문으로 판단하세요.</p>}{f.key === 'impactFactor' && <p className="field-hint">제출 기준연도의 JCR IF 또는 기관 인정 IF를 입력하세요.</p>}</div>)}</div>
      {layout.columns.some(c => c.source === 'manual') && <div className="custom-edit-fields"><h3>이 양식의 사용자 항목</h3><div className="edit-form">{layout.columns.filter(c => c.source === 'manual').map(c => <div className="edit-field" key={c.id}><label htmlFor={'custom-'+c.id}>{c.label}</label><Input id={'custom-'+c.id} maxLength={5000} value={editing.customValues?.[c.id] || ''} onChange={e => setEditing(p => p ? {...p,customValues:{...p.customValues,[c.id]:e.target.value}} : p)}/></div>)}</div></div>}
      <RecognitionEditor paper={editing} onChange={setEditing} onError={setEditError}/>
      <div className="edit-bottom"><Button variant="outline" onClick={enrich} disabled={!editing.doi || enriching}>{enriching ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}출판정보·날짜 확인</Button><label className="verify-label"><Checkbox checked={editing.verified} onCheckedChange={v => setEditing(p => p ? { ...p, verified: v === true } : p)}/>원문·기관 기준 확인 완료</label></div>{editError && <p className="field-hint" role="status">{editError}</p>}<DialogFooter><Button variant="outline" onClick={closeEdit}>취소</Button><Button onClick={commitEdit} disabled={enriching}><Check size={16}/>변경사항 반영</Button></DialogFooter></>}</DialogContent></Dialog>
    {isStandalone() ? <GoogleSettings open={settings} onOpenChange={setSettings} onApply={applyKey} keyActive={keyActive} disabled={loading || searching}/> : <SearchSettings open={settings} onOpenChange={setSettings} account={account} onAccountChange={setAccount} accountError={accountError} tabKeyActive={keyActive} serverKeyConfigured={serverKeyConfigured} onApply={applyKey} disabled={loading || searching}/>}
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="help-dialog"><DialogHeader><DialogTitle>실적 항목과 사용자 양식 안내</DialogTitle><DialogDescription>자동 수집 정보와 기관 확인 정보를 함께 관리합니다.</DialogDescription></DialogHeader><div className="help-copy"><h3>서지정보 · 11개 항목</h3><p>참여교수, 제1저자, 공동저자, 논문명, 페이지, 볼륨, 출판년월, 저자수, 학술지·학술대회명, DOI·링크, ISSN을 가능한 범위에서 채웁니다. 참여교수 표기명을 바꾸면 해당 저자의 불러온 논문에도 적용됩니다. 여러 저자를 선택할 수 있고, 공동 논문은 교수별로 별도 행을 만들어 기여율과 주저자 여부를 각각 입력합니다.</p><h3>인정 구분 자동 입력과 직접 확인</h3><p>구분은 출처가 확인된 기준표로 자동 대조합니다. SCIE는 내장한 IEEE·출판사 목록, CS우수학술대회는 BK 공식 첨부 목록, h5는 사용자가 가져온 기준표를 사용합니다. 학회 권장 목록을 BK로 인정하지 않습니다. 자료가 없으면 미확인이며 직접 입력한 값은 유지합니다. 연구보조원수, 참여교수 주저자여부, IF, 기여율, 사사 기관 수는 직접 입력합니다. h5-index는 저자 h-index와 다르며, SCIE·BK·CS 우수학술대회 인정 여부와 IF는 해당 기관의 기준연도 자료로 확인하세요.</p><h3>누락 정보와 출판일</h3><p>서지정보는 누락되거나 잘못 연결될 수 있습니다. DOI가 있으면 Crossref로 출판일과 학술유형을 자동 확인합니다. 다른 등록기관의 DOI는 Crossref에 없을 수 있습니다. 원문과 저자 식별자로 확인하여 내장한 누락 보완 자료는 저자 조회 시 함께 표시하며, 출판사 전체를 실시간 검색하는 기능은 아닙니다. Tech Science Press DOI는 출판사 페이지의 날짜를 자동으로 보완합니다. 학술대회 논문은 개최 시작일을 기준으로 표시·정렬하고, 개최일이 없으면 미확인으로 둡니다. 저널은 출판사에서 확인한 날짜를 우선하며, 그 외에는 월이 있는 Crossref 인쇄·온라인·출판·발행일 순으로 사용합니다. 월이 없으면 연도만 표시합니다. 논문 편집에서 날짜 근거를 비교하고 제출 기준에 맞게 직접 지정하세요. 직접 지정한 날짜는 자동 조회로 덮어쓰지 않습니다. 사사 기관 수는 원문 사사문을 기준으로 확인합니다.</p><h3>저장과 CSV</h3><p>기본 17열 또는 사용자가 구성한 양식으로 저장합니다. 양식·프리셋에서 열과 서식, 다중 정렬을 저장하고 Excel 머리글을 붙여넣을 수 있습니다. Excel(XLSX)은 서식과 텍스트 식별자를 보존하며 CSV는 값만 저장합니다. 저자를 검색해 추가하거나 해제해도 다른 저자의 선택은 유지됩니다. CSV는 한글 표시를 위한 UTF-8 BOM을 포함합니다. ISSN의 앞자리 0을 보존하려면 Excel의 ‘텍스트/CSV에서 가져오기’로 열고 해당 열 형식을 텍스트로 지정하세요. CSV에는 현재 필터에서 표시되고 선택된 행만 들어갑니다. 최신 1편 옵션은 대소문자·공백을 정리한 동일 제목을 참여교수·학술유형별로 비교합니다. 같은 제목의 학술대회판과 저널판은 서로 합치지 않습니다. 동일 제목 학술대회 표시에는 불러온 자료를 사용하며, 실제 확장판 관계를 확정하는 것은 아닙니다. 같은 날이면 OpenAlex ID로 일정하게 선택합니다. 비슷하지만 다른 제목은 자동으로 합치지 않습니다. 즐겨찾기는 저자 목록과 조회 조건을 저장하며, 논문 편집 내용은 탭을 닫으면 사라집니다.</p><a href="https://help.openalex.org/api/" target="_blank" rel="noopener noreferrer">OpenAlex 데이터 안내 ↗</a></div></DialogContent></Dialog>
  </div>;
}

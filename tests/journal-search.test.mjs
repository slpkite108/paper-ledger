import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
await build({configFile:false,logLevel:'silent',build:{outDir:'.build/journal-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/journal-search-entry.ts'),formats:['es'],fileName:()=>'app.mjs'}}});
const a=await import(pathToFileURL(resolve('.build/journal-test/app.mjs')).href);
const author={id:'https://openalex.org/A1',display_name:'Byeong-Seok Shin',orcid:'https://orcid.org/0000-0001-7742-4846'};
const candidate={id:'hcis1',title:'A paper',authors:[{name:'Eun-Seok Lee'},{name:'Byeong-Seok Shin'}],authorText:'Eun-Seok Lee; Byeong-Seok Shin',venue:'Human-centric Computing and Information Sciences',issn:['2192-1962'],volume:'15',doi:'10.22967/HCIS.2025.15.005',date:'2025-01-30',url:'https://hcisj.com/articles/?HCIS202515005',provider:'hcis'};
test('ISSN checksum, normalized sources and provider binding are validated',()=>{assert.equal(a.validIssn('2045-2322'),true);assert.equal(a.validIssn('2192-1962'),true);assert.equal(a.validIssn('2045-2323'),false);assert.equal(a.journalSourcesSchema.safeParse([{...a.defaultJournalSources[0],issn:'2045-2322'}]).success,false);assert.equal(a.journalSourcesSchema.safeParse([...a.defaultJournalSources,...a.defaultJournalSources]).success,false);});
test('name match does not imply identity; ORCID match is explicit',()=>{assert.equal(a.authorQuery('Byeong‐Seok Shin'),'Byeong-Seok Shin');assert.match(a.candidateMatch(candidate,author,'Byeong-Seok Shin'),/소속 확인/);assert.equal(a.candidateMatch({...candidate,authors:[{name:'Someone',orcid:author.orcid}]},author,'Shin'),'ORCID 일치');});
test('publisher provenance, year-month and author count survive conversion and CSV',()=>{const p=a.candidateToPaper(candidate,author,'신병석');assert.equal(p.values.published,'2025-01');assert.equal(p.values.authorCount,'2');assert.equal(p.values.firstAuthor,'Eun-Seok Lee');assert.equal(p.journalSource,'hcis');assert.equal(p.publicationKind,'journal');assert.equal(p.verified,false);assert.ok(!p.publicationDates.candidates.some(c=>c.source==='openalex'));assert.match(a.layoutCsv([p],a.defaultLayout()),/2025-01/);assert.equal(a.publicationInRange(p.values.published,{from:'2025',fromMonth:'09',to:'2026',toMonth:'08'},true),false);});
test('cross-source DOI dedup preserves manual edits and separates professor and conference',()=>{const p=a.candidateToPaper(candidate,author,'신병석'),edited={...p,id:'A1:W1',journalSource:undefined,values:{...p.values,title:'Edited title'}};assert.deepEqual(a.mergeJournalPapers([edited],[p]),[edited]);assert.equal(a.mergeJournalPapers([{...edited,publicationKind:'conference'}],[p]).length,2);assert.equal(a.mergeJournalPapers([{...edited,authorId:'A2'}],[p]).length,2);});
test('Crossref source metadata retains date precision and pages',()=>{const c=a.crossrefCandidate({DOI:'10.1234/test',title:['Title'],'container-title':['Journal'],ISSN:['2045-2322'],type:'journal-article',author:[{given:'Jane',family:'Doe'}],issued:{'date-parts':[[2025]]},page:'12-24'}),p=a.candidateToPaper(c,author,'Prof');assert.equal(p.values.published,'2025');assert.equal(p.values.pages,'12 / 24');assert.equal(p.publicationDates.crossrefChecked,true);});
test('journal sources round-trip in old and new favorites',()=>{const old={authors:[author],professorNames:{},from:'2025',to:'2026'};assert.equal(a.favoritePayloadSchema.safeParse(old).success,true);const next=a.favoritePayloadSchema.parse({...old,journalSources:a.defaultJournalSources});assert.deepEqual(next.journalSources,a.defaultJournalSources);});

const years={from:'2025',to:'2026',fromMonth:'',toMonth:''};
const hcisPage=JSON.parse(readFileSync('tests/hcis-author-results.json','utf8'));
test('automatic author discovery finds the reported OOD paper without a DOI query',async()=>{
  const calls=[],delivered=[];
  const results=await a.discoverJournalCandidates([author],a.defaultJournalSources,years,true,{onResult:r=>delivered.push(r)},async(source,query,range)=>{calls.push({source,query,range});return hcisPage;});
  assert.equal(calls.length,1);assert.equal(calls[0].query,'Byeong-Seok Shin');assert.deepEqual(calls[0].range,years);
  assert.equal(results[0].rows.length,3);assert.deepEqual(delivered,results);
  const ood=results[0].rows.find(c=>c.title.startsWith('Out-of-distribution'));
  assert.equal(ood.doi,'10.22967/HCIS.2025.15.018');assert.equal(ood.date,'2025-03-30');
  const p=a.candidateToPaper(ood,author,'신병석');assert.equal(p.values.published,'2025-03');assert.equal(p.verified,false);assert.match(a.layoutCsv([p],a.defaultLayout()),/2025-03/);
});
test('automatic queries coalesce equal names but preserve separate author identity candidates',async()=>{
  let calls=0;
  const people=[author,{...author,id:'A2',display_name:'Byeong‐Seok Shin'}];
  const results=await a.discoverJournalCandidates(people,[...a.defaultJournalSources,{name:'Disabled',issn:'2045-2322',provider:'crossref',enabled:false}],years,true,{},async()=>{calls++;return hcisPage;});
  assert.equal(calls,1);assert.equal(results.length,2);assert.notEqual(a.journalCandidateKey(results[0],results[0].rows[0]),a.journalCandidateKey(results[1],results[1].rows[0]));
});
test('month exclusions retain title and source date for an explanation',async()=>{
  const results=await a.discoverJournalCandidates([author],a.defaultJournalSources,{...years,fromMonth:'09',toMonth:'08'},true,{},async()=>hcisPage);
  assert.equal(results[0].rows.length,0);assert.equal(results[0].excluded.length,3);assert.ok(results[0].excluded.some(c=>c.date==='2025-03-30'));
});
test('one source failure does not hide another source; 429 stops further requests to that provider',async()=>{
  const crossref={name:'Other journal',issn:'2045-2322',provider:'crossref',enabled:true};let hcisCalls=0;
  const results=await a.discoverJournalCandidates([author,{...author,id:'A2',display_name:'Jane Doe'}],[...a.defaultJournalSources,crossref],years,true,{},async(source)=>{if(source.provider==='hcis'){hcisCalls++;throw Object.assign(new Error('Rate limited'),{status:429});}return hcisPage;});
  assert.equal(hcisCalls,1);assert.equal(results.filter(r=>r.error).length,2);assert.equal(results.filter(r=>!r.error).length,2);
});
test('superseded discovery does not publish stale results',async()=>{
  let current=true,delivered=0,calls=0;
  const results=await a.discoverJournalCandidates([author,{...author,id:'A2'}],a.defaultJournalSources,years,true,{isCurrent:()=>current,onResult:()=>delivered++},async()=>{calls++;current=false;return hcisPage;});
  assert.equal(calls,1);assert.equal(delivered,0);assert.deepEqual(results,[]);
});

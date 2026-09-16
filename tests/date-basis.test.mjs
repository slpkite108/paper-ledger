import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ExcelJS from 'exceljs';
await build({configFile:false,logLevel:'silent',build:{outDir:'.build/date-basis-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/date-basis-entry.ts'),formats:['es'],fileName:()=>'app.mjs'},rolldownOptions:{external:['exceljs']}}});
const a=await import(pathToFileURL(resolve('.build/date-basis-test/app.mjs')).href);
const author={id:'https://openalex.org/A1',display_name:'Researcher'};
const parts=(...p)=>({'date-parts':[p]});
const paper=(id='1')=>a.toPaper({id:'https://openalex.org/W'+id,title:'Paper '+id,type:'journal-article',primary_location:{source:{type:'journal'}}},author,'Researcher');
const hybrid=(id='1')=>a.applyCrossref(paper(id),a.crossrefData({DOI:'10.1234/'+id,type:'journal-article','published-print':parts(2025,10,1),'published-online':parts(2025,8,15)}));
const publisher={source:'publisher-metadata',date:'2025-07-01',url:'https://publisher.example/paper',note:'citation_publication_date'};
test('hybrid dates follow the selected meaning even when generic publisher evidence arrives first',()=>{
  const p=a.applyPublisherDate(hybrid(),publisher);
  for(const candidates of [p.publicationDates.candidates,[...p.publicationDates.candidates].reverse()]) {
    const raw={...p,publicationDates:{...p.publicationDates,candidates}};
    assert.equal(a.withDateBasis(raw,'issue').values.published,'2025-10');
    assert.equal(a.withDateBasis(raw,'online').values.published,'2025-08');
    assert.equal(a.dateResolution(a.withDateBasis(raw,'online')),'preferred');
  }
});
test('only one date kind is retained under either preference with an explicit fallback reason',()=>{
  for(const [source,kind,other] of [['crossref-print','issue','online'],['crossref-online','online','issue']]) {
    const raw=a.applyPublicationDates(paper(),{candidates:[{source,date:'2025-04-12',url:'https://doi.org/10.1/x'}]});
    assert.equal(a.withDateBasis(raw,kind).values.published,'2025-04');
    const fallback=a.withDateBasis(raw,other);
    assert.equal(fallback.values.published,'2025-04');assert.equal(a.dateResolution(fallback),'fallback');assert.match(a.dateSummary(fallback),/대체.*없음/);
  }
});
test('generic Published/issued/OpenAlex dates do not masquerade as issue or online dates',()=>{
  const raw=a.applyPublicationDates(paper(),{candidates:[publisher,{source:'openalex',date:'2025-01-01',url:'https://openalex.org/W1'}]});
  for(const basis of ['issue','online']) {
    const p=a.withDateBasis(raw,basis);assert.equal(p.values.published,'2025-07');assert.equal(a.dateResolution(p),'unspecified');assert.match(a.dateSummary(p),/종류 미확인/);
    assert.equal(a.sourceValue(p,'issueDate'),'');assert.equal(a.sourceValue(p,'onlineDate'),'');
  }
  const explicit={...publisher,note:'Tech Science Press · citation_online_date · DOI 일치'};
  assert.equal(a.candidateDateKind(explicit),'online');
});
test('unknown month remains unknown in the preferred date kind instead of borrowing a different month',()=>{
  const raw=a.applyCrossref(paper(),a.crossrefData({DOI:'10.1/x',type:'journal-article','published-print':parts(2025),'published-online':parts(2024,12)}));
  const p=a.withDateBasis(raw,'issue');assert.equal(p.values.published,'2025');assert.match(a.dateSummary(p),/월 미상/);
  assert.equal(a.withDateBasis(raw,'online').values.published,'2024-12');
});
test('background enrichment retains the active preference and separately preserves manual exceptions',()=>{
  const online=a.withDateBasis(hybrid(),'online');
  const enriched=a.applyPublisherDate(a.applyCrossref(online,a.crossrefData({DOI:'10.1/x',type:'journal-article','published-print':parts(2026,1),'published-online':parts(2025,8,15)})),publisher);
  assert.equal(enriched.values.published,'2025-08');
  const manual=a.withDateBasis(a.setManualPublicationDate(enriched,'2025-09'),'issue');
  assert.equal(manual.values.published,'2025-09');assert.equal(a.dateResolution(manual),'manual');assert.match(a.dateSummary(manual),/기준 예외/);
  assert.equal(a.applyPublicationDates(manual,{...manual.publicationDates,manual:false}).values.published,'2026-01');
});
test('conference event date is invariant under journal preferences; missing event stays unknown',()=>{
  const p={...hybrid(),publicationKind:'conference',publicationDates:{...hybrid().publicationDates,candidates:[...hybrid().publicationDates.candidates,{source:'conference-event',date:'2024-12-18',url:'https://conference.example'}]}};
  for(const basis of ['issue','online']){assert.equal(a.withDateBasis(p,basis).values.published,'2024-12');assert.equal(a.withDateBasis({...hybrid(),publicationKind:'conference'},basis).values.published,'');}
});
test('switching preference recomputes date-range membership and chronological CSV/XLSX from the same rows',async()=>{
  const range={from:'2025',fromMonth:'09',to:'2026',toMonth:'08'};
  const settings={...a.defaultLayout(),columns:a.defaultLayout().columns.filter(c=>['title','published'].includes(c.source)),sort:[{key:'published',direction:'asc'}]};
  const second=a.applyCrossref(paper('2'),a.crossrefData({DOI:'10.1234/2',type:'journal-article','published-print':parts(2025,9,1),'published-online':parts(2025,11,1)}));
  for(const [basis,expected] of [['issue',['2025-09','2025-10']],['online',['2025-11']]]) {
    const rows=a.sortPapers(a.visiblePublications([hybrid(),second].map(p=>a.withDateBasis(p,basis)),{range,includeUnknownMonths:false,excludeArxiv:false,mergeLatest:false,publicationKind:'all'}),settings);
    assert.deepEqual(rows.map(p=>p.values.published),expected);
    assert.deepEqual(a.layoutCsv(rows,settings).split('\r\n').slice(1).map(l=>l.split(',')[1].replaceAll('"','')),expected);
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(await a.ledgerXlsx(rows,settings));
    assert.deepEqual(expected.map((_,i)=>wb.getWorksheet('연구실적').getCell(i+2,2).value),expected);
  }
});
test('original dates are independently available as sortable/exportable mapped columns',()=>{
  const p=a.withDateBasis(hybrid(),'online');assert.equal(a.sourceValue(p,'issueDate'),'2025-10-01');assert.equal(a.sourceValue(p,'onlineDate'),'2025-08-15');assert.match(a.sourceValue(p,'publicationDateBasis'),/온라인/);
  for(const key of ['issueDate','onlineDate'])assert.equal(a.isDateSort(a.defaultLayout(),key),true);
});
test('new and old favorites/presets retain a valid date preference',()=>{
  const old={authors:[author],professorNames:{},from:'',to:''};assert.equal(a.favoritePayloadSchema.parse(old).dateBasis,'issue');assert.equal(a.favoritePayloadSchema.parse({...old,dateBasis:'online'}).dateBasis,'online');
  const layout=a.defaultLayout();delete layout.dateBasis;assert.equal(a.layoutSchema.parse(layout).dateBasis,'issue');assert.equal(a.layoutSchema.parse({...layout,dateBasis:'online'}).dateBasis,'online');
  assert.equal(a.layoutSchema.safeParse({...layout,dateBasis:'invalid'}).success,false);
});
test('journal candidate period results can be rebased both ways without losing previously excluded candidates',()=>{
  const c=a.crossrefCandidate({DOI:'10.1/x',title:['Hybrid journal candidate'],type:'journal-article','published-print':parts(2025,10),'published-online':parts(2025,8)}),range={from:'2025',fromMonth:'09',to:'2026',toMonth:'08'};
  const r=a.journalResult(a.defaultJournalSources[0],author,author.display_name,range,false,{works:[c],next:'2',sourceUrl:'https://api.crossref.org'},'online');
  assert.equal(r.rows.length,0);assert.equal(r.excluded.length,1);
  const issue=a.rebaseJournalResult(r,'issue');assert.equal(issue.rows.length,1);assert.equal(issue.next,'2');assert.equal(a.rebaseJournalResult(issue,'online').excluded.length,1);
});

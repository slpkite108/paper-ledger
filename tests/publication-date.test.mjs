import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';

await build({configFile:false,logLevel:'silent',build:{outDir:'.build/publication-date-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/publication-date-entry.ts'),formats:['es'],fileName:()=>'dates.mjs'}}});
const app=await import(pathToFileURL(resolve('.build/publication-date-test/dates.mjs')).href);
const author={id:'https://openalex.org/A1',display_name:'Researcher'};
const work={id:'https://openalex.org/W1',doi:'https://doi.org/10.1234/example',publication_date:'2025-01-01',publication_year:2025,title:'Example',type:'article',primary_location:{source:{type:'journal'}}};
const paper=()=>app.toPaper(work,author,'Researcher');
const parts=(...values)=>({'date-parts':[values]});
const metadata=values=>app.crossrefData({DOI:'10.1234/example',type:'journal-article',...values});

test('reported CMES paper: publisher issue date wins over OpenAlex January and Crossref year-only',async()=>{
  const fixture=JSON.parse(await readFile('tests/publication-date-fixture.json','utf8'));
  const p=app.applyCrossref(app.toPaper(fixture.openalex,author,'Researcher'),app.crossrefData(fixture.crossref));
  assert.equal(p.values.published,'2025-05'); assert.equal(p.publicationDate,'2025-05-30');
  assert.equal(p.publicationDates.selected,'publisher-issue');
  assert.equal(p.publicationDates.candidates.find(c=>c.source==='openalex').date,'2025-01-01');
  assert.equal(p.publicationDates.candidates.find(c=>c.source==='crossref-print').date,'2025');
  assert.match(app.sourceValue(p,'publicationDateSource'),/techscience.com/);
  assert.equal(app.citationDate(fixture.publisherMeta,fixture.crossref.DOI).date,'2025-05-30');
  assert.equal(app.citationDate(fixture.ris,fixture.crossref.DOI).date,'2025');
});
test('year-only metadata removes inferred January; missing metadata does not remove an OpenAlex date',()=>{
  assert.equal(app.applyCrossref(paper(),metadata({'published-print':parts(2025)})).values.published,'2025');
  assert.equal(app.applyCrossref({...paper(),verified:true},metadata({'published-print':parts(2025,5)})).verified,false);
  const p=app.applyCrossref(paper(),metadata({}));assert.equal(p.values.published,'2025-01');assert.match(app.dateSummary(p),/원문 확인/);
});
test('valid partial dates and leap years; reject malformed/zero/invalid month and day',()=>{
  for(const [value,expected] of [[parts(2025),'2025'],[parts(2025,5),'2025-05'],[parts(2024,2,29),'2024-02-29'],[parts(2025,2,29),''],[parts(2025,13),''],[parts(2025,0),''],[parts(2025,4,31),''],[parts(2025,5,0),''],[parts(2025,1.5),''],[parts('2025'),''],[{'date-parts':[[]]},''],[{},'']])assert.equal(app.dateFromParts(value),expected);
});
test('empty or invalid print date falls through to online; print and online remain distinct',()=>{
  const p=app.applyCrossref(paper(),metadata({'published-print':{},'published-online':parts(2024,11,15),published:parts(2025)}));
  assert.equal(p.values.published,'2024-11');assert.equal(p.publicationDates.selected,'crossref-online');
  const p2=app.applyCrossref(p,metadata({'published-print':parts(2025,2),'published-online':parts(2024,11,15)}));
  assert.equal(p2.values.published,'2025-02');assert.equal(p2.publicationDates.candidates.find(c=>c.source==='crossref-online').date,'2024-11-15');
});
test('known-month online date may supplement print year; actual January first is not discarded',()=>{
  assert.equal(metadata({'published-print':parts(2025),'published-online':parts(2025,5,30)}).published,'2025-05');
  assert.equal(app.applyCrossref(paper(),metadata({'published-print':parts(2025,1,1)})).values.published,'2025-01');
});
test('DOI registration/update/event dates are not publication dates',()=>{
  assert.equal(metadata({created:parts(2025,4,23),deposited:parts(2026,8,1),indexed:parts(2026,9,1),accepted:parts(2025,3,28),event:{start:parts(2025,7,1)}}).published,'');
});
test('manual date and manual kind survive repeated background and blank-enrichment updates',()=>{
  let p=app.setManualPublicationDate({...paper(),kindSource:'직접 확인',publicationKind:'conference'},'2025-06');
  const data=metadata({'published-print':parts(2025,5,30),volume:'143'});
  for(let i=0;i<2;i++)p=app.applyCrossref(p,data,true);
  assert.equal(p.values.published,'2025-06');assert.equal(p.publicationDate,'2025-06');assert.equal(p.publicationKind,'conference');assert.equal(p.values.volume,'143');
  assert.equal(p.publicationDates.candidates.filter(c=>c.source==='crossref-print').length,1);
  // A conference without an event date must not fall back to the journal/book publication date.
  assert.equal(app.applyPublicationDates(p,{...p.publicationDates,manual:false}).values.published,'');
  const cleared=app.applyCrossref(app.setManualPublicationDate(p,''),data);assert.equal(cleared.values.published,'');assert.equal(cleared.publicationDate,'');
});
test('choosing an online date protects it and retains full day precision for latest-version selection',()=>{
  const p=app.applyCrossref(paper(),metadata({'published-print':parts(2025,5),'published-online':parts(2025,4,20)}));
  const chosen=app.choosePublicationDate(p,p.publicationDates.candidates.find(c=>c.source==='crossref-online'));
  assert.equal(app.applyCrossref(chosen,metadata({'published-print':parts(2025,5)})).publicationDate,'2025-04-20');
  const earlier={...p,id:'A1:W2',values:{...p.values,published:'2025-04'},publicationDate:'2025-04-19'};
  assert.equal(app.latestByTitle([chosen,earlier])[0].id,chosen.id);
});
test('CSV follows corrected-date sort and does not invent a month for a year-only value',()=>{
  const one=app.applyCrossref(paper(),metadata({'published-print':parts(2025,5)}));
  const two=app.applyCrossref({...paper(),id:'A1:W2',values:{...paper().values,title:'Year only'}},metadata({'published-print':parts(2025)}));
  const layout=app.defaultLayout();layout.columns=layout.columns.filter(c=>['title','published'].includes(c.source));
  const csv=app.layoutCsv(app.sortPapers([two,one],layout),layout).split('\r\n');
  assert.match(csv[1],/"Example","2025-05"/);assert.match(csv[2],/"Year only","2025"/);
});
test('Cite importer handles HTML attribute order, RIS dates and BibTeX month names with DOI identity',()=>{
  assert.equal(app.citationDate(`<meta content='2025/5/30' name='citation_publication_date'><meta name="citation_doi" content="10.1234/example"><meta name="citation_reference" content="citation_doi=10.9999/other;citation_publication_date=1999">`,'https://doi.org/10.1234/EXAMPLE').date,'2025-05-30');
  assert.equal(app.citationDate('TY  - JOUR\nDO  - 10.1234/example\nPY  - 2025\nDA  - 2025/05/30/\nER  -','10.1234/example').date,'2025-05-30');
  assert.equal(app.citationDate('@article{x, doi={10.1234/example}, year={2025}, month=may}','10.1234/example').date,'2025-05');
  assert.equal(app.citationDate('@article{x, doi="10.1234/example", year=2025}','10.1234/example').date,'2025');
  assert.throws(()=>app.citationDate('TY  - JOUR\nDO  - 10.9999/wrong\nPY  - 2025','10.1234/example'),/DOI/);
  assert.throws(()=>app.citationDate('TY  - JOUR\nDO  - 10.1234/example\nPY  - 2025\nTY  - JOUR','10.1234/example'),/1편/);
  assert.throws(()=>app.citationDate('@article{x, doi={10.1234/example}, year=2025, month=13}','10.1234/example'),/출판일/);
});
test('direct Cite fetch uses public requests and returns a useful CORS fallback',async()=>{
  const saved=globalThis.fetch;
  try {
    globalThis.fetch=async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');return new Response('TY  - JOUR\nDO  - 10.1234/example\nDA  - 2025/05/30');};
    assert.equal((await app.fetchCitationDate('https://publisher.example/paper.ris','10.1234/example')).date,'2025-05-30');
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
    await assert.rejects(app.fetchCitationDate('https://publisher.example/paper','10.1234/example'),/인용파일이나 HTML/);
    await assert.rejects(app.fetchCitationDate('javascript:alert(1)','10.1234/example'),/http/);
  }finally{globalThis.fetch=saved;}
});

test('the two currently unknown months have verified publisher fallbacks',()=>{
  for(const [doi,date] of [['10.32604/cmc.2026.080992','2026-06'],['10.32604/cmc.2025.063815','2025-05']]) {
    const p=app.toPaper({...work,doi},author,'Researcher');assert.equal(p.values.published,date);
  }
});
test('automatic publisher lookup sends only DOI and applies its date after Crossref year-only',async()=>{
  const saved=globalThis.fetch;const doi='10.32604/cmc.2026.080992';
  try {
    let calls=0;
    globalThis.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).searchParams.get('doi'),doi);assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);return Response.json({doi,source:'publisher-metadata',date:'2026-06-15',url:'https://www.techscience.com/cmc/v88n2/67650',checkedOn:'2026-09-16'});};
    assert.equal(await app.getPublisherDate('10.9999/unsupported'),null);assert.equal(calls,0);
    const candidate=await app.getPublisherDate(doi);
    const p=app.applyPublisherDate(app.applyCrossref(app.toPaper({...work,doi,publication_year:2026},author,'Researcher'),metadata({'published-print':parts(2026)})),candidate);
    assert.equal(p.values.published,'2026-06');assert.equal(p.publicationDates.selected,'publisher-metadata');assert.equal(p.publicationDates.publisherChecked,true);
    assert.equal(app.applyCrossref(p,metadata({'published-print':parts(2026)})).values.published,'2026-06');
    assert.equal(app.applyPublisherDate(app.setManualPublicationDate(p,'2026-07'),candidate).values.published,'2026-07');
  }finally{globalThis.fetch=saved;}
});
test('automatic publisher lookup rejects mismatched DOI, invalid dates, hostile URLs and failures',async()=>{
  const saved=globalThis.fetch,doi='10.32604/cmc.2026.080992';
  const good={doi,source:'publisher-metadata',date:'2026-06-15',url:'https://www.techscience.com/cmc/v88n2/67650'};
  try {
    for(const extra of [{doi:'10.32604/cmc.wrong'},{date:'2026-02-30'},{url:'https://techscience.com.evil.example/'},{source:'openalex'}]) { globalThis.fetch=async()=>Response.json({...good,...extra});await assert.rejects(app.getPublisherDate(doi),/응답/); }
    globalThis.fetch=async()=>new Response('{}',{status:502});await assert.rejects(app.getPublisherDate(doi),/확인 실패/);
  }finally{globalThis.fetch=saved;}
});

const range = (from='',fromMonth='',to='',toMonth='') => ({from,fromMonth,to,toMonth});
test('month ranges are inclusive and support same-month, cross-year and one-sided bounds',()=>{
  const may=range('2025','05','2025','05');
  for(const value of ['2025-05','2025-05-01','2025-05-31'])assert.equal(app.publicationInRange(value,may,false),true);
  for(const value of ['2025-04','2025-06','2024-05'])assert.equal(app.publicationInRange(value,may,false),false);
  const winter=range('2025','11','2026','02');
  for(const value of ['2025-11','2025-12','2026-01','2026-02'])assert.equal(app.publicationInRange(value,winter,false),true);
  for(const value of ['2025-10','2026-03'])assert.equal(app.publicationInRange(value,winter,false),false);
  assert.equal(app.publicationInRange('2024-12',range('2025','05'),true),false);
  assert.equal(app.publicationInRange('2026-12',range('2025','05'),false),true);
  assert.equal(app.publicationInRange('2025-06',range('','','2025','05'),true),false);
  assert.equal(app.publicationInRange('',range(),false),true);
});
test('invalid years, invalid months, orphan month and reversed periods are rejected',()=>{
  for(const invalid of [range('20'),range('2101'),range('2025','13'),range('2025','00'),range('','05'),range('2025','06','2025','05'),range('2026','','2025','')])assert.notEqual(app.publicationRangeError(invalid),'');
  for(const valid of [range(),range('2025','','2025',''),range('2025','05','2025','05'),range('2025','11','2026','02')])assert.equal(app.publicationRangeError(valid),'');
});
test('unknown months stay uncertain; only overlapping years can be included',()=>{
  const may=range('2025','05','2025','05');
  assert.equal(app.publicationInRange('2025',may,true),true);
  assert.equal(app.publicationInRange('2025',may,false),false);
  assert.equal(app.publicationInRange('2024',may,true),false);
  assert.equal(app.publicationInRange('2026',may,true),false);
  assert.equal(app.publicationInRange('',may,true),true);
  assert.equal(app.publicationInRange('',may,false),false);
  assert.equal(app.publicationInRange('2025',range('2025','','2025',''),false),true);
  assert.equal(app.publicationInRange('2025',range('2024','11','2026','02'),false),true);
});
test('month filtering uses corrected publisher dates instead of OpenAlex January placeholders',()=>{
  const corrected=app.toPaper({...work,doi:'10.32604/cmc.2025.063815'},author,'Researcher');
  const options={excludeArxiv:false,mergeLatest:true,publicationKind:'all',range:range('2025','05','2025','05'),includeUnknownMonths:false};
  assert.equal(app.visiblePublications([corrected],options).length,1);
  assert.equal(app.visiblePublications([corrected],{...options,range:range('2025','01','2025','01')}).length,0);
  assert.equal(app.visiblePublications([app.setManualPublicationDate(corrected,'2025-06')],options).length,0);
});
test('range filtering precedes latest-title merge, and CSV uses the same filtered rows',()=>{
  const may=app.setManualPublicationDate(paper(),'2025-05');
  const june=app.setManualPublicationDate({...paper(),id:'A1:W2'},'2025-06');
  const result=app.visiblePublications([may,june],{excludeArxiv:false,mergeLatest:true,publicationKind:'all',range:range('2025','05','2025','05')});
  assert.deepEqual(result.map(p=>p.id),[may.id]);
  const layout=app.defaultLayout();layout.columns=layout.columns.filter(c=>['title','published'].includes(c.source));
  const csv=app.layoutCsv(app.sortPapers(result,layout),layout);
  assert.match(csv,/"2025-05"/);assert.doesNotMatch(csv,/2025-06/);
});
test('old favorites retain full-year ranges; new favorites preserve months and unknown-month policy',()=>{
  const old={authors:[author],professorNames:{},from:'2025',to:'2026'};
  const restored=app.favoritePayloadSchema.parse(old);
  assert.equal(restored.fromMonth,'');assert.equal(restored.toMonth,'');assert.equal(restored.includeUnknownMonths,true);
  const monthly={...restored,fromMonth:'11',toMonth:'02',includeUnknownMonths:false};
  assert.deepEqual(app.favoritePayloadSchema.parse(JSON.parse(JSON.stringify(monthly))),monthly);
  assert.equal(app.publicationRangeLabel(monthly),'2025-11 – 2026-02');
  assert.equal(app.favoritePayloadSchema.safeParse({...monthly,from:'2026',fromMonth:'03'}).success,false);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
await build({configFile:false,logLevel:'silent',build:{outDir:'.build/recognition-conference-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/recognition-conference-entry.ts'),formats:['es'],fileName:()=>'app.mjs'}}});
const app=await import(pathToFileURL(resolve('.build/recognition-conference-test/app.mjs')).href);
const make=(venue,kind='journal',issn='')=>({...app.toPaper({id:'W1',title:'Same Title'}, {id:'A1',display_name:'Researcher'},'Researcher'),publicationKind:kind,kindSource:'test',values:{...app.toPaper({id:'W1'}, {id:'A1',display_name:'Researcher'},'Researcher').values,title:'Same Title',venue,issn}});
const auto=(p,c=app.defaultCriteria)=>app.automaticallyRecognize(p,c);
const reference=(id,value,year='2026')=>({id,name:id,year,url:'https://example.org/'+id,rows:[{venue:'Test Conference',issn:'',alias:'TC',category:'h5-index',value,impactFactor:''}]});
const customCriteria=refs=>({...app.defaultCriteria,custom:refs,automaticSources:refs.map(r=>r.id)});
test('official datasets validate; no society recommendations are enabled',()=>{
  assert.equal(app.builtinIeee.rows.length,167);assert.equal(app.builtinBk.rows.length,188);
  for(const r of app.builtinReferences)assert.equal(app.referenceSchema.safeParse(r).success,true,r.id);
  assert.equal(app.criteriaSchema.safeParse(app.defaultCriteria).success,true);
  assert.ok(!app.defaultCriteria.automaticSources.includes('kiise-2024'));
  const old=app.criteriaSchema.parse({selected:'kiise-2024',custom:[]});assert.equal(old.automatic,true);assert.ok(!old.automaticSources.includes('kiise-2024'));
});
test('SCIE exact ISSN/full name matching rejects conflicts, ESCI and wrong types',()=>{
  const p=auto(make('Metadata title','journal','1545-5971'));
  assert.equal(p.values.category,'SCIE');assert.equal(p.evidence.scie.year,'2026');assert.match(p.evidence.scie.url,/IEEE-Title-List-August-2026/);
  assert.equal(p.values.impactFactor,'');assert.equal(p.verified,false);
  assert.equal(auto(make('IEEE Transactions on Dependable and Secure Computing')).values.category,'SCIE');
  assert.equal(auto(make('IEEE Transactions on Dependable and Secure Computing','journal','9999-9999')).values.category,'');
  assert.equal(auto(make('IEEE Journal of Microwaves')).values.category,'');
  for(const kind of ['conference','preprint','unknown'])assert.equal(auto(make('Applied Intelligence',kind,'0924-669X')).values.category,'');
  assert.equal(auto({...make('Applied Intelligence'),arxiv:true}).values.category,'');
});
test('BK official match fills CS classification, does not recognize workshops or findings as main tracks',()=>{
  const venue='2025 IEEE International Conference on Bioinformatics and Biomedicine (BIBM)';
  const p=auto(make(venue,'conference'));
  assert.equal(p.values.category,'CS우수학술대회');assert.equal(p.evidence.bk.status,'yes');assert.match(p.evidence.bk.url,/kast.or.kr/);
  for(const extra of [' Workshops',' Findings',' Poster Abstracts'])assert.equal(auto(make(venue+extra,'conference')).values.category,'');
  assert.equal(auto(make(venue,'journal')).values.category,'');
  const society={...reference('society','80'),url:'https://www.kiise.or.kr/TopConferences/',rows:[{...reference('x','80').rows[0],category:'BK인정'}]};
  assert.equal(auto(make('Test Conference','conference'),customCriteria([society])).values.category,'');
});
test('h5 threshold uses venue h5 only for conferences, never author h-index or journals',()=>{
  for(const [value,expected] of [['49',''],['50','h5-index 50 이상 학술대회'],['100','h5-index 50 이상 학술대회']]){
    const c=customCriteria([reference('metrics',value)]);
    const p=auto(make('Test Conference','conference'),c);assert.equal(p.values.category,expected);assert.equal(p.evidence.h5.value,value);
    assert.equal(auto(make('Test Conference','journal'),c).values.category,'');
  }
  assert.equal(auto({...make('Test Conference','conference'),h_index:99}).values.category,'');
});
test('ambiguous reference rows and same-year conflicting h5 remain unknown; newest reference wins',()=>{
  const dup=reference('dup','80');dup.rows.push({...dup.rows[0],value:'90'});
  assert.equal(auto(make('Test Conference','conference'),customCriteria([dup])).values.category,'');
  assert.equal(auto(make('Test Conference','conference'),customCriteria([reference('a','80'),reference('b','49')])).values.category,'');
  const p=auto(make('Test Conference','conference'),customCriteria([reference('a','80','2025'),reference('b','49','2026')]));
  assert.equal(p.evidence.h5.value,'49');assert.equal(p.values.category,'');
});
test('automatic ownership allows source/type changes without overwriting manual edits',()=>{
  const original=make('Applied Intelligence');const once=auto(original);assert.equal(original.values.category,'');
  assert.deepEqual(auto(once),once);
  assert.equal(auto({...once,verified:true}).verified,true);
  assert.equal(auto({...once,values:{...once.values,venue:'Unknown Journal'}}).values.category,'');
  assert.equal(auto({...once,publicationKind:'conference'}).values.category,'');
  assert.equal(auto(once,{...app.defaultCriteria,automatic:false}).values.category,'');
  assert.equal(auto({...once,values:{...once.values,category:'기관 직접 인정'}}).values.category,'기관 직접 인정');
  assert.equal(auto({...once,recognitionCategoryManual:true,values:{...once.values,category:''}}).values.category,'');
  const e=app.completeEvidence();e.scie={status:'no',year:'2026',url:'https://example.org/manual',note:'직접 확인'};
  assert.equal(auto({...original,evidence:e}).evidence.scie.status,'no');
  assert.equal(auto({...original,evidence:e}).values.category,'');
});
test('automatic category and evidence export through current layout without changing row order',()=>{
  const p=auto(make('Applied Intelligence')),layout=app.defaultLayout();
  layout.columns=layout.columns.filter(c=>c.source==='category');layout.columns.push({...app.newColumn('인정 근거·기준연도'),source:'evidence'});
  const csv=app.layoutCsv([p],layout);assert.match(csv,/SCIE/);assert.match(csv,/link.springer.com\/journal\/10489/);
});
test('reported Springer chapter uses ConferenceInfo name and Dec 2024 event date, retaining May 2025 publication evidence',async()=>{
  const fixture=JSON.parse(await readFile('tests/conference-crossref-fixture.json','utf8'));
  const p=app.applyCrossref({...make('Lecture Notes in Electrical Engineering','unknown'),doi:fixture.DOI},app.crossrefData(fixture));
  assert.equal(p.publicationKind,'conference');assert.equal(p.publicationDate,'2024-12-18');assert.equal(p.values.published,'2024-12');
  assert.match(p.values.venue,/Computer Science and its Applications \(CSA\)/);
  assert.equal(p.conference.end,'2024-12-20');assert.equal(p.publicationDates.selected,'conference-event');
  assert.equal(p.publicationDates.candidates.find(c=>c.source==='crossref-online').date,'2025-05-15');
  assert.match(app.sourceValue(p,'conferenceDates'),/2024-12-18 ~ 2024-12-20/);
  const options={excludeArxiv:false,mergeLatest:true,publicationKind:'all',range:{from:'2025',fromMonth:'09',to:'2026',toMonth:'08'},includeUnknownMonths:false};
  assert.equal(app.visiblePublications([p],options).length,0);
});
test('event start date drives conference chronology, missing date remains unknown; journals ignore event dates',()=>{
  const m={DOI:'10.1234/test',type:'proceedings-article',event:{name:'Test Conference',start:{'date-parts':[[2024,12,18]]},end:{'date-parts':[[2024,12,20]]}},'published-online':{'date-parts':[[2025,5,15]]}};
  assert.equal(app.applyCrossref(make('Test Conference','conference'),app.crossrefData(m)).values.published,'2024-12');
  assert.equal(app.applyCrossref(make('Test Conference','conference'),app.crossrefData({...m,event:{name:'Test Conference'}})).values.published,'');
  assert.equal(app.applyCrossref(make('Journal'),app.crossrefData({...m,type:'journal-article'})).values.published,'2025-05');
  for(const invalid of ['31 February 2025','2025-13-10','12/11/2025'])assert.equal(app.conferenceDate(invalid),'');
  assert.equal(app.conferenceDate('18 December 2024'),'2024-12-18');
});
test('manual event date, venue and type survive background metadata refresh',async()=>{
  const fixture=JSON.parse(await readFile('tests/conference-crossref-fixture.json','utf8'));
  const p=app.setManualPublicationDate({...make('내 학술대회','conference'),venueManual:true,kindSource:'직접 확인'},'2024-11');
  const next=app.applyCrossref(p,app.crossrefData(fixture));assert.equal(next.values.published,'2024-11');assert.equal(next.values.venue,'내 학술대회');assert.equal(next.publicationKind,'conference');
});
test('same title keeps conference and journal separately, merges only within the same author and kind',()=>{
  const conference={...make('Conference','conference'),id:'C1',publicationDate:'2024-12-18'};conference.values.published='2024-12';
  const old={...make('Journal'),id:'J1',publicationDate:'2025-05-15'};old.values.published='2025-05';
  const recent={...make('Journal'),id:'J2',publicationDate:'2026-01-01'};recent.values.published='2026-01';
  const another={...old,id:'A2:J1',authorId:'A2'};
  const result=app.latestByTitle([conference,old,recent,another]);assert.deepEqual(result.map(p=>p.id),['C1','J2','A2:J1']);
  const titles=app.conferenceCounterparts([conference,old,recent]);assert.ok(titles.has('A1\u0000same title'));assert.ok(!titles.has('A2\u0000same title'));
  const csv=app.layoutCsv(result,app.defaultLayout());assert.equal(csv.split('\r\n').length,4);
});

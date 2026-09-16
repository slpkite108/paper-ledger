import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await build({configFile:false,logLevel:'silent',build:{outDir:'.build/journal-identifiers-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/journal-identifiers-entry.ts'),formats:['es'],fileName:()=>'app.mjs'},rolldownOptions:{external:['exceljs']}}});
const a=await import(pathToFileURL(resolve('.build/journal-identifiers-test/app.mjs')).href);
const author={id:'https://openalex.org/A1',display_name:'Researcher'};
const pISSN='1532-0464',eISSN='1532-0480';
const raw=()=>a.toPaper({id:'https://openalex.org/W1',type:'journal-article',primary_location:{source:{type:'journal',display_name:'Journal of Biomedical Informatics',issn:[pISSN,eISSN],issn_l:pISSN}}},author,'Researcher');
const metadata={'container-title':['Journal of Biomedical Informatics'],DOI:'10.1234/test',type:'journal-article',ISSN:[pISSN,eISSN],'issn-type':[{type:'print',value:pISSN},{type:'electronic',value:eISSN}],'published-print':{'date-parts':[[2026,1]]},'published-online':{'date-parts':[[2025,11]]}};
const enriched=()=>a.applyCrossref(raw(),a.crossrefData(metadata));

test('OpenAlex order and ISSN-L never assert the medium',()=>{
  const ids=a.paperIdentifiers(raw());
  assert.deepEqual(ids.electronic,[]);assert.deepEqual(ids.print,[]);assert.deepEqual(ids.linking,[pISSN]);assert.deepEqual(ids.untyped,[pISSN,eISSN]);
  assert.match(a.issnSummary(raw()),/매체 미확인/);assert.equal(a.sourceValue(raw(),'electronicIssn'),'');
});
test('Crossref explicit types upgrade an already filled ISSN without losing either edition',()=>{
  for(const m of [metadata,{...metadata,ISSN:[eISSN,pISSN],'issn-type':[...metadata['issn-type']].reverse()}]){
    const p=a.applyCrossref(raw(),a.crossrefData(m));
    assert.equal(a.sourceValue(p,'electronicIssn'),eISSN);assert.equal(a.sourceValue(p,'printIssn'),pISSN);assert.equal(a.sourceValue(p,'linkingIssn'),pISSN);
    assert.equal(p.values.issn,eISSN+'; '+pISSN);assert.equal(a.preferredIssn(p),eISSN);assert.deepEqual(a.paperIdentifiers(p).untyped,[]);
    assert.match(a.issnSummary(p),/온라인 eISSN.*인쇄 pISSN/);
  }
});
test('missing ISSN array, partial types and conflicts preserve uncertainty',()=>{
  const typed=a.crossrefData({...metadata,ISSN:undefined});assert.equal(typed.issn,eISSN+'; '+pISSN);
  const partial=a.applyCrossref(raw(),a.crossrefData({...metadata,'issn-type':[{type:'print',value:pISSN}]}));
  assert.deepEqual(a.paperIdentifiers(partial).untyped,[eISSN]);assert.equal(a.sourceValue(partial,'electronicIssn'),'');assert.equal(a.preferredIssn(partial),pISSN);
  const conflict=a.crossrefIdentifiers({ISSN:[pISSN],'issn-type':[{type:'print',value:pISSN},{type:'electronic',value:pISSN}]});
  assert.deepEqual(conflict.electronic,[]);assert.deepEqual(conflict.print,[]);assert.deepEqual(conflict.untyped,[pISSN]);
});
test('manual ISSN edits, including clearing, survive enrichment and do not expose stale typed numbers',()=>{
  for(const value of ['', '2045-2322', pISSN]){
    const p=a.applyCrossref(a.setManualIssn(enriched(),value),a.crossrefData(metadata),true);
    assert.equal(p.values.issn,value);assert.equal(a.sourceValue(p,'electronicIssn'),'');assert.equal(a.sourceValue(p,'printIssn'),value===pISSN?pISSN:'');
    assert.deepEqual(a.allIdentifiers(a.paperIdentifiers(p)),value?[value]:[]);
  }
});
test('SCIE matching still uses print ISSN while an export column prefers electronic',()=>{
  const p=enriched(),reference={id:'print-test',name:'Print-only official reference fixture',year:'2026',url:'https://mjl.clarivate.com/',rows:[{venue:'Different spelling',issn:pISSN,alias:'',category:'SCIE',value:'',impactFactor:''}]};
  assert.equal(a.preferredIssn(p),eISSN);assert.equal(a.matchReference(p,reference).length,1);
  assert.equal(a.matchReference(a.setManualIssn(p,'2045-2322'),reference).length,0);
});
test('edition identifiers do not change the selected publication date basis or invent one',()=>{
  const p=enriched();assert.equal(a.withDateBasis(p,'issue').values.published,'2026-01');assert.equal(a.withDateBasis(p,'online').values.published,'2025-11');
  const generic=a.applyCrossref(raw(),a.crossrefData({...metadata,'published-print':undefined,'published-online':undefined,published:{'date-parts':[[2025,9,3]]}}));
  assert.equal(a.dateResolution(a.withDateBasis(generic,'online')),'unspecified');
});
test('Excel pasted headers, presets and CSV expose independent identifiers',()=>{
  const columns=a.headersFromTsv('e-ISSN\tp-ISSN\tISSN-L\tISSN (온라인 우선)\tISSN 매체 구분','row');
  assert.deepEqual(columns.map(c=>c.source),['electronicIssn','printIssn','linkingIssn','preferredIssn','issnDetails']);
  const layout=a.layoutSchema.parse(JSON.parse(JSON.stringify({...a.defaultLayout(),columns})));
  const csv=a.layoutCsv([enriched()],layout);assert.ok(csv.includes('"'+eISSN+'","'+pISSN+'","'+pISSN+'","'+eISSN+'"'));assert.match(csv,/온라인 eISSN/);
});
test('journal search candidates retain Crossref medium metadata through conversion',()=>{
  const c=a.crossrefCandidate({...metadata,title:['Paper'],author:[{given:'First',family:'Researcher'}]});
  const p=a.candidateToPaper(c,author,'Researcher');assert.equal(a.sourceValue(p,'electronicIssn'),eISSN);assert.equal(a.sourceValue(p,'printIssn'),pISSN);
});

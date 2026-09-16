import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJournalService,parseHcisResults,lookupHcis,hcisDetailDoi,journalDate} from './journals.mjs';
const fixture=readFileSync(new URL('./hcis-search-fixture.html',import.meta.url),'utf8');
const detail='<div class="info"><a href="https://doi.org/10.22967/HCIS.2025.15.005">DOI</a></div><a href="https://doi.org/10.22967/HCIS.9999.99.999">reference</a>';
test('publisher author query finds reported paper without knowing its DOI',async()=>{
  const result=parseHcisResults(fixture,'https://hcisj.com/articles/all_issue.php?s_author=Byeong-Seok%20Shin');
  assert.equal(result.works.length,9);assert.equal(result.nextPage,null);
  const p=result.works.find(w=>w.title.includes('BVH-Based'));assert.equal(p.date,'2025-01-30');assert.deepEqual(p.authors.map(a=>a.name),['Eun-Seok Lee','Byeong-Seok Shin']);assert.equal(p.volume,'15');
  const urls=[];const data=await lookupHcis(new URLSearchParams({author:'Byeong‐Seok Shin',from:'2025',to:'2026'}),async url=>{urls.push(url);return new Response(url.includes('all_issue')?fixture:detail,{headers:{'Content-Type':'text/html'}});});
  assert.equal(data.works.length,3);assert.ok(urls[0].includes('s_author=Byeong-Seok+Shin'));assert.equal(urls.length,4);assert.equal(data.works[2].doi,'10.22967/HCIS.2025.15.005');
});
test('only article info DOI and valid publisher dates are accepted',()=>{
  assert.equal(hcisDetailDoi(detail),'10.22967/HCIS.2025.15.005');assert.equal(hcisDetailDoi(detail.replace('class="info"','class="references"')),'');
  assert.equal(journalDate('31 February 2025'),'');assert.equal(journalDate('30 January 2025'),'2025-01-30');assert.throws(()=>parseHcisResults('<html>blocked</html>','https://hcisj.com'),/LAYOUT_CHANGED/);
});
test('query validation prevents arbitrary fetch and caches metadata with CORS',async()=>{
  let calls=0;const service=createJournalService({fetcher:async()=>{calls++;return new Response(fixture,{headers:{'Content-Type':'text/html'}});}});
  const req=q=>new Request('https://service.test/api/journal-search?'+q);
  assert.equal((await service.fetch(req('source=other&author=Shin'))).status,400);
  assert.equal((await service.fetch(req('source=hcis&author=Shin&url=http://localhost'))).status,400);
  assert.equal((await service.fetch(req('source=hcis&author=x'))).status,400);assert.equal(calls,0);
  const url='source=hcis&author=Shin&from=2026&to=2026';const a=await service.fetch(req(url));assert.equal(a.status,200);assert.equal(a.headers.get('Access-Control-Allow-Origin'),'*');assert.deepEqual((await a.json()).works,[]);
  assert.equal((await service.fetch(req(url))).status,200);assert.equal(calls,1);
});
test('detail failures retain discoveries; redirects and rate limits never get bypassed',async()=>{
  let n=0;const data=await lookupHcis(new URLSearchParams({author:'Shin',from:'2025'}),async()=>{n++;return n===1?new Response(fixture,{headers:{'Content-Type':'text/html'}}):new Response(null,{status:429});});
  assert.equal(data.works.length,3);assert.ok(data.works.some(w=>w.warning));
  await assert.rejects(lookupHcis(new URLSearchParams({author:'Shin'}),async()=>new Response(null,{status:302,headers:{Location:'http://localhost'}})),/UPSTREAM_UNAVAILABLE/);
});

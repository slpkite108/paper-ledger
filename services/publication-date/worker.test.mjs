import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDateService, lookupPublisherDate, parsePublisherDate} from './worker.mjs';
const doi = '10.32604/cmc.2026.080992';
const html = `<meta name="citation_publication_date" content="2026/06/15"/><meta name="citation_doi" content="${doi}"/>`;
const publisherUrl='https://www.techscience.com/cmc/v88n2/67650';
const fetcher=async url=>url.startsWith('https://doi.org/')?new Response(null,{status:302,headers:{Location:publisherUrl}}):new Response(html);
const request=()=>new Request('https://api.example/api/publication-date?doi='+doi);

test('publisher date and DOI matching use publication fields only',()=>{
  assert.equal(parsePublisherDate(html,doi,publisherUrl).date,'2026-06-15');
  assert.throws(()=>parsePublisherDate(html,'10.32604/cmc.other',publisherUrl),/DOI_MISMATCH/);
  assert.throws(()=>parsePublisherDate(html.replace('2026/06/15','2026'),doi,publisherUrl),/DATE_NOT_FOUND/);
  assert.throws(()=>parsePublisherDate(html.replace('2026/06/15','2026/02/30'),doi,publisherUrl),/DATE_NOT_FOUND/);
  assert.throws(()=>parsePublisherDate(html.replace('citation_publication_date','citation_accepted_date'),doi,publisherUrl),/DATE_NOT_FOUND/);
});
test('DOI follows allowlisted HTTPS redirects and returns provenance',async()=>{
  const data=await lookupPublisherDate(doi,fetcher);assert.equal(data.date,'2026-06-15');assert.equal(data.url,publisherUrl);assert.equal(data.source,'publisher-metadata');
  for(const target of ['http://www.techscience.com/paper','https://127.0.0.1/','https://techscience.com.attacker.example/','https://www.techscience.com:8443/paper'])await assert.rejects(lookupPublisherDate(doi,async()=>new Response(null,{status:302,headers:{Location:target}})),/UNSUPPORTED_REDIRECT/);
  await assert.rejects(lookupPublisherDate('10.9999/not-supported',fetcher),/UNSUPPORTED_DOI/);
});
test('responses are bounded and redirect loops stop',async()=>{
  await assert.rejects(lookupPublisherDate(doi,async url=>url.includes('doi.org')?fetcher(url):new Response('x'.repeat(1_000_001))),/TOO_LARGE/);
  await assert.rejects(lookupPublisherDate(doi,async()=>new Response(null,{status:302,headers:{Location:'https://doi.org/'+doi}})),/TOO_MANY_REDIRECTS/);
});
test('CORS, cache, request coalescing and expiry',async()=>{
  let calls=0,clock=0;const service=createDateService({fetcher:async url=>{calls++;return fetcher(url)},now:()=>clock});
  const [a,b]=await Promise.all([service.fetch(request()),service.fetch(request())]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(calls,2);
  await service.fetch(request());assert.equal(calls,2);clock=86400001;await service.fetch(request());assert.equal(calls,4);
  assert.equal((await service.fetch(new Request(request().url,{method:'OPTIONS'}))).status,204);
});
test('unsupported requests cannot act as an arbitrary fetch proxy',async()=>{
  let calls=0;const service=createDateService({fetcher:async()=>{calls++;throw Error('unexpected')}});
  assert.equal((await service.fetch(new Request('https://api.example/api/publication-date?doi=https://localhost/'))).status,422);
  assert.equal((await service.fetch(new Request(request().url,{method:'POST'}))).status,405);
  assert.equal(calls,0);
});
test('upstream failures are explicit, not cached as successful dates',async()=>{
  const service=createDateService({fetcher:async()=>new Response(null,{status:429})});
  const response=await service.fetch(request());assert.equal(response.status,429);assert.equal((await response.json()).error,'UPSTREAM_LIMITED');
});

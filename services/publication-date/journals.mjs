const HOST = 'https://hcisj.com';
const responseHeaders = {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','X-Content-Type-Options':'nosniff'};
const json = (body,status=200,extra={}) => new Response(JSON.stringify(body),{status,headers:{...responseHeaders,...extra}});
function text(value='') {
  return value.replace(/<!--[^]*?-->/g,'').replace(/<(script|style|sup)\b[^>]*>[^]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:amp|nbsp|lt|gt|quot|apos);/g,m=>({'&amp;':'&','&nbsp;':' ','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[m])).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n;return v>0&&v<=0x10ffff?String.fromCodePoint(v):'';}).replace(/\s+/g,' ').trim();
}
export function journalDate(value) {
  const m=text(value).match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if(!m)return '';
  const month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[2].toLowerCase())+1;
  if(+m[3]<1000||+m[3]>2100||+m[1]<1||+m[1]>new Date(Date.UTC(+m[3],month,0)).getUTCDate())return '';
  return `${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}
export function parseHcisResults(html,sourceUrl) {
  const list=html.match(/<ul\b[^>]*class=["']issue_list["'][^>]*>([^]*?)<\/ul>/i);
  const pages=html.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  if(!list||!pages)throw new Error('LAYOUT_CHANGED');
  const works=[];
  for(const block of list[1].matchAll(/<li\b[^>]*>([^]*?)<\/li>/gi)) {
    const a=block[1].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/i);if(!a)continue;
    const url=new URL(a[1].replaceAll('&amp;','&'),sourceUrl);
    if(url.protocol!=='https:'||!['hcisj.com','hcis-journal.springeropen.com'].includes(url.hostname)||url.username||url.password)continue;
    const ps=[...block[1].matchAll(/<p\b[^>]*>([^]*?)<\/p>/gi)],authorText=text(ps.at(-1)?.[1]||'');
    const authors=authorText.split(/,\s*(?:and\s+)?|\s+and\s+|\s+&\s+/i).map(name=>name.replace(/[\d*]+$/g,'').trim()).filter(Boolean).map(name=>({name}));
    const venue=text(block[1].match(/<em\b[^>]*>([^]*?)<\/em>/i)?.[1]),volume=venue.match(/\b\d{4}\s+(\d+)\s*:/)?.[1]||'';
    const date=journalDate(block[1].match(/Published on:\s*([^<]+)/i)?.[1]||''),doi=url.pathname.match(/\/articles\/(10\.\d{4,9}\/[^]+)$/)?.[1]||'';
    url.searchParams.delete('page');
    works.push({id:url.href,title:text(a[2]),authors,authorText,venue:'Human-centric Computing and Information Sciences',issn:['2192-1962'],volume,doi,date,url:url.href,provider:'hcis',checkedOn:new Date().toISOString().slice(0,10)});
  }
  if(!works.length&&/<li\b/i.test(list[1])&&!/no (?:data|articles|results)|게시물이 없습니다/i.test(text(list[1])))throw new Error('LAYOUT_CHANGED');
  return {works,nextPage:+pages[1]<+pages[2]?+pages[1]+1:null,page:+pages[1],pages:+pages[2],sourceUrl};
}
export function hcisDetailDoi(html) {
  const info=html.match(/<div\b[^>]*class=["']info["'][^>]*>([^]*?)<\/div>/i)?.[1]||'';
  return info.match(/href=["']https:\/\/doi\.org\/(10\.22967\/HCIS\.[^"'\s]+)["']/i)?.[1]||'';
}
async function fetchHtml(url,fetcher,signal) {
  if(url.origin!==HOST||!['/articles/all_issue.php','/articles/issue_view.php'].includes(url.pathname))throw new Error('INVALID_SOURCE');
  const r=await fetcher(url.href,{redirect:'manual',signal,headers:{Accept:'text/html','User-Agent':'PaperLedger-JournalSearch/1.0 (+https://github.com/slpkite108/paper-ledger)'}});
  if(!r.ok){await r.body?.cancel();throw new Error(r.status===429?'UPSTREAM_LIMITED':'UPSTREAM_UNAVAILABLE');}
  if(!r.headers.get('Content-Type')?.includes('text/html'))throw new Error('LAYOUT_CHANGED');
  const reader=r.body?.getReader();if(!reader)throw new Error('EMPTY_RESPONSE');
  let bytes=0,result='';const decoder=new TextDecoder();
  try{while(true){const v=await reader.read();if(v.done)break;bytes+=v.value.byteLength;if(bytes>1_000_000){await reader.cancel();throw new Error('TOO_LARGE');}result+=decoder.decode(v.value,{stream:true});}}finally{reader.releaseLock();}
  return result+decoder.decode();
}
export async function lookupHcis(params,fetcher=fetch) {
  const author=params.get('author')?.trim().normalize('NFKC').replace(/[‐‑‒–—−]/g,'-')||'';
  const page=+(params.get('page')||'1'),from=params.get('from')||'',to=params.get('to')||'';
  if(author.length<2||author.length>150||/[\x00-\x1f]/.test(author)||!Number.isInteger(page)||page<1||page>200||[from,to].some(y=>y&&!/^(?:1\d{3}|20\d{2}|2100)$/.test(y))||(from&&to&&from>to))throw new Error('INVALID_QUERY');
  const url=new URL('/articles/all_issue.php',HOST);url.searchParams.set('s_author',author);url.searchParams.set('page',String(page));
  const signal=AbortSignal.timeout(25000),data=parseHcisResults(await fetchHtml(url,fetcher,signal),url.href);
  data.works=data.works.filter(w=>!w.date||((!from||w.date.slice(0,4)>=from)&&(!to||w.date.slice(0,4)<=to)));
  let index=0,limited=false;
  const run=async()=>{while(!limited&&index<Math.min(data.works.length,20)){const w=data.works[index++],u=new URL(w.url);if(u.origin!==HOST||u.pathname!=='/articles/issue_view.php'||!/^\d+$/.test(u.searchParams.get('wr_id')||''))continue;
    try{w.doi=hcisDetailDoi(await fetchHtml(u,fetcher,signal));}catch(e){w.warning='DOI 추가 확인 실패';if(e.message==='UPSTREAM_LIMITED')limited=true;}
  }};
  await Promise.all([run(),run()]);return data;
}
export function createJournalService({fetcher=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map(),limits=new Map();
  return {async fetch(request) {
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:responseHeaders});
    if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
    const url=new URL(request.url);
    if([...url.searchParams.keys()].some(k=>!['source','author','page','from','to'].includes(k))||url.searchParams.get('source')!=='hcis')return json({error:'INVALID_QUERY'},400);
    const key=new URLSearchParams([...url.searchParams.entries()].sort()).toString(),hit=cache.get(key);
    if(hit&&hit.until>now())return json(hit.value);
    const ip=request.headers.get('CF-Connecting-IP')||'shared';let limit=limits.get(ip);
    if(!limit||limit.until<=now()){limit={count:0,until:now()+60000};if(limits.size>=2000)limits.delete(limits.keys().next().value);limits.set(ip,limit);}
    if(++limit.count>10)return json({error:'RATE_LIMITED'},429,{'Retry-After':'60'});
    let promise=pending.get(key);if(!promise){promise=lookupHcis(url.searchParams,fetcher);pending.set(key,promise);}
    try{const value=await promise;if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{value,until:now()+6*60*60*1000});return json(value,200,{'Cache-Control':'public, max-age=21600'});}
    catch(e){const code=['INVALID_QUERY','UPSTREAM_LIMITED','LAYOUT_CHANGED'].includes(e.message)?e.message:'UPSTREAM_UNAVAILABLE';return json({error:code},code==='INVALID_QUERY'?400:code==='UPSTREAM_LIMITED'?429:502);}
    finally{if(pending.get(key)===promise)pending.delete(key);}
  }};
}

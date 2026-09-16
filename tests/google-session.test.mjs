import assert from 'node:assert/strict';
import {beforeEach, afterEach, test} from 'node:test';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

await build({configFile:false, logLevel:'silent', build:{outDir:'.build/google-session-test', emptyOutDir:false, target:'esnext', lib:{entry:resolve('tests/google-session-entry.ts'),formats:['es'],fileName:()=>'google.mjs'}}});
const sessionKey = 'paper-ledger-google-session-v1';
const clientId = '307965118038-5rggmp3u7hmg0bjfr68cahrv4sl65pvl.apps.googleusercontent.com';
const store = new Map(), local = new Map(), files = new Map(), modules = [];
let serial = 0, active, requested, calls, rejectStatus, profileGate, fileGate, expiresIn, storageBlocked, denyScope;
const payload = {authors:[{id:'https://openalex.org/A1',display_name:'Test'}],professorNames:{},from:'',to:'',excludeArxiv:false,mergeLatest:true,publicationKind:'conference'};
const preset = {version:1,id:'preset-A',name:'Test preset',columns:[{id:'title',label:'제목',source:'title',constant:'',width:40,align:'left',format:'text'}],style:{headerColor:'#234264',fontSize:11,striped:true,wrap:true},sort:[{key:'published',direction:'desc'}]};
async function newPage() {
  const app = await import(pathToFileURL(resolve('.build/google-session-test/google.mjs')).href+'?page='+serial++);
  modules.push(app); return app;
}
function deferred() { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; }
beforeEach(() => {
  store.clear(); local.clear(); files.clear(); active='A'; requested=0; calls=[]; rejectStatus=0; profileGate=null; fileGate=null; expiresIn=3600; storageBlocked=false; denyScope=false;
  globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
  globalThis.window={location:{protocol:'https:'},__PAPER_LEDGER_LOCAL__:true,
    sessionStorage:{getItem:k=>{if(storageBlocked)throw Error('blocked');return store.get(k)??null;},setItem:(k,v)=>{if(storageBlocked)throw Error('blocked');store.set(k,v);},removeItem:k=>{if(storageBlocked)throw Error('blocked');store.delete(k);}},
    google:{accounts:{oauth2:{hasGrantedAllScopes:()=>!denyScope,initTokenClient:options=>{
      assert.equal(options.client_id,clientId);
      return {requestAccessToken:()=>{requested++;void options.callback({access_token:'TOKEN-'+active,expires_in:expiresIn,scope:'drive'});}};
    }}}}
  };
  globalThis.fetch=async(url,options={})=>{
    assert(url.startsWith('https://www.googleapis.com/')); assert(!url.includes('TOKEN-'));
    const owner=options.headers.Authorization.slice(-1); calls.push({url,owner,method:options.method||'GET'});
    const u=new URL(url); if(rejectStatus)return new Response('{}',{status:rejectStatus});
    if(u.pathname==='/oauth2/v3/userinfo') { if(profileGate)await profileGate.promise; return Response.json({sub:owner,email:owner+'@example.test',name:'User '+owner}); }
    if(u.pathname==='/drive/v3/files') {
      const kind=['favorite','key','preset'].find(k=>u.searchParams.get('q').includes("value='"+k+"'"));
      assert.equal(u.searchParams.get('spaces'),'appDataFolder');
      return Response.json({files:[...files].filter(([,f])=>f.owner===owner&&f.kind===kind).map(([id,f])=>({id,appProperties:f.metadata.appProperties}))});
    }
    if(u.pathname==='/upload/drive/v3/files'&&options.method==='POST') {
      const boundary=options.headers['Content-Type'].split('boundary=')[1];
      const [metadata,data]=options.body.split('--'+boundary).slice(1,3).map(p=>JSON.parse(p.split('\r\n\r\n')[1].trim()));
      assert.deepEqual(metadata.parents,['appDataFolder']); const id=String(++serial);
      files.set(id,{owner,kind:metadata.appProperties.kind,metadata,data});return Response.json({id});
    }
    const id=u.pathname.split('/').pop(), file=files.get(id);
    if(!file||file.owner!==owner)return new Response('{}',{status:404});
    if(options.method==='DELETE'){files.delete(id);return new Response(null,{status:204});}
    if(options.method==='PATCH'){file.data=JSON.parse(options.body);return Response.json({id});}
    const snapshot=structuredClone(file.data);
    if(fileGate) { fileGate.started.resolve(); await fileGate.finish.promise; }
    return Response.json(snapshot);
  };
});
afterEach(()=>{for(const app of modules.splice(0))app.disconnectGoogle();});

test('reload validates the same Google account, restores key/favorites/presets without OAuth popup',async()=>{
  const first=await newPage();await first.connectGoogle();
  await first.saveGoogleKey('openalex-test-key');await first.createGoogleFavorite('Saved authors',payload);await first.saveGoogleLayout(preset);
  assert(!JSON.stringify([...store.values()]).includes('openalex-test-key'));assert.equal(local.size,0);
  const expires=JSON.parse(store.get(sessionKey)).expiresAt;
  const reloaded=await newPage();assert.equal(reloaded.googleUser(),null);
  const restored=await reloaded.restoreGoogleSession();assert.equal(restored.sub,'A');assert.equal(requested,1);
  assert.equal(reloaded.googleConnection(),'connected');assert.equal(JSON.parse(store.get(sessionKey)).expiresAt,expires);
  assert.equal(await reloaded.readGoogleKey(),'openalex-test-key');assert.equal((await reloaded.readFavorites())[0].name,'Saved authors');assert.equal((await reloaded.readGoogleLayouts())[0].name,'Test preset');
  await reloaded.saveGoogleLayout({...preset,name:'Updated preset'});assert.equal((await reloaded.readGoogleLayouts()).length,1);
  await reloaded.deleteGoogleLayout(preset.id);assert.equal((await reloaded.readGoogleLayouts()).length,0);
  const favorite=(await reloaded.readGoogleFavorites())[0];await reloaded.deleteGoogleFavorite(favorite.id);assert.equal((await reloaded.readGoogleFavorites()).length,0);
  await reloaded.deleteGoogleKey();assert.equal(await reloaded.readGoogleKey(),'');
});
test('simultaneous restoration is one Google validation; favorites wait rather than use local storage',async()=>{
  const first=await newPage();await first.connectGoogle();await first.createGoogleFavorite('Cloud authors',payload);
  const app=await newPage();profileGate=deferred();const start=calls.length;
  const a=app.restoreGoogleSession(),b=app.restoreGoogleSession(),fav=app.readFavorites();assert.equal(a,b);assert.equal(app.googleConnection(),'restoring');
  profileGate.resolve();await a;assert.equal((await fav)[0].name,'Cloud authors');assert.equal(calls.slice(start).filter(c=>c.url.endsWith('/userinfo')).length,1);
});
test('expired session is cleared before requests and cannot silently use local favorites',async()=>{
  const first=await newPage();await first.connectGoogle();const saved=JSON.parse(store.get(sessionKey));saved.expiresAt=Date.now()-1;store.set(sessionKey,JSON.stringify(saved));
  const app=await newPage(),before=calls.length;assert.equal(await app.restoreGoogleSession(),null);assert.equal(calls.length,before);assert(!store.has(sessionKey));assert.equal(app.googleConnection(),'expired');
  await assert.rejects(app.readFavorites,/다시 연결/);
});
test('logout removes saved connection and does not restore on the next page',async()=>{
  const app=await newPage();await app.connectGoogle();app.disconnectGoogle();assert(!store.has(sessionKey));
  const reloaded=await newPage();assert.equal(await reloaded.restoreGoogleSession(),null);assert.equal(reloaded.googleConnection(),'disconnected');
});
test('revoked token is cleared after Google returns 401',async()=>{
  const first=await newPage();await first.connectGoogle();rejectStatus=401;
  const app=await newPage();await assert.rejects(app.restoreGoogleSession,/만료/);assert.equal(app.googleUser(),null);assert(!store.has(sessionKey));
});
test('wrong client, malformed session and wrong subject never restore an account',async()=>{
  const first=await newPage();await first.connectGoogle();const valid=JSON.parse(store.get(sessionKey));
  for(const value of [{...valid,clientId:'other-client'}, {...valid,expiresAt:Date.now()+7200000}, '{bad json']){
    store.set(sessionKey,typeof value==='string'?value:JSON.stringify(value));const app=await newPage(),before=calls.length;
    assert.equal(await app.restoreGoogleSession(),null);assert.equal(calls.length,before);assert(!store.has(sessionKey));
  }
  store.set(sessionKey,JSON.stringify({...valid,subject:'B'}));const app=await newPage();await assert.rejects(app.restoreGoogleSession,/일치/);assert.equal(app.googleUser(),null);assert(!store.has(sessionKey));
});
test('a delayed restoration cannot reconnect after explicit logout',async()=>{
  const first=await newPage();await first.connectGoogle();const app=await newPage();profileGate=deferred();
  const pending=app.restoreGoogleSession();app.disconnectGoogle();profileGate.resolve();await assert.rejects(pending,/변경/);assert.equal(app.googleUser(),null);assert.equal(app.googleConnection(),'disconnected');assert(!store.has(sessionKey));
});
test('account switch rejects a delayed key response from the previous account',async()=>{
  const app=await newPage();await app.connectGoogle();await app.saveGoogleKey('openalex-test-key');
  fileGate={started:deferred(),finish:deferred()};const pending=app.readGoogleKey();await fileGate.started.promise;
  active='B';await app.connectGoogle();fileGate.finish.resolve();await assert.rejects(pending,/변경/);assert.equal(app.googleUser().sub,'B');assert.equal(app.googleUser().hasSavedKey,false);
  fileGate=null;assert.equal(await app.readGoogleKey(),'');assert.equal((await app.readGoogleFavorites()).length,0);assert.equal((await app.readGoogleLayouts()).length,0);
});
test('blocked session storage leaves manual sign-in usable without permanent token storage',async()=>{
  storageBlocked=true;const app=await newPage();await app.connectGoogle();assert.equal(app.googleUser().sub,'A');assert.equal(store.size,0);assert.equal(local.size,0);
  const reloaded=await newPage();assert.equal(await reloaded.restoreGoogleSession(),null);
});
test('missing consent is not saved, and automatic expiration updates the connection indicator',async()=>{
  const app=await newPage();denyScope=true;await assert.rejects(app.connectGoogle,/권한/);assert.equal(store.size,0);
  denyScope=false;expiresIn=61;await app.connectGoogle();let expired=false;const unsubscribe=app.subscribeGoogle(()=>{expired=app.googleConnection()==='expired';});
  await new Promise(r=>setTimeout(r,1100));unsubscribe();assert(expired);assert.equal(app.googleUser(),null);assert(!store.has(sessionKey));
});
test('file mode never restores OAuth credentials',async()=>{
  const first=await newPage();await first.connectGoogle();window.location.protocol='file:';const app=await newPage();const before=calls.length;
  assert.equal(await app.restoreGoogleSession(),null);assert.equal(calls.length,before);await assert.rejects(app.connectGoogle,/HTTPS/);
});

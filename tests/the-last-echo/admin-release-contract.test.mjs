import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,mkdtemp,rm} from 'node:fs/promises';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
const lib=resolve('src/app/the-last-echo/admin/_lib');
const {decodeAdminSession,gameHeaders,establishAdminSession,adminRpc,GAME_EPOCH,beginAdminLogin,isAdminLoginCurrent}=await import(pathToFileURL(resolve(lib,'release-contract.ts')));
const account='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',nonce='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',newnonce='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let checks=0;
function check(a,b,label){assert.deepEqual(a,b,label);checks++;}
async function denied(fn,pattern){await assert.rejects(fn,pattern);checks++;}
let context=null,current=account,mode='ok',calls=[],generation=0;
const store={read:()=>context,write:value=>context=value,clear:()=>{generation++;context=null;},generation:()=>generation};
const client={auth:{getUser:async()=>({data:{user:current?{id:current}:null},error:null}),getSession:async()=>({data:{session:current?{user:{id:current}}:null},error:null})},rpc:async(name,args)=>{
 calls.push({name,args});
 if(name==='get_app_status')return{data:{is_admin:mode!=='nonadmin',progress_epoch:mode==='epoch'?1:2,maintenance:mode==='maintenance'},error:null};
 if(name==='claim_session'){if(mode==='switch_claim')current=other;return{data:mode==='bad_nonce'?null:nonce,error:mode==='claim_denied'?{message:'session_superseded'}:null};}
 if(mode==='switch_reply')current=other;
 if(mode==='nonce_reply')context={account,nonce:newnonce,epoch:2};
 if(mode==='clear_reply')store.clear();
 return{data:{sent:1},error:mode==='stale'?{message:'session_superseded'}:mode==='failed'?{message:'private SQL detail'}:null};
}};
check(GAME_EPOCH,2,'fixed official epoch');
check(decodeAdminSession('broken'),null,'corrupt browser context refused');
for(const raw of [null,JSON.stringify({account,nonce,epoch:1}),JSON.stringify({account:'bad',nonce,epoch:2}),JSON.stringify({account,nonce:1,epoch:2})])check(decodeAdminSession(raw),null,'malformed context refused');
check(gameHeaders(),{'X-Game-Epoch':'2'},'bootstrap has official epoch and no invented nonce');
check(gameHeaders({account,nonce,epoch:2}),{'X-Game-Epoch':'2','X-Game-Session':nonce},'current nonce headers exact');
await establishAdminSession(client,store);check(context,{account,nonce,epoch:2},'explicit admin sign-in stores confirmed context');
check(calls.map(c=>c.name),['get_app_status','claim_session'],'only explicit login claims device ownership');
for(const blocked of ['nonadmin','epoch','maintenance','bad_nonce','claim_denied','switch_claim']){mode=blocked;current=account;calls=[];await denied(()=>establishAdminSession(client,store),/admin|release|maintenance|confirmed|session|changed/i);check(context,null,'failed login stores no context: '+blocked);if(['nonadmin','epoch','maintenance'].includes(blocked))check(calls.length,1,'precheck stops session takeover: '+blocked);}
mode='ok';current=account;context={account,nonce,epoch:2};calls=[];
check(await adminRpc(client,store,'admin_broadcast_mail',{p_reward_json:{gems:4}}),{sent:1},'bounded current context forwards one admin mutation');
check(calls,[{name:'admin_broadcast_mail',args:{p_reward_json:{gems:4}}}],'wrapper preserves exact RPC/body');
await denied(()=>adminRpc(client,store,'claim_session'),/Unsupported/);check(calls.length,1,'RPC helper cannot silently reclaim session');
for(const stale of ['stale','switch_reply','nonce_reply','clear_reply']){mode=stale;current=account;context={account,nonce,epoch:2};calls=[];await denied(()=>adminRpc(client,store,'admin_broadcast_mail'),/session|account|changed/i);check(calls.map(c=>c.name),['admin_broadcast_mail'],'ambiguous or stale mutation never retries/reclaims: '+stale);}
mode='ok';current=other;context={account,nonce,epoch:2};calls=[];await denied(()=>adminRpc(client,store,'admin_delete_mail'),/Sign in/);check(calls.length,0,'wrong account rejected before network');
current=account;context=null;await denied(()=>adminRpc(client,store,'admin_delete_mail'),/Sign in/);
context={account,nonce,epoch:2};mode='failed';await denied(()=>adminRpc(client,store,'admin_broadcast_mail'),/Check the result/);
// Same-account reversed nonce replies, logout and explicit login generations.
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(predicate){for(let n=0;n<40&&!predicate();n++)await tick();assert(predicate(),'deferred test reached intended boundary');}
const settled=promise=>promise.then(()=>({ok:true}),error=>({error}));
function heldClient(phase,chosenNonce=nonce){
 const gate=deferred();let waiting=false,claims=0,gets=0;
 const hold=async(where,data)=>{if(where===phase){waiting=true;await gate.promise;}return data;};
 return{gate,isWaiting:()=>waiting,claims:()=>claims,gets:()=>gets,client:{
  auth:{getUser:async()=>{gets++;return hold('user',{data:{user:{id:account}},error:null});},getSession:async()=>hold('session',{data:{session:{user:{id:account}}},error:null})},
  rpc:async(name)=>{if(name==='get_app_status')return hold('status',{data:{is_admin:true,progress_epoch:2,maintenance:false},error:null});claims++;return hold('claim',{data:chosenNonce,error:null});}
 }};
}
const older=heldClient('claim',nonce),newer=heldClient('claim',newnonce);
const oldResult=settled(establishAdminSession(older.client,store));await waitFor(older.isWaiting);
const newResult=settled(establishAdminSession(newer.client,store));await waitFor(newer.isWaiting);
newer.gate.resolve();check(await newResult,{ok:true},'new same-account login confirms its nonce first');
older.gate.resolve();check((await oldResult).error instanceof Error,true,'older reversed response is superseded');check(context,{account,nonce:newnonce,epoch:2},'older nonce cannot overwrite a newer same-account login');
for(const phase of ['user','status','claim','session']){
 const held=heldClient(phase);const result=settled(establishAdminSession(held.client,store));await waitFor(held.isWaiting);store.clear();held.gate.resolve();
 check((await result).error instanceof Error,true,'logout fences pending login after '+phase);check(context,null,'logout stays cleared after '+phase);
 if(['user','status'].includes(phase))check(held.claims(),0,'superseded early login never claims server ownership: '+phase);
}
const beforePassword=beginAdminLogin(store);const fresh=heldClient('never',newnonce);await establishAdminSession(fresh.client,store);
const obsolete=heldClient('never');await denied(()=>establishAdminSession(obsolete.client,store,beforePassword),/changed/);check(obsolete.gets(),0,'old password response cannot begin a new establishment after newer login');
check(isAdminLoginCurrent(store,beforePassword),false,'explicit newer login invalidates pre-password attempt');
const failingOld=heldClient('claim');const failing=settled(establishAdminSession(failingOld.client,store));await waitFor(failingOld.isWaiting);store.clear();
await establishAdminSession(fresh.client,store);failingOld.gate.reject(Error('old transport failure'));check((await failing).error.message,'old transport failure','old failed response remains an error');check(context,{account,nonce:newnonce,epoch:2},'logout/new-login followed by old failure cannot clear newer context');
// A clear + same context rewrite also invalidates a pending ordinary RPC.
const readGate=deferred();let gatedCalls=0;context={account,nonce,epoch:2};
const guarded={auth:{getSession:async()=>{await readGate.promise;return{data:{session:{user:{id:account}}},error:null};}},rpc:async()=>{gatedCalls++;return{data:null,error:null};}};
const pendingRpc=settled(adminRpc(guarded,store,'admin_delete_mail'));await tick();store.clear();context={account,nonce,epoch:2};readGate.resolve();
check((await pendingRpc).error instanceof Error,true,'explicit clear invalidates same-account/same-nonce pending read');check(gatedCalls,0,'stale RPC context stops before mutation');
// Exercise the actual Supabase SSR client options against a synthetic fetch. No managed backend traffic.
const transformed=ts.transpileModule(await readFile(resolve(lib,'client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"./release-contract"',JSON.stringify(pathToFileURL(resolve(lib,'release-contract.ts')).href));
const temp=resolve('tests/the-last-echo/.admin-client.test-runtime.mjs');await writeFile(temp,transformed);
const oldFetch=globalThis.fetch;const oldWindow=globalThis.window;
const memory=new Map();globalThis.window={sessionStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://backend.invalid';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='synthetic-public-key';
let wire=[];globalThis.fetch=async(input,init)=>{wire.push({url:String(input),headers:Object.fromEntries(new Headers(init.headers))});return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});};
try{
 const{createClient,adminSessionStore}=await import(pathToFileURL(temp));adminSessionStore.write({account,nonce,epoch:2});
 const first=createClient();adminSessionStore.write({account,nonce:newnonce,epoch:2});const second=createClient();
 await first.rpc('admin_get_stats');await second.rpc('admin_get_stats');
 check(wire.map(w=>w.headers['x-game-epoch']),['2','2'],'real browser SDK forwards fixed game epoch');
 check(wire.map(w=>w.headers['x-game-session']),[nonce,newnonce],'each game-only client captures its tab nonce; singleton cannot overwrite it');
 check(wire.every(w=>!w.url.includes('claim_session')),true,'ordinary browser client does not claim session');
 const storage=globalThis.window.sessionStorage;globalThis.window.sessionStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 check(adminSessionStore.read(),null,'unavailable tab storage fails closed');adminSessionStore.clear();assert.throws(()=>adminSessionStore.write({account,nonce,epoch:2}),/Allow session storage/);checks++;
 globalThis.window.sessionStorage=storage;
 const{createBrowserClient}=await import('@supabase/ssr');const unrelated=createBrowserClient('https://backend.invalid','synthetic-public-key',{isSingleton:false});await unrelated.rpc('other_product_read');
 check(wire.at(-1).headers['x-game-epoch'],undefined,'unrelated product has no game epoch contamination');
}catch(error){throw error;}finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow;await unlink(temp);}
// Execute the production form event handler with controlled hook/SDK fixtures.
// This tests async decisions without claiming a mounted React/browser Auth flow.
const uiDirectory=await mkdtemp(resolve('tests/the-last-echo/.admin-ui-runtime-'));
try{
 const runtime=pathToFileURL(join(uiDirectory,'hooks.mjs')).href,clientFixture=pathToFileURL(join(uiDirectory,'client.mjs')).href,routerFixture=pathToFileURL(join(uiDirectory,'router.mjs')).href,componentsFixture=pathToFileURL(join(uiDirectory,'components.mjs')).href;
 await writeFile(join(uiDirectory,'hooks.mjs'),`export const useState=initial=>[initial,value=>globalThis.__adminUiTest.states.push(value)];export const useRef=initial=>({current:initial});`);
 await writeFile(join(uiDirectory,'client.mjs'),`export const createClient=()=>globalThis.__adminUiTest.client;export const adminSessionStore=globalThis.__adminUiTest.store;`);
 await writeFile(join(uiDirectory,'router.mjs'),`export const useRouter=()=>globalThis.__adminUiTest.router;export const usePathname=()=>'/the-last-echo/admin';`);
 await writeFile(join(uiDirectory,'components.mjs'),`export const Btn=()=>null;export const Input=()=>null;export const ErrorNote=()=>null;export const Badge=()=>null;export default()=>null;`);
 let passwordCalls=0,signouts=0,routes=[],states=[];
 const passwordGate=deferred();
 globalThis.__adminUiTest={store,states,router:{replace:url=>routes.push(url),refresh:()=>routes.push('refresh')},client:{...fresh.client,auth:{...fresh.client.auth,signInWithPassword:async()=>{passwordCalls++;await passwordGate.promise;return{error:null};},signOut:async()=>{signouts++;}}}};
 const pageSource=ts.transpileModule(await readFile(resolve('src/app/the-last-echo/admin/login/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  .replace('"react"',JSON.stringify(runtime)).replace('"next/navigation"',JSON.stringify(routerFixture)).replace('"../_lib/client"',JSON.stringify(clientFixture)).replace('"../_lib/release-contract"',JSON.stringify(pathToFileURL(resolve(lib,'release-contract.ts')).href)).replace('"../_components/ui"',JSON.stringify(componentsFixture));
 await writeFile(join(uiDirectory,'login.mjs'),pageSource);const{default:Login}=await import(pathToFileURL(join(uiDirectory,'login.mjs')));
 const submit=Login().props.children.props.onSubmit;
 const oldSubmit=submit({preventDefault(){}});await submit({preventDefault(){}});check(passwordCalls,1,'actual form synchronously refuses repeated submit before React busy render');
 await establishAdminSession(fresh.client,store);const newerContext={...context};const newerGeneration=store.generation();const initialStateCalls=states.length;
 passwordGate.resolve();await oldSubmit;
 check(context,newerContext,'old password response leaves newer current context intact');check(store.generation(),newerGeneration,'stale form cannot clear newer context');check(routes,[],'stale form cannot navigate over newer login');check(states.length,initialStateCalls,'stale catch/finally never replaces current UI state');check(signouts,0,'failed/stale login never signs out a newer Auth session');
 // An older failing password request is also fenced before error/clear/logout.
 const failingPassword=deferred();globalThis.__adminUiTest.client={...fresh.client,auth:{...fresh.client.auth,signInWithPassword:async()=>{await failingPassword.promise;throw Error('obsolete password failure');},signOut:async()=>{signouts++;}}};
 const failingSubmit=Login().props.children.props.onSubmit({preventDefault(){}});await establishAdminSession(fresh.client,store);const afterNewLogin={...context};failingPassword.reject(Error('obsolete password failure'));await failingSubmit;
 check(context,afterNewLogin,'old password error cannot erase a newer successful login');check(signouts,0,'old password error does not issue auth signOut');
 // Execute the actual logout handler: a late response cannot navigate over a new login.
 const logoutGate=deferred();routes=[];globalThis.__adminUiTest.router={replace:url=>routes.push(url),refresh:()=>routes.push('refresh')};
 globalThis.__adminUiTest.client={...fresh.client,auth:{...fresh.client.auth,signOut:async()=>{await logoutGate.promise;}}};
 const sidebarSource=ts.transpileModule(await readFile(resolve('src/app/the-last-echo/admin/_components/Sidebar.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  .replace('"next/link"',JSON.stringify(componentsFixture)).replace('"next/navigation"',JSON.stringify(routerFixture)).replace('"../_lib/client"',JSON.stringify(clientFixture)).replace('"./ui"',JSON.stringify(componentsFixture));
 await writeFile(join(uiDirectory,'sidebar.mjs'),sidebarSource);const{default:Sidebar}=await import(pathToFileURL(join(uiDirectory,'sidebar.mjs')));
 const findAction=node=>{if(!node||typeof node!=='object')return null;if(node.props?.onClick)return node.props.onClick;for(const child of [node.props?.children].flat()){const found=findAction(child);if(found)return found;}return null;};
 const logout=findAction(Sidebar({email:'synthetic@example.invalid',maintenance:false}));assert(logout,'production logout action exists');
 const oldLogout=logout();await establishAdminSession(fresh.client,store);const signedBackIn={...context};logoutGate.resolve();await oldLogout;
 check(context,signedBackIn,'late explicit logout cannot clear newer tab context');check(routes,[],'late explicit logout cannot redirect newer successful login');
 // Render the real unavailable leaderboard with the real Card component.
 const uiSource=ts.transpileModule(await readFile(resolve('src/app/the-last-echo/admin/_components/ui.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 await writeFile(join(uiDirectory,'ui.mjs'),uiSource);
 const leaderboard=ts.transpileModule(await readFile(resolve('src/app/the-last-echo/admin/(dashboard)/leaderboard/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"../../_components/ui"',JSON.stringify(pathToFileURL(join(uiDirectory,'ui.mjs')).href));
 await writeFile(join(uiDirectory,'leaderboard.mjs'),leaderboard);const{default:Leaderboard}=await import(pathToFileURL(join(uiDirectory,'leaderboard.mjs')));const{renderToStaticMarkup}=await import('react-dom/server');const html=renderToStaticMarkup(Leaderboard());
 check(html.includes('temporarily unavailable'),true,'rendered leaderboard explains held rankings');check(/<button|Rebuild now|animate-spin|<table/.test(html),false,'held leaderboard exposes no rebuild, stale rows or indefinite spinner');check(/SQL|permission|migration|RPC/.test(html),false,'held leaderboard copy does not expose implementation details');
}finally{delete globalThis.__adminUiTest;await rm(uiDirectory,{recursive:true,force:true});}
console.log(`Web admin contract: PASS (${checks} checks, synthetic adapters + actual SSR wire headers)`);

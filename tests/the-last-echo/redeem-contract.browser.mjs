// Four actual DOM flows in a disposable browser. All backend/provider traffic is intercepted.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=resolve('public'),locales=['en','es','ko','ja'];
const paths=locales.map(lc=>`/the-last-echo/${lc==='en'?'':lc+'/'}redeem/`);
const server=http.createServer(async(req,res)=>{const page=paths.find(p=>req.url===p);if(!page){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/html');res.end(await readFile(resolve(root,'.'+page,'index.html')));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let browser,checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
try{
 browser=await chromium.launch({headless:true});
 for(const [index,locale]of locales.entries()){
  const context=await browser.newContext();const page=await context.newPage();let mode='success',requests=[],pending=null,errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{
   const request=route.request();
   if(request.url().startsWith(origin))return route.continue();
   if(new URL(request.url()).pathname==='/rest/v1/rpc/redeem_code_by_number'){
    requests.push({url:request.url(),headers:request.headers(),body:request.postDataJSON()});
    if(mode==='network')return route.abort('failed');
    if(mode==='pending'){pending=route;return;}
    const payload=mode==='success'?{ok:true,reward:{gems:7,weekly_tickets:3,daily_tickets:4,color_id:'<img src=x onerror="window.__injected=1">'}}:mode==='duplicate'?{error:'already_redeemed'}:{message:mode==='maintenance'?'maintenance: private-db-detail':'update_required: private-db-detail'};
    return route.fulfill({status:['maintenance','epoch'].includes(mode)?403:200,contentType:'application/json',body:JSON.stringify(payload)});
   }
   return route.abort('blockedbyclient');
  });
  await page.goto(origin+paths[index],{waitUntil:'domcontentloaded'});
  await page.locator('#pid').fill('#1234567');await page.locator('#code').fill('welcome');await page.locator('#redeem-btn').click();
  await page.waitForFunction(()=>!document.getElementById('redeem-btn').disabled&&document.getElementById('reward-box').classList.contains('show'));
  check(requests.length,1,locale+' sends exactly one anonymous redeem');
  check(requests[0].body,{p_number:1234567,p_code:'WELCOME'},locale+' exact public-number/code body; no caller reward fields');
  check(requests[0].headers['x-game-epoch'],'2',locale+' official epoch header');
  check(requests[0].headers['x-game-session'],undefined,locale+' public code page does not invent a login nonce');
  check(requests[0].headers.authorization,'Bearer '+requests[0].headers.apikey,locale+' only original public anon key forwarded');
  check(await page.locator('#code').inputValue(),'',locale+' success clears redeemed code');
  check(await page.evaluate(()=>window.__injected),undefined,locale+' reward string cannot execute markup');
  check(await page.locator('#reward-list img').count(),3,locale+' weekly ticket legacy alias renders merged Harpenny + two other local icons');
  check(await page.locator('#reward-list').innerText().then(s=>s.includes('<img')),true,locale+' server color value rendered as text');
  check(await page.locator('#reward-list b').allTextContents(),['7','7','<img src=x onerror="window.__injected=1">'],locale+' authored rewards/alias value shown');
  for(const rejected of ['duplicate','maintenance','epoch','network']){
   mode=rejected;await page.locator('#code').fill('welcome');await page.locator('#redeem-btn').click();
   await page.waitForFunction(()=>!document.getElementById('redeem-btn').disabled&&document.getElementById('redeem-msg').textContent.length>0);
   check(await page.locator('#redeem-btn').isDisabled(),false,locale+' retry button recovers after '+rejected);
   check(await page.locator('#reward-box').evaluate(node=>node.classList.contains('show')),false,locale+' rejected request never shows a successful reward: '+rejected);
   check((await page.locator('#redeem-msg').innerText()).includes('private-db-detail'),false,locale+' no internal SQL details in error');
   if(locale!=='en')check(/The game is in maintenance|This page needs the matching|Something went wrong redeeming/.test(await page.locator('#redeem-msg').innerText()),false,locale+' localized policy/network error');
  }
  mode='pending';await page.locator('#code').fill('welcome');await page.locator('#redeem-btn').click();await page.waitForFunction(()=>document.getElementById('redeem-btn').disabled);const before=requests.length;
  await page.locator('#code').press('Enter');await page.waitForTimeout(50);check(requests.length,before,locale+' Enter while waiting cannot start another mutation');
  await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:'already_redeemed'})});await page.waitForFunction(()=>!document.getElementById('redeem-btn').disabled);
  check(errors,[],locale+' no runtime page exceptions');await context.close();
 }
 console.log(`Redeem browser: PASS (${checks} checks, en/es/ko/ja actual DOM; all backend/provider requests intercepted)`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

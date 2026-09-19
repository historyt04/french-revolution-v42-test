// DOM integration checks with a disposable PostgreSQL database, not the live Supabase project.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {makeDB,api} from './trial-db.mjs';
const require=createRequire(import.meta.url);
const {JSDOM}=require(require.resolve('jsdom',{paths:[process.env.HISTORY_TEST_DEPS||process.cwd()]}));
const root=new URL('../',import.meta.url);
const until=async fn=>{for(let i=0;i<1000;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI condition timeout');};

test('real app DOM → login → retry quiz → lost completion response → reload → pack → restore',async t=>{
  const db=await makeDB();t.after(()=>db.close());
  const requests=[];let dropComplete=true,dropOpen=true;
  const fetchAPI=async(url,options)=>{
    const body=JSON.parse(options.body);requests.push(body.action);
    try{
      const result=await api(db,body.action,body.payload,body.token);
      if(body.action==='game.complete'&&dropComplete){dropComplete=false;throw Error('simulated response loss');}
      if(body.action==='pack.open'&&dropOpen){dropOpen=false;throw Error('simulated response loss');}
      return {ok:result.ok,status:result.ok?200:400,json:async()=>result};
    }catch(e){if(e.message==='simulated response loss')throw e;return {ok:false,status:400,json:async()=>({ok:false,code:e.message,message:e.message})};}
  };
  async function mount(storage={}){
    const dom=new JSDOM(await fs.readFile(new URL('supabase-student.html',root),'utf8'),{url:'https://historyt04.github.io/french-revolution-v42-test/supabase-student.html',runScripts:'outside-only'});
    t.after(()=>dom.window.close());const w=dom.window;
    w.fetch=fetchAPI;w.confirm=()=>true;
    for(const [key,value]of Object.entries(storage))w.sessionStorage.setItem(key,value);
    const context=dom.getInternalVMContext(),cache=new Map();
    async function module(url){
      const key=url.href;if(cache.has(key))return cache.get(key);
      const m=new vm.SourceTextModule(await fs.readFile(url,'utf8'),{context,identifier:key});cache.set(key,m);
      await m.link(spec=>module(new URL(spec,url)));return m;
    }
    const entry=await module(new URL('supabase-trial/app.mjs',root));await entry.evaluate();
    const click=action=>{const el=w.document.querySelector(`[data-action="${action}"]`);assert.ok(el,action);assert.equal(el.disabled,false,action+' enabled');el.click();};
    const text=()=>w.document.querySelector('#app').textContent;
    return {w,click,text};
  }
  let ui=await mount();
  assert.match(ui.text(),/프랑스혁명 초급/);
  const login=ui.w.document.querySelector('#login');login.elements.code.value='12345';login.elements.rememberDevice.checked=true;
  login.dispatchEvent(new ui.w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>/핵심어로 만나는/.test(ui.text()));
  assert.ok(ui.w.localStorage.getItem('history-supabase-student-trial-1'));
  assert.equal(ui.w.localStorage.getItem('history-supabase-student-trial-1').includes('12345'),false);
  ui.click('start');await until(()=>!!ui.w.document.querySelector('#answer'));
  const questions=(await db.query('select questions from trial_runs order by started_at desc limit 1')).rows[0].questions;
  await db.exec("update trial_runs set started_at=now()-interval '30 seconds'");
  const answer=value=>{
    const form=ui.w.document.querySelector('#answer');form.elements.answer.value=value;
    form.dispatchEvent(new ui.w.Event('submit',{bubbles:true,cancelable:true}));
  };
  const count=requests.length;
  answer('틀린 답');answer('틀린 답');assert.match(ui.text(),/아직 정답은 공개하지/);
  ui.click('next');assert.equal(ui.w.document.querySelector('.feedback').textContent,'띄어쓰기는 달라도 됩니다.');
  for(const q of questions.slice(1)){answer(q.answers[0]);ui.click('next');}
  assert.equal(requests.length,count,'answering and navigation use no network');
  assert.match(ui.text(),/힌트:/);answer(questions[0].answers[0]);ui.click('next');
  await until(()=>!!ui.w.document.querySelector('[data-action="retry"]'));
  assert.match(ui.text(),/12문제를 모두 풀었습니다/);
  const storage=Object.fromEntries(Array.from({length:ui.w.sessionStorage.length},(_,i)=>{const k=ui.w.sessionStorage.key(i);return[k,ui.w.sessionStorage.getItem(k)];}));
  ui=await mount(storage);ui.click('retry');await until(()=>/초급 학습 완료!/.test(ui.text()));
  assert.equal((await db.query('select packs from trial_wallets')).rows[0].packs,1);
  ui.click('vault');ui.click('open');await until(()=>!!ui.w.document.querySelector('[data-action="retry"]'));
  ui.click('retry');await until(()=>/카드를 공개해 보세요/.test(ui.text()));
  ui.click('reveal');assert.match(ui.text(),/카드를 획득했습니다/);
  assert.equal((await db.query('select count(*)::int n from trial_openings')).rows[0].n,1);
  ui.click('vault');assert.ok(ui.w.document.querySelector('.card img'));
  assert.equal(ui.w.document.querySelectorAll('.collection-slot').length,12);
  const beforeCollection=requests.length;
  ui.w.document.querySelector('.history-card').click();
  assert.ok(ui.w.document.querySelector('.history-card.is-back'));
  assert.equal(requests.length,beforeCollection,'card flipping is local');
  const repButton=ui.w.document.querySelector('[data-action="representative"]:not(:disabled)');
  const chosen={event:repButton.dataset.event,tier:repButton.dataset.tier,effect:repButton.dataset.effect};
  repButton.click();await until(()=>requests.includes('collection.preference')&&!ui.w.document.querySelector('[data-action="home"]').disabled);
  const pref=(await db.query('select event_id,rarity,effect from trial_card_preferences')).rows[0];
  assert.deepEqual(pref,{event_id:chosen.event,rarity:chosen.tier,effect:chosen.effect});
  ui.click('home');
  assert.ok(ui.w.document.querySelector('.revolution-hero'));
  assert.equal(ui.w.document.querySelectorAll('.chapter-tile').length,4);
  const beforePractice=requests.length;
  ui.click('connections');
  assert.equal(ui.w.document.querySelectorAll('.connection-row').length,3);
  for(let round=0;round<4;round++){
    for(const select of ui.w.document.querySelectorAll('.connection-choice select')){
      select.value=select.dataset.event;
      select.dispatchEvent(new ui.w.Event('change',{bubbles:true}));
    }
    ui.click('connection-check');ui.click('connection-next');
  }
  assert.match(ui.text(),/12개 사건의 원인과 결과를 모두 연결/);
  ui.click('home');ui.click('memory');ui.click('memory-begin');
  assert.equal(ui.w.document.querySelectorAll('.memory-card').length,12);
  // Simulate wall-clock expiry without blocking the test on the visual timer.
  const realNow=ui.w.Date.now;ui.w.Date.now=()=>realNow()+6000;
  await until(()=>!!ui.w.document.querySelector('.card-tray'));
  const {events}=await import('../supabase-trial/practice.mjs');
  for(const event of events){
    ui.w.document.querySelector(`[data-action="memory-select"][data-event="${event.id}"]`).click();
    ui.w.document.querySelector(`[data-action="memory-place"][data-zone="${event.zone}"]`).click();
  }
  ui.click('memory-check');assert.match(ui.text(),/12개 사건을 모두 올바른/);
  assert.equal(requests.length,beforePractice,'practice navigation never calls the server');
  assert.equal((await db.query('select count(*)::int n from trial_openings')).rows[0].n,1);
  ui.click('practice-exit');
  ui.click('logout');assert.match(ui.text(),/5자리 학생 코드/);
  assert.equal(ui.w.sessionStorage.getItem('history-supabase-student-trial-1'),null);
});

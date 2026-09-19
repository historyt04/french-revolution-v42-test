import {TrialClient} from './client.mjs';
import {createQuiz,currentQuestion,submitAnswer,nextQuestion,hintFor} from './quiz.mjs?v=2';
import {homeView,bottomNav,recordsView,connectionsView,memoryView} from './views.mjs?v=3';
import {createConnections,checkConnections,nextConnections,createMemory,beginMemory,tickMemory,memoryHint,placeMemory,checkMemory} from './practice.mjs?v=3';
import {cardMarkup,packView,collectionView,celebrationView,tiers,effectOf,effectNames} from './collection.mjs?v=4';

const app=document.querySelector('#app'),notice=document.querySelector('#notice');
const client=new TrialClient();
const names={normal:'노말',rare:'레어',unique:'유니크',legend:'전설',myth:'신화'};
let state=null,schools=[],page='loading',quiz=null,attempt=null,completion=null,opening=null,revealed=false,busy=false,pending=null;
let practice=null,practiceTimer=null,collectionTier='normal',celebration=null;
const timings=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds=ms=>(ms/1000).toFixed(2)+'초';
const pendingKey=()=>`history-trial-pending:${client.session?.token.slice(0,16)||'none'}`;
function savePending(value){pending=value;try{if(value)sessionStorage.setItem(pendingKey(),JSON.stringify(value));else sessionStorage.removeItem(pendingKey());}catch{}}
function loadPending(){try{pending=JSON.parse(sessionStorage.getItem(pendingKey())||'null');}catch{pending=null;}}
function message(text){notice.textContent=text;}
function render(){
  const pageChanged=document.body.dataset.page!==page;
  document.body.dataset.page=page;
  if(page==='loading'){app.innerHTML='<section class="panel"><h1>시험판을 준비하고 있습니다.</h1></section>';return;}
  if(page==='login'){
    app.innerHTML=`<section class="panel login"><p class="eyebrow">SUPABASE · STUDENT TRIAL</p><h1>프랑스혁명 초급 학습</h1><p>초급 12문항을 풀고 시험용 카드팩을 열어 보세요.<br>홍길동 시험 계정만 입장할 수 있습니다.</p><form id="login">
      <label>학교<select name="schoolId" required>${schools.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')||'<option value="">서버 준비 후 학교를 불러옵니다</option>'}</select></label>
      <div class="grid"><label>학년도<input name="schoolYear" type="number" value="2026" required></label><label>학년<input name="grade" type="number" value="2" min="1" max="6" required></label><label>반<input name="classNo" type="number" value="4" min="1" max="30" required></label><label>번호<input name="number" type="number" value="4" min="1" max="100" required></label></div>
      <label>5자리 학생 코드<input name="code" type="password" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off" required aria-describedby="test-code"></label><p id="test-code" class="muted">가상 학생: 2학년 4반 4번 홍길동 · 시험 코드 12345</p>
      <label><input name="rememberDevice" type="checkbox">내 개인 태블릿에서 로그인 유지</label><small>공용 기기에서는 체크하지 마세요. 접속 코드는 저장하지 않습니다.</small>
      <div class="actions"><button ${busy||!schools.length?'disabled':''}>로그인</button><button type="button" class="secondary" data-action="bootstrap" ${busy?'disabled':''}>학교 다시 불러오기</button></div></form></section>`;
    return;
  }
  if(!state)return;
  const p=state.profile;
  const nav=`<div class="topline account-bar"><p>${esc(p.schoolName)} · ${esc(p.grade)}학년 ${esc(p.classNo)}반 ${esc(p.number)}번 <b>${esc(p.name)}</b></p><div class="actions"><button class="secondary" data-action="home" ${busy?'disabled':''}>학습 홈</button><button class="secondary" data-action="vault" ${busy?'disabled':''}>카드팩·도감</button><button class="secondary" data-action="logout" ${busy?'disabled':''}>로그아웃</button></div></div>`;
  let content='';
  if(pending&&!busy&&page!=='quiz')content+=`<section class="panel"><h2>응답 확인이 필요한 작업이 있습니다.</h2><p>같은 요청 번호로 다시 확인합니다. 새로고침해도 중복 지급·중복 차감하지 않습니다.</p><button data-action="retry">${pending.action==='game.complete'?'완료 저장 다시 확인':pending.action==='pack.open'?'개봉 결과 다시 확인':'작업 다시 확인'}</button></section>`;
  if(page==='home'){
    content+=homeView(state,busy||!!pending);
  }else if(page==='records'){
    content+=recordsView(state);
  }else if(page==='missions'){
    content+='<section class="panel"><p class="eyebrow">MISSIONS</p><h1>미션 이전 준비 중</h1><p>기존 미션을 없앤 것이 아닙니다. 교사 설정과 보상 검증을 연결한 뒤 이곳에 표시합니다.</p><p class="muted">현재 시험판에서는 초급 최초 완료 보상만 사용할 수 있습니다.</p><button data-action="home">학습 홈으로</button></section>';
  }else if(page==='connections'){
    content+=connectionsView(practice);
  }else if(page==='memory'){
    content+=memoryView(practice);
  }else if(page==='quiz'){
    const q=currentQuestion(quiz);
    content+=`<section class="panel"><div class="topline"><p class="eyebrow">초급 · ${quiz.round?`${quiz.round+1}바퀴 · 틀린 문제 다시 풀기`:'핵심어 학습'} · ${quiz.position+1}/${quiz.sequence.length}</p><button class="secondary" data-action="abandon">중단하고 나가기</button></div><div class="progress"><span style="width:${quiz.passed.length/12*100}%"></span></div><h2>${esc(q.prompt)}</h2>${quiz.round?`<p class="hint">힌트: ${esc(hintFor(q.label,quiz.round))}</p>`:''}<form id="answer"><label for="answer-input">핵심어를 입력하세요<input id="answer-input" name="answer" maxlength="150" autocomplete="off" autocapitalize="off" ${quiz.advance?'disabled':''}></label><button ${quiz.advance?'disabled':''}>정답 확인 ↵</button></form><p class="feedback ${quiz.feedback?.ok?'good':''}" role="status">${esc(quiz.feedback?.text||'띄어쓰기는 달라도 됩니다.')}</p>${quiz.advance?`<button id="next" data-action="next">${quiz.passed.length===12?'학습 완료 · 저장하기':'다음 문제 →'}</button>`:''}<p class="muted">성공 ${quiz.passed.length}/12 · 이번 문제 입력 ${quiz.tries}/2</p></section>`;
  }else if(page==='saving'){
    content+=`<section class="panel"><h1>12문제를 모두 풀었습니다.</h1><p>${busy?'서버에서 답안을 확인하고 완료 기록·보상을 저장하고 있습니다.':'저장 결과를 아직 확인하지 못했습니다. 위 버튼으로 다시 확인해 주세요.'}</p><p class="muted">확인 전에는 카드팩을 임의로 지급하지 않습니다.</p></section>`;
  }else if(page==='result'){
    content+=`<section class="panel"><p class="eyebrow">LEARNING COMPLETE</p><h1>초급 학습 완료!</h1><p>12문제 모두 성공 · 오답 ${completion.errorCount}회<br>처음에 바로 맞힌 문제 ${completion.firstTryCount}/12 · ${seconds(completion.elapsedMs)}</p><h2>${completion.rewardPacks?'일반 카드팩 1개가 지급되었습니다.':'완료 기록이 저장되었습니다.'}</h2><p>${completion.rewardPacks?'카드팩·도감에서 개봉할 수 있습니다.':'최초 완료 보상은 이미 받았습니다.'}</p><div class="actions"><button data-action="vault">카드팩·도감으로</button><button class="secondary" data-action="home">학습 홈으로</button></div></section>`;
  }else if(page==='vault'||page==='inventory'){
    content+=celebrationView(state,celebration);
    if(page==='vault'){
      content+=`<section class="panel topline"><p>시험용 일반 카드팩 ${state.packs}개</p><div class="actions"><button data-action="open" data-pack="basic" ${busy||pending||!state.packs?'disabled':''}>카드팩 1개 개봉</button><button class="secondary" data-action="inventory">8종 카드팩 보관함</button></div></section>`;
      content+=collectionView(state,collectionTier,busy||!!pending);
    }else content+=packView(state,busy||!!pending);
  }else if(page==='opening'){
    const cards=opening.cards||[opening.card];
    const glows=cards.filter(c=>effectOf(c)!=='normal');
    content+=`<section class="panel"><h1>${revealed?(glows.length?'숨겨진 광휘 발견!':'카드를 획득했습니다!'):'카드를 공개해 보세요'}</h1>${revealed&&glows.length?`<p class="glow-discovery">${[...new Set(glows.map(c=>effectNames[effectOf(c)]))].map(esc).join(' · ')}</p>`:''}<p>카드팩 차감과 카드 저장은 이미 완료되었습니다.</p><div class="${cards.length>1?'multi-reveal':'reveal'}">${revealed?cards.map(c=>cardMarkup(c,1,'reveal')).join(''):'<button class="sealed" data-action="reveal" style="width:100%">✦<br>카드 공개</button>'}</div><button class="secondary" data-action="vault">도감으로</button><button class="secondary" data-action="inventory">카드팩 보관함</button></section>`;
    if(revealed)content+=celebrationView(state,celebration);
  }
  app.innerHTML=nav+content+bottomNav(page,busy)+`<details class="panel timing-panel"><summary>이 기기의 서버 응답 시간</summary><table><thead><tr><th>동작</th><th>시간</th></tr></thead><tbody>${timings.slice(-12).map(t=>`<tr><td>${esc(t.action)}</td><td>${seconds(t.elapsed)}</td></tr>`).join('')}</tbody></table><small>문제 정답·오답 확인과 다음 문제 이동은 서버 요청 0회입니다.</small></details>`;
  if(pageChanged){document.documentElement.scrollTop=0;document.body.scrollTop=0;}
  window.HistoryCards.mountHistoryCards(app);
}
function stopPractice(){clearInterval(practiceTimer);practiceTimer=null;practice=null;}
function startPracticeTimer(){
  clearInterval(practiceTimer);
  practiceTimer=setInterval(()=>{
    if(page!=='memory'||!practice){clearInterval(practiceTimer);practiceTimer=null;return;}
    if(practice.phase==='memorize'||(practice.phase==='play'&&practice.visibleUntil)){
      tickMemory(practice);
      if(practice.phase==='play'&&Date.now()>=practice.visibleUntil)practice.visibleUntil=0;
      render();
    }
  },250);
}
async function call(action,payload){
  const owner=client.session?.token;
  const out=await client.call(action,payload);
  if(action!=='student.login'&&owner!==client.session?.token)throw new Error('로그인 정보가 바뀌었습니다. 다시 로그인해 주세요.');
  timings.push({action,elapsed:out.elapsed});return out.data;
}
function handleError(e){
  message(e.message||'오류가 발생했습니다.');
  if(e.code==='AUTH_REQUIRED'){state=null;page='login';quiz=null;attempt=null;pending=null;}
}
async function task(fn){if(busy)return;busy=true;message('');render();try{await fn();}catch(e){handleError(e);}finally{busy=false;render();}}
async function bootstrap(){const out=await call('public.bootstrap',{});schools=out.schools;}
async function mutate(action,payload){
  if(pending&&(pending.action!==action))throw new Error('먼저 응답 확인이 필요한 작업을 확인해 주세요.');
  if(!pending)savePending({action,payload:{...payload,requestId:crypto.randomUUID()}});
  let out;
  try{out=await call(pending.action,pending.payload);}catch(e){
    if(['PACK_EMPTY','ATTEMPT_NOT_FOUND','ATTEMPT_NOT_ACTIVE','ATTEMPT_EXPIRED','INVALID_SUBMISSIONS',
      'INCOMPLETE_QUIZ','INVALID_INPUT','UNKNOWN_GAME','REQUEST_CONFLICT'].includes(e.code))savePending(null);
    throw e;
  }
  savePending(null);if(out.state)state=out.state;
  return out;
}
function acceptMutation(action,out){
  if(action==='game.start'){attempt=out;quiz=createQuiz(out.questions);page='quiz';}
  else if(action==='game.complete'){completion=out;quiz=null;attempt=null;page='result';}
  else if(action==='pack.open'){opening=out;collectionTier=out.card.rarity;revealed=false;page='opening';}
  else if(action==='collection.ack'){celebration=null;}
  else if(action==='game.abandon'){quiz=null;attempt=null;page='home';}
}
async function finish(){page='saving';render();await task(async()=>{
  const out=await mutate('game.complete',{attemptId:attempt.attemptId,submissions:quiz.submissions});
  acceptMutation('game.complete',out);
});}
app.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault();});
app.addEventListener('change',e=>{
  const {event}=e.target.dataset;
  if(page!=='connections'||!event||practice.solved.includes(event))return;
  practice.choices[event]=e.target.value;
});
app.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(e.target.id==='login'){
    const data=Object.fromEntries(new FormData(e.target));data.rememberDevice=data.rememberDevice==='on';
    await task(async()=>{const out=await call('student.login',data);client.remember(out);state=out.state;page='home';loadPending();});
  }else if(e.target.id==='answer'){
    if(e.isComposing)return;
    const input=document.querySelector('#answer-input');
    if(!submitAnswer(quiz,input.value))return;
    render();document.querySelector(quiz.advance?'#next':'#answer-input')?.focus();
  }
});
app.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button||busy||button.disabled)return;
  const action=button.dataset.action;
  if(action==='tier'){if(tiers[button.dataset.tier])collectionTier=button.dataset.tier;render();return;}
  if(action==='celebrate'){celebration=button.dataset.milestone;render();return;}
  if(action==='milestone-ack'){
    await task(async()=>{acceptMutation('collection.ack',await mutate('collection.ack',{milestone:button.dataset.milestone}));});return;
  }
  if(action==='representative'){
    await task(async()=>{await mutate('collection.preference',{eventId:button.dataset.event,rarity:button.dataset.tier,effect:button.dataset.effect});});return;
  }
  if(action.startsWith('connection-')){
    if(page!=='connections'||!practice)return;
    if(action==='connection-check')checkConnections(practice);
    if(action==='connection-next')nextConnections(practice);
    render();return;
  }
  if(action.startsWith('memory-')){
    if(page!=='memory'||!practice)return;
    if(action==='memory-begin'){beginMemory(practice);startPracticeTimer();}
    else if(action==='memory-select'){if(practice.phase==='play'&&Date.now()>=practice.visibleUntil)practice.selected=button.dataset.event;}
    else if(action==='memory-place')placeMemory(practice,Number(button.dataset.zone));
    else if(action==='memory-hint'){memoryHint(practice);startPracticeTimer();}
    else if(action==='memory-check')checkMemory(practice);
    render();return;
  }
  if(action==='next'){if(nextQuestion(quiz)){if(quiz.done)await finish();else{render();document.querySelector('#answer-input')?.focus();}}return;}
  if(action==='reveal'){revealed=true;render();return;}
  if(action==='bootstrap'){await task(bootstrap);return;}
  if(action==='logout'){
    if(pending){message('저장·개봉 결과를 먼저 확인한 뒤 로그아웃해 주세요.');return;}
    if(quiz&&!confirm('학습을 중단하고 로그아웃할까요? 완료하지 않은 풀이는 저장되지 않습니다.'))return;
    const token=client.session?.token;stopPractice();client.clear();state=null;quiz=null;attempt=null;page='login';render();
    try{await client.call('session.logout',{},token);}catch{message('이 기기의 로그인 정보는 지웠습니다. 서버 로그아웃 확인에 실패했습니다.');}return;
  }
  if(['home','vault','inventory','missions','records','abandon'].includes(action)&&quiz){
    if(!confirm('중단할까요? 아직 완료하지 않은 풀이는 저장되지 않습니다.'))return;
    await task(async()=>{const out=await mutate('game.abandon',{attemptId:attempt.attemptId});acceptMutation('game.abandon',out);page=action==='abandon'?'home':action;});return;
  }
  if(['home','vault','inventory','missions','records','practice-exit'].includes(action)){stopPractice();page=action==='practice-exit'?'home':action;message('');render();return;}
  if(action==='connections'||action==='memory'){
    if(pending){message('먼저 저장 중인 작업의 결과를 확인해 주세요.');return;}
    stopPractice();practice=action==='connections'?createConnections():createMemory();page=action;message('');render();return;
  }
  if(action==='refresh'){await task(async()=>{state=await call('student.state',{});});return;}
  if(action==='start'){
    await task(async()=>{acceptMutation('game.start',await mutate('game.start',{gameId:'fr-beginner'}));});
    document.querySelector('#answer-input')?.focus();return;
  }
  if(action==='open'){await task(async()=>{acceptMutation('pack.open',await mutate('pack.open',state.collectionVersion>=2?{packType:button.dataset.pack||'basic',count:Number(button.dataset.count||1)}:{}));});return;}
  if(action==='retry'&&pending){const saved=pending;await task(async()=>{const out=await mutate(saved.action,saved.payload);acceptMutation(saved.action,out);});}
});
addEventListener('beforeunload',e=>{if(quiz&&!quiz.done){e.preventDefault();e.returnValue='';}});
addEventListener('storage',e=>{if(e.key==='history-supabase-student-trial-1'&&client.session?.rememberDevice){
  // Another tab changed identity. Stop using the old student's local state.
  stopPractice();client.invalidateTab();state=null;quiz=null;attempt=null;pending=null;page='login';render();message('다른 창에서 로그인 정보가 변경되었습니다. 다시 로그인해 주세요.');
}});
render();
await task(async()=>{
  await bootstrap();
  if(client.session){state=await call('student.state',{});page='home';loadPending();}
  else page='login';
});
if(page==='loading'){page='login';render();}

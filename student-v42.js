/* v4.1 renderers retained. Official decisions come only from the server. */
let state42=null,busy42=false,attempts42={},openPlan42=null,rank42=null,portal42=null;
const PACK_CARD_HOLD_MS42=1500;
let matchPreviewTimer42=null,matchPreviewEpoch42=0;
const api42=HistoryGameAPI,clone42=x=>JSON.parse(JSON.stringify(x));
const stateCacheKey42='history-v42-student-state:'+(window.HISTORY_API_CONFIG?.gasUrl||'local');
function readStateCache42(){try{const x=JSON.parse(sessionStorage.getItem(stateCacheKey42)||'null');return x?.owner===api42.session?.token?x.state:null}catch{return null}}
function writeStateCache42(s){try{if(api42.session?.role==='student'&&s)sessionStorage.setItem(stateCacheKey42,JSON.stringify({owner:api42.session.token,state:s}))}catch{}}
function clearStateCache42(){try{sessionStorage.removeItem(stateCacheKey42)}catch{}}
teacherUnlocked=false;dailyChecked=true;names.challenge='도전';
function toast42(msg){document.querySelector('.v42-toast')?.remove();const e=document.createElement('div');e.className='v42-toast';e.setAttribute('role','status');e.textContent=msg;document.body.append(e);setTimeout(()=>e.remove(),5500)}
async function run42(fn){if(busy42)return;busy42=true;document.body.classList.add('v42-busy');try{return await fn()}catch(e){toast42(e.message);if(['SESSION_EXPIRED','AUTH_REQUIRED'].includes(e.code)){api42.clear();state42=null;profile=null;profileScreen()}else if(e.code==='STALE_STATE'){await refresh42();render42()}}finally{busy42=false;document.body.classList.remove('v42-busy')}}
function applyState42(s){if(!s)return;writeStateCache42(s);acquiredCache41=null;state42=s;profile={...s.profile,serverBest:s.best.speedrun||0};P=fresh();for(const m of ['beginner','intermediate','advanced','challenge']){if(s.progress[m]){P[m]={...P[m],...clone42(s.progress[m])};if(P[m].status==='active')attempts42[m]={attemptId:P[m].run,mode:m,state:{...P[m]}}}if(s.completed[m]&&P[m].status!=='active')P[m].status='completed';else if(!s.completed[m]&&P[m].status==='completed')P[m]=['beginner','intermediate'].includes(m)?freshQ(m):freshO(m==='challenge'?14:12)}teacherUnlocked=false;dailyChecked=true}
async function refresh42(){applyState42(await api42.request('student.state'))}
profileScreen=function(){profile=null;app.innerHTML=`<main class="profile v42-login"><form class="shell" id="login42"><p class="eyebrow">1789 — 1799</p><h1>혁명 학습 명부 <span class="version">v4.2</span></h1><p>교사가 나누어 준 학번과 접속 코드로 입장하세요.</p><div class="fields"><label>학교<select name="schoolId" id="schoolLogin3"><option value="">학교 불러오는 중</option></select></label><label>학년도<input name="schoolYear" type="number" value="2026" min="2020" required></label><label>학년<input name="grade" type="number" value="2" min="1" max="6" required></label><label>반<input name="classNo" type="number" value="1" min="1" required></label><label>번호<input name="number" type="number" value="1" min="1" required></label><label>학생 접속 코드<input name="code" type="password" autocomplete="current-password" placeholder="신규 코드는 숫자 5자리" required></label></div><p class="registry-note">이름·진행·카드 수량은 인증 후 서버에서 불러옵니다. 학생은 기록을 초기화할 수 없습니다.</p><button class="btn" type="submit">학습 시작</button><p id="connection42" role="status"></p></form>${themeBadgeV35()}</main>`;document.querySelector('#login42').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));['schoolYear','grade','classNo','number'].forEach(k=>data[k]=+data[k]);run42(async()=>{const login=await api42.login('student',data);applyState42(login.student);view='results';render42();clock();bonusClock();if(login.attendance?.claimed&&login.attendance.result)toast42(login.attendance.result.message)})};api42.bootstrap().then(x=>{const s=document.querySelector('#schoolLogin3'),labels=window.HISTORY_API_CONFIG?.schoolLabels||{};if(s)s.innerHTML=(x.schools||[]).map(z=>'<option value="'+escape41(z.id)+'">'+escape41(labels[z.id]||z.name)+'</option>').join('')||'<option value="">학교 사용 준비가 필요합니다</option>';const chosen=new URLSearchParams(location.search).get('school');if(s&&chosen&&(x.schools||[]).some(z=>z.id===chosen))s.value=chosen;document.querySelector('#connection42')?.append(document.createTextNode(`v4.2 테스트 서버 연결 · ${x.schoolYear}학년도`))}).catch(e=>{const t=document.querySelector('#connection42');if(t)t.textContent=e.message})};
save=()=>{};saveCollection=savePackInventoryV38=savePackPityV36=saveBonusData=saveSettingsV36=saveV29Settings=()=>{};
report=saveOfficial=grantCards=grantCard=grantPackV36=addPackInventoryV38=recordMissionV36=maybeDailyPack=finishMatching=finishQuiz=()=>{};
flushOutbox=scheduleSync=()=>{};getOutbox=()=>[];teacherMenu=previewTeacher41=()=>toast42('교사 기능은 별도 인증 플랫폼에서만 이용할 수 있습니다.');
loadCollection=()=>Object.fromEntries((state42?.cards||[]).map(x=>[x.legacyId+'-'+x.rarity,x.count]));
loadAcquiredV33=()=>Object.fromEntries((state42?.cards||[]).map(x=>[x.legacyId+'-'+x.rarity,new Date(Date.parse(x.firstAcquiredAt)+9*3600000).toISOString().slice(0,10)]));
loadPackInventoryV38=()=>({counts:Object.fromEntries(PACKS_V36.map(p=>[p.id,state42?.packs.find(x=>x.packId===p.id)?.count||0])),guarantees:{}});
loadBonusData=()=>({best:state42?.best||{},completions:{}});bestFor=k=>state42?.best[k]||0;
loadFusionSettingsV34=()=>({mode:state42?.settings.fusionMode||'fast'});loadSettingsV36=()=>state42?.rewards||{packs:{},pity:{},missions:[]};
unlocked=unlockedV28=m=>['results','collection'].includes(m)||!!state42?.unlocked[m];
function gate42(v){if(['portal','results'].includes(v))return true;if(v==='rankings')return state42?.visibility.rankings;if(v==='collection')return state42?.visibility.collection;if(!state42?.visibility.game||!state42?.allowed)return false;if(v==='practice')return state42?.settings.practiceAllowed;if(v==='bonus')return state42?.unlocked.speedrun;return !!state42?.unlocked[v]}
go=function(v){if(!gate42(v))return toast42('앞 단계 완료 또는 교사의 이용 허용이 필요합니다.');view=v;if(v==='rankings')return loadRank42();if(v==='portal')return loadPortal42();render42();clock();bonusClock()};
function result42(){return `<section class="shell"><p class="eyebrow">서버에서 확인한 학습 진행</p><h2>나의 기록</h2><div class="results">${['beginner','intermediate','advanced','challenge'].map(m=>`<article class="result ${state42?.completed[m]?'done':''}"><h3>${names[m]}</h3><p>${state42?.completed[m]?'완료':state42?.unlocked[m]?'학습 가능':'앞 단계 완료 후 해금'}</p><button class="btn alt" onclick="go('${m}')" ${gate42(m)?'':'disabled'}>열기</button></article>`).join('')}</div><div class="bonus-actions"><button class="btn" onclick="go('rankings')">순위·기록</button><button class="btn alt" onclick="go('collection')">카드 도감</button></div></section>`}
const bonusHub42Base=bonusHub;
function bonusHub42(){const box=document.createElement('div');box.innerHTML=bonusHub42Base();box.querySelector('.dailybox')?.remove();box.querySelectorAll('[onclick*="practice"]').forEach(x=>x.disabled=!gate42('practice'));return box.innerHTML+missions42()}
function missions42(){return `<section class="shell"><h2>일일·주간 미션</h2>${(state42?.missions||[]).map(m=>`<div class="v42-mission"><span><b>${escape41(m.title)}</b><small>${m.progress}/${m.target} · ${escape41(packByIdV36(m.reward).name)} ${m.rewardCount}개</small></span><button class="btn alt" onclick="claim42('${m.id}')" ${m.claimed||m.progress<m.target?'disabled':''}>${m.claimed?'수령 완료':'보상 받기'}</button></div>`).join('')}</section>`}
function claim42(missionId){run42(async()=>{applyState42((await api42.request('missions.claim',{missionId})).student);render42()})}
function render42(){if(!state42)return profileScreen();if(!gate42(view))view='results';let body=view==='records27'?recordsPage27():view==='preferences26'?preferencePage26():['connections','revolutionmap'].includes(view)?board26(view):view==='results'?result42():view==='rankings'?rankMarkup42():view==='portal'?portalMarkup42():['beginner','intermediate'].includes(view)?quiz(view):['advanced','challenge'].includes(view)?order(view):view==='bonus'?bonusHub42():view==='collection'?collectionPage():view==='practice'?practicePageV28():view==='speedrun'?speedPageV28():view==='baitrun'?baitPage():view==='matching'?matchingPage():view==='faceoff'?facePage():result42();body=decorateStage2Body(body);const tabs=[['results','게임 선택'],['connections','기초학습'],['beginner','초급'],['intermediate','중급'],['advanced','고급'],['bonus','보너스 게임'],['collection','도감'],['records27','나의 기록'],['rankings','공식 순위'],['preferences26','학생 설정'],['portal','전체 단원']];app.innerHTML=`<header class="header"><div class="headerin"><div><p class="eyebrow">1789 — 1799</p><h1>프랑스 혁명 학습 게임 <span class="version">v4.2</span></h1></div><div class="student"><span>${state42.testOnly?'교사 연습모드 · 10분 시험 세션':`${profile.schoolYear}학년도 · ${profile.grade}학년 ${profile.classNo}반 ${profile.number}번 ${escape41(profile.name)}`}</span><button class="btn alt" onclick="logout42()">로그아웃</button></div></div></header><main class="wrap"><div class="v42-status"><span>${['127.0.0.1','localhost'].includes(location.hostname)?'로컬 테스트 서버 · 운영 자료와 분리':'v4.2 테스트 연결 · 승인 전 학생 배포 금지'}</span><button onclick="run42(async()=>{await refresh42();render42()})">상태 새로고침</button></div><nav class="tabs">${tabs.filter(([m])=>state42?.learning26?.gameLocks[m]?.display!=='hide').map(([m,label])=>`<button class="tab ${view===m?'active':''} ${gate42(m)?'':'locked'}" onclick="go('${m}')" ${gate42(m)?'':'disabled'}>${label}${gate42(m)?'':' 🔒'}</button>`).join('')}</nav>${body}</main>${themeBadgeV35()}${rewardModal()}${cardInspectModal()}${stage2Overlay()}`;document.title='프랑스 혁명 학습 게임 v4.2';for(const root of document.querySelectorAll('.v41-inspect,.v41-reward'))HistoryCards.mountHistoryCards(root);if(cardInspect?.flipped){const card=document.querySelector('.v41-inspect .history-card');if(card)HistoryCards.flipHistoryCard(card,true)}document.querySelector('.v41-inspect')?.addEventListener('historycardflip',e=>{if(cardInspect)cardInspect.flipped=e.detail.back});requestAnimationFrame(()=>document.querySelector('#ans')?.focus({preventScroll:true}));schedulePackAutoV38()}
render=renderV28=renderV29=renderV30=renderV31=renderV32=renderV33=renderV34=renderV35=renderV36=renderV37=renderV38=renderV39=renderV40=renderV41=render42;
syncLabel=()=>busy42?'서버 확인 중':'서버 상태';showSync=()=>{};
async function logout42(){api42.logout();clearStateCache42();state42=null;profile=null;attempts42={};packReward=null;openPlan42=null;profileScreen()}
function applyAttempt42(a){attempts42[a.mode]=a;const s={...clone42(a.state),status:a.status==='active'?'active':a.status==='completed'?'completed':'review',run:a.attemptId,elapsed:Math.floor((a.serverNow-Date.parse(a.startedAt))/1000),answer:'',notice:'',selected:null,checked:a.state.history?.length>0,startedAt:performance.now()-(a.serverNow-Date.parse(a.startedAt)),finishedMs:a.state.finishedMs||0,official:a.state.official||false,errorChecks:a.state.errors||0};
 if(['beginner','intermediate','advanced','challenge'].includes(a.mode))P[a.mode]={...P[a.mode],...s};
 if(a.mode==='speedrun'){speed={...s,previousBest:state42?.best.speedrun||0,isBest:false,officialEligible:s.official,errorChecks:s.errors};if(a.status==='active')speed.officialEligible=!s.errors}
 if(a.mode==='baitrun')bait={...s,refs:Object.fromEntries((s.refs||[]).map(r=>[r,{unitId:r.split('/')[0],eventId:r.split('/')[1]}])),decoyCount:s.decoyCount};
 if(a.mode==='matching'){
  matchGame={...s,cards:s.cards.map(x=>({...x,q:Q.find(q=>q.id===x.pair)})),lock:s.mismatchUntil>a.serverNow,preview:!!s.playAt&&a.serverNow<s.playAt,startedAt:performance.now()+((s.playAt||Date.parse(a.startedAt))-a.serverNow)};
  scheduleMatchingPreview42();
 }
 if(a.mode==='faceoff')face={...s,phase:a.serverNow<s.playAt?'preview':'play',board:s.board,startedAt:performance.now()-Math.max(0,a.serverNow-s.playAt)};
 if(a.status==='review'){toast42('검토 필요 기록으로 분류되어 해금·보상·공식 순위에 반영하지 않았습니다.');view='results'}
}
function payload42(m,data={}){const a=attempts42[m];if(!a)throw Error('시작 버튼을 먼저 눌러주세요.');return{attemptId:a.attemptId,revision:a.state.revision,...data}}
async function begin42(mode,options={}){const a=await api42.request('attempt.start',{mode,...options});applyAttempt42(a);render42();clock();bonusClock();return a}
start=m=>run42(()=>begin42(m));
answer=(e,m)=>{e.preventDefault();const s=P[m],a=s.answer,good=attempts42[m]?.state.result==='good';run42(async()=>{const out=await api42.request(good?'attempt.advance':'attempt.answer',payload42(m,good?{}:{questionId:s.sequence[s.pos],answer:a}));applyState42(out.student);applyAttempt42(out);render42()})};
check=m=>run42(async()=>{clearTimeout(draft42);await draftPending42;const out=await api42.request('attempt.order',payload42(m,{slots:P[m].slots}));applyState42(out.student);applyAttempt42(out);render42()});
startSpeed=()=>run42(()=>begin42('speedrun',{restart:true}));
judgeSpeed=()=>{if(!speed||speed.status!=='active'||speed.slots.some(x=>!x))return;run42(async()=>{const out=await api42.request('attempt.order',payload42('speedrun',{slots:speed.slots}));applyState42(out.student);applyAttempt42(out);render42()})};
startBait=n=>run42(()=>begin42('baitrun',{decoyCount:n,restart:true}));
checkBait=()=>run42(async()=>{const out=await api42.request('attempt.order',payload42('baitrun',{slots:bait.slots}));applyState42(out.student);applyAttempt42(out);render42()});
startMatching=(variant,setCount=6)=>run42(async()=>{
 // Load the possible faces before the server starts the five-second preview.
 await Promise.all([HistoryCards.frameURL('normal'),...Q.map(q=>HistoryContent.image(event41(q.contentRef)))].map(readyAsset41));
 await begin42('matching',{variant,setCount,restart:true});
});
flipMatch=i=>{if(!matchGame||matchGame.preview||matchGame.done.includes(i)||matchGame.open.includes(i)||matchGame.lock)return;run42(async()=>{const out=await api42.request('attempt.match',payload42('matching',{index:i}));if(out.student)applyState42(out.student);applyAttempt42(out);render42();if(matchGame.lock){const current=matchGame;setTimeout(()=>{if(matchGame===current){matchGame.open=[];matchGame.lock=false;render42()}},Math.max(0,out.state.mismatchUntil-out.serverNow)+30)}})};
function scheduleMatchingPreview42(){
 clearTimeout(matchPreviewTimer42);
 const current=matchGame,epoch=++matchPreviewEpoch42;
 if(!current?.preview)return;
 const tick=()=>{
  if(epoch!==matchPreviewEpoch42||matchGame!==current||!state42)return;
  const remaining=current.startedAt-performance.now();
  if(remaining<=0){current.preview=false;if(view==='matching')render42();return}
  const label=document.querySelector('#match-preview-count42');
  if(label)label.textContent=String(Math.ceil(remaining/1000));
  matchPreviewTimer42=setTimeout(tick,Math.min(100,remaining));
 };
 tick();
}
const bonusNow42Base=bonusNow,matchingPage42Base=matchingPage,matchCard42Base=matchCard;
bonusNow=s=>s===matchGame&&s?.preview?0:Math.max(0,bonusNow42Base(s));
matchCard=(c,i)=>{
 if(!matchGame?.preview)return matchCard42Base(c,i);
 const description=matchGame.variant==='advanced'&&c.side===1;
 return `<button type="button" class="matchcard match41 open preview42" disabled aria-label="미리보기: ${escape41(description?'사건 설명':c.q.title)}">${description?`<span class="match-description41">${escape41(DESC[c.q.id])}</span>`:gameInside41(c.q)}</button>`;
};
matchingPage=()=>{
 let h=matchingPage42Base();
 if(!matchGame)return h.replace('처음에는 6세트로 익히고, 익숙해지면 8·10·12세트에 도전하세요.','시작하면 모든 카드를 5초간 보여 줍니다. 덮인 뒤부터 시간을 측정합니다.');
 if(matchGame.preview){
  const seconds=Math.max(1,Math.ceil((matchGame.startedAt-performance.now())/1000));
  h=h.replace('<div class="matchgrid',`<div class="match-preview42" role="status">카드 위치를 기억하세요 <strong id="match-preview-count42">${seconds}</strong><span>초 뒤 덮기 · 아직 기록 시간은 흐르지 않습니다.</span></div><div class="matchgrid`);
 }
 return h;
};
startFace=()=>run42(async()=>{const a=await begin42('faceoff',{restart:true});setTimeout(()=>{if(face){face.phase='play';face.startedAt=performance.now();render42();bonusClock()}},Math.max(0,a.state.playAt-a.serverNow))});
checkFace=()=>run42(async()=>{const out=await api42.request('attempt.order',payload42('faceoff',{slots:face.board}));applyState42(out.student);applyAttempt42(out);render42()});
showFaceHint=()=>run42(async()=>{const out=await api42.request('attempt.hint',payload42('faceoff'));attempts42.faceoff=out;face.hints=out.state.hints;face.hinting=true;render42();setTimeout(()=>{if(face){face.hinting=false;render42()}},3000)});
let draft42,draftPending42=Promise.resolve();const place42Base=place,remove42Base=removeSlot;
function queueDraft42(m){if(!['advanced','challenge'].includes(m)||!attempts42[m])return;clearTimeout(draft42);draft42=setTimeout(()=>{if(busy42)return queueDraft42(m);draftPending42=draftPending42.then(async()=>{try{const out=await api42.request('attempt.save',payload42(m,{slots:clone42(P[m].slots)}));attempts42[m]=out}catch(e){toast42(e.message)}})},900)}
place=(m,i)=>{place42Base(m,i);queueDraft42(m)};removeSlot=(m,i)=>{remove42Base(m,i);queueDraft42(m)};
const practice42Base=startPractice;startPractice=m=>{if(!gate42('practice'))return toast42('교사가 연습 모드를 허용해야 합니다.');practice42Base(m)};
const reveal42Base=revealPack,reward42Base=rewardModal,advance42Base=advancePackV38,close42Base=closePackV38;
function cardFrom42(x){return{event:CH.find(e=>e.id===x.eventId),rar:rarityById(x.rarity),count:x.count,isNew:x.isNew,effect:x.effect||'normal',shiny:!!x.shiny}}
openStoredPacksV38=(packId,amount)=>{const n=loadPackInventoryV38().counts[packId]||0,total=amount==='all'?n:Math.min(n,Number(amount)||1);if(!total)return;openPlan42={packId,total,opened:0,cards:[]};packReward=null;packAutoV38=false;render42()};
function waitingPack42(){const p=packByIdV36(openPlan42.packId);return `<div class="rewardmodal v41-reward" role="dialog" aria-modal="true"><div class="packbox v41-packbox"><h2>${p.name}</h2><p>${openPlan42.opened+1} / ${openPlan42.total} · 팩을 누르면 개봉이 확정됩니다.</p>${packStage41(p,null,false)}<div class="packcontrols39"><button class="btn alt" onclick="closePackV38()">닫기</button>${openPlan42.total>1?`<button class="btn alt" onclick="autoOpenPackV39()">${packAutoV38?'자동 개봉 중지':'한 장씩 자동 개봉'}</button><button class="btn" onclick="revealAllPackV39()">모두 동시 개봉</button>`:''}</div><small>아직 열지 않은 팩은 차감되지 않습니다.</small></div></div>`}
rewardModal=()=>{if(openPlan42&&!packReward)return waitingPack42();if(!packReward)return'';let h=reward42Base().replace('닫아도 이미 획득한 결과는 도감에 보관됩니다.','개봉한 카드는 도감에 보관됩니다.');if(packReward.cards[packReward.cursor]?.isNew)h=h.replace('카드 등장!','카드 등장! <span class="new42">NEW!</span>');if(openPlan42&&packReward.phase!=='done'){h=h.replace('1 / 1 ·',`${openPlan42.opened} / ${openPlan42.total} ·`);if(openPlan42.opened<openPlan42.total)h=h.replace('>결과 확인</button>','>확인 · 다음 카드</button>');if(openPlan42.total>1)h=h.replace('</div><small class="pack-status41">',`<button class="btn alt" onclick="autoOpenPackV39()">${packAutoV38?'자동 개봉 중지':'한 장씩 자동 개봉'}</button><button class="btn" onclick="revealAllPackV39()">모두 동시 개봉</button></div><small class="pack-status41">`)}return h};
const stage42Base=packStage41;packStage41=(p,x,shown)=>{if(!packReward){packReward={cursor:0};const h=stage42Base(p,x,shown);packReward=null;return h}return stage42Base(p,x,shown)};
const spotlightStage42Base=packStage41;
packStage41=(p,x,shown)=>{
 const stage=spotlightStage42Base(p,x,shown);
 if(!shown||!x)return stage;
 const rarity=escape41(x.rar.id),name=escape41(x.rar.name);
 return `<div class="card-spotlight42" data-rarity="${rarity}" role="status"><strong class="rarity-label42">${name}</strong>${x.isNew?'<b class="new42">NEW</b>':''}<span class="revealed-title42">${escape41(x.event.title)}</span></div>`+stage.replace('class="stage v41-stage"',`class="stage v41-stage tier-highlight42" data-rarity="${rarity}"`);
};
const collectionMarkup42Base=collectionMarkup41;
collectionMarkup41=(id,rarity,count,mode='list')=>{
 const card=collectionMarkup42Base(id,rarity,count,mode);
 if(mode!=='list')return card;
 const title=CH.find(x=>x.id===id)?.title||'';
 return card+`<p class="card-readable-title42">${escape41(title)}</p><span class="card-readable-rarity42" data-rarity="${escape41(rarity)}">${escape41(rarityById(rarity).name)}</span>`;
};
revealPack=i=>{if(openPlan42&&!packReward)return run42(async()=>{const out=await api42.request('cards.openPack',{packId:openPlan42.packId,count:1});applyState42(out.student);const x=cardFrom42(out.cards[0]);openPlan42.cards.push(x);openPlan42.opened++;packReward={packType:openPlan42.packId,cards:[x],cursor:0,phase:'covered',revealed:0,lastReveal:-1};render42();await reveal42Base(0)});return reveal42Base(i)};
advancePackV38=()=>{if(openPlan42&&packReward?.phase==='shown'){const done=openPlan42.opened>=openPlan42.total;packReward=done?{packType:openPlan42.packId,cards:openPlan42.cards,cursor:openPlan42.cards.length,phase:'done',revealed:openPlan42.cards.length}:null;if(done){openPlan42=null;packAutoV38=false}render42();return}advance42Base()};
closePackV38=()=>{if(busy42)return;openPlan42=null;packReward=null;packAutoV38=false;clearTimeout(packAutoTimerV38);close42Base();render42()};
autoOpenPackV39=()=>{packAutoV38=!packAutoV38;schedulePackAutoV38();render42()};
schedulePackAutoV38=()=>{clearTimeout(packAutoTimerV38);if(!packAutoV38||cardInspect)return;const phase=packReward?.phase||'covered';if(['covered','shown'].includes(phase))packAutoTimerV38=setTimeout(()=>phase==='shown'?advancePackV38():revealPack(packReward?.cursor||0),phase==='shown'?PACK_CARD_HOLD_MS42:550)};
revealAllPackV39=()=>run42(async()=>{if(!openPlan42){if(packReward){packReward.phase='done';packReward.cursor=packReward.cards.length;render42()}return}const cards=openPlan42.cards.slice();let left=openPlan42.total-openPlan42.opened;while(left>0){const out=await api42.request('cards.openPack',{packId:openPlan42.packId,count:Math.min(100,left)});applyState42(out.student);cards.push(...out.cards.map(cardFrom42));left-=out.cards.length;openPlan42.opened+=out.cards.length;openPlan42.cards=cards.slice()}packReward={packType:openPlan42.packId,cards,cursor:cards.length,phase:'done',revealed:cards.length};openPlan42=null;packAutoV38=false;render42()});
performFusionV34=()=>{if(fusionSlotsV34.length!==5||!confirm('선택한 중복 카드 5장을 합성할까요? 각 종류의 마지막 1장은 보존됩니다.'))return;run42(async()=>{const out=await api42.request('cards.synthesize',{materials:fusionSlotsV34.map(x=>({eventId:x.eventId,rarity:x.rarityId}))});applyState42(out.student);fusionSlotsV34=[];packReward={source:'합성 결과',packType:out.card.rarity,cards:[cardFrom42(out.card)],cursor:0,phase:'shown',revealed:1,lastReveal:0};render42()})};
async function loadRank42(mode='speedrun'){view='rankings';rank42=null;render42();await run42(async()=>{rank42=await api42.request('rankings.read',{mode});render42()})}
function rankTable42(rows){return rows.length?`<table class="table42"><thead><tr><th>순위</th><th>표시 이름</th><th>기록</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.rank}위</td><td>${escape41(x.displayName)}${x.isMe?' (나)':''}</td><td>${precise(x.elapsedMs)}</td></tr>`).join('')}</tbody></table>`:'<p>아직 공개할 공식 기록이 없습니다.</p>'}
function rankMarkup42(){if(!rank42)return'<section class="shell"><h2>순위·기록</h2><p>서버 기록을 불러오는 중입니다.</p></section>';return`<section class="shell"><h2>프랑스 혁명 · 순위와 기록</h2><div class="rank-controls42"><select aria-label="게임 모드" onchange="loadRank42(this.value)">${['connections','beginner','intermediate','advanced','speedrun','baitrun','matching','revolutionmap'].map(m=>`<option value="${m}" ${m===rank42.mode?'selected':''}>${names[m]||({speedrun:'스피드런',baitrun:'미끼런',matching:'짝맞추기',faceoff:'페이스오프'})[m]}</option>`).join('')}</select></div><div class="rank42"><article>나의 학급 순위<strong>${rank42.myClassRank?rank42.myClassRank+'위':'—'}</strong></article><article>나의 학년 순위<strong>${rank42.myGradeRank?rank42.myGradeRank+'위':'—'}</strong></article><article>개인 최고기록<strong>${rank42.personalBest?precise(rank42.personalBest):'기록 없음'}</strong></article></div><h3>우리 반 상위권</h3>${rankTable42(rank42.classTop)}${rank42.weekly?`<h3>이번 주 · ${rank42.weekly.label}</h3>${rankTable42(rank42.weekly.rows)}`:''}${rank42.monthly?`<h3>이번 달 · ${rank42.monthly.label}</h3>${rankTable42(rank42.monthly.rows)}`:''}<p>교사가 공개한 정보만 표시합니다. 기간은 한국 표준시 서버 기준입니다.</p></section>`}
async function loadPortal42(){view='portal';portal42=null;render42();run42(async()=>{portal42=await api42.request('portal.read');render42()})}
function portalMarkup42(){if(!portal42)return'<section class="shell">단원 목록을 불러오는 중입니다.</section>';let major='';return'<section class="shell lesson-tree42"><h2>역사 ① 학습 공간</h2>'+portal42.lessons.map(l=>{let head='';if(major!==l.majorId){major=l.majorId;head=`<h3>${escape41(l.majorTitle)}</h3>`}return head+`<details ${l.unitId==='fr-revolution'?'open':''}><summary>${escape41(l.middleTitle)} / ${escape41(l.lessonTitle)} ${l.ready?'':'· 준비 중'}</summary><div class="lesson-menu42">${[['learn','학습하기'],['game','게임하기'],['collection','카드 도감'],['rankings','순위·기록']].map(([k,label])=>`<button ${l.ready&&l.visibility[k]&&k!=='learn'?'':'disabled'} onclick="go('${({game:'beginner',collection:'collection',rankings:'rankings'})[k]||'portal'}')">${label}${!l.ready||k==='learn'?' · 준비 중':l.visibility[k]?'':' · 잠김'}</button>`).join('')}</div></details>`}).join('')+'</section>'}
addEventListener('keydown',e=>{if(e.key==='Escape'&&openPlan42&&!busy42)closePackV38()});
// Keep v4.2 overrides after the original runtime-installed styles.
const studentStyle42=document.querySelector('link[href="v42.css"]');if(studentStyle42)document.head.appendChild(studentStyle42);
applyThemeV35();(async()=>{if(new URLSearchParams(location.search).has('teacherTest')&&window.opener){app.innerHTML='<main class="profile"><section class="shell"><h1>교사 시험 인증 확인 중</h1><p>시험에서는 학생 기록·순위·보상을 저장하지 않습니다.</p></section></main>';const receive=async e=>{if(e.origin!==location.origin||e.source!==window.opener||e.data?.type!=='v42-teacher-test')return;removeEventListener('message',receive);api42.saveSession(e.data.session);await run42(async()=>{await refresh42();view='beginner';render42()})};addEventListener('message',receive);window.opener.postMessage({type:'v42-test-ready'},location.origin);return}if(api42.session?.role==='student'){const cached=readStateCache42();if(cached)setTimeout(()=>{if(!state42&&api42.session?.role==='student'){applyState42(cached);view='results';render42();clock();bonusClock()}},0);try{await refresh42();render42();clock();bonusClock();return}catch(e){if(['SESSION_EXPIRED','AUTH_REQUIRED','SESSION_REVOKED','ACCESS_DENIED'].includes(e.code)){clearStateCache42();api42.clear()}else if(state42){toast42('최신 서버 상태를 확인하지 못했습니다. 표시된 내용은 마지막 확인 상태입니다.');return}else{app.innerHTML='<main class="profile"><section class="shell"><h1>연결을 확인해 주세요</h1><p>로그인 정보는 유지됩니다. 인터넷 연결 후 다시 시도하세요.</p><button onclick="location.reload()">다시 연결</button></section></main>';return}}}profileScreen()})();

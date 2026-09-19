/* Stage 2 UI. Server responses, never local inventory deltas, determine completion notices. */
let stage2Dialog=null,matchMode2='basic',matchSets2=6,lastDraft2={},leaving2=false;
const modes2=['beginner','intermediate','advanced','challenge','speedrun','baitrun','matching','faceoff'];
const label2={beginner:'초급',intermediate:'중급',advanced:'고급',challenge:'도전',speedrun:'스피드런',baitrun:'미끼런',matching:'짝맞추기',faceoff:'페이스오프'};
const pending2=m=>null;
const gateStage1=gate42;gate42=function(v){const a=attempts42[v]||pending2(v);if(modes2.includes(v)&&a?.state.practice&&state42?.visibility.game&&state42.allowed&&(state42.testOnly||state42.settings.practiceAllowed||a.state.resumedPractice))return true;return gateStage1(v)};
function active2(m){const a=attempts42[m];return a?.status==='active'?a:null}
function gameObject2(m){return ['beginner','intermediate','advanced','challenge'].includes(m)?P[m]:m==='speedrun'?speed:m==='baitrun'?bait:m==='matching'?matchGame:face}
function slots2(m){const s=gameObject2(m);return ['advanced','challenge','speedrun','baitrun'].includes(m)?s?.slots:m==='faceoff'?s?.board:undefined}
function policy2(m){return state42?.testOnly?'choose':state42?.completionSettings?.resume[m]||'choose'}
function rewardKey2(m,s={}){return m==='matching'?`matching.${s.variant||matchMode2}.${s.setCount||matchSets2}`:m==='baitrun'?`baitrun.${s.decoyCount||8}`:m}
function preview2(key,practice=false){const text=state42?.testOnly?'교사 연습모드이므로 기록과 보상이 저장되지 않습니다':practice?'일반 연습모드이므로 기록과 보상이 저장되지 않습니다':state42?.rewardPreviews?.[key]?.description||'서버 보상 설정을 불러오는 중입니다';return `<div class="reward-preview2" role="note">${escape41(text)}</div>`}
function completionNotice2(a){const r=a?.completionReward||a?.state.rewardResult;if(!r)return'';return `<section class="completion-notice2 ${r.granted?'granted':''}" role="status"><h2>${r.granted?'완료 보상을 확인하세요':'완료 결과'}</h2><p>${escape41(r.message).replaceAll('\n','<br>')}</p><div class="bonus-actions">
 ${r.packs.length&&gate42('collection')?'<button class="btn" onclick="openVault2()">보관함에서 카드팩 열기</button>':''}${r.cards.length&&gate42('collection')?'<button class="btn" onclick="collectionModeV34=\'book\';go(\'collection\')">카드 도감에서 확인</button>':''}
 <button class="btn alt" onclick="retryGame2('${a.mode}')">다시 도전</button><button class="btn alt" onclick="go('${['beginner','intermediate','advanced','challenge'].includes(a.mode)?'results':'bonus'}')">게임 선택으로</button></div></section>`}
function openVault2(){collectionModeV34='packs';go('collection');setTimeout(()=>document.querySelector('.pack-vault,.pack-inventory,.packvault38')?.scrollIntoView({behavior:'smooth'}),50)}
function decorateStage2Body(h){
 if(view==='practice')return preview2('',true)+h;
 if(!modes2.includes(view))return h;
 const a=attempts42[view],s=gameObject2(view),pending=pending2(view);
 // Remove obsolete, hard-coded rewards from retained legacy renderers only.
 h=h.replace(/완료 보상[^<]*(?:카드|카드팩)\s*\d+장[^<]*/g,'완료 보상은 현재 서버 설정을 따릅니다.');
 h=h.replaceAll('bait=null;go(\'bonus\')',"stopGame2('baitrun')").replaceAll('face=null;go(\'bonus\')',"stopGame2('faceoff')").replaceAll('matchGame=null;go(\'bonus\')',"stopGame2('matching')");
 if(s?.practice)h=h.replace('페이스오프 · 공식','페이스오프 · 연습').replaceAll('<span class="officialtag">공식</span>','<span class="casualtag">연습</span>');
 else h=h.replaceAll('<span class="casualtag">연습</span>','<span class="casualtag">비공식</span>');
 if(a&&['completed','review'].includes(a.status)){const x=a.state,record=a.status==='review'?'검토 필요 기록':x.practice?'연습 완료 · 학생 기록 미저장':x.official?'공식 기록':'완료 · 비공식 기록';return `<section class="shell quiz center"><h2>${label2[a.mode]} 완료</h2><p>${record} · ${precise(x.finishedMs||0)}</p>${a.mode==='matching'?`<p>${x.variant==='basic'?'기본모드':'고급모드'} · ${x.setCount}세트 · ${x.moves}번 뒤집기</p>`:''}${['beginner','intermediate'].includes(a.mode)?`<p>첫 입력 정답 ${x.first}/${a.mode==='beginner'?11:12} · 힌트 ${x.hints}회</p>`:''}</section>`+completionNotice2(a)}
 if(s?.status==='completed')h+=`<div class="bonus-actions"><button class="btn" onclick="retryGame2('${view}')">다시 도전</button></div>`;
 const resume='';
 const title=s?.resumedPractice?'<p class="practice-badge2">재개한 연습 기록 · 공식 기록·보상 없음</p>':s?.practice?`<p class="practice-badge2">${state42.testOnly?'교사':'일반'} 연습모드</p>`:'';
 const reward=['matching','baitrun'].includes(view)&&!active2(view)?'':preview2(rewardKey2(view,s||{}),s?.practice);
 const matchingTitle=view==='matching'&&active2(view)?`<h2 class="current-match2">${a.state.variant==='basic'?'기본모드':'고급모드'} · ${a.state.setCount}세트</h2>`:'';
 return matchingTitle+title+reward+resume+(active2(view)?`<div class="pause-actions2"><button class="btn alt" onclick="stopGame2('${view}')">중단하고 나가기</button></div>`:'')+h;
}
function stage2Overlay(){if(!stage2Dialog)return'';const {kind,mode}=stage2Dialog,p=policy2(mode),timed=['speedrun','baitrun','faceoff','revolutionmap'].includes(mode);return `<div class="stage2-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title2"><section class="shell"><h2 id="pause-title2">${label2[mode]} ${kind==='pause'?'중단':'다시 시작'}</h2>
 <p>${p==='resume'?'교사 설정: 항상 이어하기':p==='restart'?'교사 설정: 항상 처음부터 시작':'이어서 하거나 새 시도를 시작할 수 있습니다.'}</p>${timed?'<p>이어한 시도는 연습 기록이며 공식 기록·보상에 반영되지 않습니다.</p>':''}
 <div class="pause-choices2"><button class="btn" ${p==='restart'?'disabled':''} onclick="chooseResume2('resume')">${kind==='pause'?'이어서 하기 위해 저장하고 나가기':'이어서 하기'}</button><button class="btn alt" ${p==='resume'?'disabled':''} onclick="chooseResume2('restart')">${kind==='pause'?'현재 진행을 포기하고 처음부터 다시 하기':'처음부터 다시 하기'}</button><button class="btn alt" onclick="stage2Dialog=null;render42()">${kind==='pause'?'게임 계속하기':'나중에 선택'}</button></div></section></div>`}
function stopGame2(mode,nextView){if(!active2(mode))return;if(!confirm('현재 진행은 저장되지 않습니다. 게임을 중단할까요?'))return;delete attempts42[mode];if(['beginner','intermediate'].includes(mode))P[mode]=freshQ(mode);else if(['advanced','challenge'].includes(mode))P[mode]=freshO(mode==='challenge'?14:12);if(mode==='speedrun')speed=null;if(mode==='baitrun')bait=null;if(mode==='matching')matchGame=null;if(mode==='faceoff')face=null;if(mode==='connections'||mode==='revolutionmap')delete boards26[mode];stage2Dialog=null;view=nextView||(['beginner','intermediate','advanced','challenge'].includes(mode)?'results':'bonus');render42();clock();bonusClock()}
function offerResume2(mode){const a=pending2(mode);if(!a)return;stage2Dialog={kind:'resume',mode};render42()}
const applyStateStage1=applyState42;
applyState42=function(s){if(!s)return;const live={};for(const m of modes2)if(active2(m))live[m]={a:attempts42[m],s:gameObject2(m)};applyStateStage1(s);for(const m of modes2){const pending=pending2(m);if(live[m]&&pending?.attemptId===live[m].a.attemptId){if(pending.state.revision!==live[m].a.state.revision)applyAttempt42(pending);else{attempts42[m]=live[m].a;if(['beginner','intermediate','advanced','challenge'].includes(m))P[m]=live[m].s}}else if(pending&&['beginner','intermediate','advanced','challenge'].includes(m))P[m].status='not_started';else if(live[m]&&!pending)delete attempts42[m]} };
const applyAttemptStage1=applyAttempt42;
applyAttempt42=function(a){const oldView=view;applyAttemptStage1(a);view=oldView;const s=gameObject2(a.mode);s.status=['completed','review'].includes(a.status)?'completed':a.status;s.elapsed=Math.floor((a.elapsedMs||0)/1000);if(a.mode!=='matching'||!s.preview)s.startedAt=performance.now()-(a.elapsedMs||0);
 if(state42){state42.pendingAttempts=(state42.pendingAttempts||[]).filter(x=>x.mode!==a.mode);if(['active','paused'].includes(a.status))state42.pendingAttempts.push(a)}
 if(slots2(a.mode))lastDraft2[a.mode]=JSON.stringify(slots2(a.mode));
 if(a.status==='paused'){if(['beginner','intermediate','advanced','challenge'].includes(a.mode))P[a.mode].status='not_started';if(a.mode==='speedrun')speed=null;if(a.mode==='baitrun')bait=null;if(a.mode==='faceoff')face=null}
 if(a.mode==='faceoff'&&a.status==='active'&&s.phase==='preview'){const current=face;setTimeout(()=>{if(face===current&&active2('faceoff')){face.phase='play';face.startedAt=performance.now()-(a.elapsedMs||0);render42();bonusClock()}},Math.max(0,a.state.playAt-a.serverNow))}
};
const beginStage1=begin42;
begin42=async function(mode,options={}){view=mode;return beginStage1(mode,{...options,restart:true})};
start=m=>run42(()=>begin42(m));startSpeed=()=>run42(()=>begin42('speedrun'));startBait=n=>run42(()=>begin42('baitrun',{decoyCount:n}));startFace=()=>run42(()=>begin42('faceoff'));
startMatching=(variant=matchMode2,setCount=matchSets2)=>run42(async()=>{await Promise.all([HistoryCards.frameURL('normal'),...Q.map(q=>HistoryContent.image(event41(q.contentRef)))].map(readyAsset41));return begin42('matching',{variant,setCount})});
startPractice=m=>{if(!gate42('practice')&&!state42?.testOnly)return toast42('교사가 연습모드를 허용해야 합니다.');return run42(()=>begin42(m,{practice:true}))};
function retryGame2(m){const a=attempts42[m],s=a?.state||{},options={restart:true,practice:state42?.testOnly||!!s.practice};if(s.resumedPractice)options.practice=false;if(m==='matching')Object.assign(options,{variant:s.variant||matchMode2,setCount:s.setCount||matchSets2});if(m==='baitrun')options.decoyCount=s.decoyCount||8;return run42(()=>begin42(m,options))}
restartCurrentBonus=()=>retryGame2(view);cancelSpeed=()=>stopGame2('speedrun');
async function chooseResume2(choice){const dialog=stage2Dialog;if(!dialog)return;return run42(async()=>{clearTimeout(draft42);await draftPending42;const {mode,kind,nextView}=dialog;let a=active2(mode)||pending2(mode);if(!a)throw Error('진행 상태를 새로고침해 주세요.');
 if(choice==='resume'&&a.status==='active'){try{const cached=JSON.parse(sessionStorage.getItem('stage2-draft:'+a.attemptId)||'null');if(cached&&cached.revision===a.state.revision){a=await api42.request('attempt.save',{attemptId:a.attemptId,revision:a.state.revision,slots:cached.slots});attempts42[mode]=a}}catch(e){if(e.code)throw e}}
 const p={attemptId:a.attemptId,revision:a.state.revision};
 if(kind==='pause'&&choice==='resume'){const slots=slots2(mode);a=await api42.request('attempt.pause',{...p,...(slots?{slots:clone42(slots)}:{})});applyAttempt42(a);stage2Dialog=null;view=nextView||(['beginner','intermediate','advanced','challenge'].includes(mode)?'results':'bonus');render42();return}
 if(choice==='resume'){a=await api42.request('attempt.resume',p);applyAttempt42(a);stage2Dialog=null;view=mode;render42();clock();bonusClock();return}
 await api42.request('attempt.abandon',p);const s=a.state;delete attempts42[mode];state42.pendingAttempts=state42.pendingAttempts.filter(x=>x.attemptId!==a.attemptId);stage2Dialog=null;
 const options={restart:true,practice:state42.testOnly||!!s.practice&&!s.resumedPractice};if(mode==='matching')Object.assign(options,{variant:dialog.options?.variant||s.variant,setCount:dialog.options?.setCount||s.setCount});if(mode==='baitrun')options.decoyCount=dialog.options?.decoyCount||s.decoyCount;if(['connections','revolutionmap'].includes(mode))options.variant=dialog.options?.variant||s.variant;if(dialog.options?.practice!==undefined)options.practice=dialog.options.practice;
 await begin42(mode,options);
 })}
const goStage1=go;
go=function(v){if(active2(view)&&v!==view&&!leaving2){stopGame2(view,v);return}goStage1(v)};
const matchingStage1=matchingPage;
const baitStage1=baitPage;baitPage=function(){if(bait)return baitStage1();return `<section class="shell quiz center"><h2>미끼런</h2><p>프랑스 혁명 사건 12개를 순서대로 배치하세요. 영국·미국 사건이 같은 수만큼 섞입니다.</p><div class="modepick">${[4,6,8].map(n=>`<article><h3>미끼 ${n}장</h3>${preview2('baitrun.'+n)}<button class="btn" onclick="startBait(${n})">${n}장으로 시작</button></article>`).join('')}</div><p>공식 기록은 미끼 8장·첫 확인 정답인 새 시도만 인정합니다.</p></section>`};
const finishBonusStage1=finishBonusPage;finishBonusPage=function(label,s,key,official,note){const h=finishBonusStage1(label,s,key,official,note);return !s.practice&&!official?h.replace('연습 기록','비공식 기록'):h};
matchingPage=function(){if(matchGame&&['active','completed'].includes(matchGame.status))return matchingStage1();return `<section class="shell quiz center"><h2>짝맞추기</h2><p>시작하면 전체 카드를 5초 동안 공개합니다.</p><h3>1. 모드 선택</h3><div class="modepick">${[['basic','기본모드','같은 사건 카드끼리 맞추는 방식'],['advanced','고급모드','그림+제목 카드 ↔ 사건 설명 카드를 연결하는 방식']].map(([v,t,d])=>`<button class="${matchMode2===v?'selected2':''}" aria-pressed="${matchMode2===v}" onclick="matchMode2='${v}';render42()"><strong>${t}</strong><small>${d}</small></button>`).join('')}</div><h3>2. 세트 수 선택</h3><div class="settingrow">${[6,8,10,12].map(n=>`<button class="${matchSets2===n?'on':''}" aria-pressed="${matchSets2===n}" onclick="matchSets2=${n};render42()">${n}세트</button>`).join('')}</div><p>현재 선택: <b>${matchMode2==='basic'?'기본모드':'고급모드'} · ${matchSets2}세트</b></p>${preview2(`matching.${matchMode2}.${matchSets2}`)}<p>공식 기록: 고급모드 12세트만 인정합니다. 보상 조건과 별개입니다.</p><button class="btn" onclick="startMatching()">선택한 게임 시작</button></section>`};
bonusHub42=function(){return `<section class="shell"><h2>게임 선택</h2><div class="bonusmenu">${['speedrun','baitrun','matching','faceoff'].map(m=>`<article><h3>${label2[m]}</h3><p>${m==='matching'?'기본모드 / 고급모드에서 6·8·10·12세트를 선택하세요.':m==='baitrun'?'미끼 4·6·8장별 보상은 시작 화면에서 확인하세요.':'완료 보상은 서버의 현재 설정을 따릅니다.'}</p>${['speedrun','faceoff'].includes(m)?preview2(m):''}<button class="btn" onclick="go('${m}')">선택</button></article>`).join('')}</div>${state42?.settings.practiceAllowed?'<button class="btn alt" onclick="go(\'practice\')">일반 연습모드</button>':''}</section>`+(state42?.testOnly?'':missions42())};
// Persist order-board edits through the same serialized draft path, including bonus games.
queueDraft42=function(){};
function observeDraft2(){}
// Final screen render is shared by drag, click and keyboard legacy handlers.
const renderStage1=render42;
render42=function(){renderStage1();observeDraft2()};
render=renderV28=renderV29=renderV30=renderV31=renderV32=renderV33=renderV34=renderV35=renderV36=renderV37=renderV38=renderV39=renderV40=renderV41=render42;
function clearSessionGames2(){stage2Dialog=null;attempts42={};speed=bait=face=matchGame=null;lastDraft2={};clearTimeout(draft42);clearTimeout(matchPreviewTimer42);matchPreviewEpoch42++}
const runStage1=run42;run42=async function(fn){const result=await runStage1(async()=>{clearTimeout(draft42);await draftPending42;return fn()});if(!state42)clearSessionGames2();return result};
const logoutStage1=logout42;logout42=async function(){await logoutStage1();clearSessionGames2()};
// In-progress games are intentionally memory-only. Refreshing or closing starts the game over.

/* Personal-tablet login and server-filtered school display. */
const loginReadyBase=api42.login;
api42.login=async function(role,p){return loginReadyBase.call(api42,role,role==='student'?{...p,rememberDevice:p.rememberDevice===true||p.rememberDevice==='on'}:p)};
const profileReadyBase=profileScreen;
profileScreen=function(){profileReadyBase();const form=document.querySelector('#login42');if(!form)return;form.querySelector('.fields')?.insertAdjacentHTML('beforeend','<label>기기 이름<input name="deviceLabel" value="내 태블릿" maxlength="40" autocomplete="off"></label><label><input name="rememberDevice" type="checkbox" checked>내 개인 태블릿에서 로그인 유지</label>');form.insertAdjacentHTML('beforeend','<p>공용 기기에서는 로그인 유지를 해제하세요. 교사가 지정한 기간이 지나거나 기기를 분실한 경우 다시 로그인해야 합니다. 접속코드는 저장하지 않습니다.</p>');};
const renderReadyBase=render42;
let attendanceReadyKey='',attendanceReadyBusy=false;
async function attendanceReady(){if(!state42||state42.testOnly||attendanceReadyBusy)return;const key=state42.profile.id+':'+new Date(Date.now()+9*3600000).toISOString().slice(0,10);if(attendanceReadyKey===key)return;attendanceReadyBusy=true;try{const out=await api42.request('attendance.claim');attendanceReadyKey=key;applyState42(out.student);if(out.claimed&&out.result)toast42(out.result.message);render42()}catch(e){if(e.code!=='SESSION_CHANGED')toast42(e.message)}finally{attendanceReadyBusy=false}}
render42=function(){renderReadyBase();const label=state42?.publicDisplay?.schoolLabel;if(label){const spot=document.querySelector('.headerin .student');if(spot){const span=document.createElement('span');span.textContent=label;spot.prepend(span)}}if(state42)setTimeout(attendanceReady,0);};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)attendanceReady()});
addEventListener('history-session-changed',()=>{attendanceReadyKey=''});
const rankReadyBase=rankMarkup42;
rankMarkup42=function(){const base=rankReadyBase(),s=rank42?.shared;if(!s)return base;return base+`<section class="shell"><h2>공개 학교 통합 순위</h2><p>${escape41(s.notice)}</p>${rankTable42(s.rows.map(r=>({...r,displayName:r.displayName+(r.schoolLabel?' · '+r.schoolLabel:'')})))}</section>`;};
if(!state42&&!api42.session)profileScreen();

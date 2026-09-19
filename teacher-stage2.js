/* Completion rewards are intentionally separate from attendance, missions and gifts. */
function completionSettingsPage(){
 const s=info.completionSettings;if(!s)return '<section class="panel">2단계 서버 소스로 테스트 서버를 실행해 주세요.</section>';
 const events=Object.fromEntries(info.completionEvents.map(x=>[x.id,x.title]));
 return `<section class="panel"><h2>게임·단계별 완료 보상</h2><p>출석·미션·교사 직접 지급과 별도입니다. 기존 기본 보상은 유지되며, 설정을 저장해도 기존 지급 이력은 초기화되지 않습니다.</p><form onsubmit="saveCompletionSettings(event)">
 ${info.completionCatalog.map(({key,label})=>{const r=s.rules[key],kind=r.card?(r.pack?'both':'card'):(r.pack?'pack':'none');return `<details class="completion-rule"><summary>${E(label)}</summary><div class="formgrid">
 <label>보상 종류<select name="${key}_kind">${opts({none:'보상 없음',card:'특정 사건 카드',pack:'카드팩',both:'카드와 카드팩 동시 지급'},kind)}</select></label>
 <label>지급 주기<select name="${key}_policy">${opts({first:'최초 완료만',always:'완료할 때마다',daily:'하루 최초 완료만',weekly:'주간 최초 완료만'},r.policy)}</select></label>
 <label>사건 카드<select name="${key}_event">${opts(events,r.card?.eventId||1)}</select></label><label>카드 등급<select name="${key}_rarity">${opts(rarityNames,r.card?.rarity||'normal')}</select></label><label>카드 수량<input name="${key}_cards" type="number" min="1" max="50" value="${r.card?.count||1}" required></label>
 <label>카드팩 종류<select name="${key}_pack">${opts(packNames,r.pack?.packId||'basic')}</select></label><label>카드팩 수량<input name="${key}_packs" type="number" min="1" max="100" value="${r.pack?.count||1}" required></label>
 <label class="checkline"><input type="checkbox" name="${key}_eventLinked" ${r.legacyEvent?'checked':''}>기존 이벤트 배수·팩 설정 연동 유지 (팩에만 적용)</label>
 </div>${r.pack?.minR?'<p class="muted">기존 첫 팩 레어 이상 보장을 유지합니다. 확정팩은 해당 등급 확정 규칙이 우선합니다.</p>':''}</details>`}).join('')}
 <h2>게임별 중단·재개</h2><p>‘학생이 선택’이 기본입니다. 스피드런·미끼런·페이스오프를 이어하면 연습 기록이 되어 공식 기록·보상에 반영되지 않습니다.</p><div class="formgrid">
 ${Object.entries(modeNames).map(([m,n])=>`<label>${n}<select name="resume_${m}">${opts({choose:'학생이 선택',resume:'항상 이어하기',restart:'항상 처음부터 시작'},s.resume[m])}</select></label>`).join('')}
 <label>진행 기록 보관 기간<select name="retention">${opts({day:'당일', '3d':'3일','7d':'7일',unit:'단원 종료까지'},s.retention)}</select></label>
 <label>단원 종료 시각 (한국시간)<input name="unitEndsAt" type="datetime-local" value="${s.unitEndsAt?new Date(Date.parse(s.unitEndsAt)+9*3600000).toISOString().slice(0,16):''}"></label></div>
 <p class="muted">기간이 끝난 진행은 포기 상태로 남기며 자동 영구 삭제하지 않습니다. 새 시도부터 변경한 보관 기간이 적용됩니다. 단원 종료까지를 선택하면 종료 시각이 필요합니다.</p>
 <p>짝맞추기 공식 기록 조건은 ‘고급모드 12세트’로 고정되어 보상 설정과 함께 바뀌지 않습니다. 교사 연습모드는 설정과 관계없이 자유롭게 이어하기·재시작할 수 있으며 실제 보상은 없습니다.</p>
 <button class="primary">완료 보상·중단 설정 저장</button></form></section>`;
}
function saveCompletionSettings(e){e.preventDefault();const f=e.target,v=copy(info.completionSettings),val=k=>f.elements[k].value;
 for(const {key} of info.completionCatalog){const old=v.rules[key],kind=val(key+'_kind');v.rules[key]={...old,policy:val(key+'_policy'),legacyEvent:f.elements[key+'_eventLinked'].checked,
 card:['card','both'].includes(kind)?{eventId:+val(key+'_event'),rarity:val(key+'_rarity'),count:+val(key+'_cards')}:null,
 pack:['pack','both'].includes(kind)?{packId:val(key+'_pack'),count:+val(key+'_packs'),minR:old.pack?.minR||0}:null};}
 for(const m of Object.keys(modeNames))v.resume[m]=val('resume_'+m);v.retention=val('retention');v.unitEndsAt=val('unitEndsAt')?new Date(val('unitEndsAt')+':00+09:00').toISOString():'';
 task(async()=>{await API.request('teacher.completion.save',{schoolYear:year,value:v});await refresh();msg('완료 보상·중단 설정을 저장했습니다. 출석·미션·확률 설정은 유지했습니다.')});
}

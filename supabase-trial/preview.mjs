// Public visual QA only; no credentials, API calls, writes or simulated rewards.
import {homeView,bottomNav,connectionsView,memoryView} from './views.mjs?v=3';
import {createConnections,createMemory} from './practice.mjs?v=3';
import {collectionView,tiers,effects} from './collection.mjs?v=3';
const app=document.querySelector('#app'),notice=document.querySelector('#notice');
const state={profile:{name:'화면 미리보기'},runs:[],cards:[],packs:0,rewardClaimed:false};
const sample={...state,collectionVersion:2,representatives:{},milestones:[],cards:Object.keys(tiers).flatMap(rarity=>['normal',...effects[rarity]].map(effect=>({eventId:'FR-04',title:'바스티유 감옥 습격',rarity,effect,quantity:1})))};
let previewTier='normal';
function render(page='home'){
  document.body.dataset.page=page;
  const s=page==='memory'?createMemory():null;
  if(s){s.phase='memorize';s.visibleUntil=Date.now()+5000;}
  app.innerHTML=(page==='vault'?'<p class="migration-note">디자인 예시입니다. 아래 카드는 실제 보유 기록이 아닙니다.</p>'+collectionView(sample,previewTier):page==='connections'?connectionsView(createConnections()):page==='memory'?memoryView(s):homeView(state))+bottomNav(page);
  window.HistoryCards.mountHistoryCards(app);
  document.documentElement.scrollTop=0;document.body.scrollTop=0;
}
app.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]'),action=button?.dataset.action;if(!action)return;
  if(action==='tier'){previewTier=button.dataset.tier;render('vault');return;}
  if(action==='representative'){sample.representatives[button.dataset.event+':'+button.dataset.tier]=button.dataset.effect;render('vault');return;}
  if(['home','connections','memory','practice-exit','vault'].includes(action)){notice.textContent='';render(action==='practice-exit'?'home':action);}
  else notice.textContent='화면 미리보기입니다. 학습·저장·개봉은 상단의 “실제 시험판으로”에서 확인해 주세요.';
});
const width=Number(new URLSearchParams(location.search).get('width'));
if([390,768].includes(width)){
  app.innerHTML=`<p>화면 너비 ${width}px 검사 · <a href="supabase-design-preview.html">기본 화면</a></p><iframe title="반응형 디자인 검사" src="supabase-design-preview.html" style="width:${width}px;max-width:100%;height:1800px;border:1px solid #c4a069;display:block;margin:auto"></iframe>`;
}else render();

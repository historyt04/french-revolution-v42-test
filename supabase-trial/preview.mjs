// Public visual QA only; no credentials, API calls, writes or simulated rewards.
import {homeView,bottomNav,connectionsView,memoryView} from './views.mjs?v=3';
import {createConnections,createMemory} from './practice.mjs?v=3';
import {collectionView,celebrationView,tiers,effects} from './collection.mjs?v=4';
import {catalog} from './catalog.mjs?v=3';
const app=document.querySelector('#app'),notice=document.querySelector('#notice');
const state={profile:{name:'화면 미리보기'},runs:[],cards:[],packs:0,rewardClaimed:false};
let previewTier='normal',previewMode='effects',sample=null,previewRepresentatives={};
const makeCard=(eventId,rarity,effect='normal')=>({eventId,title:catalog.find(c=>c.eventId===eventId)?.title||eventId,rarity,effect,quantity:1});
function previewState(){
  const common={...state,collectionVersion:2,representatives:previewRepresentatives,shinyPercent:5,mythPity:100,pity:{sinceMyth:0,counters:{}},milestones:[]};
  if(previewMode==='hidden')return {...common,cards:[makeCard('FR-04',previewTier)]};
  if(previewMode==='tier'){
    const list=['normal',...effects[previewTier]],cards=catalog.flatMap(c=>list.map(effect=>makeCard(c.eventId,previewTier,effect)));
    previewRepresentatives=Object.fromEntries(catalog.map((c,i)=>[c.eventId+':'+previewTier,list[i%list.length]]));
    return {...common,representatives:previewRepresentatives,cards,milestones:[{id:`tier:${previewTier}`,seen:false}]};
  }
  return {...common,cards:['normal',...effects[previewTier]].map(effect=>makeCard('FR-04',previewTier,effect)),milestones:[{id:`set:FR-04:${previewTier}`,seen:false}]};
}
function previewTools(){return `<nav class="preview-tools" aria-label="도감 미리보기 선택"><button data-preview="hidden" aria-pressed="${previewMode==='hidden'}">발견 전 도감</button><button data-preview="effects" aria-pressed="${previewMode==='effects'}">광휘 효과 비교</button><button data-preview="set">사건 수집 완성 축하</button><button data-preview="tier">${tiers[previewTier]} 도감 완성 축하</button></nav>`;}
function render(page='home'){
  document.body.dataset.page=page;
  const s=page==='memory'?createMemory():null;
  if(s){s.phase='memorize';s.visibleUntil=Date.now()+5000;}
  sample=previewState();
  const celebration=previewMode==='set'?`set:FR-04:${previewTier}`:previewMode==='tier'?`tier:${previewTier}`:null;
  app.innerHTML=(page==='vault'?'<p class="migration-note">디자인 예시입니다. 아래 카드는 실제 보유 기록이 아닙니다.</p>'+previewTools()+collectionView(sample,previewTier)+celebrationView(sample,celebration):page==='connections'?connectionsView(createConnections()):page==='memory'?memoryView(s):homeView(state))+bottomNav(page);
  window.HistoryCards.mountHistoryCards(app);
  document.documentElement.scrollTop=0;document.body.scrollTop=0;
}
app.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]'),action=button?.dataset.action;if(!action)return;
  if(action==='tier'){previewTier=button.dataset.tier;render('vault');return;}
  if(action==='representative'){previewRepresentatives[button.dataset.event+':'+button.dataset.tier]=button.dataset.effect;render('vault');return;}
  if(action==='milestone-ack'){previewMode='effects';render('vault');return;}
  if(['home','connections','memory','practice-exit','vault'].includes(action)){notice.textContent='';render(action==='practice-exit'?'home':action);}
  else notice.textContent='화면 미리보기입니다. 학습·저장·개봉은 상단의 “실제 시험판으로”에서 확인해 주세요.';
});
app.addEventListener('click',e=>{
  const button=e.target.closest('[data-preview]');if(!button)return;
  previewMode=button.dataset.preview;render('vault');
});
const width=Number(new URLSearchParams(location.search).get('width'));
if([390,768].includes(width)){
  app.innerHTML=`<p>화면 너비 ${width}px 검사 · <a href="supabase-design-preview.html">기본 화면</a></p><iframe title="반응형 디자인 검사" src="supabase-design-preview.html" style="width:${width}px;max-width:100%;height:1800px;border:1px solid #c4a069;display:block;margin:auto"></iframe>`;
}else render();

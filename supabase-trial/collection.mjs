import '../history-card.js';
import {catalog} from './catalog.mjs?v=3';
export const tiers={normal:'노말',rare:'레어',unique:'유니크',legend:'전설',myth:'신화'};
export const effects={normal:['02','03'],rare:['02','05'],unique:['06','09'],legend:['03','04','07'],myth:['01','07','12']};
export const effectNames={'01':'무지개 홀로그램','02':'얼음 프리즘','03':'황금 광채','04':'붉은 불꽃','05':'에메랄드 오로라','06':'보라 성운','07':'은빛 프리즘','09':'홀로그램 원형 파동','12':'진주 오팔'};
window.HISTORY_CARD_ASSETS=Object.fromEntries(Object.keys(tiers).map(id=>['frame-'+id,`supabase-trial/assets/frames/${id}.webp`]));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const effectOf=c=>c.effect==='shiny'?effects[c.rarity]?.[0]:c.effect;
export function effectLabel(rarity,effect){return effect==='normal'?'일반 모습':`이로치 ${effects[rarity].indexOf(effect)+1} · ${effectNames[effect]}`;}
export function cardMarkup(card,quantity=card.quantity||1,mode='list'){
  const base=catalog.find(e=>e.eventId===card.eventId),effect=effectOf(card);
  if(!base||!tiers[card.rarity])return '<p>이전 카드 정보를 확인해 주세요.</p>';
  let markup=window.HistoryCards.renderHistoryCard({...base,image:`supabase-trial/assets/cards/${base.eventId}.webp`,rarity:card.rarity,ownedCount:quantity},{mode}).replaceAll('decoding="async"','decoding="async" loading="lazy"');
  if(effect!=='normal'&&effects[card.rarity].includes(effect)){
    markup=markup.replace('class="history-card ',`class="history-card effect25-${effect} `)
      .replace('<section class="history-card__face history-card__front" aria-hidden="false">',
        '<section class="history-card__face history-card__front" aria-hidden="false"><div class="shiny25-overlay" aria-hidden="true"><i></i><i></i><i></i><i></i></div>');
  }
  return `<div class="card collection-card">${markup}<p class="variant-caption">${esc(tiers[card.rarity])} · ${esc(effectLabel(card.rarity,effect))} · ${quantity}장</p></div>`;
}
export function packView(state,busy=false){
  const upgraded=state.collectionVersion>=2;
  const packs=upgraded?state.packTypes:[{id:'basic',name:'일반팩',weights:[70,23,6,.9,.1],pity_at:0}];
  const counts=state.packCounts||{basic:state.packs};
  return `<section class="panel pack-inventory"><p class="eyebrow">PACK INVENTORY</p><h1>카드팩 보관함</h1><p>팩 종류는 나올 수 있는 <b>등급의 확률</b>을 뜻합니다. 일반팩에서도 신화가 나올 수 있어요.</p>${!upgraded?'<p class="migration-note">도감 확장 SQL 적용 전입니다. 기존 일반팩 개봉은 그대로 사용할 수 있습니다.</p>':''}
  <div class="pack-grid">${packs.map(p=>`<article class="pack-entry"><img src="supabase-trial/assets/packs/${esc(p.id)}.webp" alt="${esc(p.name)}" loading="lazy" decoding="async"><h2>${esc(p.name)}</h2><strong>${counts[p.id]||0}개</strong><button data-action="open" data-pack="${esc(p.id)}" ${busy||!counts[p.id]?'disabled':''}>1개 개봉</button>${upgraded&&counts[p.id]>=10?`<button class="secondary" data-action="open" data-pack="${esc(p.id)}" data-count="10" ${busy?'disabled':''}>10개 한 번에</button>`:''}<details><summary>확률·천장</summary><p>${p.weights.map((n,i)=>Number(n)>0?`${Object.values(tiers)[i]} ${n}%`:'').filter(Boolean).join('<br>')}</p>${p.pity_at?`<small>${p.pity_at}회 안에 ${tiers[p.pity_tier]} 이상 보장<br>현재 ${state.pity?.counters?.[p.id]||0} / ${p.pity_at}</small>`:''}</details></article>`).join('')}</div>
  <p class="muted">${upgraded?`이로치 ${state.shinyPercent}% · 미획득 효과 우선 · 확률형 팩의 공통 신화 천장 ${state.mythPity}회 (현재 ${state.pity.sinceMyth}회). 확정팩은 해당 등급이 나옵니다.`:'도감 확장 전의 시험 확률이 적용됩니다.'}<br>개봉·천장·중복 방지는 서버가 처리하고, 카드 공개 연출은 기기에서 처리합니다.</p></section>`;
}
export function collectionView(state,rarity='normal',busy=false){
  const owned=state.cards.filter(c=>c.rarity===rarity),found=new Set(owned.map(c=>c.eventId)).size;
  const complete=state.milestones?.filter(m=>m.id.startsWith('set:')&&m.id.endsWith(':'+rarity)).length||0;
  return `<section class="panel collection-panel"><p class="eyebrow">THE CHRONICLE · CARD COLLECTION</p><h1>프랑스혁명 카드 도감</h1><p>등급별 12사건 · 일반 모습과 이로치를 모아 나만의 도감을 완성하세요.</p><nav class="tier-tabs" aria-label="카드 등급">${Object.entries(tiers).map(([id,name])=>`<button data-action="tier" data-tier="${id}" class="tierbadge25 ${id}" aria-pressed="${id===rarity}">${name}</button>`).join('')}</nav>
  <div class="collection-progress"><strong>${tiers[rarity]} 사건 ${found} / 12</strong><span>모든 모습 완성 ${complete} / 12세트</span></div>
  <p class="muted">카드를 누르면 뒷면 해설을 읽을 수 있습니다. 획득한 모습 중 원하는 것을 대표로 선택하세요.</p>
  <div class="collection-grid">${catalog.map(e=>{
    const variants=owned.filter(c=>c.eventId===e.eventId),list=['normal',...effects[rarity]];
    const rep=state.representatives?.[e.eventId+':'+rarity]||'normal';
    const current=variants.find(c=>effectOf(c)===rep)||variants.find(c=>effectOf(c)==='normal')||variants[0];
    return `<article class="collection-slot">${current?cardMarkup(current):`<div class="uncollected"><span>FRANCE · ${esc(e.eventId)}</span><b>✧</b><h2>${esc(e.title)}</h2><p>아직 만나지 못한 사건</p></div>`}<div class="variant-controls" aria-label="${esc(e.title)} 대표 모습">${list.map((fx,i)=>{const c=variants.find(v=>effectOf(v)===fx);return `<button data-action="representative" data-event="${e.eventId}" data-tier="${rarity}" data-effect="${fx}" title="${esc(effectLabel(rarity,fx))}" aria-pressed="${!!current&&effectOf(current)===fx}" ${!c||busy||state.collectionVersion<2?'disabled':''}>${i?`이로치 ${i}`:'일반'}<small>${c?c.quantity+'장':'미획득'}</small></button>`;}).join('')}</div></article>`;
  }).join('')}</div><h2>완성 배지</h2><div class="milestone-list">${(state.milestones||[]).map(m=>`<button class="secondary" data-action="celebrate" data-milestone="${esc(m.id)}">✦ ${esc(milestoneTitle(m.id))}</button>`).join('')||'<p>일반 모습과 해당 등급의 모든 이로치를 모으면 축하 배지가 생깁니다.</p>'}</div><p class="muted">이 시험판에는 12사건 × 5등급이 연결되어 있습니다. 원본 게임의 다른 자료는 삭제하지 않았습니다. 미션·합성·교사 확률 설정 화면은 이전 준비 중입니다.</p></section>`;
}
export function milestoneTitle(id){const [kind,event,rarity]=id.split(':');return kind==='tier'?`${tiers[event]} 도감 완성`:`${catalog.find(c=>c.eventId===event)?.title||event} · ${tiers[rarity]} 세트 완성`;}
export function celebrationView(state,selected=null){
  const m=selected?state.milestones?.find(m=>m.id===selected):state.milestones?.find(m=>!m.seen);
  if(!m)return '';
  return `<section class="panel collection-celebration" role="status"><p class="eyebrow">COLLECTION COMPLETE</p><span aria-hidden="true">✦</span><h2>축하합니다!</h2><p>${esc(milestoneTitle(m.id))}</p><p class="muted">꾸준히 모은 카드가 하나의 기록이 되었습니다.</p><button data-action="milestone-ack" data-milestone="${esc(m.id)}">확인</button></section>`;
}

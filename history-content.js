/* All modes resolve unitId + eventId against this one registry. No image/content copies. */
(function(global){
 'use strict';
 const units=new Map();let customMatcher=null;
 function registerUnit(unit){
  if(!unit?.unitId||!Array.isArray(unit.events))throw Error('unitId와 events가 필요합니다.');
  const ids=new Set(),orders=new Set();
  for(const e of unit.events){
   if(ids.has(e.eventId)||orders.has(e.order))throw Error('중복 사건 ID 또는 순서');
   if(!e.eventId||!e.title||!e.image||!Number.isInteger(e.order))throw Error('사건 필수값 누락');
   ids.add(e.eventId);orders.add(e.order);
  }
  for(const e of unit.events){
   for(const id of [e.previousEvent,e.nextEvent,...(e.intermediate?.distractorEventIds||[]),...(e.decoy?.wrongTitleEventIds||[])].filter(Boolean)){
    if(!ids.has(id))throw Error('찾을 수 없는 사건 참조: '+id);
   }
  }
  units.set(unit.unitId,unit);return unit;
 }
 function unit(id){if(!units.has(id))throw Error('등록되지 않은 단원: '+id);return units.get(id);}
 function event(unitId,eventId){const e=unit(unitId).events.find(e=>e.eventId===eventId);if(!e)throw Error('등록되지 않은 사건: '+eventId);return e;}
 const ordered=id=>[...unit(id).events].sort((a,b)=>a.order-b.order);
 const order=id=>ordered(id).map(e=>e.eventId);
 const image=e=>global.HistoryCards.assetURL(e.image,e.image);
 const focal=(e,mode)=>e.focalPoints?.[mode]||{x:e.focalX??50,y:e.focalY??50};
 function toCard(unitId,eventId,ownership={}){
  const e=event(unitId,eventId),f=focal(e,'collection');
  const flow=id=>id?(event(unitId,id).navigationTitle||event(unitId,id).title):'';
  return {...e,image:image(e),focalX:f.x,focalY:f.y,previousEvent:flow(e.previousEvent),nextEvent:flow(e.nextEvent),...ownership};
 }
 function normalize(s,policy={}){
  s=String(s??'').normalize('NFKC').toLocaleLowerCase().trim();
  if(policy.ignoreWhitespace!==false)s=s.replace(/\s+/gu,'');
  if(policy.ignorePunctuation!==false)s=s.replace(/[\p{P}\p{S}]/gu,'');
  return s;
 }
 function checkAnswer(unitId,eventId,input){
  const e=event(unitId,eventId),a=event(unitId,e.intermediate?.answerEventId||eventId);
  const aliases=[a.title,...(e.intermediate?.acceptedAnswers||[])],policy=e.intermediate?.normalization||{};
  const n=normalize(input,policy);if(!n)return false;
  if(customMatcher)return !!customMatcher({input,event:e,acceptedAnswers:aliases,normalize:s=>normalize(s,policy)});
  return aliases.some(s=>normalize(s,policy)===n);
 }
 function shuffle(values,rng=Math.random){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function shuffledOrder(unitId){const ids=order(unitId),a=shuffle(ids);if(a.length>1&&a.every((id,i)=>id===ids[i]))[a[0],a[1]]=[a[1],a[0]];return a;}
 function checkOrder(unitId,ids){const answer=order(unitId);return {complete:ids.length===answer.length&&ids.every(Boolean),correct:ids.length===answer.length&&answer.every((id,i)=>id===ids[i]),positions:answer.map((id,i)=>id===ids[i])};}
 function foreignDecoys(targetUnitId,foreignIds){return foreignIds.flatMap(id=>ordered(id).filter(e=>e.decoy?.eligibleAsForeignDecoy!==false&&!e.decoy?.excludedAgainstUnitIds?.includes(targetUnitId)).map(e=>({unitId:id,eventId:e.eventId,isTarget:false})));}
 function pickDecoyRound(targetUnitId,{targetCount=4,foreignCount=4,foreignUnitIds,excludedRefs=[]}={}){
  const config=unit(targetUnitId).modes?.decoy||{};
  const foreignIds=foreignUnitIds||config.foreignUnitIds||[];
  const excluded=new Set([...(config.excludedRefs||[]),...excludedRefs].map(r=>typeof r==='string'?r:`${r.unitId}/${r.eventId}`));
  const targets=shuffle(ordered(targetUnitId).filter(e=>!excluded.has(`${targetUnitId}/${e.eventId}`))).slice(0,Math.max(0,targetCount)).map(e=>({unitId:targetUnitId,eventId:e.eventId,isTarget:true}));
  const foreign=shuffle(foreignDecoys(targetUnitId,foreignIds).filter(r=>!excluded.has(`${r.unitId}/${r.eventId}`))).slice(0,Math.max(0,foreignCount));
  return shuffle([...targets,...foreign]);
 }
 global.HistoryContent={registerUnit,unit,event,ordered,order,image,focal,toCard,normalize,checkAnswer,shuffle,shuffledOrder,checkOrder,foreignDecoys,pickDecoyRound,
  get units(){return [...units.values()];},setAnswerMatcher(fn){if(fn!==null&&typeof fn!=='function')throw Error('채점 함수가 필요합니다.');customMatcher=fn;}};
 for(const data of global.HISTORY_UNITS||[])registerUnit(data);
})(window);

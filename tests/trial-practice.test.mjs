import {test} from 'node:test';
import assert from 'node:assert/strict';
import {events,zones,createConnections,connectionRound,checkConnections,nextConnections,createMemory,beginMemory,tickMemory,memoryHint,placeMemory,checkMemory} from '../supabase-trial/practice.mjs';
import {homeView,memoryView,connectionsView} from '../supabase-trial/views.mjs';

test('connection board covers 12 distinct events, preserves correct rows, rejects missing selections',()=>{
  const s=createConnections();assert.equal(new Set(s.sequence.map(e=>e.id)).size,12);
  assert.equal(checkConnections(s),false);assert.equal(nextConnections(s),false);
  for(let r=0;r<4;r++){
    for(const e of connectionRound(s))s.choices[e.id]=e.id;
    assert.equal(checkConnections(s),true);checkConnections(s);
    assert.equal(s.solved.length,(r+1)*3);assert.equal(nextConnections(s),true);
  }
  assert.match(connectionsView(s),/12개 사건/);
});
test('memory uses wall clock, incremental placement, three-second hint and exact period checks',()=>{
  const s=createMemory();assert.equal(placeMemory(s,0),false);beginMemory(s,1000);
  assert.equal(tickMemory(s,5999),false);assert.equal(tickMemory(s,6000),true);
  assert.equal(memoryHint(s,7000),true);assert.equal(s.visibleUntil,10000);assert.equal(memoryHint(s,7001),false);
  s.visibleUntil=0;s.selected=events[0].id;assert.equal(placeMemory(s,-1),false);
  assert.equal(placeMemory(s,3),true);assert.equal(checkMemory(s),false);
  for(const e of events){s.selected=e.id;assert.equal(placeMemory(s,e.zone),true);}
  assert.equal(checkMemory(s),true);assert.equal(s.phase,'done');assert.equal(s.hints,1);
  assert.match(memoryView(s),/지도 완성/);assert.equal(zones.length,4);
});
test('home counts server cards by event and never invents sample XP or mission progress',()=>{
  const html=homeView({profile:{name:'<script>alert(1)</script>'},cards:[{eventId:'FR-01',quantity:2},{eventId:'FR-01',quantity:1}],runs:[],packs:3,rewardClaimed:false});
  assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
  assert.match(html,/소장 카드 3장/);assert.match(html,/1 <em>\/ 12종/);assert.doesNotMatch(html,/Lv\.?\s*12|28\/84|3\/3/);
});

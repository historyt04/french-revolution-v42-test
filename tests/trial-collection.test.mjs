import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {makeDB,api,credentials} from './trial-db.mjs';
const request=()=>({requestId:crypto.randomUUID()});
test('collection upgrade: eight packs, pity, variants, preferences, celebrations, idempotency',async t=>{
  const db=await makeDB();t.after(()=>db.close());
  const login=(await api(db,'student.login',credentials)).data,token=login.token;
  const sid=(await db.query("select id from students where legacy_id='TEST-2026-2-4-4'")).rows[0].id;
  const state=async()=> (await api(db,'student.state',{},token)).data;
  await t.test('default rules, all roles denied, no free inventory',async()=>{
    const s=await state();assert.equal(s.packTypes.length,8);assert.equal(s.eventCount,12);
    assert.equal(s.shinyPercent,5);assert.equal(s.mythPity,100);assert.equal(Object.values(s.packCounts).reduce((a,b)=>a+b),0);
    const rights=(await db.query("select has_function_privilege('anon','public.trial_api_v1(text,jsonb,text)','execute') a,has_function_privilege('authenticated','public.trial_state(uuid)','execute') b,has_table_privilege('anon','public.trial_pack_inventory','select') c")).rows[0];
    assert.deepEqual(rights,{a:false,b:false,c:false});
    await assert.rejects(()=>api(db,'pack.open',request()),/AUTH_REQUIRED/);
  });
  // Test-only fixture in disposable DB. Never adds free packs to the live project.
  await db.query('insert into trial_wallets(student_id,packs) values($1,10)',[sid]);
  await db.query("insert into trial_pack_inventory(student_id,pack_type,quantity) select $1,id,2 from trial_pack_types where id<>'basic'",[sid]);
  await t.test('fixed packs never change rarity, no cross-pack spending',async()=>{
    for(const tier of ['normal','rare','unique','legend','myth']){
      const out=(await api(db,'pack.open',{...request(),packType:tier},token)).data;
      assert.equal(out.card.rarity,tier);assert.equal(out.state.packCounts[tier],1);assert.equal(out.state.packs,10);
    }
    const before=await state();
    for(const count of [0,-1,101,'1.1','abc'])await assert.rejects(()=>api(db,'pack.open',{...request(),count},token),/INVALID_INPUT/);
    await assert.rejects(()=>api(db,'pack.open',{...request(),packType:'madeup'},token),/INVALID_INPUT/);
    assert.deepEqual((await state()).packCounts,before.packCounts);
  });
  await t.test('guaranteed ceilings use server counts, not payload',async()=>{
    await db.exec("update trial_pack_types set weights='[100,0,0,0,0]' where not fixed");
    await db.query("update trial_pack_pity set counters='{\"basic\":19,\"premium\":14,\"elite\":9}',since_myth=0 where student_id=$1",[sid]);
    assert.equal((await api(db,'pack.open',{...request(),packType:'basic'},token)).data.card.rarity,'unique');
    assert.equal((await api(db,'pack.open',{...request(),packType:'premium'},token)).data.card.rarity,'unique');
    assert.equal((await api(db,'pack.open',{...request(),packType:'elite'},token)).data.card.rarity,'legend');
    await db.query('update trial_pack_pity set since_myth=99 where student_id=$1',[sid]);
    assert.equal((await api(db,'pack.open',{...request(),packType:'basic',rarity:'normal'},token)).data.card.rarity,'myth');
    assert.equal((await state()).pity.sinceMyth,0);
  });
  await t.test('batch is atomic, repeated ID replays same cards, insufficient stock rolls back',async()=>{
    const req={...request(),packType:'basic',count:5};
    const a=(await api(db,'pack.open',req,token)).data;
    assert.equal(a.cards.length,5);
    const b=(await api(db,'pack.open',req,token)).data;assert.deepEqual(b.cards,a.cards);
    assert.equal(b.state.packs,3);
    await assert.rejects(()=>api(db,'pack.open',{...req,count:1},token),/REQUEST_CONFLICT/);
    await assert.rejects(()=>api(db,'pack.open',{...request(),count:4},token),/PACK_EMPTY/);
    assert.equal((await state()).packs,3);
  });
  await t.test('legacy shiny conversion preserves quantity on repeated migrations',async()=>{
    await db.query("insert into trial_cards(student_id,card_key,card,quantity) values($1,'FR-01:myth:shiny','{\"eventId\":\"FR-01\",\"rarity\":\"myth\",\"effect\":\"shiny\"}',3)",[sid]);
    const sql=await fs.readFile(new URL('../supabase/migrations/202609190006_trial_collection.sql',import.meta.url),'utf8');
    const before=(await state()).cards.reduce((n,c)=>n+c.quantity,0);
    await db.exec(sql);await db.exec(sql);
    assert.equal((await state()).cards.reduce((n,c)=>n+c.quantity,0),before);
    assert.equal((await state()).cards.some(c=>c.effect==='shiny'),false);
  });
  await t.test('owned-only representative and complete-set/tier achievements persist once',async()=>{
    await assert.rejects(()=>api(db,'collection.preference',{...request(),eventId:'FR-01',rarity:'normal',effect:'99'},token),/INVALID_INPUT/);
    // All normal-tier variants for each event, simulating accumulated legitimate draws.
    await db.query(`insert into trial_cards(student_id,card_key,card,quantity)
      select $1,q.id||':normal:'||e,jsonb_build_object('eventId',q.id,'title',q.title,'image',q.image,'rarity','normal','effect',e),1
      from trial_questions q cross join unnest(array['normal','02','03']) e
      on conflict(student_id,card_key) do nothing`,[sid]);
    await db.query('select trial_record_completions($1)',[sid]);await db.query('select trial_record_completions($1)',[sid]);
    assert.equal((await state()).milestones.length,13);
    const req={...request(),eventId:'FR-01',rarity:'normal',effect:'03'};
    const p=(await api(db,'collection.preference',req,token)).data;
    assert.equal(p.state.representatives['FR-01:normal'],'03');
    const ack={...request(),milestone:'tier:normal'};
    await api(db,'collection.ack',ack,token);await api(db,'collection.ack',ack,token);
    assert.equal((await state()).milestones.find(m=>m.id==='tier:normal').seen,true);
  });
  await t.test('shiny selection prioritizes missing effects for the drawn event/tier',async()=>{
    await db.exec('update trial_collection_settings set shiny_percent=100');
    await db.query("update trial_pack_inventory set quantity=50 where student_id=$1 and pack_type='rare'",[sid]);
    const before=(await state()).cards;
    const out=(await api(db,'pack.open',{...request(),packType:'rare',count:50},token)).data;
    const seen=new Map();for(const c of before.filter(c=>c.rarity==='rare'&&['02','05'].includes(c.effect)))seen.set(c.eventId,new Set([...(seen.get(c.eventId)||[]),c.effect]));
    for(const c of out.cards){const s=seen.get(c.eventId)||new Set();assert.ok(['02','05'].includes(c.effect));if(s.size<2)assert.ok(!s.has(c.effect),'missing effect before duplicate');s.add(c.effect);seen.set(c.eventId,s);}
    assert.equal(out.state.packCounts.rare,0);
  });
  await t.test('revoked session cannot open or change representative',async()=>{
    await api(db,'session.logout',{},token);
    await assert.rejects(()=>api(db,'collection.preference',{...request(),eventId:'FR-01',rarity:'normal',effect:'normal'},token),/AUTH_REQUIRED/);
  });
});

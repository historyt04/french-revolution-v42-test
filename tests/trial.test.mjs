import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import {makeDB,api,credentials} from './trial-db.mjs';
import {createQuiz,currentQuestion,submitAnswer,nextQuestion,normalizeAnswer,hintFor} from '../supabase-trial/quiz.mjs';
const id=()=>crypto.randomUUID();

test('isolated PostgreSQL trial lifecycle and adversarial inputs',async t=>{
  const db=await makeDB();t.after(()=>db.close());
  await t.test('migration reruns without wiping records',async()=>{
    await db.exec(await fs.readFile(new URL('../supabase/migrations/202609190005_student_trial.sql',import.meta.url),'utf8'));
    assert.equal((await db.query('select count(*)::int as n from trial_questions')).rows[0].n,12);
  });
  await t.test('anonymous roles cannot call RPC or read trial data',async()=>{
    const p=(await db.query("select has_function_privilege('anon','public.trial_api(text,jsonb,text)','execute') f, has_table_privilege('anon','public.trial_cards','select') r")).rows[0];
    assert.deepEqual(p,{f:false,r:false});
    await db.exec('set role anon');
    await assert.rejects(()=>api(db,'health'),/permission denied/);
    await db.exec('reset role');
  });
  await t.test('login failure and missing session reject',async()=>{
    assert.equal((await api(db,'student.login',{...credentials,code:'00000'})).code,'AUTH_FAILED');
    await assert.rejects(()=>api(db,'student.state'),/AUTH_REQUIRED/);
  });
  const login=await api(db,'student.login',credentials), token=login.data.token;
  assert.equal(login.data.state.profile.name,'홍길동');
  const runRequest={gameId:'fr-beginner',requestId:id()};
  const run=(await api(db,'game.start',runRequest,token)).data;
  await t.test('start retries reuse original attempt and questions',async()=>{
    const again=(await api(db,'game.start',runRequest,token)).data;
    assert.equal(again.attemptId,run.attemptId);assert.deepEqual(again.questions,run.questions);
    await assert.rejects(()=>api(db,'pack.open',{requestId:runRequest.requestId},token),/REQUEST_CONFLICT/);
  });
  const submissions=run.questions.map(q=>({questionId:q.id,answer:q.answers[0]}));
  const complete={requestId:id(),attemptId:run.attemptId,submissions};
  await t.test('instant finish, counts-only and wrong answers rejected',async()=>{
    await assert.rejects(()=>api(db,'game.complete',complete,token),/TOO_FAST/);
    await db.query("update trial_runs set started_at=now()-interval '30 seconds' where id=$1",[run.attemptId]);
    await assert.rejects(()=>api(db,'game.complete',{requestId:id(),attemptId:run.attemptId,correctCount:12,totalCount:12},token),/INVALID_SUBMISSIONS/);
    await assert.rejects(()=>api(db,'game.complete',{...complete,submissions:submissions.map(s=>({...s,answer:'오답'}))},token),/INVALID_SUBMISSIONS|INCOMPLETE_QUIZ/);
    await assert.rejects(()=>api(db,'game.complete',{...complete,submissions:[...submissions].reverse()},token),/INVALID_SUBMISSIONS/);
    await assert.rejects(()=>api(db,'game.complete',{...complete,submissions:[...submissions,submissions[0]]},token),/INVALID_SUBMISSIONS/);
    assert.equal((await api(db,'student.state',{},token)).data.packs,0);
  });
  await t.test('correct completion and parallel duplicate requests grant one pack',async()=>{
    const results=await Promise.all([api(db,'game.complete',complete,token),api(db,'game.complete',complete,token)]);
    assert.equal(results[0].data.rewardPacks,1);assert.equal(results[1].data.replayed,true);
    const again=(await api(db,'game.complete',{...complete,requestId:id()},token)).data;
    assert.equal(again.alreadyCompleted,true);assert.equal(again.state.packs,1);
    assert.equal((await db.query('select count(*)::int n from trial_rewards')).rows[0].n,1);
  });
  await t.test('pack retries and two different requests cannot double-spend',async()=>{
    const req={requestId:id()};const first=await api(db,'pack.open',req,token);
    const again=await api(db,'pack.open',req,token);
    assert.deepEqual(again.data.card,first.data.card);assert.equal(again.data.openingId,first.data.openingId);
    assert.equal(again.data.state.packs,0);
    assert.equal(again.data.state.cards.reduce((n,c)=>n+c.quantity,0),1);
    await assert.rejects(()=>api(db,'pack.open',{requestId:id()},token),/PACK_EMPTY/);
  });
  await t.test('local wrong-answer/retry flow is accepted by server, no second first reward',async()=>{
    const r=(await api(db,'game.start',{gameId:'fr-beginner',requestId:id()},token)).data;
    const s=createQuiz(r.questions);const first=currentQuestion(s);
    submitAnswer(s,'틀림');assert.equal(s.advance,false);submitAnswer(s,'틀림');
    assert.match(s.feedback.text,/정답:/);assert.equal(currentQuestion(s).id,first.id);
    nextQuestion(s);assert.equal(s.feedback,null);
    while(s.round===0){submitAnswer(s,currentQuestion(s).answers[0]);nextQuestion(s);}
    assert.equal(s.sequence.length,1);assert.equal(hintFor(currentQuestion(s).label)[0],first.label[0]);
    submitAnswer(s,first.answers[0]);nextQuestion(s);assert.equal(s.done,true);
    await db.query("update trial_runs set started_at=now()-interval '30 seconds' where id=$1",[r.attemptId]);
    const done=(await api(db,'game.complete',{requestId:id(),attemptId:r.attemptId,submissions:s.submissions},token)).data;
    assert.equal(done.errorCount,2);assert.equal(done.firstTryCount,11);assert.equal(done.rewardPacks,0);
    assert.equal(done.official,false);
  });
  await t.test('abandoned and nonexistent attempts rejected',async()=>{
    const r=(await api(db,'game.start',{gameId:'fr-beginner',requestId:id()},token)).data;
    await api(db,'game.abandon',{attemptId:r.attemptId,requestId:id()},token);
    await assert.rejects(()=>api(db,'game.complete',{...complete,attemptId:r.attemptId,requestId:id()},token),/ATTEMPT_NOT_ACTIVE/);
    await assert.rejects(()=>api(db,'game.complete',{...complete,attemptId:id(),requestId:id()},token),/ATTEMPT_NOT_FOUND/);
  });
  await t.test('shared login limits persist after failures',async()=>{
    let out;for(let i=0;i<21;i++)out=await api(db,'student.login',{...credentials,code:'11111'});
    assert.equal(out.code,'RATE_LIMITED');
  });
  await t.test('logout revokes the token',async()=>{
    await api(db,'session.logout',{},token);
    await assert.rejects(()=>api(db,'student.state',{},token),/AUTH_REQUIRED/);
  });
});

test('answer normalization and double-submit guard',()=>{
  assert.equal(normalizeAnswer(' 루이 １６세 '),'루이16세');
  assert.equal(hintFor('삼부회'),'삼○○');
  const q=createQuiz([{id:'q',prompt:'?',answers:['삼부회'],label:'삼부회'}]);
  submitAnswer(q,'삼 부회');assert.equal(submitAnswer(q,'삼부회'),false);
  assert.equal(q.submissions.length,1);nextQuestion(q);assert.equal(q.done,true);
});

-- Isolated teacher trial. Requires 001-004. Does not modify the GAS game or its data.
-- All writes go through trial_api, callable ONLY by the server service role.
begin;

create table if not exists public.trial_questions (
  id text primary key, prompt text not null, answers jsonb not null,
  label text not null, title text not null, image text not null
);
create table if not exists public.trial_login_limits (
  key text primary key, window_start timestamptz not null, attempts integer not null
);
create table if not exists public.trial_sessions (
  token_hash text primary key, student_id uuid not null references public.students(id),
  session_version integer not null, expires_at timestamptz not null,
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.trial_runs (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id),
  status text not null default 'started' check (status in ('started','completed','abandoned')),
  questions jsonb not null, started_at timestamptz not null default now(),
  completed_at timestamptz, result jsonb
);
create index if not exists trial_runs_student_idx on public.trial_runs(student_id, started_at desc);
create table if not exists public.trial_wallets (
  student_id uuid primary key references public.students(id), packs integer not null default 0 check (packs >= 0)
);
create table if not exists public.trial_rewards (
  student_id uuid primary key references public.students(id),
  attempt_id uuid not null unique references public.trial_runs(id), created_at timestamptz not null default now()
);
create table if not exists public.trial_openings (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id),
  card jsonb not null, created_at timestamptz not null default now()
);
create index if not exists trial_openings_student_idx on public.trial_openings(student_id, created_at desc);
create table if not exists public.trial_cards (
  student_id uuid not null references public.students(id), card_key text not null,
  card jsonb not null, quantity integer not null check (quantity > 0),
  primary key (student_id, card_key)
);
create table if not exists public.trial_receipts (
  student_id uuid not null references public.students(id), request_id uuid not null,
  action text not null, payload_hash text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key (student_id, request_id)
);

do $$ declare t text; begin
  foreach t in array array['trial_questions','trial_login_limits','trial_sessions','trial_runs',
    'trial_wallets','trial_rewards','trial_openings','trial_cards','trial_receipts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

insert into public.trial_questions(id,prompt,answers,label,title,image) values
  ('FR-01','국가 재정 문제를 해결하기 위해 루이 16세가 성직자·귀족·평민 대표를 불러 모은 회의는?','["삼부회"]','삼부회','삼부회 소집','content/fr-revolution/images/FR-01.png'),
  ('FR-02','제3신분 대표들이 자신들을 국민의 대표라고 선언하여 결성한 의회는?','["국민의회"]','국민의회','국민의회 결성','content/fr-revolution/images/FR-02.png'),
  ('FR-03','국민의회가 헌법을 제정할 때까지 해산하지 않겠다고 맹세한 사건은?','["테니스코트의서약","테니스코트서약"]','테니스코트의서약','테니스 코트의 서약','content/fr-revolution/images/FR-03.png'),
  ('FR-04','프랑스 혁명의 시작을 알린 사건으로, 파리 시민들이 무기와 화약을 얻기 위해 습격한 감옥은?','["바스티유감옥","바스티유"]','바스티유감옥','바스티유 감옥 습격','content/fr-revolution/images/FR-04.png'),
  ('FR-05','자유와 평등, 국민주권 등 시민의 기본권을 선포한 문서는?','["인간과시민의권리선언","인권선언"]','인간과시민의권리선언','인간과 시민의 권리 선언','content/fr-revolution/images/FR-05.png'),
  ('FR-06','혁명 중 국외로 탈출하려다가 바렌에서 붙잡힌 프랑스 국왕은?','["루이16세","루이십육세"]','루이16세','루이 16세의 탈출 실패','content/fr-revolution/images/FR-06.png'),
  ('FR-07','왕정을 폐지하고 프랑스에 공화정을 선포한 의회는?','["국민공회"]','국민공회','국민공회와 공화정 수립','content/fr-revolution/images/FR-07.png'),
  ('FR-08','루이 16세를 처형할 때 사용된 기구는?','["단두대","기요틴"]','단두대','루이 16세 처형','content/fr-revolution/images/FR-08.png'),
  ('FR-09','혁명에 반대하는 사람들을 단두대로 처형하며 실시한 정치를 무엇이라고 하는가?','["공포정치"]','공포정치','로베스피에르의 공포 정치','content/fr-revolution/images/FR-09.png'),
  ('FR-10','공포 정치를 주도하다가 테르미도르의 반동으로 체포·처형된 인물은?','["로베스피에르"]','로베스피에르','로베스피에르 체포와 처형','content/fr-revolution/images/FR-10.png'),
  ('FR-11','공포 정치 이후 5명의 총재가 행정부를 맡아 통치한 정부는?','["총재정부"]','총재정부','총재정부 수립','content/fr-revolution/images/FR-11.png'),
  ('FR-12','쿠데타를 일으켜 총재정부를 무너뜨리고 권력을 장악한 인물은?','["나폴레옹","나폴레옹보나파르트","나폴레옹1세"]','나폴레옹','나폴레옹의 쿠데타와 집권','content/fr-revolution/images/FR-12.png')
on conflict(id) do nothing;

create or replace function public.trial_normalize(p_text text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(normalize(coalesce(p_text,''), NFKC), '[[:space:]·ㆍ.,!?()（）-]', '', 'g'));
$$;

create or replace function public.trial_state(p_student_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('name',s.name,'grade',c.grade,'classNo',c.class_no,
      'number',s.student_no,'schoolName',sc.name,'schoolYear',sy.year)
      from public.students s join public.classes c on c.id=s.class_id
      join public.school_years sy on sy.id=c.school_year_id join public.schools sc on sc.id=sy.school_id
      where s.id=p_student_id),
    'packs', coalesce((select packs from public.trial_wallets where student_id=p_student_id),0),
    'rewardClaimed', exists(select 1 from public.trial_rewards where student_id=p_student_id),
    'cards', coalesce((select jsonb_agg(card || jsonb_build_object('quantity',quantity) order by card_key)
      from public.trial_cards where student_id=p_student_id),'[]'::jsonb),
    'runs', coalesce((select jsonb_agg(x.result order by x.completed_at desc) from (
      select result,completed_at from public.trial_runs where student_id=p_student_id and status='completed'
      order by completed_at desc limit 10) x),'[]'::jsonb),
    'openings', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,card,created_at from public.trial_openings where student_id=p_student_id
      order by created_at desc limit 10) x),'[]'::jsonb)
  );
$$;

create or replace function public.trial_api(p_action text, p_payload jsonb default '{}'::jsonb, p_token text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student public.students%rowtype;
  v_session public.trial_sessions%rowtype;
  v_run public.trial_runs%rowtype;
  v_receipt public.trial_receipts%rowtype;
  v_request uuid; v_digest text; v_data jsonb; v_token text; v_expires timestamptz;
  v_key text; v_attempts integer; v_questions jsonb; v_q jsonb; v_answer jsonb;
  v_sequence text[]; v_original text[]; v_passed text[] := '{}'; v_pos integer := 1;
  v_tries integer := 0; v_errors integer := 0; v_submissions integer := 0; v_round integer := 0;
  v_first integer := 0; v_ok boolean; v_done boolean := false; v_reward integer := 0;
  v_elapsed bigint; v_roll integer; v_rarity text; v_card jsonb; v_shiny boolean; v_opening uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception using message='INVALID_INPUT';
  end if;
  if p_action='health' then
    return jsonb_build_object('ok',true,'data',jsonb_build_object('version','student-trial-1','testOnly',true));
  end if;
  if p_action='public.bootstrap' then
    return jsonb_build_object('ok',true,'data',jsonb_build_object('schools',
      coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.schools
        where active and id='dongju-middle'),'[]'::jsonb),'schoolYear',2026,'testOnly',true));
  end if;

  if p_action='student.login' then
    -- Count every attempt in a shared DB window; failures return, not raise (rollback would erase the counter).
    v_key := encode(extensions.digest(concat_ws(':',p_payload->>'schoolId',p_payload->>'schoolYear',
      p_payload->>'grade',p_payload->>'classNo',p_payload->>'number'),'sha256'),'hex');
    insert into public.trial_login_limits(key,window_start,attempts) values(v_key,now(),1)
    on conflict(key) do update set
      attempts=case when public.trial_login_limits.window_start < now()-interval '15 minutes' then 1 else public.trial_login_limits.attempts+1 end,
      window_start=case when public.trial_login_limits.window_start < now()-interval '15 minutes' then now() else public.trial_login_limits.window_start end
    returning attempts into v_attempts;
    if v_attempts>20 then
      return jsonb_build_object('ok',false,'code','RATE_LIMITED','message','로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');
    end if;
    select s.* into v_student from public.students s join public.classes c on c.id=s.class_id
      join public.school_years sy on sy.id=c.school_year_id join public.schools sc on sc.id=sy.school_id
      where sc.id=p_payload->>'schoolId' and sy.year::text=p_payload->>'schoolYear'
      and c.grade::text=p_payload->>'grade' and c.class_no::text=p_payload->>'classNo'
      and s.student_no::text=p_payload->>'number' and s.active and c.active and sy.active and sc.active
      and s.legacy_id='TEST-2026-2-4-4';
    if not found or coalesce(p_payload->>'code','') !~ '^[0-9]{5}$'
      or v_student.access_code_hash<>extensions.crypt(p_payload->>'code',v_student.access_code_hash) then
      return jsonb_build_object('ok',false,'code','AUTH_FAILED','message','시험 학생의 학번과 5자리 접속 코드를 확인해 주세요.');
    end if;
    v_token := encode(extensions.gen_random_bytes(32),'hex');
    v_expires := now() + case when p_payload->>'rememberDevice'='true' then interval '30 days' else interval '12 hours' end;
    insert into public.trial_sessions(token_hash,student_id,session_version,expires_at)
      values(encode(extensions.digest(v_token,'sha256'),'hex'),v_student.id,v_student.session_version,v_expires);
    return jsonb_build_object('ok',true,'data',jsonb_build_object('token',v_token,'expiresAt',v_expires,
      'rememberDevice',p_payload->>'rememberDevice'='true','state',public.trial_state(v_student.id)));
  end if;

  if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' then raise exception using message='AUTH_REQUIRED'; end if;
  select * into v_session from public.trial_sessions
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null and expires_at>now();
  if not found then raise exception using message='AUTH_REQUIRED'; end if;
  select s.* into v_student from public.students s join public.classes c on c.id=s.class_id
    join public.school_years sy on sy.id=c.school_year_id join public.schools sc on sc.id=sy.school_id
    where s.id=v_session.student_id and s.active and s.session_version=v_session.session_version
      and c.active and sy.active and sc.active and s.legacy_id='TEST-2026-2-4-4';
  if not found then raise exception using message='AUTH_REQUIRED'; end if;
  if p_action='student.state' then
    return jsonb_build_object('ok',true,'data',public.trial_state(v_student.id));
  end if;
  if p_action='session.logout' then
    update public.trial_sessions set revoked_at=now() where token_hash=v_session.token_hash;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('loggedOut',true));
  end if;
  if p_action not in ('game.start','game.complete','game.abandon','pack.open') then
    raise exception using message='UNKNOWN_ACTION';
  end if;

  -- Serialize ONLY this student's economy; different students never share this row lock.
  perform 1 from public.students where id=v_student.id for update;
  v_request := (p_payload->>'requestId')::uuid;
  if v_request is null then raise exception using message='INVALID_INPUT'; end if;
  v_digest := encode(extensions.digest(p_payload::text,'sha256'),'hex');
  select * into v_receipt from public.trial_receipts where student_id=v_student.id and request_id=v_request;
  if found then
    if v_receipt.action<>p_action or v_receipt.payload_hash<>v_digest then raise exception using message='REQUEST_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'data',v_receipt.response || jsonb_build_object('replayed',true));
  end if;

  if p_action='game.start' then
    if p_payload->>'gameId' is distinct from 'fr-beginner' then raise exception using message='UNKNOWN_GAME'; end if;
    if (select count(*) from public.trial_runs where student_id=v_student.id and started_at>now()-interval '1 minute')>=10 then
      raise exception using message='RATE_LIMITED';
    end if;
    select jsonb_agg(to_jsonb(q) order by random()) into v_questions from public.trial_questions q;
    if jsonb_array_length(v_questions)<>12 then raise exception using message='CONTENT_NOT_READY'; end if;
    insert into public.trial_runs(student_id,questions) values(v_student.id,v_questions) returning * into v_run;
    v_data := jsonb_build_object('attemptId',v_run.id,'questions',v_questions,'startedAt',v_run.started_at,
      'minDurationMs',15000,'rewardLabel','이 시험판에서 초급을 처음 완료하면 시험용 일반 카드팩 1개');
  elsif p_action in ('game.complete','game.abandon') then
    select * into v_run from public.trial_runs where id=(p_payload->>'attemptId')::uuid and student_id=v_student.id for update;
    if not found then raise exception using message='ATTEMPT_NOT_FOUND'; end if;
    if p_action='game.abandon' then
      if v_run.status='started' then update public.trial_runs set status='abandoned' where id=v_run.id; end if;
      v_data := jsonb_build_object('abandoned',v_run.status<>'completed');
    elsif v_run.status='completed' then
      v_data := v_run.result || jsonb_build_object('alreadyCompleted',true);
    else
      if v_run.status<>'started' then raise exception using message='ATTEMPT_NOT_ACTIVE'; end if;
      v_elapsed := floor(extract(epoch from (clock_timestamp()-v_run.started_at))*1000)::bigint;
      if v_elapsed<15000 then raise exception using message='TOO_FAST'; end if;
      if v_elapsed>86400000 then raise exception using message='ATTEMPT_EXPIRED'; end if;
      if jsonb_typeof(p_payload->'submissions') is distinct from 'array' then raise exception using message='INVALID_SUBMISSIONS'; end if;
      if jsonb_array_length(p_payload->'submissions') not between 12 and 1200 then raise exception using message='INVALID_SUBMISSIONS'; end if;
      select array_agg(q->>'id' order by ord) into v_original from jsonb_array_elements(v_run.questions) with ordinality as x(q,ord);
      v_sequence := v_original;
      for v_answer in select value from jsonb_array_elements(p_payload->'submissions') loop
        if v_done or v_answer->>'questionId' is distinct from v_sequence[v_pos]
          or jsonb_typeof(v_answer->'answer') is distinct from 'string'
          or char_length(v_answer->>'answer') not between 1 and 150
          or public.trial_normalize(v_answer->>'answer')='' then raise exception using message='INVALID_SUBMISSIONS'; end if;
        select q into v_q from jsonb_array_elements(v_run.questions) q where q->>'id'=v_sequence[v_pos];
        select exists(select 1 from jsonb_array_elements_text(v_q->'answers') a where public.trial_normalize(a)=public.trial_normalize(v_answer->>'answer')) into v_ok;
        v_tries:=v_tries+1; v_submissions:=v_submissions+1;
        if v_ok then
          v_passed:=array_append(v_passed,v_sequence[v_pos]);
          if v_round=0 and v_tries=1 then v_first:=v_first+1; end if;
        else v_errors:=v_errors+1; end if;
        if v_ok or v_tries=2 then
          v_tries:=0; v_pos:=v_pos+1;
          if v_pos>cardinality(v_sequence) then
            select coalesce(array_agg(q order by ord),'{}'::text[]) into v_sequence
              from unnest(v_original) with ordinality as x(q,ord) where not(q=any(v_passed));
            v_pos:=1; v_round:=v_round+1; v_done:=cardinality(v_sequence)=0;
          end if;
        end if;
      end loop;
      if not v_done or cardinality(v_passed)<>12 then raise exception using message='INCOMPLETE_QUIZ'; end if;
      insert into public.trial_rewards(student_id,attempt_id) values(v_student.id,v_run.id) on conflict(student_id) do nothing;
      if found then
        v_reward:=1;
        insert into public.trial_wallets(student_id,packs) values(v_student.id,1)
          on conflict(student_id) do update set packs=public.trial_wallets.packs+1;
      end if;
      v_data:=jsonb_build_object('attemptId',v_run.id,'completedAt',now(),'correctCount',12,'totalCount',12,
        'errorCount',v_errors,'firstTryCount',v_first,'submissionCount',v_submissions,'elapsedMs',v_elapsed,
        'rewardPacks',v_reward,'official',false,'testOnly',true);
      update public.trial_runs set status='completed',completed_at=now(),result=v_data where id=v_run.id;
    end if;
  elsif p_action='pack.open' then
    update public.trial_wallets set packs=packs-1 where student_id=v_student.id and packs>0;
    if not found then raise exception using message='PACK_EMPTY'; end if;
    -- Unbiased 0..9999 draw using rejection sampling on cryptographic bytes.
    loop
      v_key:=encode(extensions.gen_random_bytes(2),'hex');
      v_roll:=('x'||v_key)::bit(16)::integer;
      exit when v_roll<60000;
    end loop;
    v_roll:=v_roll%10000;
    -- Legacy basic-pack default odds: 70 / 23 / 6 / 0.9 / 0.1 percent.
    v_rarity:=case when v_roll<7000 then 'normal' when v_roll<9300 then 'rare'
      when v_roll<9900 then 'unique' when v_roll<9990 then 'legend' else 'myth' end;
    select to_jsonb(q) into v_q from public.trial_questions q order by random() limit 1;
    if v_q is null then raise exception using message='CONTENT_NOT_READY'; end if;
    -- Trial-only shiny rate 1%; school-specific rates and effects are NOT migrated yet.
    -- Use exact 1/100 probability, without byte-modulo bias.
    loop v_roll:=get_byte(extensions.gen_random_bytes(1),0); exit when v_roll<200; end loop;
    v_shiny:=(v_roll%100)=0;
    v_card:=jsonb_build_object('eventId',v_q->>'id','title',v_q->>'title','image',v_q->>'image',
      'rarity',v_rarity,'effect',case when v_shiny then 'shiny' else 'normal' end,'testOnly',true);
    v_key:=(v_q->>'id')||':'||v_rarity||':'||(v_card->>'effect');
    insert into public.trial_cards(student_id,card_key,card,quantity) values(v_student.id,v_key,v_card,1)
      on conflict(student_id,card_key) do update set quantity=public.trial_cards.quantity+1;
    insert into public.trial_openings(student_id,card) values(v_student.id,v_card) returning id into v_opening;
    v_data:=jsonb_build_object('openingId',v_opening,'card',v_card);
  end if;
  v_data:=v_data||jsonb_build_object('state',public.trial_state(v_student.id));
  insert into public.trial_receipts(student_id,request_id,action,payload_hash,response)
    values(v_student.id,v_request,p_action,v_digest,v_data);
  return jsonb_build_object('ok',true,'data',v_data);
end;
$$;

revoke all on function public.trial_normalize(text) from public,anon,authenticated;
revoke all on function public.trial_state(uuid) from public,anon,authenticated;
revoke all on function public.trial_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.trial_normalize(text) to service_role;
grant execute on function public.trial_state(uuid) to service_role;
grant execute on function public.trial_api(text,jsonb,text) to service_role;

commit;
select count(*) as trial_questions, 'student-trial-1' as trial_version from public.trial_questions;

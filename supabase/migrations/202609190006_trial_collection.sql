-- Additive, isolated trial upgrade. Apply AFTER 005. Never touches the GAS game.
-- Keep the existing beginner/login implementation and extend collection operations.
begin;
do $$ begin
  if to_regprocedure('public.trial_api_v1(text,jsonb,text)') is null then
    execute replace(pg_get_functiondef('public.trial_api(text,jsonb,text)'::regprocedure),
      'FUNCTION public.trial_api(', 'FUNCTION public.trial_api_v1(');
  end if;
  if to_regprocedure('public.trial_state_v1(uuid)') is null then
    execute replace(pg_get_functiondef('public.trial_state(uuid)'::regprocedure),
      'FUNCTION public.trial_state(', 'FUNCTION public.trial_state_v1(');
  end if;
end $$;

create table if not exists public.trial_pack_types (
  id text primary key, name text not null, weights jsonb not null,
  pity_at integer not null default 0, pity_tier text,
  fixed boolean not null default false, sort_order integer not null
);
insert into public.trial_pack_types(id,name,weights,pity_at,pity_tier,fixed,sort_order) values
('basic','일반팩','[70,23,6,0.9,0.1]',20,'unique',false,1),
('premium','중급팩','[45,37,15,2.7,0.3]',15,'unique',false,2),
('elite','고급팩','[20,40,28,10,2]',10,'legend',false,3),
('normal','노말 확정팩','[100,0,0,0,0]',0,null,true,4),
('rare','레어 확정팩','[0,100,0,0,0]',0,null,true,5),
('unique','유니크 확정팩','[0,0,100,0,0]',0,null,true,6),
('legend','전설 확정팩','[0,0,0,100,0]',0,null,true,7),
('myth','신화 확정팩','[0,0,0,0,100]',0,null,true,8)
on conflict(id) do nothing;
create table if not exists public.trial_collection_settings (
  id boolean primary key default true check(id),
  shiny_percent numeric not null default 5 check(shiny_percent between 0 and 100),
  myth_pity integer not null default 100 check(myth_pity>0)
);
insert into public.trial_collection_settings(id) values(true) on conflict do nothing;
create table if not exists public.trial_pack_inventory (
  student_id uuid not null references public.students(id),
  pack_type text not null references public.trial_pack_types(id) check(pack_type<>'basic'),
  quantity integer not null default 0 check(quantity>=0), primary key(student_id,pack_type)
);
create table if not exists public.trial_pack_pity (
  student_id uuid primary key references public.students(id), counters jsonb not null default '{}',
  since_myth integer not null default 0 check(since_myth>=0)
);
create table if not exists public.trial_card_preferences (
  student_id uuid not null references public.students(id), event_id text not null references public.trial_questions(id),
  rarity text not null check(rarity in ('normal','rare','unique','legend','myth')),
  effect text not null, primary key(student_id,event_id,rarity)
);
create table if not exists public.trial_collection_milestones (
  student_id uuid not null references public.students(id), milestone text not null,
  created_at timestamptz not null default now(), seen_at timestamptz,
  primary key(student_id,milestone)
);
do $$ declare t text; begin
  foreach t in array array['trial_pack_types','trial_collection_settings','trial_pack_inventory',
    'trial_pack_pity','trial_card_preferences','trial_collection_milestones'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.trial_effects(p_rarity text) returns text[]
language sql immutable set search_path='' as $$
  select case p_rarity when 'normal' then array['02','03'] when 'rare' then array['02','05']
    when 'unique' then array['06','09'] when 'legend' then array['03','04','07']
    when 'myth' then array['01','07','12'] else '{}'::text[] end;
$$;
-- Convert the former one-kind shiny to that tier's first effect; preserve quantities.
insert into public.trial_cards(student_id,card_key,card,quantity)
select student_id,(card->>'eventId')||':'||(card->>'rarity')||':'||(public.trial_effects(card->>'rarity'))[1],
  jsonb_set(card,'{effect}',to_jsonb((public.trial_effects(card->>'rarity'))[1])),quantity
from public.trial_cards where card->>'effect'='shiny'
on conflict(student_id,card_key) do update set quantity=public.trial_cards.quantity+excluded.quantity;
delete from public.trial_cards where card->>'effect'='shiny';

create or replace function public.trial_record_completions(p_student uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  insert into public.trial_collection_milestones(student_id,milestone)
  select p_student,'set:'||q.id||':'||r.rarity from public.trial_questions q
  cross join unnest(array['normal','rare','unique','legend','myth']) r(rarity)
  where not exists(select 1 from unnest(array['normal']||public.trial_effects(r.rarity)) e(effect)
    where not exists(select 1 from public.trial_cards c where c.student_id=p_student
      and c.card->>'eventId'=q.id and c.card->>'rarity'=r.rarity and c.card->>'effect'=e.effect))
  on conflict do nothing;
  insert into public.trial_collection_milestones(student_id,milestone)
  select p_student,'tier:'||r.rarity from unnest(array['normal','rare','unique','legend','myth']) r(rarity)
  where not exists(select 1 from public.trial_questions q where not exists(
    select 1 from public.trial_collection_milestones m where m.student_id=p_student
      and m.milestone='set:'||q.id||':'||r.rarity)) on conflict do nothing;
end $$;

create or replace function public.trial_state(p_student_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select public.trial_state_v1(p_student_id)||jsonb_build_object(
    'collectionVersion',2,'eventCount',(select count(*) from public.trial_questions),
    'packTypes',(select jsonb_agg(to_jsonb(t) order by sort_order) from public.trial_pack_types t),
    'packCounts',(select jsonb_object_agg(t.id,case when t.id='basic' then
      coalesce((select packs from public.trial_wallets where student_id=p_student_id),0)
      else coalesce((select quantity from public.trial_pack_inventory where student_id=p_student_id and pack_type=t.id),0) end)
      from public.trial_pack_types t),
    'shinyPercent',(select shiny_percent from public.trial_collection_settings where id),
    'mythPity',(select myth_pity from public.trial_collection_settings where id),
    'pity',coalesce((select jsonb_build_object('counters',counters,'sinceMyth',since_myth)
      from public.trial_pack_pity where student_id=p_student_id),'{"counters":{},"sinceMyth":0}'::jsonb),
    'representatives',coalesce((select jsonb_object_agg(event_id||':'||rarity,effect)
      from public.trial_card_preferences where student_id=p_student_id),'{}'::jsonb),
    'milestones',coalesce((select jsonb_agg(jsonb_build_object('id',milestone,'seen',seen_at is not null)
      order by created_at,milestone) from public.trial_collection_milestones where student_id=p_student_id),'[]'::jsonb));
$$;

create or replace function public.trial_api(p_action text,p_payload jsonb default '{}'::jsonb,p_token text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_auth jsonb; v_student uuid; v_req uuid; v_hash text; v_receipt public.trial_receipts%rowtype;
  v_pack public.trial_pack_types%rowtype; v_cfg public.trial_collection_settings%rowtype;
  v_pity public.trial_pack_pity%rowtype; v_count integer; v_counter integer; v_tier integer;
  v_rarities text[]:=array['normal','rare','unique','legend','myth']; v_effects text[]; v_missing text[];
  v_rarity text; v_effect text; v_q public.trial_questions%rowtype; v_card jsonb; v_data jsonb;
  v_cards jsonb:='[]'; v_opening uuid; v_first uuid; v_roll numeric; v_sum numeric; v_i integer; v_j integer;
  v_bytes bytea; v_total numeric;
begin
  if p_action not in ('pack.open','collection.preference','collection.ack') then
    return public.trial_api_v1(p_action,p_payload,p_token);
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_INPUT'; end if;
  -- Reuse complete session/active-school/student validation. Never accept a client student ID.
  v_auth:=public.trial_api_v1('student.state','{}',p_token);
  select student_id into strict v_student from public.trial_sessions
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  perform 1 from public.students where id=v_student for update;
  -- Revalidate after waiting for the student's lock (e.g. simultaneous logout).
  v_auth:=public.trial_api_v1('student.state','{}',p_token);
  begin v_req:=(p_payload->>'requestId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
  if v_req is null then raise exception 'INVALID_INPUT'; end if;
  v_hash:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
  select * into v_receipt from public.trial_receipts where student_id=v_student and request_id=v_req;
  if found then
    if v_receipt.action<>p_action or v_receipt.payload_hash<>v_hash then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'data',v_receipt.response||jsonb_build_object('replayed',true,'state',public.trial_state(v_student)));
  end if;

  if p_action='collection.preference' then
    if not exists(select 1 from public.trial_cards where student_id=v_student
      and card->>'eventId'=p_payload->>'eventId' and card->>'rarity'=p_payload->>'rarity'
      and card->>'effect'=p_payload->>'effect') then raise exception 'INVALID_INPUT'; end if;
    insert into public.trial_card_preferences(student_id,event_id,rarity,effect)
    values(v_student,p_payload->>'eventId',p_payload->>'rarity',p_payload->>'effect')
    on conflict(student_id,event_id,rarity) do update set effect=excluded.effect;
    v_data:=jsonb_build_object('saved',true);
  elsif p_action='collection.ack' then
    update public.trial_collection_milestones set seen_at=coalesce(seen_at,now())
    where student_id=v_student and milestone=p_payload->>'milestone';
    v_data:=jsonb_build_object('saved',true);
  else
    select * into v_pack from public.trial_pack_types where id=coalesce(p_payload->>'packType','basic');
    if not found then raise exception 'INVALID_INPUT'; end if;
    if coalesce(p_payload->>'count','1')!~'^[0-9]{1,3}$' then raise exception 'INVALID_INPUT'; end if;
    v_count:=coalesce((p_payload->>'count')::integer,1);
    if v_count<1 or v_count>100 then raise exception 'INVALID_INPUT'; end if;
    select * into strict v_cfg from public.trial_collection_settings where id;
    if v_pack.id='basic' then
      update public.trial_wallets set packs=packs-v_count where student_id=v_student and packs>=v_count;
    else
      update public.trial_pack_inventory set quantity=quantity-v_count
      where student_id=v_student and pack_type=v_pack.id and quantity>=v_count;
    end if;
    if not found then raise exception 'PACK_EMPTY'; end if;
    insert into public.trial_pack_pity(student_id) values(v_student) on conflict do nothing;
    select * into v_pity from public.trial_pack_pity where student_id=v_student;
    v_counter:=coalesce((v_pity.counters->>v_pack.id)::integer,0);
    for v_i in 1..v_count loop
      v_bytes:=extensions.gen_random_bytes(4);
      v_roll:=(get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)*65536+get_byte(v_bytes,2)*256+get_byte(v_bytes,3))::numeric/4294967296;
      select sum(value::numeric) into v_total from jsonb_array_elements_text(v_pack.weights);
      if v_total<=0 or jsonb_array_length(v_pack.weights)<>5 then raise exception 'INVALID_INPUT'; end if;
      v_roll:=v_roll*v_total; v_sum:=0; v_tier:=5;
      for v_j in 0..4 loop
        v_sum:=v_sum+(v_pack.weights->>v_j)::numeric;
        if v_roll<v_sum then v_tier:=v_j+1; exit; end if;
      end loop;
      v_counter:=v_counter+1; v_pity.since_myth:=v_pity.since_myth+1;
      if not v_pack.fixed then
        if v_pack.pity_at>0 and v_counter>=v_pack.pity_at then
          v_tier:=greatest(v_tier,array_position(v_rarities,v_pack.pity_tier));
        end if;
        if v_pity.since_myth>=v_cfg.myth_pity then v_tier:=5; end if;
      end if;
      if v_tier>=array_position(v_rarities,v_pack.pity_tier) then v_counter:=0; end if;
      if v_tier=5 then v_pity.since_myth:=0; end if;
      v_rarity:=v_rarities[v_tier];
      select * into strict v_q from public.trial_questions order by extensions.gen_random_bytes(8) limit 1;
      v_effect:='normal'; v_bytes:=extensions.gen_random_bytes(4);
      v_roll:=(get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)*65536+get_byte(v_bytes,2)*256+get_byte(v_bytes,3))::numeric/4294967296*100;
      if v_roll<v_cfg.shiny_percent then
        v_effects:=public.trial_effects(v_rarity);
        select array_agg(e) into v_missing from unnest(v_effects) e where not exists(
          select 1 from public.trial_cards c where c.student_id=v_student
          and c.card->>'eventId'=v_q.id and c.card->>'rarity'=v_rarity and c.card->>'effect'=e);
        v_effects:=coalesce(v_missing,v_effects);
        select e into v_effect from unnest(v_effects) e order by extensions.gen_random_bytes(8) limit 1;
      end if;
      v_card:=jsonb_build_object('eventId',v_q.id,'title',v_q.title,'image',v_q.image,
        'rarity',v_rarity,'effect',v_effect,'testOnly',true);
      insert into public.trial_cards(student_id,card_key,card,quantity)
      values(v_student,v_q.id||':'||v_rarity||':'||v_effect,v_card,1)
      on conflict(student_id,card_key) do update set quantity=public.trial_cards.quantity+1;
      insert into public.trial_openings(student_id,card) values(v_student,v_card) returning id into v_opening;
      v_first:=coalesce(v_first,v_opening); v_cards:=v_cards||jsonb_build_array(v_card);
    end loop;
    update public.trial_pack_pity set counters=jsonb_set(v_pity.counters,array[v_pack.id],to_jsonb(v_counter)),
      since_myth=v_pity.since_myth where student_id=v_student;
    perform public.trial_record_completions(v_student);
    v_data:=jsonb_build_object('openingId',v_first,'card',v_cards->0,'cards',v_cards,'packType',v_pack.id,'count',v_count);
  end if;
  v_data:=v_data||jsonb_build_object('state',public.trial_state(v_student));
  insert into public.trial_receipts(student_id,request_id,action,payload_hash,response)
    values(v_student,v_req,p_action,v_hash,v_data);
  return jsonb_build_object('ok',true,'data',v_data);
end $$;

do $$ declare f record; s record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('trial_api','trial_api_v1','trial_state','trial_state_v1','trial_effects','trial_record_completions') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.sig);
    execute format('grant execute on function %s to service_role',f.sig);
  end loop;
  for s in select distinct student_id from public.trial_cards loop
    perform public.trial_record_completions(s.student_id);
  end loop;
end $$;
commit;
select count(*) as pack_types, 'collection-v2' as collection_version from public.trial_pack_types;

-- Atomic game completion and pack opening.
-- Run once in the Supabase SQL Editor after migrations 001-003.

alter table public.game_attempts
  add column if not exists challenge text;

create table if not exists public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  unit_id text not null references public.units(id),
  pack_id text not null,
  card_id text not null references public.card_catalog(id),
  effect text not null default 'normal',
  created_at timestamptz not null default now()
);

alter table public.pack_openings enable row level security;
create index if not exists pack_openings_student_created_idx
  on public.pack_openings(student_id, created_at desc);

-- The first test catalog. Images can be attached later without changing rewards.
insert into public.card_catalog (id, unit_id, event_id, title, rarity)
values
  ('fr-estates-general-normal', 'fr-revolution', 'estates-general', '삼부회 소집', 'normal'),
  ('fr-tennis-court-normal', 'fr-revolution', 'tennis-court', '테니스 코트의 서약', 'normal'),
  ('fr-bastille-normal', 'fr-revolution', 'bastille', '바스티유 감옥 습격', 'normal'),
  ('fr-rights-rare', 'fr-revolution', 'rights', '인간과 시민의 권리 선언', 'rare'),
  ('fr-republic-rare', 'fr-revolution', 'republic', '프랑스 공화정 수립', 'rare'),
  ('fr-louis-unique', 'fr-revolution', 'louis-execution', '루이 16세 처형', 'unique'),
  ('fr-thermidor-legend', 'fr-revolution', 'thermidor', '테르미도르의 반동', 'legend'),
  ('fr-napoleon-myth', 'fr-revolution', 'napoleon', '나폴레옹의 등장', 'myth')
on conflict (id) do update
set title = excluded.title,
    rarity = excluded.rarity,
    active = true;

-- Temporary test defaults: completing each mode for the first time grants one
-- general pack. Teachers will be able to change this later from the admin UI.
update public.games
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'completionReward', jsonb_build_object(
    'type', 'pack',
    'packId', 'general',
    'quantity', 1,
    'firstCompletionOnly', true
  )
)
where unit_id = 'fr-revolution'
  and not (coalesce(settings, '{}'::jsonb) ? 'completionReward');

create or replace function public.complete_game_attempt(
  p_student_id uuid,
  p_attempt_id uuid,
  p_request_id uuid,
  p_elapsed_ms integer,
  p_correct_count integer,
  p_total_count integer,
  p_error_count integer,
  p_hint_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.game_attempts%rowtype;
  v_game public.games%rowtype;
  v_server_elapsed integer;
  v_pack_id text;
  v_pack_qty integer;
  v_first_only boolean;
  v_previous_count integer;
  v_rewarded boolean := false;
begin
  if p_elapsed_ms < 0 or p_correct_count < 0 or p_total_count < 1
     or p_correct_count > p_total_count or p_error_count < 0 or p_hint_count < 0 then
    raise exception using errcode = '22023', message = 'INVALID_COMPLETION';
  end if;

  select * into v_attempt
  from public.game_attempts
  where id = p_attempt_id and student_id = p_student_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.status = 'completed' then
    return jsonb_build_object(
      'attemptId', v_attempt.id,
      'alreadyCompleted', true,
      'rewarded', exists(select 1 from public.reward_ledger r where r.attempt_id = v_attempt.id),
      'elapsedMs', v_attempt.elapsed_ms
    );
  end if;

  if v_attempt.status <> 'started' then
    raise exception using errcode = '22023', message = 'ATTEMPT_NOT_ACTIVE';
  end if;

  select * into v_game from public.games where id = v_attempt.game_id and active;
  if not found then
    raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND';
  end if;

  v_server_elapsed := greatest(0, floor(extract(epoch from (clock_timestamp() - v_attempt.started_at)) * 1000)::integer);
  if p_elapsed_ms > v_server_elapsed + 15000 then
    raise exception using errcode = '22023', message = 'INVALID_ELAPSED_TIME';
  end if;

  update public.game_attempts
  set status = 'completed',
      elapsed_ms = greatest(p_elapsed_ms, least(v_server_elapsed, p_elapsed_ms + 15000)),
      answer_summary = jsonb_build_object('correct', p_correct_count, 'total', p_total_count),
      score = round((p_correct_count::numeric / p_total_count::numeric) * 100, 2),
      error_count = p_error_count,
      hint_count = p_hint_count,
      official = (p_correct_count = p_total_count),
      completed_at = now()
  where id = v_attempt.id;

  update public.student_progress
  set progress = jsonb_set(
        jsonb_set(coalesce(progress, '{}'::jsonb), array['completed', v_game.id], to_jsonb(now()), true),
        '{lastGameId}', to_jsonb(v_game.id), true
      ),
      updated_at = now()
  where student_id = p_student_id and unit_id = v_game.unit_id;

  if not found then
    insert into public.student_progress(student_id, unit_id, progress)
    values (
      p_student_id,
      v_game.unit_id,
      jsonb_build_object('completed', jsonb_build_object(v_game.id, now()), 'lastGameId', v_game.id)
    );
  end if;

  v_pack_id := coalesce(v_game.settings #>> '{completionReward,packId}', 'general');
  v_pack_qty := greatest(0, coalesce((v_game.settings #>> '{completionReward,quantity}')::integer, 0));
  v_first_only := coalesce((v_game.settings #>> '{completionReward,firstCompletionOnly}')::boolean, true);

  select count(*) into v_previous_count
  from public.game_attempts
  where student_id = p_student_id
    and game_id = v_game.id
    and status = 'completed'
    and id <> v_attempt.id;

  if p_correct_count = p_total_count and v_pack_qty > 0 and (not v_first_only or v_previous_count = 0) then
    insert into public.reward_ledger(
      request_id, student_id, unit_id, attempt_id, reward_type, reward_key, amount, detail
    ) values (
      p_request_id, p_student_id, v_game.unit_id, v_attempt.id, 'pack', v_pack_id, v_pack_qty,
      jsonb_build_object('gameId', v_game.id, 'reason', 'completion')
    ) on conflict (request_id) do nothing;

    if found then
      insert into public.pack_inventory(student_id, unit_id, pack_id, quantity)
      values (p_student_id, v_game.unit_id, v_pack_id, v_pack_qty)
      on conflict (student_id, unit_id, pack_id) do update
      set quantity = public.pack_inventory.quantity + excluded.quantity,
          updated_at = now();
      v_rewarded := true;
    end if;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'alreadyCompleted', false,
    'official', p_correct_count = p_total_count,
    'rewarded', v_rewarded,
    'reward', case when v_rewarded then jsonb_build_object('type','pack','packId',v_pack_id,'quantity',v_pack_qty) else null end,
    'elapsedMs', greatest(p_elapsed_ms, least(v_server_elapsed, p_elapsed_ms + 15000))
  );
end;
$$;

create or replace function public.open_student_pack(
  p_student_id uuid,
  p_unit_id text,
  p_pack_id text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.pack_openings%rowtype;
  v_roll numeric;
  v_rarity text;
  v_effect text;
  v_card public.card_catalog%rowtype;
  v_remaining integer;
begin
  select * into v_existing from public.pack_openings where request_id = p_request_id;
  if found then
    select * into v_card from public.card_catalog where id = v_existing.card_id;
    return jsonb_build_object(
      'alreadyOpened', true,
      'card', jsonb_build_object('id',v_card.id,'title',v_card.title,'rarity',v_card.rarity,'effect',v_existing.effect,'imagePath',v_card.image_path)
    );
  end if;

  update public.pack_inventory
  set quantity = quantity - 1, updated_at = now()
  where student_id = p_student_id and unit_id = p_unit_id and pack_id = p_pack_id and quantity > 0
  returning quantity into v_remaining;
  if not found then
    raise exception using errcode = '22023', message = 'PACK_EMPTY';
  end if;

  v_roll := random();
  v_rarity := case
    when v_roll < 0.01 then 'myth'
    when v_roll < 0.05 then 'legend'
    when v_roll < 0.15 then 'unique'
    when v_roll < 0.40 then 'rare'
    else 'normal'
  end;

  select * into v_card
  from public.card_catalog
  where unit_id = p_unit_id and rarity = v_rarity and active
  order by random()
  limit 1;

  -- If a rarity has no card yet, fall back to any active card in the unit.
  if not found then
    select * into v_card from public.card_catalog
    where unit_id = p_unit_id and active
    order by random() limit 1;
  end if;
  if not found then
    raise exception using errcode = 'P0002', message = 'CARD_CATALOG_EMPTY';
  end if;

  v_effect := case when random() < 0.01 then 'shiny' else 'normal' end;

  insert into public.pack_openings(request_id, student_id, unit_id, pack_id, card_id, effect)
  values (p_request_id, p_student_id, p_unit_id, p_pack_id, v_card.id, v_effect);

  insert into public.student_cards(student_id, card_id, effect, quantity, first_acquired_at)
  values (p_student_id, v_card.id, v_effect, 1, now())
  on conflict (student_id, card_id, effect) do update
  set quantity = public.student_cards.quantity + 1,
      updated_at = now();

  return jsonb_build_object(
    'alreadyOpened', false,
    'remaining', v_remaining,
    'card', jsonb_build_object('id',v_card.id,'title',v_card.title,'rarity',v_card.rarity,'effect',v_effect,'imagePath',v_card.image_path)
  );
end;
$$;

revoke all on function public.complete_game_attempt(uuid,uuid,uuid,integer,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.open_student_pack(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.complete_game_attempt(uuid,uuid,uuid,integer,integer,integer,integer,integer) to service_role;
grant execute on function public.open_student_pack(uuid,text,text,uuid) to service_role;

grant all privileges on table public.pack_openings to service_role;

select
  (select count(*) from public.card_catalog where unit_id = 'fr-revolution') as cards,
  (select count(*) from public.games where unit_id = 'fr-revolution' and settings ? 'completionReward') as games_with_rewards;

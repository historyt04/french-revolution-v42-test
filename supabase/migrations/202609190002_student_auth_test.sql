-- Student credential verification and one fake student for the first speed test.
-- Test login: 동주중학교 / 2026 / 2학년 / 4반 / 4번 / 12345

create or replace function public.verify_student_credentials(
  p_school_id text,
  p_year integer,
  p_grade integer,
  p_class_no integer,
  p_student_no integer,
  p_code text
)
returns table(student_id uuid, session_version integer)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.session_version
  from public.students s
  join public.classes c on c.id = s.class_id
  join public.school_years sy on sy.id = c.school_year_id
  join public.schools sc on sc.id = sy.school_id
  where sc.id = p_school_id
    and sc.active
    and sy.year = p_year
    and sy.active
    and c.grade = p_grade
    and c.class_no = p_class_no
    and c.active
    and s.student_no = p_student_no
    and s.active
    and s.access_code_hash = extensions.crypt(p_code, s.access_code_hash)
  limit 1;
$$;

revoke all on function public.verify_student_credentials(text,integer,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.verify_student_credentials(text,integer,integer,integer,integer,text) to service_role;

with target_year as (
  select id from public.school_years where school_id = 'dongju-middle' and year = 2026
)
insert into public.classes (school_year_id, grade, class_no)
select id, 2, 4 from target_year
on conflict (school_year_id, grade, class_no) do nothing;

with target_class as (
  select c.id
  from public.classes c
  join public.school_years sy on sy.id = c.school_year_id
  where sy.school_id = 'dongju-middle' and sy.year = 2026 and c.grade = 2 and c.class_no = 4
)
insert into public.students (class_id, student_no, name, nickname, access_code_hash, legacy_id)
select id, 4, '홍길동', null, extensions.crypt('12345', extensions.gen_salt('bf', 10)), 'TEST-2026-2-4-4'
from target_class
on conflict (class_id, student_no) do update
set name = excluded.name,
    access_code_hash = excluded.access_code_hash,
    active = true;

insert into public.student_progress (student_id, unit_id, progress)
select id, 'fr-revolution', '{"lastView":"results","completed":{}}'::jsonb
from public.students
where legacy_id = 'TEST-2026-2-4-4'
on conflict (student_id, unit_id) do nothing;

select s.name, sy.year, c.grade, c.class_no, s.student_no
from public.students s
join public.classes c on c.id = s.class_id
join public.school_years sy on sy.id = c.school_year_id
where s.legacy_id = 'TEST-2026-2-4-4';

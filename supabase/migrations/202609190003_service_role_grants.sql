-- Allow only the trusted server-side service role to operate the application schema.
-- RLS remains enabled for browser-facing roles (anon/authenticated).

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

select
  has_table_privilege('service_role', 'public.schools', 'select') as can_read_schools,
  has_table_privilege('service_role', 'public.app_sessions', 'insert') as can_create_sessions,
  has_function_privilege(
    'service_role',
    'public.verify_student_credentials(text,integer,integer,integer,integer,text)',
    'execute'
  ) as can_verify_students;

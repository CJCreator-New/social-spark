-- One-shot: promote a specific user to admin in public.admin_users
-- Replace <OWNER_UUID> with the auth.users.id of the user you want to promote.
-- This file is intentionally idempotent: it will not insert duplicates.

insert into public.admin_users (user_id)
select '<OWNER_UUID>'::uuid
where not exists (select 1 from public.admin_users where user_id = '<OWNER_UUID>'::uuid);

-- To run manually, replace <OWNER_UUID> and run via psql or supabase SQL editor.

-- F-005: admin_users grants INSERT/UPDATE/DELETE to `authenticated`, relying
-- solely on the "Super admin can manage admin users" RLS policy for
-- protection. This is a defense-in-depth gap: if that single policy is ever
-- weakened or dropped, every authenticated user gains direct mutation rights
-- on the table that grants admin dashboard access. Revoke the table-level
-- grant and restrict mutations to service_role, keeping SELECT for the
-- existing "view own admin status" query.

REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_users TO service_role;

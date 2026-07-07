-- Code-duplication cleanup: "Admins read all payments" (20260616000000)
-- inlines the same two EXISTS checks that public.is_admin() (added later, in
-- 20260617000000_admin_comp_grants.sql) already centralizes. Replace the
-- inline pattern with is_admin() so admin-check logic has one definition.

DROP POLICY IF EXISTS "Admins read all payments" ON public.payments;
CREATE POLICY "Admins read all payments"
  ON public.payments
  FOR SELECT
  USING (public.is_admin());

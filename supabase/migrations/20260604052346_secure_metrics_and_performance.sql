-- Enable Row Level Security on API metrics and query performance logging tables.
-- Restrict SELECT and INSERT to authenticated/admin roles properly.

ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.api_metrics
CREATE POLICY "Authenticated users can insert metrics"
ON public.api_metrics FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can select metrics"
ON public.api_metrics FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for public.query_performance
CREATE POLICY "Authenticated users can insert query performance"
ON public.query_performance FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can select query performance"
ON public.query_performance FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Redefine shared_templates view with security_invoker = true to enforce RLS
DROP VIEW IF EXISTS public.shared_templates;

CREATE VIEW public.shared_templates WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  name,
  description,
  config,
  created_at,
  updated_at
FROM public.templates
WHERE is_shared = true
ORDER BY created_at DESC;

GRANT SELECT ON public.shared_templates TO authenticated;

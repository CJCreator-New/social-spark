-- Migration: API Key Security Hardening
-- Created: 2026-06-09
-- Purpose: Tighten RLS policies, create audit log, and configure admin view.

-- 1. Create api_key_audit_log Table
CREATE TABLE IF NOT EXISTS public.api_key_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('saved', 'deleted', 'used', 'toggled')),
  provider   TEXT,
  source     TEXT CHECK (source IN ('platform', 'user')),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Define RLS Policies for api_key_audit_log

-- Policy Comment: Users can only select their own audit log rows to track their history.
-- Intent: Ensure user privacy and self-auditing.
CREATE POLICY "Users read own audit log"
  ON public.api_key_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy Comment: Admins can view audit logs for all users to monitor system behavior and troubleshoot fallback key usage.
-- Intent: Allow system operators visibility into fallback metrics without key exposure.
CREATE POLICY "Admins read all audit logs"
  ON public.api_key_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    )
  );

-- Policy Comment: Blocks all client-side inserts. Inserts are permitted only via server-side/Edge Functions using the service role client.
-- Intent: Ensure audit logs cannot be spoofed or deleted by the user client.
CREATE POLICY "Service role inserts only"
  ON public.api_key_audit_log
  FOR INSERT
  WITH CHECK (false);

-- Grant select permission
GRANT SELECT ON public.api_key_audit_log TO authenticated;


-- 3. Review and Redefine RLS Policies for user_settings with Audit Comments

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own user settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own user settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own user settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own user settings" ON public.user_settings;

-- Policy Comment: Users can only select their own row in user_settings.
-- Intent: Prevent cross-user data leakage of settings.
CREATE POLICY "Users can view own user settings" 
  ON public.user_settings
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy Comment: Users can insert their own row in user_settings.
-- Intent: Allow initial configuration of provider preference and fallback toggle.
CREATE POLICY "Users can insert own user settings" 
  ON public.user_settings
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy Comment: Users can update their own settings.
-- Intent: Allow changing provider, fallback toggles, and encrypted key metadata.
CREATE POLICY "Users can update own user settings" 
  ON public.user_settings
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy Comment: Users can delete their own settings row.
-- Intent: Support user rights to purge their settings and keys completely.
CREATE POLICY "Users can delete own user settings" 
  ON public.user_settings
  FOR DELETE 
  USING (auth.uid() = user_id);


-- 4. Exclude user_settings and api_key_audit_log from Supabase Realtime Publications
-- Intent: Prevent broadcasting encrypted keys or key usage patterns over web sockets.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'user_settings'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.user_settings;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'api_key_audit_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.api_key_audit_log;
    END IF;
  END IF;
END $$;


-- 5. Create admin_user_key_status View
-- Intent: Provide a secure, read-only metadata view of API key status without exposing the encrypted credentials.
-- Only accessible to users with the 'admin' role in user_roles or admin_users.
CREATE OR REPLACE VIEW public.admin_user_key_status AS
SELECT 
  user_id,
  api_provider,
  use_own_key,
  (api_key_enc IS NOT NULL) AS has_own_key,
  updated_at
FROM public.user_settings
WHERE (
  EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  )
);

-- Grant select permission on the view to authenticated users
GRANT SELECT ON public.admin_user_key_status TO authenticated;

-- Corrective / defensive migration.
--
-- Why this migration exists:
-- Two prior migrations both used `CREATE TABLE IF NOT EXISTS` for
-- `public.rate_limit_events` and `public.telemetry_events`, but defined the
-- `id` column with CONFLICTING types:
--   - 20260708144216_1623bd01-1959-41bc-b796-95e65d8b307a.sql
--       -> id bigserial primary key
--   - 20260711000000_fix_live_ai_pipeline_issues.sql
--       -> id uuid primary key default gen_random_uuid()
--
-- Because `CREATE TABLE IF NOT EXISTS` is a no-op when the table already
-- exists, whichever migration ran first (by timestamp order, 20260708 before
-- 20260711) "won" the CREATE TABLE — only its column shape actually took
-- effect. The 20260711 migration's own CREATE TABLE silently did nothing on
-- a system where 20260708 had already run; only its trailing GRANT/POLICY/
-- INDEX statements executed against the table shape 20260708 created.
--
-- The generated `src/integrations/supabase/types.ts` (produced from the live
-- schema via `supabase gen types`) shows `id: number` for both tables,
-- confirming the bigserial/bigint shape from 20260708 is what is actually
-- live today, and no application code (checked `src/` and
-- `supabase/functions/`) inserts or reads these `id` columns as UUID
-- strings — both tables are treated as opaque, service-role-only event logs
-- keyed by (user_id, endpoint/event_name, created_at), never by `id`. So
-- bigint/bigserial is the canonical/target type going forward.
--
-- This migration is written to be a safe no-op on any of these three states:
--   (a) only 20260708 ran (id is already bigint)         -> no-op
--   (b) both ran, 20260708 won the race (id is bigint)    -> no-op
--   (c) hypothetically only 20260711's shape exists (uuid) -> converts to
--       bigint, dropping the old uuid default/values (this event-log data is
--       disposable telemetry/rate-limit history, not a table depended on for
--       referential integrity elsewhere)
-- It also reconciles the two differently-named, functionally-overlapping
-- "admin can read all telemetry" policies (`"Admins read telemetry"` from
-- 20260708 vs `"Admins can view all telemetry"` from 20260711) down to a
-- single canonical policy, and is safe to run whether zero, one, or both of
-- those policy names currently exist.

-- ── 1. Normalize rate_limit_events.id to bigint ────────────────────────────
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'rate_limit_events'
    AND column_name = 'id';

  IF current_type IS NULL THEN
    -- Table doesn't exist yet on this system for some reason; nothing to
    -- normalize (a normal CREATE TABLE migration would be responsible for
    -- creating it, not this corrective migration).
    RAISE NOTICE 'rate_limit_events does not exist; skipping id normalization';
  ELSIF current_type IN ('bigint', 'integer', 'smallint') THEN
    RAISE NOTICE 'rate_limit_events.id is already %; no-op', current_type;
  ELSE
    RAISE NOTICE 'rate_limit_events.id is %; converting to bigint', current_type;

    -- Drop the uuid default before altering type (a uuid default expression
    -- is not valid once the column becomes bigint).
    ALTER TABLE public.rate_limit_events ALTER COLUMN id DROP DEFAULT;

    -- Disposable event-log data: reassign fresh bigint identity values via a
    -- deterministic row_number() ordering rather than trying to cast the old
    -- uuid text into a number.
    ALTER TABLE public.rate_limit_events
      ALTER COLUMN id TYPE bigint
      USING (row_number() OVER (ORDER BY created_at, id))::bigint;

    -- Recreate the bigserial-style identity (sequence + default + ownership)
    -- so future inserts auto-increment the same way 20260708's shape did.
    CREATE SEQUENCE IF NOT EXISTS public.rate_limit_events_id_seq
      OWNED BY public.rate_limit_events.id;
    PERFORM setval(
      'public.rate_limit_events_id_seq',
      COALESCE((SELECT max(id) FROM public.rate_limit_events), 0) + 1,
      false
    );
    ALTER TABLE public.rate_limit_events
      ALTER COLUMN id SET DEFAULT nextval('public.rate_limit_events_id_seq');
    GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;
  END IF;
END $$;

-- ── 2. Normalize telemetry_events.id to bigint ──────────────────────────────
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'telemetry_events'
    AND column_name = 'id';

  IF current_type IS NULL THEN
    RAISE NOTICE 'telemetry_events does not exist; skipping id normalization';
  ELSIF current_type IN ('bigint', 'integer', 'smallint') THEN
    RAISE NOTICE 'telemetry_events.id is already %; no-op', current_type;
  ELSE
    RAISE NOTICE 'telemetry_events.id is %; converting to bigint', current_type;

    ALTER TABLE public.telemetry_events ALTER COLUMN id DROP DEFAULT;

    ALTER TABLE public.telemetry_events
      ALTER COLUMN id TYPE bigint
      USING (row_number() OVER (ORDER BY created_at, id))::bigint;

    CREATE SEQUENCE IF NOT EXISTS public.telemetry_events_id_seq
      OWNED BY public.telemetry_events.id;
    PERFORM setval(
      'public.telemetry_events_id_seq',
      COALESCE((SELECT max(id) FROM public.telemetry_events), 0) + 1,
      false
    );
    ALTER TABLE public.telemetry_events
      ALTER COLUMN id SET DEFAULT nextval('public.telemetry_events_id_seq');
    GRANT USAGE, SELECT ON SEQUENCE public.telemetry_events_id_seq TO service_role;
  END IF;
END $$;

-- ── 3. Reconcile duplicate admin-read policies on telemetry_events ─────────
-- Keep a single canonical policy name/definition. Prefer
-- "Admins can view all telemetry" (the has_role()-based check from
-- 20260711, which is the more current admin-role convention used elsewhere
-- in this codebase — see public.has_role()) and drop the older
-- "Admins read telemetry" (is_admin()-based) policy if it exists, so a
-- system where both migrations ran does not carry two redundant SELECT
-- policies for the same access pattern.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telemetry_events'
      AND policyname = 'Admins read telemetry'
  ) THEN
    DROP POLICY "Admins read telemetry" ON public.telemetry_events;
  END IF;
END $$;

-- Ensure the canonical policy exists (idempotent: replace if already present).
DROP POLICY IF EXISTS "Admins can view all telemetry" ON public.telemetry_events;
CREATE POLICY "Admins can view all telemetry"
  ON public.telemetry_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================================
-- F-007 regression — SECURITY DEFINER functions must not leak cross-user data
-- and must reject non-admin callers for admin-only effects.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(4);

-- ---------------------------------------------------------------------------
-- Fixtures: two users each with their own BYOK settings row.
-- ---------------------------------------------------------------------------
INSERT INTO user_settings (user_id, api_provider, use_own_key)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'openai', true),
  ('b0000000-0000-0000-0000-000000000002', 'anthropic', true)
ON CONFLICT (user_id) DO UPDATE
  SET api_provider = EXCLUDED.api_provider, use_own_key = EXCLUDED.use_own_key;

-- ---------------------------------------------------------------------------
-- Test 1: get_decrypted_api_key() as user A never returns user B's provider.
-- get_decrypted_api_key() takes no arguments and derives the row strictly
-- from auth.uid() (see 20260703090000_repair_byok_rpc_grants.sql), so this
-- guards against a future edit that parameterizes it with a user id argument
-- and forgets to enforce auth.uid() = p_user_id.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT api_provider FROM get_decrypted_api_key() LIMIT 1),
  'openai',
  'Test 1: get_decrypted_api_key() as user A returns only user A''s provider'
);

RESET role;

SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT api_provider FROM get_decrypted_api_key() LIMIT 1),
  'anthropic',
  'Test 2: get_decrypted_api_key() as user B returns only user B''s provider (not A''s)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 3: admin_calendar_stats() rejects a non-admin caller.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$SELECT admin_calendar_stats()$$,
  'P0001',
  'Not authorized',
  'Test 3: non-admin cannot call admin_calendar_stats()'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 4: admin_grant_tier() rejects a non-admin caller (defense-in-depth
-- duplicate of api_key_rls.test.sql Test 12, kept here so all SECURITY
-- DEFINER admin-gate regressions live in one file).
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$SELECT admin_grant_tier('a0000000-0000-0000-0000-000000000001', 'pro', 300, 30)$$,
  'P0001',
  'Not authorized',
  'Test 4: non-admin cannot call admin_grant_tier()'
);

RESET role;

-- Cleanup test data
DELETE FROM user_settings WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

SELECT * FROM finish();
ROLLBACK;

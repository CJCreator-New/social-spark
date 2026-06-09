-- ============================================================================
-- API Key Security — RLS Integration Tests (pg_tap)
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(7);

-- ---------------------------------------------------------------------------
-- Test 1: User cannot read another user's user_settings row
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Insert a row as user A using service role (bypasses RLS)
  INSERT INTO user_settings (user_id, api_provider, use_own_key)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'openai', true)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Now check as user B (simulate via RLS check)
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT COUNT(*)::bigint FROM user_settings
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 1: User B cannot read User A settings via RLS'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 2: user_settings is excluded from supabase_realtime publication
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'user_settings'
  ),
  'Test 2: user_settings excluded from supabase_realtime publication'
);

-- ---------------------------------------------------------------------------
-- Test 3: api_key_audit_log is excluded from supabase_realtime publication
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'api_key_audit_log'
  ),
  'Test 3: api_key_audit_log excluded from supabase_realtime publication'
);

-- ---------------------------------------------------------------------------
-- Test 4: Authenticated role cannot INSERT directly into api_key_audit_log
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$INSERT INTO api_key_audit_log (user_id, action, provider, ip_address)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'saved', 'openai', '127.0.0.1')$$,
  '42501',
  NULL,
  'Test 4: Authenticated role cannot insert audit logs directly (RLS)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 5: Authenticated role cannot UPDATE another user's settings
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

-- Attempt to update user A's row as user B — should affect 0 rows (RLS filters it)
UPDATE user_settings SET use_own_key = false
WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT use_own_key FROM user_settings
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  true,
  'Test 5: User B cannot update User A settings (use_own_key remains true)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 6: api_key_enc column is NOT readable via the admin view
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_user_key_status'
      AND column_name = 'api_key_enc'
  ),
  'Test 6: admin_user_key_status view does NOT expose api_key_enc column'
);

-- ---------------------------------------------------------------------------
-- Test 7: admin_user_key_status view EXISTS
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'admin_user_key_status'
  ),
  'Test 7: admin_user_key_status view exists'
);

-- Cleanup test data
DELETE FROM user_settings WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

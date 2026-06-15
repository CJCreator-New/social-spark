-- ============================================================================
-- API Key Security — RLS Integration Tests (pg_tap)
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(12);

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

-- ---------------------------------------------------------------------------
-- Test 8: payments table is excluded from supabase_realtime publication
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'payments'
  ),
  'Test 8: payments excluded from supabase_realtime publication'
);

-- ---------------------------------------------------------------------------
-- Test 9: User cannot read another user's payments row (RLS)
-- ---------------------------------------------------------------------------
INSERT INTO payments (user_id, razorpay_order_id, amount, currency, status, tier_granted, period_end)
VALUES ('a0000000-0000-0000-0000-000000000001', 'order_test_rls_9', 49900, 'INR', 'paid', 'pro', now() + interval '30 days')
ON CONFLICT (razorpay_order_id) DO NOTHING;

SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT COUNT(*)::bigint FROM payments
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 9: User B cannot read User A payments via RLS'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 10: Authenticated role cannot INSERT into payments directly (RLS)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$INSERT INTO payments (user_id, razorpay_order_id, amount, status)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'order_client_insert', 49900, 'paid')$$,
  '42501',
  NULL,
  'Test 10: Authenticated role cannot insert payments directly (RLS)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 11: grant_tier_from_payment is idempotent on razorpay_order_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_period TIMESTAMPTZ := now() + interval '30 days';
BEGIN
  PERFORM grant_tier_from_payment(
    'a0000000-0000-0000-0000-000000000001', 'pro', 300, v_period,
    'order_idempotent_11', 'pay_idempotent_11', 49900, 'INR'
  );
  -- Second call with same order id must not create a second payments row.
  PERFORM grant_tier_from_payment(
    'a0000000-0000-0000-0000-000000000001', 'pro', 300, v_period,
    'order_idempotent_11', 'pay_idempotent_11', 49900, 'INR'
  );
END $$;

SELECT is(
  (SELECT COUNT(*)::bigint FROM payments WHERE razorpay_order_id = 'order_idempotent_11'),
  1::bigint,
  'Test 11: grant_tier_from_payment does not double-insert for the same order'
);

-- ---------------------------------------------------------------------------
-- Test 12: admin_grant_tier rejects non-admin callers
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$SELECT admin_grant_tier('a0000000-0000-0000-0000-000000000001', 'pro', 300, 30)$$,
  'P0001',
  'Not authorized',
  'Test 12: non-admin cannot comp-grant a tier'
);

RESET role;

-- Cleanup test data
DELETE FROM payments WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM user_settings WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

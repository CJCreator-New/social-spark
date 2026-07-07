-- ============================================================================
-- F-016 regression — increment_generation_count must reset the monthly
-- counter atomically and must not reject trusted service-role callers.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(4);

-- ---------------------------------------------------------------------------
-- Fixture: a user whose stored quota period is from last month.
-- ---------------------------------------------------------------------------
INSERT INTO user_settings (user_id, generation_count, quota_period_start)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  49,
  date_trunc('month', now()) - interval '1 month'
)
ON CONFLICT (user_id) DO UPDATE
  SET generation_count = 49,
      quota_period_start = date_trunc('month', now()) - interval '1 month';

-- ---------------------------------------------------------------------------
-- Test 1: service-role call (auth.uid() IS NULL) is not rejected
-- ---------------------------------------------------------------------------
RESET role;
SELECT lives_ok(
  $$SELECT increment_generation_count('a0000000-0000-0000-0000-000000000001')$$,
  'Test 1: service-role call to increment_generation_count is not rejected'
);

-- ---------------------------------------------------------------------------
-- Test 2: the stale prior-month count was reset to 1, not incremented to 50
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT generation_count FROM user_settings
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'Test 2: crossing into a new month resets generation_count to 1, not 50'
);

-- ---------------------------------------------------------------------------
-- Test 3: quota_period_start was advanced to the current month
-- ---------------------------------------------------------------------------
SELECT ok(
  (SELECT quota_period_start FROM user_settings
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001') >= date_trunc('month', now()),
  'Test 3: quota_period_start is advanced to the current month on reset'
);

-- ---------------------------------------------------------------------------
-- Test 4: an authenticated user cannot increment another user's count
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$SELECT increment_generation_count('a0000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Not authorized',
  'Test 4: authenticated user cannot increment a different user''s quota count'
);

RESET role;

-- Cleanup test data
DELETE FROM user_settings WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

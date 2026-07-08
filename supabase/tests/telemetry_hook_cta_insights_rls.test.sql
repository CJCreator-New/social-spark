-- ============================================================================
-- user_hook_cta_insights() — security-boundary regression
-- Verifies the RPC is strictly self-scoped via auth.uid(): calling it as
-- user A only ever reflects user A's telemetry_events rows, even when user B
-- has rows for the same event types in the same window. Also verifies the
-- byPlatform breakdown and that an unauthenticated caller is rejected.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(5);

-- ---------------------------------------------------------------------------
-- Fixtures: user A has 2 hook_regenerate_clicked events (one per platform)
-- and 1 post_kept event. User B has 5 hook_regenerate_clicked events. Rows
-- are inserted directly (service role bypasses RLS), simulating the
-- telemetry Edge Function's service-role insert.
-- ---------------------------------------------------------------------------
INSERT INTO telemetry_events (event_name, props, user_id, created_at)
VALUES
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'a0000000-0000-0000-0000-000000000001', now()),
  ('hook_regenerate_clicked', '{"platform": "Twitter"}'::jsonb, 'a0000000-0000-0000-0000-000000000001', now()),
  ('post_kept', '{"platform": "LinkedIn"}'::jsonb, 'a0000000-0000-0000-0000-000000000001', now()),
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'b0000000-0000-0000-0000-000000000002', now()),
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'b0000000-0000-0000-0000-000000000002', now()),
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'b0000000-0000-0000-0000-000000000002', now()),
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'b0000000-0000-0000-0000-000000000002', now()),
  ('hook_regenerate_clicked', '{"platform": "LinkedIn"}'::jsonb, 'b0000000-0000-0000-0000-000000000002', now());

-- ---------------------------------------------------------------------------
-- Test 1: user A sees only their own hookRegenerateClicked count (2, not 7).
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT (user_hook_cta_insights(30) ->> 'hookRegenerateClicked')::int),
  2,
  'Test 1: user A''s hookRegenerateClicked count reflects only their own rows'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 2: user A's postKept count is 1 (their own row only).
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT (user_hook_cta_insights(30) ->> 'postKept')::int),
  1,
  'Test 2: user A''s postKept count reflects only their own rows'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 3: user B sees their own hookRegenerateClicked count (5, not 2),
-- proving the boundary is symmetric and not just a fluke of A's data.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT (user_hook_cta_insights(30) ->> 'hookRegenerateClicked')::int),
  5,
  'Test 3: user B''s hookRegenerateClicked count reflects only their own rows'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 4: user A's byPlatform breakdown only aggregates their own rows
-- (LinkedIn: 2 [1 hook_regenerate_clicked + 1 post_kept], Twitter: 1), never
-- user B's 5 LinkedIn rows.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT ((user_hook_cta_insights(30) -> 'byPlatform') ->> 'LinkedIn')::int),
  2,
  'Test 4: user A''s byPlatform LinkedIn count excludes user B''s rows'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 5: an unauthenticated (anon) caller is rejected.
-- ---------------------------------------------------------------------------
SET LOCAL role TO anon;

SELECT throws_ok(
  $$SELECT user_hook_cta_insights(30)$$,
  'P0001',
  'Not authorized',
  'Test 5: anonymous caller cannot invoke user_hook_cta_insights()'
);

RESET role;

-- Cleanup test data
DELETE FROM telemetry_events WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

SELECT * FROM finish();
ROLLBACK;

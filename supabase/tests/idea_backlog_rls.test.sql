-- ============================================================================
-- idea_backlog — RLS regression tests
-- Verifies a user cannot select/insert/update/delete another user's
-- idea_backlog rows, and that the owner retains full CRUD access.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(7);

-- ---------------------------------------------------------------------------
-- Fixture: user A owns one idea_backlog row (inserted via service role,
-- bypassing RLS, to simulate data already present).
-- ---------------------------------------------------------------------------
INSERT INTO idea_backlog (id, user_id, angle, format, rationale, key_points, platform)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Contrarian take on remote work',
  'Contrarian take',
  'Strong hook, timely angle',
  'Point 1; Point 2',
  'LinkedIn'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Test 1: User B cannot SELECT User A's idea_backlog row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT COUNT(*)::bigint FROM idea_backlog
   WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 1: User B cannot read User A idea_backlog row via RLS'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 2: User B cannot INSERT a row claiming to belong to User A
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$INSERT INTO idea_backlog (user_id, angle)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Hijacked idea')$$,
  '42501',
  NULL,
  'Test 2: User B cannot insert an idea_backlog row for User A'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 3/4: User B cannot UPDATE User A's row (RLS filters it — 0 rows
-- affected, original angle unchanged)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

UPDATE idea_backlog SET angle = 'Hijacked angle'
WHERE id = 'e0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT angle FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'Contrarian take on remote work',
  'Test 3: idea_backlog row remains unchanged after User B update attempt'
);

-- ---------------------------------------------------------------------------
-- Test 4: owner cannot reassign user_id to another user via UPDATE
-- (WITH CHECK regression)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$UPDATE idea_backlog SET user_id = 'b0000000-0000-0000-0000-000000000002'
    WHERE id = 'e0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'Test 4: owner cannot reassign idea_backlog.user_id to another user'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 5: User B cannot DELETE User A's row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

DELETE FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001';

RESET role;

SELECT ok(
  EXISTS (SELECT 1 FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'Test 5: idea_backlog row survives User B delete attempt'
);

-- ---------------------------------------------------------------------------
-- Test 6/7: legitimate owner retains full CRUD on their own row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

UPDATE idea_backlog SET used_at = now()
WHERE id = 'e0000000-0000-0000-0000-000000000001';

RESET role;

SELECT ok(
  (SELECT used_at FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001') IS NOT NULL,
  'Test 6: owner can update their own idea_backlog row'
);

SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

DELETE FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT COUNT(*)::bigint FROM idea_backlog WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 7: owner can delete their own idea_backlog row'
);

-- Cleanup test data
DELETE FROM idea_backlog WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

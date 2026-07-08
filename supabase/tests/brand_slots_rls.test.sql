-- ============================================================================
-- brand_slots — RLS regression tests
-- Verifies a user cannot select/insert/update/delete another user's
-- brand_slots rows, that the UPDATE policy's WITH CHECK blocks reassigning
-- user_id, and that the partial unique index prevents two is_default = true
-- rows for the same user.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(9);

-- ---------------------------------------------------------------------------
-- Fixture: user A owns one brand_slots row (inserted via service role,
-- bypassing RLS, to simulate data already present).
-- ---------------------------------------------------------------------------
INSERT INTO brand_slots (id, user_id, name, is_default, forbidden_phrases, proof_points)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Default',
  true,
  ARRAY['synergy'],
  ARRAY['10 years in business']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Test 1: User B cannot SELECT User A's brand_slots row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT is(
  (SELECT COUNT(*)::bigint FROM brand_slots
   WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 1: User B cannot read User A brand_slots row via RLS'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 2: User B cannot INSERT a row claiming to belong to User A
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$INSERT INTO brand_slots (user_id, name)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Hijacked slot')$$,
  '42501',
  NULL,
  'Test 2: User B cannot insert a brand_slots row for User A'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 3: User B cannot UPDATE User A's row (RLS filters it — 0 rows
-- affected, original name unchanged)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

UPDATE brand_slots SET name = 'Hijacked name'
WHERE id = 'f0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT name FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'Default',
  'Test 3: brand_slots row remains unchanged after User B update attempt'
);

-- ---------------------------------------------------------------------------
-- Test 4: owner cannot reassign user_id to another user via UPDATE
-- (WITH CHECK regression)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$UPDATE brand_slots SET user_id = 'b0000000-0000-0000-0000-000000000002'
    WHERE id = 'f0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'Test 4: owner cannot reassign brand_slots.user_id to another user'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 5: User B cannot DELETE User A's row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'b0000000-0000-0000-0000-000000000002';
SET LOCAL role TO authenticated;

DELETE FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001';

RESET role;

SELECT ok(
  EXISTS (SELECT 1 FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'Test 5: brand_slots row survives User B delete attempt'
);

-- ---------------------------------------------------------------------------
-- Test 6/7: legitimate owner retains full CRUD on their own row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

UPDATE brand_slots SET name = 'Renamed'
WHERE id = 'f0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT name FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'Renamed',
  'Test 6: owner can update their own brand_slots row'
);

-- ---------------------------------------------------------------------------
-- Test 7: partial unique index prevents a second is_default = true row for
-- the same user, via a fresh INSERT while one already exists.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$INSERT INTO brand_slots (user_id, name, is_default)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Second default', true)$$,
  '23505',
  NULL,
  'Test 7: second is_default=true row for the same user is rejected (unique violation)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 8: partial unique index also blocks flipping a second, non-default
-- row to is_default = true via UPDATE while one already exists.
-- ---------------------------------------------------------------------------
INSERT INTO brand_slots (id, user_id, name, is_default)
VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Secondary',
  false
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$UPDATE brand_slots SET is_default = true
    WHERE id = 'f0000000-0000-0000-0000-000000000002'$$,
  '23505',
  NULL,
  'Test 8: updating a second row to is_default=true is rejected (unique violation)'
);

RESET role;

-- ---------------------------------------------------------------------------
-- Test 9: owner can delete their own row
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

DELETE FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT COUNT(*)::bigint FROM brand_slots WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Test 9: owner can delete their own brand_slots row'
);

-- Cleanup test data
DELETE FROM brand_slots WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

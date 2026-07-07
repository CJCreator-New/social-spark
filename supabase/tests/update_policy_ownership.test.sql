-- ============================================================================
-- F-001 regression — UPDATE policies must reject row-ownership hijack
-- (SET user_id = <other user>) via WITH CHECK, not just USING.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

SELECT plan(6);

-- ---------------------------------------------------------------------------
-- Fixtures: user A owns one row in each of the three most exploitable tables.
-- ---------------------------------------------------------------------------
INSERT INTO saved_calendars (id, user_id, title, form_payload, posts)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Test Calendar',
  '{}'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO scheduled_posts (id, user_id, calendar_id, post_day, scheduled_at, post_snapshot)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  1,
  now() + interval '1 day',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wizard_drafts (user_id, snapshot)
VALUES ('a0000000-0000-0000-0000-000000000001', '{}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Test 1/2: owner cannot reassign saved_calendars.user_id to another user
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$UPDATE saved_calendars SET user_id = 'b0000000-0000-0000-0000-000000000002'
    WHERE id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'Test 1: owner cannot reassign saved_calendars.user_id to another user'
);

RESET role;

SELECT is(
  (SELECT user_id FROM saved_calendars WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Test 2: saved_calendars row remains owned by original user'
);

-- ---------------------------------------------------------------------------
-- Test 3/4: owner cannot reassign scheduled_posts.user_id to another user
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

SELECT throws_ok(
  $$UPDATE scheduled_posts SET user_id = 'b0000000-0000-0000-0000-000000000002'
    WHERE id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'Test 3: owner cannot reassign scheduled_posts.user_id to another user'
);

RESET role;

SELECT is(
  (SELECT user_id FROM scheduled_posts WHERE id = 'd0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Test 4: scheduled_posts row remains owned by original user'
);

-- ---------------------------------------------------------------------------
-- Test 5/6: legitimate owner update still works (WITH CHECK does not
-- regress normal same-user updates)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

UPDATE saved_calendars SET title = 'Updated Title'
WHERE id = 'c0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT title FROM saved_calendars WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  'Updated Title',
  'Test 5: owner can still update their own saved_calendars row'
);

SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SET LOCAL role TO authenticated;

UPDATE wizard_drafts SET snapshot = '{"step":2}'::jsonb
WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

RESET role;

SELECT is(
  (SELECT snapshot FROM wizard_drafts WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  '{"step":2}'::jsonb,
  'Test 6: owner can still update their own wizard_drafts row'
);

-- Cleanup test data
DELETE FROM scheduled_posts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM saved_calendars WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM wizard_drafts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;

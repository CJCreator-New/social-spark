# Thematic — Missing Tests

Existing coverage inventory (verified via `find`):

- Unit/integration (26 files): `src/**/__tests__/**` — includes `apiKeyManager`, `aiClientResolver`, `postPerformanceScore`, `hashtagPolicy`, `passwordPolicy`, `useIsAdmin`, `useRegeneratePostMutation`, `Admin`, `Auth.oauth`, `Profile`, `Schedule`, `ResetPassword`, `CalendarDetail.batchRegenerate`, wizard offline/timeout/draftRestore.
- E2E (4 files): `e2e/critical-paths.spec.ts`, `accessibility.spec.ts`, `responsive.spec.ts`, `api-key-settings.spec.ts`.
- SQL: `supabase/tests/api_key_rls.test.sql`.
- Edge fn: `supabase/functions/_shared/promptHelpers.test.ts` (373 loc).

## Untested high-risk paths

- **F-020** — Payment flow (`create-order`, `verify-payment`): no unit test verifying HMAC/user/amount/plan branches. Highest financial-impact gap.
- **F-001-related** — No SQL test asserting that `UPDATE saved_calendars SET user_id=<other>` is rejected. `supabase/tests/api_key_rls.test.sql` covers BYOK only.
- **`generate-post-image` ownership** — no test verifying that a different user cannot upload to another user's calendar (F-004).
- **`repurpose-post` / `inline-rewrite` quota** — no test verifying platform quota isn't burned (F-002).
- **`queue-worker`** — no test for `publish_scheduled_post` idempotency or backoff behavior.
- **`generate-post-image` timeout & malformed JSON** — has failure branches (`:229-253`), no test.
- **`admin_grant_tier`** — no SQL test verifying non-admin rejection.
- **`monthly_quota_reset`** cron — no test.

## Flaky/skipped
- `[UNVERIFIED — requires manual check]` — no grep hit for `.skip`/`describe.skip` in test files above; but the response was truncated. Manual pass recommended.

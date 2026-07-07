# Phase 7 — Comprehensive Test Suite

> **QA Lead:** [Name]  
> **Date:** 2026-07-06  
> **Project:** Social Spark  
> **Phase:** 7 — Testing  
> **Test Strategy:** Unit + Integration + Regression  
> **Environments:** Local (dev), Staging, Production Preview

---

## 1. Unit Test Specifications

### UT-001: Wizard Cancel

**Objective:** Verify that cancelling a wizard mid-flow discards unsaved changes without side effects.

**Preconditions:**
- User is authenticated
- Wizard component is mounted and in a valid state

**Execution Steps:**
1. Navigate to the wizard entry point.
2. Complete Steps 1 and 2 of the wizard without submitting.
3. Click the **Cancel** button (or press `Escape` if supported).
4. Confirm the cancel action if a confirmation dialog appears.

**Expected Result:**
- Wizard closes and returns the user to the previous view or dashboard.
- No draft or partial data is persisted to the backend/localStorage.
- No network requests are initiated.
- React Router history does not retain the wizard route (or route is popped).

**Edge Cases & Error Scenarios:**
- Cancel triggered during an async validation step — ensure the promise is aborted or ignored.
- Rapid double-click on Cancel — ensure only one navigation action fires.
- Browser back button after cancel — should not reopen the wizard with stale data.
- Cancel when the wizard is in a loading state — should still close cleanly.

---

### UT-002: Wizard Timeout

**Objective:** Verify that an idle wizard session times out gracefully and cleans up state.

**Preconditions:**
- User is authenticated
- Wizard component is mounted and active

**Execution Steps:**
1. Navigate to the wizard.
2. Progress to any step with unsaved form data.
3. Wait for the configured inactivity timeout period (e.g., 15 minutes).
4. Attempt to interact with the wizard after timeout.

**Expected Result:**
- A timeout warning or auto-close occurs.
- Unsaved data is purged from component state and any persistence layer.
- A finalization/cleanup function fires exactly once (no memory leaks).
- User is redirected to a safe route (dashboard or home).

**Edge Cases & Error Scenarios:**
- Timeout occurs during file upload or image crop — ensure abort controller cancels the request.
- User returns via browser back button after timeout — wizard should not restore stale session.
- Multiple wizard instances open in different tabs — each times out independently.
- Clock skew or system sleep — use monotonic timer if possible to prevent false positives.

---

### UT-003: Drag Reorder

**Objective:** Verify that drag-and-drop reordering updates the list order immutably and maintains accessibility.

**Preconditions:**
- A reorderable list is rendered (e.g., posts, schedule items, calendar events).
- Drag handle is visible and interactive.

**Execution Steps:**
1. Identify an item in the list (e.g., index 2).
2. Drag the item to a new position (e.g., index 4).
3. Release the mouse/finger to drop.
4. Inspect the new list order and screen reader announcements.

**Expected Result:**
- The moved item appears at the target index.
- All other items shift accordingly.
- The underlying data structure (array/state) is updated immutably.
- A visual placeholder or ghost element renders at the drag origin and destination.
- Drag handle retains valid `aria-grabbed`, `aria-dropeffect`, or `role="button"` attributes.
- No duplicate or missing items appear in the list.

**Edge Cases & Error Scenarios:**
- Drag item outside the list bounds — should snap back to original position.
- Rapid drag without settling — should not corrupt the list.
- Drag on touch device with scrolling — should distinguish scroll vs. drag gestures.
- Reorder during a concurrent save operation — optimistic UI should reconcile correctly.

---

### UT-004: Timezone Conversion

**Objective:** Verify accurate conversion between user timezones without data loss or DST errors.

**Preconditions:**
- User has a timezone set in their profile.
- At least one event or scheduled item exists with a UTC timestamp.

**Execution Steps:**
1. Create or select an event scheduled for a known UTC instant.
2. Display the event in the source timezone (e.g., `America/New_York`).
3. Convert the same instant to a target timezone (e.g., `Asia/Kolkata`).
4. Perform a round-trip conversion (source → target → source).

**Expected Result:**
- The displayed local time matches the UTC instant when converted back.
- DST boundaries (spring forward / fall back) are handled correctly — no 1-hour drift.
- No data loss: the underlying UTC value remains unchanged.
- Timezone abbreviations (EST, EDT, IST) are displayed correctly.

**Edge Cases & Error Scenarios:**
- Convert across a DST transition day (e.g., 2026-03-08 in US) — verify no ambiguous or missing hour.
- Invalid or legacy timezone strings (e.g., `UTC`, `Etc/GMT+5`) — should normalize gracefully.
- Leap seconds — most libraries ignore these; ensure no crash or NaN.
- User changes system timezone while viewing a calendar — should prompt reload or auto-update.

---

### UT-005: Conflict Detection

**Objective:** Verify that overlapping calendar events are flagged correctly and do not create double-bookings.

**Preconditions:**
- User has an existing calendar with at least one event.
- User is in the event creation or scheduling flow.

**Execution Steps:**
1. Create Event A: `2026-07-06 10:00 – 12:00` (local time).
2. Attempt to create Event B: `2026-07-06 11:00 – 13:00` (overlaps with Event A).
3. Submit Creation of Event B.
4. Attempt to create Event C: `2026-07-06 12:00 – 13:00` (back-to-back with Event A — should be allowed or flagged per spec).

**Expected Result:**
- Event B triggers a conflict warning or is rejected.
- The conflict message identifies Event A by title/time.
- Event C behavior matches the product rule (allow back-to-back or flag).
- The event list updates optimistically without a full refetch.
- No duplicate events are created.

**Edge Cases & Error Scenarios:**
- All-day events overlapping timed events — should resolve consistently.
- Events in different timezones converted to same UTC window — conflict should still fire.
- Bulk import of events with overlaps — each conflicting event should be reported individually.
- Conflict detection runs while offline — should queue and validate on reconnection.

---

### UT-006: Avatar Upload

**Objective:** Verify secure and correct handling of user avatar uploads including validation, preview, and error states.

**Preconditions:**
- User is authenticated.
- A valid image file exists on the local filesystem.

**Execution Steps:**
1. Open the profile/avatar upload modal.
2. Select a valid image (JPG, PNG, WEBP) under the size limit.
3. Verify the preview renders.
4. Attempt to upload an oversized file or disallowed format (e.g., `.svg`, `.exe`).
5. Complete a successful upload.

**Expected Result:**
- Valid files show a preview with correct aspect ratio and no distortion.
- Oversized or invalid files are rejected with a clear, specific error message.
- File size and type validation occurs client-side before any network request.
- Cropping dimensions match the defined spec (e.g., 200x200 px).
- Upload progress callback fires at least once (0% → 100%).
- On failure, no orphaned or partial files remain in storage.

**Edge Cases & Error Scenarios:**
- Upload a HEIC/HEIF image — should normalize or reject gracefully.
- Network drops mid-upload — should retry or rollback without corrupting state.
- Upload the same file twice without changing — should handle idempotently (no duplicate saves).
- Drag-and-drop a folder instead of a file — should ignore with no crash.
- Unicode filenames or special characters — should sanitize on the server.

---

### UT-007: Password Validator

**Objective:** Verify password strength validation enforces policy without leaking sensitive data.

**Preconditions:**
- User is on the registration or password-change screen.

**Execution Steps:**
1. Enter a password shorter than the minimum length.
2. Enter a password that lacks required character classes (no number, no symbol, etc.).
3. Enter a compliant password meeting all criteria.
4. Submit the form for each case.

**Expected Result:**
- Short or weak passwords are rejected with specific, actionable messages (e.g., "Add a special character").
- Compliant passwords are accepted.
- No password value is logged to console, URL, or error messages.
- Validation runs both client-side and server-side (backup enforcement).

**Edge Cases & Error Scenarios:**
- Whitespace-only password — should be rejected or trimmed before validation.
- Password exceeding maximum length — should be truncated or rejected.
- Unicode or emoji passwords — should be counted correctly in length and character classes.
- Concurrent submissions — validator should remain pure; no race conditions producing incorrect states.

---

## 2. Integration Test Specifications

### IT-001: Generate → Save → Calendar

**Objective:** Verify end-to-end content generation persists as a draft and syncs to the user's calendar.

**Preconditions:**
- User is authenticated.
- AI generation service is available.
- User has an active calendar integration (Google Calendar or ICS).

**Execution Steps:**
1. Open the content generation wizard.
2. Configure inputs (topic, tone, platform, date).
3. Trigger **Generate**.
4. Wait for generation to complete.
5. Click **Save Draft**.
6. Verify draft appears in the drafts list.
7. Trigger **Sync to Calendar** or navigate to the calendar view.
8. Verify the event appears on the correct date and time.

**Expected Result:**
- Generation returns a valid content draft.
- Draft persists in the database and is retrievable after page refresh.
- Calendar event is created with correct title, date, and time.
- Refresh of the calendar page preserves the event.
- If sync fails, the UI reports a specific error without losing the draft.

**Edge Cases & Error Scenarios:**
- AI provider times out during generation — UI should show retry option; draft should not be created empty.
- Calendar API is unavailable during sync — draft must remain safe; a background retry should be scheduled.
- User generates content for a past date — event should still be created but flagged or rejected per business rule.
- Concurrent edits — last write wins or conflict prompt appears.

---

### IT-002: Calendar → Schedule

**Objective:** Verify that selecting a date in the calendar correctly generates a schedule with timezone-aware slots.

**Preconditions:**
- User is authenticated.
- User has at least one calendar connected.
- At least one draft or generated post exists.

**Execution Steps:**
1. Navigate to the Calendar view.
2. Select an empty date or a date with availability.
3. Trigger **Auto-Generate Schedule**.
4. Inspect the resulting schedule list.
5. Verify the assigned time slots.

**Expected Result:**
- Schedule is populated with items for the selected date.
- Time slots are timezone-correct (displayed in user's locale).
- Optimistic updates appear immediately; reverts on backend failure.
- The schedule is persisted in the database.

**Edge Cases & Error Scenarios:**
- Selected date is in a different timezone than the default — times should convert correctly.
- Calendar is fully booked for the date — system should report no availability or suggest next open slot.
- AI service is degraded — schedule should still be created with default times.
- User switches timezone while viewing the schedule — times should update without page reload.

---

### IT-003: Schedule → Edit

**Objective:** Verify that editing a scheduled item propagates changes correctly and validates inputs.

**Preconditions:**
- User has an existing schedule with at least one item.
- User navigates to the schedule detail or list view.

**Execution Steps:**
1. Open an existing schedule item for editing.
2. Modify the content, time, or platform.
3. Introduce an invalid change (e.g., empty required field, past date).
4. Attempt to save.
5. Correct the error and save successfully.
6. Verify the updated item appears in the schedule.

**Expected Result:**
- Inline validation errors guide the user to fix issues; rejected saves do not corrupt the item.
- Successful edits persist to the backend.
- UI reflects the edit immediately (optimistic update).
- Related items (e.g., linked calendar events) update in sync if applicable.

**Edge Cases & Error Scenarios:**
- Edit while the item is being processed by a background job — locking or conflict resolution should apply.
- Rapidly save twice — only one network request should fire or the second should supersede the first cleanly.
- Edit across a timezone boundary — time should be preserved or converted per spec.

---

### IT-004: Admin Dashboard

**Objective:** Verify that admin users can access metrics, filter data, and execute bulk actions securely.

**Preconditions:**
- Admin user account exists with appropriate role.
- Non-admin user account exists for negative testing.

**Execution Steps:**
1. Log in as admin.
2. Navigate to `/admin`.
3. Observe KPI cards and charts.
4. Apply date-range filter; verify metrics update.
5. Attempt a bulk action (e.g., export CSV, suspend user).
6. Log in as non-admin and attempt to access `/admin`.

**Expected Result:**
- KPIs render with real aggregated data (not placeholders).
- Date-range queries return correct aggregates.
- Non-admin users are blocked with a 403 or redirect.
- Bulk actions complete successfully with feedback.
- Exported CSV contains valid headers and row data.

**Edge Cases & Error Scenarios:**
- Empty date range — dashboard should show empty state or zeros, not crash.
- Large dataset (10k+ rows) — pagination or virtualization should keep UI responsive.
- Admin role is revoked mid-session — subsequent admin requests should fail.
- Concurrent admin actions — no race conditions corrupting aggregate counts.

---

### IT-005: Reset Password

**Objective:** Verify the password reset flow is secure and completes successfully.

**Preconditions:**
- A registered user account with a known email exists.
- SMTP/mail service is configured in the test environment.

**Execution Steps:**
1. Go to the login page and click **Forgot password**.
2. Enter a registered email address.
3. Check the inbox for a reset token email.
4. Click the reset link (or copy the token).
5. Set a new compliant password.
6. Log in with the new password.

**Expected Result:**
- Reset email is delivered within a reasonable timeframe (e.g., < 60 seconds).
- Token is single-use and expires after the configured TTL.
- Old password is invalidated immediately.
- New password passes validation rules.
- User is authenticated upon successful reset.
- Audit log records the event with timestamp and IP.

**Edge Cases & Error Scenarios:**
- Request reset for a non-existent email — should not reveal account existence (generic message).
- Reuse the same reset token twice — second attempt should be rejected.
- Request multiple reset emails — only the most recent token should be valid.
- Reset link opened on a different device or browser — should still work.

---

### IT-006: OAuth Login

**Objective:** Verify that external OAuth authentication correctly maps to a local user account.

**Preconditions:**
- OAuth provider (e.g., Google) is configured in the test environment.
- A test user exists in the provider's directory.

**Execution Steps:**
1. Navigate to the login page.
2. Click **Sign in with Google**.
3. Authenticate with the test user credentials in the popup/redirect.
4. Grant requested scopes.
5. Observe the redirect back to the app.
6. Verify the user is logged in and their profile loads.

**Expected Result:**
- Round-trip redirect completes without error.
- Provider profile data maps correctly to the local user record (name, email, avatar).
- First-time login creates a local account automatically.
- Duplicate email collision is handled (merge or error per spec).
- Errors from the provider (denied access, user not found) display a friendly message.

**Edge Cases & Error Scenarios:**
- User denies consent — app should show a clear message and return to login.
- OAuth provider is down — timeout or error page should appear, no infinite spinner.
- Account linking conflict (same email, different provider) — handled deterministically.
- Popup blocker prevents OAuth flow — fallback or clear instruction shown.

---

### IT-007: Offline Generation

**Objective:** Verify that content generation degrades gracefully when the network or AI service is unavailable.

**Preconditions:**
- User is authenticated.
- AI service is reachable, then made unavailable (e.g., dev tool offline toggle).

**Execution Steps:**
1. Open the generation wizard.
2. Configure inputs and trigger **Generate**.
3. Disable network or simulate AI service error.
4. Observe UI behavior.
5. Re-enable network/service.
6. Verify retry or queue behavior.

**Expected Result:**
- UI shows a clear error state (no blank screen).
- A retry button is available.
- A local queue persists the generation request (localStorage or IndexedDB).
- On reconnection, queued requests are retried automatically or on user action.
- No orphan API calls remain after reconnection.
- Data reconciliation runs without duplication.

**Edge Cases & Error Scenarios:**
- Service returns 5xx with a valid response body — should not crash the JSON parser.
- Multiple generation requests queued while offline — should process in order on reconnect.
- User navigates away while offline — queued request should still retry on next app launch.
- Storage quota exceeded in localStorage — should fallback to in-memory or show error.

---

### IT-008: AI Unavailable

**Objective:** Verify behavior when the AI provider returns errors or times out during generation.

**Preconditions:**
- User is authenticated.
- AI service is mocked or throttled to simulate failure.

**Execution Steps:**
1. Open the generation wizard.
2. Configure inputs and trigger **Generate**.
3. Simulate AI provider returning a 500 error or timeout (e.g., 30s delay).
4. Observe UI.

**Expected Result:**
- Fallback mode activates (e.g., template-based generation) OR a descriptive error is shown.
- An exponential backoff retry is attempted if configured.
- Analytics/monitoring event fires for SLO tracking.
- No blank state or silent failure occurs.
- User can manually retry after the automated retries are exhausted.

**Edge Cases & Error Scenarios:**
- Provider returns malformed JSON — error handler should not throw.
- Partial stream response followed by disconnect — UI should not hang in loading state.
- Concurrent generation requests — failure of one should not cancel others.
- Rate-limit response (429) — retry-after header should be respected.

---

## 3. Regression Test Specifications

### RT-001: Existing Scheduling

**Objective:** Verify that current scheduling workflows and data remain intact after recent changes.

**Preconditions:**
- Staging environment seeded with existing schedules.
- Baseline build available for comparison.

**Execution Steps:**
1. Log in as an existing user with historical schedule data.
2. Navigate to the Schedule page.
3. Review existing scheduled items.
4. Edit a recurring event.
5. Delete a non-recurring event.
6. Create a new event that does not conflict.

**Expected Result:**
- All pre-existing schedules load correctly with no data loss.
- Date, time, recurrence rules, and platform assignments are unaltered.
- No orphaned calendar events remain after deletion.
- New event creation functions as expected.

**Edge Cases & Error Scenarios:**
- Schedule spans a DST boundary — recurrence should still align correctly.
- User has > 1000 scheduled items — list should render without performance degradation.
- Bulk delete operation — only intended items are removed.

---

### RT-002: Draft Restore

**Objective:** Verify that auto-saved or manually saved drafts are restored correctly on re-opening.

**Preconditions:**
- User has at least one draft saved.
- Browser or app is refreshed/relaunched.

**Execution Steps:**
1. Create a draft (auto-save or manual save).
2. Close the browser tab or refresh the page.
3. Re-open the app and navigate to Drafts.
4. Open the previously saved draft.
5. Verify content, settings, and metadata are identical.

**Expected Result:**
- Drafts list loads with the saved draft present.
- Draft content is identical to the saved version.
- Latest revision is restored if multiple saves occurred.
- Corrupted drafts do not crash the app (graceful fallback).

**Edge Cases & Error Scenarios:**
- Draft contains large media blobs — should not exceed storage limits.
- Draft is from a previous app version with a changed schema — should migrate or reject gracefully.
- Multiple devices have conflicting draft versions — last-write-wins or merge prompt.

---

### RT-003: Clipboard

**Objective:** Verify copy and paste operations preserve content formatting and encoding across platforms.

**Preconditions:**
- User has content available to copy (generated post, event details, etc.).
- Clipboard permissions are granted.

**Execution Steps:**
1. Select and copy content from the app.
2. Paste into a plain text editor (Notepad).
3. Paste into a rich text editor (Word, Google Docs).
4. Copy from external source and paste into the app.

**Expected Result:**
- Plain-text paste preserves line breaks and special characters.
- Rich-text paste preserves formatting (bold, italic, lists) where supported.
- Content encoding is UTF-8 throughout; no mojibake.
- Paste into plain-text areas strips formatting as expected.

**Edge Cases & Error Scenarios:**
- Very large clipboard payload (e.g., 1MB text) — should paste or truncate gracefully.
- Clipboard contains executable scripts — should be pasted as text only, never executed.
- Clipboard access denied by OS — should show a user-friendly message or disable copy button.

---

### RT-004: Export

**Objective:** Verify that exported files match source content and encoding standards.

**Preconditions:**
- User has data to export (posts, schedule, analytics).
- A target directory or browser download location is available.

**Execution Steps:**
1. Trigger an export (CSV, JSON, or PDF).
2. Save the file.
3. Inspect the file encoding, structure, and content.
4. Compare file content to source data for exactness.
5. Verify filename follows the project convention.

**Expected Result:**
- File encoding is UTF-8.
- Content matches source data exactly (no truncation, no extra rows).
- Date and number formats respect the user's locale.
- Filename includes project name and date.
- Exported file opens in the target application without errors.

**Edge Cases & Error Scenarios:**
- Export empty dataset — should produce a valid empty file with correct headers.
- Export content with emojis or non-Latin characters — must render correctly.
- Disk full or write permission denied — error message should be specific.
- Concurrent export requests — only the requested dataset should be exported.

---

### RT-005: ICS Export

**Objective:** Verify that `.ics` calendar files are RFC 5545 compliant and import cleanly into major calendar providers.

**Preconditions:**
- User has one or more scheduled events.
- Target calendar client (Google Calendar, Outlook, Apple Calendar) is available for import.

**Execution Steps:**
1. Trigger ICS export from the schedule or calendar page.
2. Save the `.ics` file.
3. Import the file into Google Calendar.
4. Import the file into Microsoft Outlook.
5. Import the file into Apple Calendar.
6. Verify event details on all platforms.

**Expected Result:**
- File passes RFC 5545 validation.
- Events appear on the correct date and time in all target calendars.
- Recurrence rules (if any) are preserved and expanded correctly.
- Event titles, locations, and descriptions are preserved.
- Timezone offsets are respected.

**Edge Cases & Error Scenarios:**
- All-day events — should be represented with `VALUE=DATE`.
- Events in exotic timezones — should resolve to correct local time.
- Recurring exceptions (edited instances) — should import correctly.
- Large ICS file with 100+ events — should not exceed file size limits.

---

### RT-006: Batch Regenerate

**Objective:** Verify that batch content regeneration completes accurately and reports failures per item.

**Preconditions:**
- User has multiple existing items (e.g., posts, schedule entries) selected for regeneration.

**Execution Steps:**
1. Select 3–5 items in the batch actions panel.
2. Trigger **Regenerate All**.
3. Observe the progress indicator.
4. Wait for completion.
5. Review results for each item.

**Expected Result:**
- All selected items are processed.
- Progress indicator accurately reflects completion percentage.
- Failed items are reported individually with a retry option.
- Successful items show updated content and a success indicator.
- Queue order is preserved — no item is skipped or processed twice.

**Edge Cases & Error Scenarios:**
- One item in the batch fails permanently — others continue; failure is reported.
- User navigates away during batch — process continues in the background or resumes on return.
- AI rate-limit whitelists the batch — exponential backoff applies.
- Total batch size exceeds server limits — partial processing with clear error.

---

### RT-007: Brand Memory

**Objective:** Verify that brand assets (logo, colors, tone) persist across sessions and are archived correctly on deactivation.

**Preconditions:**
- User has configured brand settings.
- User has generated content that uses the brand profile.

**Execution Steps:**
1. Configure a brand profile (name, logo URL, primary color, tone).
2. Generate content that uses the brand profile.
3. Log out and log back in.
4. Verify brand settings are still present.
5. Verify generated content still reflects the brand.
6. Deactivate the brand profile.
7. Verify brand data is archived (not deleted).

**Expected Result:**
- Brand assets persist in the database and load on subsequent sessions.
- Asset URLs remain valid and accessible.
- Deactivated brand data is archived and retrievable for audit.
- Active brand correctly applies to new content.

**Edge Cases & Error Scenarios:**
- Brand logo URL becomes invalid (404) — app should fallback to a placeholder without crashing.
- Multiple brand profiles exist — the active one should always be applied.
- Brand is deleted while content references it — content should retain a snapshot or revert to defaults.

---

### RT-008: Profile Update

**Objective:** Verify that profile updates (name, email, avatar, preferences) save atomically and validation errors rollback partial saves.

**Preconditions:**
- User is logged in and on the Profile page.

**Execution Steps:**
1. Update display name and save.
2. Update email address and save.
3. Update avatar image and save.
4. Update notification preferences and save.
5. Attempt an invalid update (e.g., malformed email).

**Expected Result:**
- Each valid update is persisted and reflected immediately in the UI.
- Invalid updates display inline validation errors and do not alter the saved state.
- Email change triggers a verification flow if required (verification email sent, status shown as "unverified").
- Avatar upload succeeds or fails atomically — no partial/cropped saves.

**Edge Cases & Error Scenarios:**
- Update email to an address already in use by another account — reject with specific error.
- Avatar file is corrupt — validation rejects before upload begins.
- Network drops during profile save — optimistic update should rollback automatically.
- Rapidly update multiple fields — final state should match the last successful save.

---

## 4. Test Execution Checklist

| Test Type | Total | Pass Required | Actual Pass | Status |
|-----------|-------|---------------|-------------|--------|
| Unit Tests | 7 | 7 | | Pass / Fail |
| Integration Tests | 8 | 8 | | Pass / Fail |
| Regression Tests | 8 | 8 | | Pass / Fail |
| **Total** | **23** | **23** | | |

**Notes:**
- All tests must pass on Local, Staging, and Production Preview environments.
- Blockers must be resolved before merge; Major defects require explicit QA sign-off.
- Test evidence (screenshots, logs, HAR files) must be attached to the testing report.

## ContentForge — Full End-to-End Audit Report

Here is a comprehensive breakdown of all gaps, issues, and bugs found across the entire application:

***

## 🔴 CRITICAL ISSUES

### 1. Raw Markdown Asterisks in Generated Post Body Content [contentforged.lovable](https://contentforged.lovable.app/calendar/0596a51f-605b-457f-b73d-236fac7b4a9f)
The single biggest content quality issue: post bodies in saved calendars display raw `**bold**` markdown syntax literally — e.g., `→ **Context Window:** Claude's 200K token...` — instead of rendering as bold text. This makes the content **copy-paste unusable** for LinkedIn without manual cleanup. The "Copy for LinkedIn" button copies the raw asterisks, meaning users would paste `**bold**` directly into LinkedIn posts where it renders as plain text. [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)

- Affected calendars: "claude 101", "What Is HIMS & Why Hospitals...", "claude 101 – Claude code..."
- Root cause: Inconsistency in the AI prompt — newer generations have clean content; older generations have raw markdown
- Impact: The core value proposition ("platform-native posts ready to use") is broken for these entries

### 2. Generated Calendar Not Saved Unless "Save Calendar" Is Explicitly Clicked [contentforged.lovable](https://contentforged.lovable.app/app)
After generating a full week of content, if a user closes or navigates away before clicking "Save calendar," all generated content is lost. There is no auto-save, no warning/prompt, and no draft recovery. The newly generated calendar I created did not appear in "My Calendars" because I navigated away without saving.

***

## 🟠 HIGH-PRIORITY UX ISSUES

### 3. Step 2 ("Topics") and Step 3 ("Generate") Are Combined Into One Long Page [contentforged.lovable](https://contentforged.lovable.app/app)
The step indicator shows 4 steps (Industry → Topics → Generate → Calendar), but Steps 2 and 3 are served on a single scrollable page. The user sees "Pick your weekly topics" (Step 2 label) but also has Structure, Post Length, Week Starting, NEVER SAY, MUST MENTION, and the "Generate my week" button all on the same page — content that belongs to Step 3. This causes confusion about where one step ends and another begins.

### 4. Validation Errors Don't Scroll to the Offending Field [contentforged.lovable](https://contentforged.lovable.app/app)
When clicking "Generate my week →" without selecting a topic, the error "Please select at least 1 topic." appears at the *bottom* of the screen, but the Topics field is at the *top* of the long scrollable form. Users see a red bar at the bottom but don't know which field caused it, and the page doesn't scroll back to the topic selector.

### 5. "Core Idea / Angle" Field is Required But Not Marked as Required [contentforged.lovable](https://contentforged.lovable.app/app)
Clicking "Next step →" without filling the "CORE IDEA / ANGLE" textarea shows the error "Please describe your core idea." but the field label has **no asterisk (*), no "(required)" note, or any visual indicator** that it's mandatory — unlike "EXTRA CONTEXT (optional)" which does have a visible optional label.

### 6. Stale Validation Error Message Persists After Fixing the Issue [contentforged.lovable](https://contentforged.lovable.app/app)
After getting "Please select at least 1 topic." and then selecting topics, the red error bar **does not clear** until the user clicks Generate again. The error is stale and misleading.

### 7. Tracking URL Field Shows "https://yoursite.com/launch" as If It's Real Data [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)
The TRACKING URL input field in every saved calendar displays `https://yoursite.com/launch`. This looks like actual saved data but is just a placeholder. Users could mistakenly think they've already set a tracking URL. It should be styled as a dimmed placeholder inside the input, not as filled-in content. [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)

***

## 🟡 MEDIUM-PRIORITY ISSUES

### 8. Inconsistent Navigation Between Pages [contentforged.lovable](https://contentforged.lovable.app/schedule)

| Page | Nav Items Shown |
|------|----------------|
| /app (main wizard) | My calendars · Schedule · Profile · Email · Sign out |
| /my-calendars | Schedule · ← New calendar · Sign out |
| /schedule | My calendars · ← New calendar |
| /calendar/[id] | ← Back to my calendars · Star |

Every page has a **different navigation pattern**. "Profile" disappears from most pages. "My calendars" link appears/disappears inconsistently. There is no persistent global navigation.

### 9. Schedule Page Shows No Posts Despite Existing Calendars [contentforged.lovable](https://contentforged.lovable.app/schedule)
The "My schedule" page at `/schedule` shows "No scheduled posts yet. Open a calendar and click Schedule week." — but the existing HIMS calendar already has a "Schedule week →" button. After opening that calendar, the Schedule page is still empty. Either the scheduling feature is not working or it requires additional steps that are not communicated clearly.

### 10. Download Buttons (.pdf, .ics, .md) Give No Feedback [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)
Clicking `.pdf`, `.md`, or `.ics` in the saved calendar view produces no visible feedback — no loading spinner, no success toast, no error. It's unclear whether a download was triggered. The `.ics` button appears to toggle a "selected" style but nothing downloads visibly.

### 11. Export Format Inconsistency Between New and Saved Calendars
- **New calendar (Step 4):** Shows `.txt`, `.md`, `.pdf`, `.ics`, and "Copy all 7 for LinkedIn" buttons [contentforged.lovable](https://contentforged.lovable.app/app)
- **Saved calendar view:** Shows only `.md`, `.pdf`, `.ics` — the `.txt` download and the bulk "Copy all 7" button are **missing** [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)

### 12. Calendar Title Auto-Capitalization Missing [contentforged.lovable](https://contentforged.lovable.app/my-calendars)
User-typed calendar names (derived from the "Core Idea" field) appear as-entered with no normalization: "claude 101", "claude a breif intro" (also a typo: "breif" → "brief"). The AI should either fix capitalization/typos or at least warn the user.

### 13. Calendar Title Truncated in List View [contentforged.lovable](https://contentforged.lovable.app/my-calendars)
"intro about the latest AI models - Claude, Chatgpt. Gemini, Kimi, Z.ai - their c" — the title is cut off mid-sentence. The title list should either truncate cleanly with ellipsis or wrap fully.

### 14. "WHY THIS WORKS (RATIONALE)" Exposed to End Users [contentforged.lovable](https://contentforged.lovable.app/app)
The AI rationale box — intended as internal reasoning — is displayed directly in the calendar card and in the edit form under "WHY THIS WORKS (RATIONALE)". This is internal AI scaffolding that should be hidden from users, or made into a toggleable "See why →" section for power users only.

***

## 🟢 LOW-PRIORITY / POLISH ISSUES

### 15. Hashtag Casing Inconsistency Between View and Edit Modes
- **View mode** hashtags: lowercase (`#hospitalefficiency`, `#himsbenefits`)
- **Edit mode** hashtag textarea: PascalCase (`#HospitalEfficiency #HIMSBenefits`)

These two representations should match. When copied for LinkedIn, it's unclear which format is used.

### 16. Hashtag "Dense" Warning on Monday Post (6 Tags) [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)
Monday's post for the HIMS calendar shows "# 6 tags · dense" with a red "× fix" indicator — meaning the system flags 6 hashtags as too many for LinkedIn. However, the app still generates 6 hashtags by default and shows the error without automatically fixing it. A better approach would be to enforce the limit during generation.

### 17. Profile Page - Email Field Not Editable [contentforged.lovable](https://contentforged.lovable.app/profile)
The email field (`cjsaran94@gmail.com`) appears as a styled input but is read-only with no label indicating it's non-editable. Users may try to change their email and not understand why it doesn't respond. [contentforged.lovable](https://contentforged.lovable.app/profile)

### 18. Profile Brand Defaults Pre-Filled With All Goals Selected [contentforged.lovable](https://contentforged.lovable.app/profile)
In the Profile's "Brand defaults", all 7 goals (Awareness, Engagement, Drive traffic, Lead generation, Thought leadership, Community building, Sales & conversion) are pre-selected by default. This is counterproductive — selecting all goals provides no signal to the AI about content prioritization.

### 19. "View all →" on Dashboard Only Shows 3 Recent Calendars [contentforged.lovable](https://contentforged.lovable.app/app)
The "PICK UP WHERE YOU LEFT OFF" section shows only 3 most recent calendars. The "View all →" link goes to `/my-calendars`, which is fine — but the homepage section should probably show 4–5 entries to give better context.

### 20. No Confirmation Before Deleting a Calendar [contentforged.lovable](https://contentforged.lovable.app/my-calendars)
The "Delete" button in "My Calendars" is directly clickable with no confirmation dialog or undo mechanism. Accidental deletion is irreversible.

### 21. "Reformat for Another Platform" Default Shows "Another platform…" as Default [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)
The "REFORMAT FOR" dropdown has "Another platform…" selected as default — this reads as a placeholder, not a real option. It's confusing because the user doesn't know what "another platform" means and whether clicking "Reformat all 7 →" would do anything.

### 22. Post Time Picker Uses Unusual Number Spinner Instead of Standard Time Picker [contentforged.lovable](https://contentforged.lovable.app/calendar/78cf4b9a-31e7-411f-8bc8-d5d7b0782e44)
The POST TIME field uses a custom numeric spinner (separate hour/minute number inputs) instead of a native `<input type="time">` element, making time setting awkward on desktop.

***

## 📋 Content Quality Issues Specifically

| Issue | Details |
|-------|---------|
| Raw `**markdown**` in post body | Older generated posts show `**bold**` literally instead of as bold. Unusable for direct copy-paste [contentforged.lovable](https://contentforged.lovable.app/calendar/0596a51f-605b-457f-b73d-236fac7b4a9f) |
| Inconsistent bullet style | Some posts use `•` bullets, others use `→` arrows, with no consistent platform-native style |
| Post body word count labeled "132 words · varies (80–380)" | The range is extremely wide and confusing — what does 80–380 mean for a single post? |
| Hook section uses italics visually but is plain text | The italic display of the hook is just a CSS style in the app — when copied, it pastes as plain text |
| LinkedIn character limit: WITHIN LIMIT shows "100%" | While technically correct, this counts all content (hook + body + CTA + hashtags) together, which is misleading since LinkedIn's 3,000-character limit counts the full post |
| CTA style "Share & repost bait" | Default CTA style is optimized for virality which may not suit all use cases — should ask user intent |
| No image/visual suggestions | LinkedIn posts perform significantly better with images, but the app generates zero guidance on what visual to pair with each post |
| No post preview | There is no "Preview as LinkedIn post" feature — users cannot see how the post would actually look on the platform |

***

## Summary by Priority

| Priority | Count | Key Issues |
|----------|-------|------------|
| 🔴 Critical | 2 | Raw markdown in content, no auto-save |
| 🟠 High | 6 | Navigation, validation UX, stale errors, tracking URL |
| 🟡 Medium | 8 | Download feedback, format inconsistency, rationale exposure |
| 🟢 Low/Polish | 8 | Casing, deletion confirmation, time picker, reformat default |
| 📋 Content Quality | 8+ | Markdown, bullet style, no visual suggestions, no preview |
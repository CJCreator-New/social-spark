# Repository Evidence — Feature Mapping

This document maps key product features to concrete files, helper classes, serverless edge functions, and tests found in the repository.

### State Management & Scheduling
- **Centralized Wizard Store**: [useWizardStore.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/stores/useWizardStore.ts) coordinates wizard configurations, active step states, generated content variants, and brand memory preferences.
- **Calendar Details UI**: [CalendarDetail.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/pages/CalendarDetail.tsx) manages the weekly calendar dashboard, displays post details, and handles bulk scheduling mutations.
- **Weekly Schedule Strip**: [WeekStrip.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/wizard/WeekStrip.tsx) provides a horizontal slider representing days of the week, displaying allocated post counts and triggering timezone-aware scheduling dialogs.
- **Calendar Export & Scheduling Logic**:
  - [calendarSchedule.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/calendarSchedule.ts): Helper logic for calendar date math and ICS scheduling exports.
  - [exportCalendar.ts](file:///c:/Users/HP%20/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/exportCalendar.ts): Generates markdown and PDF files of content plans.

### Content Composer & Draft Recovery
- **Draft Recovery Modal**: [DraftRecoveryDialog.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/DraftRecoveryDialog.tsx) checks local storage for uncommitted editor drafts on load and prompts users to restore their progress.
- **Composer Forms & Layouts**:
  - [PostDetailCard.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/wizard/PostDetailCard.tsx): Standard form layout displaying post editing inputs, image previews, and character limits.
  - [PlatformPreview.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/wizard/PlatformPreview.tsx): Renders custom mockup cards simulating how posts look on LinkedIn, Twitter, and other networks.

### AI Generation & Edge Functions
- **Shared AI Prompt Helpers**: [promptHelpers.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/_shared/promptHelpers.ts) provides standard prompt construction, character constraints, hashtag filtering, and **Variant Evaluation** logic that scores candidate post options.
- **Post Repurposing**: [repurpose-post/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/repurpose-post/index.ts) adapts an existing post to align with formatting expectations of other platforms.
- **Image Generation**: [generate-post-image/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/generate-post-image/index.ts) manages calls to generative imagery APIs and uploads output PNGs to Supabase Storage.
- **Inline Text Rewrite**: [inline-rewrite/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/inline-rewrite/index.ts) performs text alterations on selected blocks based on user-guided metrics (e.g., punchy, formal, expand).
- **Core Generators**:
  - [generate-calendar/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/generate-calendar/index.ts)
  - [generate-single-post/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/generate-single-post/index.ts)
  - [regenerate-post/index.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/supabase/functions/regenerate-post/index.ts)

### Brand Intelligence & Insights
- **Brand Memory System**: [brandMemory.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/brandMemory.ts) loads, saves, and injects customized client voice rules, target keywords, and forbidden terms into prompt construction.
- **Performance Evaluation**: [postPerformanceScore.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/postPerformanceScore.ts) parses generated drafts to calculate individual score metrics (hooks, call-to-actions, and readability indices).
- **Performance Score Card Component**: [PerformanceScoreCard.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/PerformanceScoreCard.tsx) displays grading details and displays tips to improve copy.
- **Topic Gap Badge**: [TopicGapBadge.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/TopicGapBadge.tsx) warns content creators about key topics missing from their calendar.
- **Post Seeding**: [seedFromPost.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/seedFromPost.ts) handles pulling an existing post's details to pre-fill the generation wizard.

### Performance Optimization & Lazy Loading
- **Routing Transition Fallback**: [RouteFallback.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/components/layout/RouteFallback.tsx) renders loading animations during lazy route resolutions.
- **Asynchronous Charting Component**: [AdminCharts.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/pages/admin/AdminCharts.tsx) abstracts Recharts visualization elements into a dynamically imported component to trim the landing/core bundle size.
- **Page Bundling Splitting**:
  - [App.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/App.tsx): Dynamically imports all major routes via `React.lazy`.
  - [IndexResults.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/pages/IndexResults.tsx): Split out from Index.tsx to keep the main homepage component lean.

### Auth & API Integrations
- **Supabase Client Initializer**: [client.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/integrations/supabase/client.ts)
- **User Authentication Context**: [AuthContext.tsx](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/contexts/AuthContext.tsx)
- **Application Hooks**: [useAppQueries.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/hooks/useAppQueries.ts) packages React-Query mutations and queries for DB interaction.

### Test Coverage
- **Unit Tests (`src/lib/__tests__/`)**:
  - [brandMemory.test.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/__tests__/brandMemory.test.ts)
  - [postPerformanceScore.test.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/__tests__/postPerformanceScore.test.ts)
  - [seedFromPost.test.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/__tests__/seedFromPost.test.ts)
  - [calendarSchedule.test.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/__tests__/calendarSchedule.test.ts)
  - [errors.test.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/src/lib/__tests__/errors.test.ts)
- **E2E & Accessibility Tests**:
  - [accessibility.spec.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/e2e/accessibility.spec.ts)
  - [critical-paths.spec.ts](file:///c:/Users/HP/OneDrive/Desktop/Projects/AntiGravity%20-%20Google%20-%20Projects/social-spark/e2e/critical-paths.spec.ts)

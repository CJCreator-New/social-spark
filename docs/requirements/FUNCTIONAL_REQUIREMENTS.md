# Functional Requirements — Social Spark

Core user flows

1. **Authentication & Profile Management**
   - Sign up, sign in, and password reset via email and social providers powered by Supabase Auth.
   - Profile management interface (`src/pages/Profile.tsx`) allows users to customize their display name, avatar, bio, and configure content settings.
   - Role-based route protection (`src/components/ProtectedRoute.tsx` and `src/components/AdminRoute.tsx`).

2. **Calendar Management & Theme Analysis**
   - Create, rename, delete, and view weekly calendars.
   - **Topic Gap Detection**: Calendar item listings include a topic gap badge (`src/components/TopicGapBadge.tsx`) to highlight missing content themes or recommendations based on current content distribution.

3. **AI-Powered Content Generation & Optimization**
   - **Draft Generation**: Generate content calendars for multiple days/platforms based on brief settings.
   - **Quality Variant Scoring**: The system generates multiple post variations, scores them on hooks, CTA, and readability, and presents evaluation insights (`src/components/PerformanceScoreCard.tsx` and `src/components/PostInsights.tsx`).
   - **Brand Memory Integration**: Injects custom brand styles, voice, and industry guidelines (`src/lib/brandMemory.ts`) directly into AI prompts to ensure consistent brand identity.

4. **Interactive Post Editing & Composer**
   - **Post Repurposing**: Ability to repurpose an existing post for other platforms (e.g., LinkedIn, Twitter, Facebook) using specialized platform-style guides.
   - **Inline Rewrites**: Fine-grain editing toolbar allows inline AI rewriting to make sections shorter, longer, punchier, or change tone.
   - **Cover Image Generation**: Integrated AI image generator (`src/components/wizard/CoverImageGenerator.tsx`) to produce custom visuals for posts, supporting preview, aspect ratio selections, and direct storage.

5. **Scheduling & Publishing**
   - Compose posts with text, images, and hashtags.
   - Centralized schedule builder state via Zustand (`src/stores/useWizardStore.ts`) to orchestrate multi-post calendar setups.
   - Timezone-aware weekly scheduling strip (`src/components/wizard/WeekStrip.tsx`) and publishing queues with status tracking.

6. **Collaboration & Recovery**
   - Commenting/approvals workflow for drafts.
   - **Draft Recovery & Autosave**: Autosaves wizard input in real-time. On application reload, the system checks for unsaved changes and prompts the user to restore their draft using `src/components/DraftRecoveryDialog.tsx`.

7. **Analytics & Performance Insights**
   - Analytics dashboard showing post-level and calendar-level metrics (impressions, engagements, click rates).
   - Post performance metrics are secured on a per-user basis.
   - Trending topics suggestions based on industry parameters.

Admin features
- Role assignment and user management.
- System health dashboard showing metrics and log views with asynchronous chart loading (`src/pages/admin/AdminCharts.tsx`) to keep initial load times low.

Error handling
- Integrated global error boundaries (`src/components/ErrorBoundary.tsx`) providing user-friendly fallback UIs.
- User feedback modals (`src/components/FeedbackModal.tsx`) for reporting errors or suggestions.
- Server-side validations and idempotent APIs where applicable.

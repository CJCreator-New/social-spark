# Frontend Requirements — Social Spark

Platform & stack
- **Framework**: React + TypeScript.
- **Build**: Vite.
- **Styling**: Tailwind CSS + Custom Design Tokens (`src/styles/tokens.css` and `src/styles/pages.css`).
- **Testing**: Vitest for component/hook tests, Playwright for E2E.

State Management
- **Centralized Store**: Global wizard and content editor states are managed using a centralized Zustand store (`src/stores/useWizardStore.ts`). This synchronizes content briefs, active calendars, selected platforms, and unsaved drafts.

Performance & Bundle Optimization
- **Lazy Loading**: All primary pages and heavy components are dynamically imported using `React.lazy()` and wrapped in `Suspense` blocks.
- **Unified Transitions**: Standardized loading interface provided via `src/components/layout/RouteFallback.tsx` during page transitions.
- **Decoupled Charting**: Large visualization libraries (e.g., `recharts`) are isolated inside `src/pages/admin/AdminCharts.tsx` and loaded asynchronously on the admin dashboard, protecting the core bundle size.
- **Component Splitting**: Heavier modals and editors (e.g., `DraftRecoveryDialog`, image editor dialogs) are lazy-loaded within parent pages.

Core UI Components
1. **Calendar View & Scheduling Strip**: Dynamic weekly scheduling strip (`src/components/wizard/WeekStrip.tsx`) and standard calendar view supporting timezone-aware scheduling.
2. **Draft Recovery Dialog**: Component (`src/components/DraftRecoveryDialog.tsx`) that checks local storage on mount and prompts the user to restore any uncommitted wizard drafts.
3. **Cover Image Generator**: Component (`src/components/wizard/CoverImageGenerator.tsx`) allowing users to request AI image assets, preview results, choose aspect ratios, and manage Supabase uploads.
4. **Performance Score Card**: UI card (`src/components/PerformanceScoreCard.tsx` / `src/components/PostInsights.tsx`) displaying structured quality scores (hooks, CTA, readability) along with actionable regeneration tips.
5. **Topic Gap Badge**: Contextual badge (`src/components/TopicGapBadge.tsx`) notifying creators of underrepresented themes or topics in their calendar.
6. **Platform Preview & Reformat Bar**: Inline preview block (`src/components/wizard/PlatformPreview.tsx`) supporting multiple social platforms, alongside formatting toolbars.

Developer Requirements
- Clean, well-typed React hook interfaces (`src/hooks/useAppQueries.ts`) mapping Supabase client queries and mutations.
- Standardized linting and formatting configured via ESLint.

Performance Targets
- First Contentful Paint (FCP) < 2s on 3G simulated networks.
- Reduced initial chunk size via route-based splitting.

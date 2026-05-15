# Frontend Requirements — Social Spark

Platform & stack
- Framework: React + TypeScript.
- Build: Vite.
- Styling: Tailwind CSS.
- Testing: Vitest for unit tests, Playwright for E2E.

User experience
- Responsive design for desktop and mobile.
- Accessible components (WCAG AA where feasible).
- Fast interactions: hydrate within 2s on slow networks.

Core features
- Calendar view: month/week/day, drag-and-drop scheduling.
- Post composer: rich text, media attachments, hashtag recommendations.
- Scheduling UI: select date/time, timezone support.
- Draft recovery and autosave (`DraftRecoveryDialog` exists).
- Virtualized lists for feeds (`VirtualizedList`).
- Admin and protected routes for permissioned views.

Integrations
- OAuth flows for social platforms (configurable).
- Realtime updates for collaboration via Supabase or websockets.

Developer requirements
- Component library and storybook (if added) for shared UI.
- Well-typed public interfaces for hooks and contexts.
- Linting and formatting: ESLint + Prettier.

Performance targets
- First Contentful Paint (FCP) < 2.5s on 3G simulated mobile.
- Time to Interactive (TTI) < 5s for main calendar view.

Observability
- Client-side error reporting (Sentry or similar).
- Instrument key UX events and feature usage.

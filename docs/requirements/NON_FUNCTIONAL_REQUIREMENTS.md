# Non-Functional Requirements — Social Spark

Performance
- **Bundle Optimization**: Initial page JavaScript bundle size must remain under 250KB gzipped. Non-essential dependencies (such as `recharts`) must be lazy loaded or dynamically imported to prevent blocking the main chunk.
- **Fast First Paints**: First Contentful Paint (FCP) must be < 2.0s on a simulated 3G mobile network.
- **Loading State Latency**: Standardized transition loaders (`RouteFallback.tsx`) must trigger in less than 100ms during route shifts.
- **API Latency**: Serverless Edge Function median latency must remain under 300ms for core operations (excluding heavy AI generation payloads).

Scalability
- Support 10k daily active users (DAU) with serverless edge functions scaling automatically.
- Database connection pooling handles spikes in concurrently scheduled updates.

Security
- **Row-Level Security (RLS)**: Row-Level Security must be enabled on all database tables (e.g., `profiles`, `saved_calendars`, `scheduled_posts`). Policies must strictly enforce that users can only read, write, update, or delete records belonging to their authentication UUID.
- **Storage Security**: Storage buckets (e.g., `post-images`) must enforce object-level security policies restricting uploads/modifications to authenticated user folders.
- **Least Privilege Access**: Role-based access control managed via custom database function triggers (e.g., `has_role`) to authorize admin API actions.

Maintainability
- **Type Safety**: Strictly enforced TypeScript interfaces on all API mutation requests, responses, and global stores (`useWizardStore.ts`).
- **Modular Architecture**: Complete separation between presentation components and database actions/mutations (`src/hooks/useAppQueries.ts`).
- **Test Coverage**: Critical helper libraries (`src/lib/brandMemory.ts`, `src/lib/postPerformanceScore.ts`) must have corresponding unit test suites to protect core scoring and injection logic.

Availability
- Target 99.9% uptime for scheduling and core databases.

Observability
- Error logging via application error boundaries (`ErrorBoundary.tsx`) and client-side logging hooks.
- Server-side invocation logs tracked within Supabase for edge functions.

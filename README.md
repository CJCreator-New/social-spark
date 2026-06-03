# ContentForge

AI-powered weekly content calendar generator. Turn one brief into a week of polished, platform-native social media posts for LinkedIn, X/Twitter, Instagram, Facebook, newsletters, and blogs.

## Features

- **Brand-aware generation** — Voice, audience, goals, banned phrases, and hashtag rules persist across every calendar
- **Platform-native writing** — Content adapts to each platform's length, structure, and CTA conventions
- **Schedule & export** — Timezone-aware scheduling, CSV / Markdown / PDF / ICS export
- **Reusable templates** — Save winning prompts as brief templates
- **Single-post mode** — Generate one fully tuned post with the same brand context
- **Draft auto-recovery** — The wizard autosaves locally and to the server; a refresh never resets your work
- **Undo / redo** — Full history for post editing (Ctrl+Z / Ctrl+Y)
- **Batch edit** — Apply changes across all posts at once (Ctrl+Shift+E)
- **Drag-and-drop reordering** — Rearrange your weekly calendar visually

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Vite + React 18 + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui + custom CSS |
| **State** | TanStack Query (React Query) |
| **Auth & DB** | Supabase (Auth, Postgres, Edge Functions, Storage) |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **CI/CD** | GitHub Actions |

## Architecture Overview

```
src/
├── pages/           # Route-level page components
│   ├── Index.tsx    # Main wizard / calendar builder (largest component)
│   ├── Landing.tsx  # Public landing page
│   ├── Auth.tsx     # Sign in / sign up
│   ├── Profile.tsx  # User profile & brand defaults
│   ├── MyCalendars.tsx  # Calendar list
│   ├── CalendarDetail.tsx  # Single calendar view
│   ├── Schedule.tsx  # Publishing schedule
│   └── Admin.tsx    # Admin dashboard
├── components/      # Shared UI components
├── contexts/        # React contexts (Auth)
├── hooks/           # Custom hooks (data fetching, mutations)
├── lib/             # Utilities (config, errors, logger, storage, export)
├── integrations/    # Supabase client & types
└── main.tsx         # App entry point

supabase/
├── functions/       # Edge Functions (generate-calendar, regenerate-post, etc.)
├── migrations/      # SQL migrations (22 files)
└── config.toml      # Supabase project configuration

e2e/                 # Playwright E2E test specs
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** (comes with Node)
- A **Supabase** project (for auth, DB, and edge functions)

### Setup

1. **Clone and install:**
   ```bash
   git clone <repo-url> && cd social-spark
   npm install
   ```

2. **Configure environment:**
   Create a `.env` file (gitignored) with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
   ```

3. **Run the dev server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173)

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test:run` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |
| `npx playwright test` | Run E2E tests (requires dev server or build) |

## Supabase Edge Functions

Deploy from `supabase/functions/`:

| Function | Purpose |
|----------|---------|
| `generate-calendar` | Generate a full week of posts from a brief |
| `generate-single-post` | Generate one post |
| `regenerate-post` | Re-generate a single post within a calendar |
| `repurpose-post` | Reformat a post for a different platform |
| `inline-rewrite` | Apply a tweak instruction to a post |
| `generate-post-image` | Generate an image for a post |
| `queue-worker` | Process background job queue (cron) |
| `cleanup-media` | Remove orphaned media files (cron) |
| `telemetry` | Capture usage events |
| `trends_ingest` / `trends_read` / `trends_admin` | Trending topics pipeline |
| `adapters` | Platform adapter utilities |

See [docs/DEPLOYMENT_SETUP.md](docs/DEPLOYMENT_SETUP.md) for deployment details.

## Configuration

All application constants are centralized in [`src/lib/config.ts`](src/lib/config.ts):
- Rate limits, API retry config, generation timeouts
- Platform character limits (Twitter 280, LinkedIn 3000, etc.)
- Content length guides, structure templates
- React Query caching defaults
- Feature flags

Feature flags can be overridden at runtime via `localStorage`:
```js
// In browser console:
localStorage.setItem("ss:feature_flags", JSON.stringify({ enable_telemetry: false }));
```

## Testing

### Unit Tests (Vitest)
```bash
npm run test:run       # Run once
npm run test:coverage  # With coverage
```

### E2E Tests (Playwright)
The E2E suite uses a mock authentication mode (dev-only) that bypasses Supabase auth for deterministic test execution.

```bash
npx playwright test
```

See [`e2e/critical-paths.spec.ts`](e2e/critical-paths.spec.ts) for the test scenarios.

## Documentation

Additional docs are in the [`docs/`](docs/) directory:
- [Deployment Setup](docs/DEPLOYMENT_SETUP.md) — Edge function and migration checklist
- [Requirements](docs/requirements/) — Business, functional, backend, frontend, and QA requirements

## License

Private — All rights reserved.

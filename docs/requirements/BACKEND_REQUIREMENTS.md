# Backend Requirements — Social Spark

Platform & stack
- Primary data/service layer: Supabase (Postgres, Auth, Functions).
- Serverless functions for heavy-lift operations (`supabase/functions/`).

APIs
- REST/HTTP endpoints for scheduling, calendar, posts, analytics.
- Authentication via Supabase Auth; role-based access for admin routes.

Core features
- Scheduling engine: store scheduled posts, handle timezones, enqueue delivery.
- Post delivery integrations: adapters per platform (rate-limit aware).
- Analytics pipeline: events ingestion, aggregation, and queryable metrics.
- Draft recovery and versioning.

Data
- Schemas for users, calendars, posts, schedules, analytics.
- Backups and migrations (use `supabase/migrations/`).

Security & compliance
- Protect PII, encrypt sensitive fields where required.
- Follow least-privilege access for DB and functions.

Reliability
- Retry and dead-letter handling for failed post deliveries.
- Health checks and uptime monitoring.

Scalability
- Design the scheduling system to be horizontally scalable; queue-based workers.

Observability
- Centralized logs, structured events, and metrics (request latency, errors).

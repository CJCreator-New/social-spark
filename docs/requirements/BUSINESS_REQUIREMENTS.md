# Business Requirements — Social Spark

Project overview
- Product: Social Spark — social content calendar, scheduling, and insights platform for teams and agencies.
- Purpose: Help teams plan, create, schedule, and measure social content efficiently.

Stakeholders
- Product Manager: owns roadmap and prioritization.
- Marketing/Content teams: primary users.
- Engineering: delivery and operations.
- Sales/Customer Success: adoption and feedback.

Business goals (SMART)
- Increase paid conversions by 15% in 12 months via premium analytics and scheduling features.
- Reduce time-to-schedule (task completion) by 30% for power users within 6 months.
- Reach NPS ≥ 40 for core scheduling flows by end of year.

Key success metrics
- Activation rate (user schedules first post within 7 days).
- Conversion rate from free→paid.
- Weekly active users (WAU) and retention at 7/30 days.
- Feature-specific metrics: posts scheduled per user, calendar interactions, analytics views.

User segments
- Solo creators: occasional scheduling, simple analytics.
- Social media managers at agencies: multi-calendar support, team workflows, advanced analytics.
- Small/medium businesses: integrated scheduling and basic analytics.

Primary use cases
- Create and schedule posts across platforms.
- Build and share editorial calendars.
- Review and approve content with collaborators.
- Track content performance and trending topics.

Constraints & assumptions
- Uses Supabase for auth and serverless functions (repo `supabase/functions`).
- Frontend is React + TypeScript + Vite + Tailwind.
- Integrations with external platforms will require OAuth and platform APIs.

Risks
- API rate limits from social platforms may constrain realtime posting.
- Data privacy/regulatory constraints for user content and analytics.

Prioritized next steps (quarterly)
1. Deliver robust calendar + scheduling MVP with multi-calendar support.
2. Add basic analytics dashboard for scheduled posts.
3. Pilot premium features for agencies (team workflows, exportable reports).

# Business Requirements — Social Spark

Project overview
- **Product**: Social Spark — social content calendar, scheduling, and AI-driven insights platform for content creators, teams, and agencies.
- **Purpose**: Help teams plan, create, schedule, optimize, and measure social content efficiently.

Stakeholders
- Product Manager: owns roadmap and prioritization.
- Marketing/Content teams: primary users.
- Engineering: delivery and operations.
- Sales/Customer Success: adoption and feedback.

Business goals (SMART)
- **Increase Paid Conversions**: Increase paid conversions by 15% in 12 months via premium analytics, AI image generation, platform repurposing, and brand memory features.
- **Reduce Time-to-Schedule**: Reduce time-to-schedule (task completion) by 30% for power users within 6 months through a centralized wizard state (`useWizardStore`) and draft recovery mechanisms.
- **Reach NPS ≥ 40**: Reach NPS ≥ 40 for core scheduling flows by end of year by delivering actionable post scoring insights and topic gap recommendations.

Key success metrics
- **Activation Rate**: User schedules first post within 7 days.
- **AI Feature Adoption**: Percentage of users utilizing image generation, inline rewrite, and platform repurposing.
- **Conversion Rate**: Free-tier to paid-tier conversions.
- **Weekly Active Users (WAU)** and retention at 7/30 days.

User segments
- **Solo creators**: Occasional scheduling, simple analytics, basic AI rewrites.
- **Social media managers at agencies**: Multi-calendar support, team workflows, custom brand memory profiles, and bulk generation.
- **Small/medium businesses**: Integrated scheduling, basic analytics, and automated image generation.

Primary use cases
- Create and schedule posts across platforms (LinkedIn, Twitter, Facebook, Instagram).
- Store and apply brand identities (voice guidelines, forbidden terms) via Brand Memory.
- Score draft quality in real-time and adapt posts using platform-specific style guides.
- Generate post-tailored cover images directly in the composer.
- Review performance insights and highlight topic gaps on calendars.
- Protect draft progress with automatic autosave and recovery flows.

Constraints & assumptions
- Primary technology stack uses Supabase for database, authentication, and edge functions.
- Client is React + TypeScript + Vite.
- Edge functions call third-party AI endpoints; requires rate limiting and cost management.

Risks & Mitigations
- **API Rate Limits**: Platform rate limits can prevent real-time posting. *Mitigation*: Robust scheduling queue.
- **AI Token Costs**: Generation functions can become expensive. *Mitigation*: Server-side per-user rate limits (e.g., 10 req/min for key functions).
- **Data Privacy**: Brand memory data and metrics must be secure. *Mitigation*: Row-Level Security (RLS) on metrics and brand memory tables.

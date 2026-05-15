# Non-Functional Requirements — Social Spark

Performance
- FCP < 2.5s on 3G simulated mobile for main views.
- API median latency < 300ms for common queries.

Scalability
- Support 10k daily active users in initial production with horizontal scaling.

Security
- OWASP Top 10 mitigations.
- Role-based access control and least privilege.
- Encryption at rest for sensitive fields as needed.

Maintainability
- Modular codebase with clear interfaces between `src/` and `supabase/functions`.
- Automated tests covering critical flows.

Availability
- Target 99.9% uptime for core scheduling APIs.

Observability
- Tracing, metrics, and centralized logs for debugging and SLO tracking.

Compliance
- Data retention and deletion policies for user content.

# Backend Requirements — Social Spark

Platform & stack
- **Service Layer**: Supabase (Postgres Database, Auth, Storage, Serverless Edge Functions).
- Serverless Edge Functions handle heavy operations, external API routing, and AI generation tasks (`supabase/functions/`).

Serverless Edge Functions (`supabase/functions/`)
1. **`generate-calendar`**: Generates a structured multi-day, multi-platform post schedule based on a topic brief. Incorporates content validation, variant evaluation, and JSON payload parsing.
2. **`generate-single-post`**: Generates a single post draft based on user specifications.
3. **`regenerate-post`**: Tweaks or regenerates a post copy based on feedback.
4. **`repurpose-post`**: Adapts an existing post copy for other social platforms using network-specific style instructions (e.g., LinkedIn vs. Twitter).
5. **`generate-post-image`**: Calls AI image generation models to produce custom visual assets and uploads them to Supabase Storage.
6. **`inline-rewrite`**: Offers micro-rewriting capabilities (e.g., shorter, punchier, change tone) on user-selected text blocks.

Content Scoring & Shared Prompt Helpers
- **`supabase/functions/_shared/promptHelpers.ts`**: Contains shared prompt assembly guidelines, length restrictions, hashtag rules, rate-limiting checks (`checkRateLimit`), and **Variant Evaluation** logic. The variant selection logic scores generated variants against hook quality, CTA relevance, and overall readability to return the best-scoring candidate.

Data, Storage & Migrations
- **Supabase Migrations**:
  - `20260602143000_post_images_bucket.sql`: Creates the public `post-images` storage bucket with appropriate access control.
  - `20260604052346_secure_metrics_and_performance.sql`: Establishes Row-Level Security (RLS) on performance metrics and scores, restricting read/write access to owning users.
  - `20260604103000_add_brand_memory.sql`: Adds support for `brand_memory` fields (custom examples, brand voice, forbidden words) in user profile tables to enrich prompts.
- **Relational Schemas**: Tables for `profiles`, `saved_calendars`, `scheduled_posts`, and `user_roles`.

Security & Compliance
- **Row-Level Security (RLS)**: Active RLS on all tables and storage buckets, ensuring users can only read or write their own data, calendars, or post images.
- **Admin Verification**: Role-based access control leveraging database RPC functions (e.g., `has_role`) to protect admin routes and management interfaces.

Reliability & Limits
- **Rate Limiting**: Per-user and per-function rate limits (e.g., maximum 10 requests per minute for high-cost generation functions) to prevent abuse and manage API costs.
- **Error Propagation**: Consistent structured error payloads returned from Edge Functions to the client-side queries.


The user wants to replace the current PostAI app with a "ContentForge" 7-day content calendar generator. The provided code is a single-file React app that:
- Uses a multi-step wizard (Industry → Topics → Generate → Calendar)
- Calls Anthropic API directly from the browser (we must replace this with our Lovable AI edge function)
- Has its own styling (custom CSS with Playfair Display + Sora fonts, dark theme)
- Generates 7 posts as JSON

Key adaptations needed:
1. **Replace direct Anthropic call** with a new Supabase edge function using Lovable AI Gateway (google/gemini-2.5-flash) — never call AI from client.
2. **Keep the existing styling approach** — inject the provided CSS and fonts. Replace current `Index.tsx` content.
3. **Fix broken JSX** in the pasted code — many JSX tags are missing (Caret, Check, SelectField, MultiSelect, the brand/stepper/screens render). I'll reconstruct them properly using the intent shown in the className strings.
4. **Remove old components** (Sidebar, PostGenerator, PlatformSelector, etc.) — not used anymore. I'll keep files but stop importing them; safer to leave them.
5. **Edge function**: new `generate-calendar` function that takes the form payload, calls Lovable AI with structured tool-calling for the 7-post array, handles 429/402.

## Plan

### 1. New edge function `supabase/functions/generate-calendar/index.ts`
- Accepts: `{ industry, industryLabel, platform, coreIdea, audiences, voice, style, goals, topics, format, cta, extra }`
- Builds the same prompt shown in the user's code
- Calls Lovable AI Gateway with `google/gemini-2.5-flash` using **tool calling** to enforce the 7-post JSON schema (day, dow, topic, format, title, hook, body, cta, hashtags, rationale)
- Handles 429 (rate limit) and 402 (credits) → returns friendly errors
- CORS headers, public (verify_jwt = false in config.toml)

### 2. Update `supabase/config.toml`
Add `[functions.generate-calendar]` with `verify_jwt = false`.

### 3. Replace `src/pages/Index.tsx`
- Inject the provided CSS + Google Fonts via a `<style>` tag and `<link>` (or just `@import` inside the style block as the code already does).
- Reconstruct the full ContentForge component with proper JSX:
  - `Caret`, `Check` SVG components
  - `SelectField` (label + native `<select>`)
  - `MultiSelect` (custom dropdown with chips)
  - 4 screens (Industry, Topics, Generating, Calendar)
  - Stepper, brand header, background grid/glow
- Replace the `fetch("https://api.anthropic.com/...")` call with `supabase.functions.invoke("generate-calendar", { body: formPayload })` using the lazy `getSupabaseClient()` helper that already exists in `src/lib/supabase.ts`.
- Keep all copy/download logic intact.

### 4. Simplify `src/App.tsx`
Remove the catch-all routing complexity if needed — actually keep as-is; just `Index` renders the new app.

### 5. Files left untouched (orphaned but harmless)
- `src/components/layout/Sidebar.tsx`, `src/components/post/*` — no longer imported.
- `supabase/functions/generate-captions/*` — leave deployed, unused.

## Technical notes
- Tool calling structure: one tool `return_calendar` with `parameters.posts` = array of 7 objects, each with the 10 required string/number fields. Force with `tool_choice: { type: "function", function: { name: "return_calendar" } }`.
- Parse `choices[0].message.tool_calls[0].function.arguments` → JSON → `.posts`.
- Frontend posts payload as JSON, expects `{ posts: [...] }` or `{ error: "..." }`.

## Out of scope (not doing)
- Authentication, persistence (no DB tables) — pure stateless generation per request.
- Removing old unused files.
- Image generation.

After approval I'll implement in this order: edge function → config.toml → Index.tsx rewrite.

# ContentForge v4 — Complete Feature List

> **38 total features** · 24 live · 9 planned · 9 AI-powered · 5 export options

---

## Status key

| Badge | Meaning |
|-------|---------|
| ✅ Live | Built and working in the current artifact |
| 🔵 Planned | Designed, not yet built |
| 🤖 AI-powered | Makes a direct call to the API |
| 🎨 UX | Editing or interface feature |
| 📤 Export | Outputs content outside the app |

---

## 1. Content generation

*9 features*

### 12-industry niche selector ✅
Tech, health, finance, education, e-commerce, marketing, startups, legal, HR, sustainability, creator economy, and custom. Each industry ships with a curated 10-topic library and an 8-option audience preset list that populates the form automatically.

### Platform-aware post structure ✅ 🤖
Each platform has its own structure rules injected into the AI prompt. LinkedIn gets single-sentence hooks that trigger "see more" and short white-spaced paragraphs. Twitter/X gets numbered threads (1/ 2/ 3/). Instagram gets a scroll-stopping first line with hashtags separated at the end. Newsletter gets subject-line-energy titles and sectioned body. Blog gets H2 subheadings and SEO-aware structure.

### 5 post type formats ✅ 🤖
- **Text post** — standard feed post following platform structure
- **Carousel** — slide-by-slide script (Slide 1: hook, Slides 2–7: one insight each, last slide: CTA)
- **Thread** — numbered entry format, each entry one idea
- **Poll** — punchy question + 4 options (under 25 chars each) + caption
- **Newsletter section** — subject line energy in title, preview text in hook, 2–3 titled body sections

### Configurable cadence — 3, 4, 5, or 7 posts/week ✅
Choose how many posts to generate. The calendar, topic picker, and generation all adapt. No more forced 7-post weeks when your schedule is 3.

### Voice and writing style selectors ✅
**11 voice options:** Technical & analytical, Conversational & warm, PM / product thinking, Opinionated & bold, Data-driven, Storytelling-first, Educational & clear, Contrarian / challenger, Founder POV, Humorous & witty, Inspirational & motivating.

**11 style options:** Short punchy lines, Long-form narrative, Lists & frameworks, Thread-style breakdown, Stats-led, Case study format, Question-led, First-person story, Myth-busting, How-to guide, Behind-the-scenes.

### Multi-audience targeting ✅
Pick up to 4 audience types from a curated list that changes per industry. Selection feeds directly into the AI prompt, shaping language, examples, and assumed knowledge level.

### Custom topic input ✅
Add topics not in the preset library by typing and pressing Enter or clicking Add. Custom topics are selectable and deletable like built-in ones.

### Markdown-formatted AI output ✅ 🤖
The AI prompt explicitly instructs the model to use `**bold**` for key terms and numbers, `*italic*` for nuance, `## headers` for sections (sparingly), and `→` for bullet lists inside the JSON string values. Rendered as real styled HTML in the card.

### Trending topic suggestions 🔵 🤖
Pull live trending topics per industry via web search, surfaced as chip suggestions in the topic picker. User reviews and confirms before adding to the selection.

---

## 2. Editing and refinement

*6 features*

### Inline field editing ✅ 🎨
Click any post field — title, hook, body, or CTA — to open an editable textarea in place. No modal, no separate screen. Save replaces the field; cancel restores the previous value.

### Per-field AI rewrite ✅ 🤖
Inside every inline edit, an "AI rewrite" button sends the current field content, platform context, and voice setting to the API and replaces just that field. No other fields are affected. Supported for: title, hook, body, CTA.

### Drag-to-reorder calendar ✅ 🎨
Posts in the calendar overview grid are draggable. Drag a post to a different day and drop — day numbers and day-of-week labels update automatically. Useful for redistributing heavy or light days.

### Rich text preview ✅ 🎨
Post body, hook, and CTA are rendered with actual HTML formatting — bold text is bold, italic is italic, headers are larger, bullet lists show `→` markers. Shows the formatted reading experience before copying.

### Hashtag editor 🔵
Edit, add, or remove individual hashtags per post without touching the body. Includes volume guidance per platform (Instagram: 20–30, LinkedIn: 3–5, Twitter/X: 1–2).

### Tone slider per post 🔵 🤖
A formal/casual slider that triggers a targeted rewrite of the post body at the selected tone level. Does not change content or structure — only the register of the language.

---

## 3. Image prompt generation

*5 features*

### Per-post AI image prompt ✅ 🤖
Generates a detailed image brief tailored to the post's title, topic, hook, industry, and platform. Output specifies subject, composition, lighting, colour palette, mood, style, aspect ratio, and quality modifiers. 60–100 words, optimised for AI image generators.

### 6 visual style options ✅
Choose a style before generating. The selected style feeds into the prompt and meaningfully changes the output:

| Style | Description |
|-------|-------------|
| Photorealistic | DSLR, natural light, documentary feel |
| Flat design | Bold colours, minimal, graphic |
| 3D render | Soft lighting, depth, modern |
| Hand-drawn | Ink sketch, textured, editorial |
| Data visual | Infographic, charts, structured |
| Abstract | Geometric, conceptual, mood-driven |

### Generate all image prompts at once ✅
"All image prompts" button runs through every post sequentially and generates missing prompts. Posts that already have a prompt are skipped — no redundant API calls.

### Direct links to 5 AI image tools ✅
One-click links open the tool in a new tab so the user can paste the prompt immediately:
- [Midjourney](https://www.midjourney.com)
- [DALL-E 3 via ChatGPT](https://chatgpt.com)
- [Ideogram](https://ideogram.ai)
- [Adobe Firefly](https://firefly.adobe.com)
- [Leonardo.ai](https://leonardo.ai)

### Inline image preview 🔵
After generating an image externally, paste the URL back into ContentForge to preview it inline alongside the post card. Stored with the session on save.

---

## 4. Performance and strategy hints

*5 features*

### Per-post performance hints ✅
Three badges appear on every post card, sourced from platform-specific data baked into the generation prompt:

- 🕐 **Best posting time** — e.g. "Tue–Thu 8–10am" for LinkedIn
- ⭐ **Engagement type** — e.g. "Comments over saves" for LinkedIn, "Saves over likes" for Instagram
- 🖼 **Visual tip** — e.g. "Clean data graphic or quote card"

### Best-day indicator in calendar ✅
Each day cell in the calendar grid shows "Best day" or "Off-peak" in a small coloured dot. Based on platform-specific peak engagement days built into the app:

| Platform | Best days |
|----------|-----------|
| LinkedIn | Tue, Wed, Thu |
| Twitter/X | Mon, Wed, Fri |
| Instagram | Mon, Wed, Fri, Sat |
| Facebook | Wed, Thu, Fri |
| Newsletter | Tue, Thu |
| Blog | Mon, Thu |

### Format spread visibility ✅
The calendar grid shows each post's format type (Storytelling, Opinion, List, etc.) as a small label on the day cell. Lets you spot a monotone week — e.g. five consecutive Opinion posts — before copying.

### Week balance score 🔵
A visual indicator that scores the week's format mix, topic variety, and posting cadence. Flags imbalances such as three consecutive opinion posts, repeated topics, or poor day distribution. Shown as a coloured bar above the calendar.

### Engagement prediction badge 🔵 🤖
Rates each post's predicted engagement level — High, Medium, or Low — based on topic, format, platform, and day of week, using a lightweight scoring prompt. Shown as a badge on each calendar cell.

---

## 5. Copy and export

*6 features*

### Plain text copy ✅ 📤
Copies a single post as clean text — all markdown stripped. Uses `navigator.clipboard.writeText` with an `execCommand` fallback for iframe environments where the Clipboard API is restricted.

### Rich copy (HTML clipboard) ✅ 📤
Uses `ClipboardItem` with both `text/html` and `text/plain` MIME types. When pasted into LinkedIn, Notion, Google Docs, or Word — bold stays bold, lists stay lists, italic stays italic. Falls back to a DOM selection + `execCommand` approach when `ClipboardItem` is unavailable.

### Copy all posts ✅ 📤
Copies every post as a single formatted text block with day headers (`=== Day 1 — Mon | Topic ===`). Image prompts are appended to each post where generated. One paste for the entire week.

### Download .txt ✅ 📤
Full formatted text file including:
- Header: industry, platform, niche, generation date
- Per post: day, DOW, topic, format, post type, best time, engagement type, full post content, rationale, visual tip, image prompt

### CSV export ✅ 📤
Spreadsheet-ready CSV with one row per post. Columns:

`Day · DOW · Platform · Topic · Post Type · Format · Title · Hook · Body · CTA · Hashtags · Best Time · Engagement Type · Image Prompt`

Designed to import directly into Buffer, Hootsuite, Notion databases, or Airtable.

### Direct Buffer / Hootsuite scheduling 🔵 📤
Connect Buffer or Hootsuite via API key entered in settings. Push all posts to the scheduling queue in one click — platform, date, best-time slot, and image prompt pre-filled from the generated data.

---

## 6. Personas and saved sessions

*5 features*

### Content persona save/load ✅
Name and save a persona that captures: platform, industry, voice, style, target audiences, goals, format preference, CTA style, and posts-per-week cadence. Load in one click from the top of Step 1 — skips all form setup for repeat visits.

Up to 8 personas stored in `localStorage` under key `contentforge_personas_v4`.

### Session save/load ✅
Save a full session to `localStorage` including posts, image prompts, image style selections, and form state. Listed on Step 1 with platform, industry, and creation date. Up to 10 sessions stored under key `contentforge_sessions_v4`.

### Session and persona delete ✅
Delete individual sessions or personas with a single click. The list updates immediately without page reload.

### Cloud sync across devices 🔵
Optional Supabase-backed persistence so sessions and personas sync across browsers and devices. Requires a Supabase project URL and anon key entered in a settings panel.

### Multi-persona quick switch 🔵 🤖
Run the same week's topics through two different personas — e.g. a LinkedIn thought leader voice and an Instagram casual creator voice — and view both sets of posts in a side-by-side comparison before choosing which to copy.

---

## 7. UX and platform infrastructure

*4 features*

### 6-platform support ✅
LinkedIn, Twitter/X, Instagram, Facebook, Newsletter, Blog/SEO. Platform selection changes: AI structure rules, performance hints, best-day indicators, topic pool bias, and image prompt aspect ratio targets.

### Responsive mobile layout ✅
Breakpoint at 580px:
- Industry grid: 4 columns → 3 columns
- Platform grid: 3 columns → 2 columns
- Post type grid: 5 columns → 3 columns
- Calendar grid: 7 columns → 4 columns
- Two-column form rows collapse to single column
- Stepper labels hidden to save space

### 3-strategy JSON parser ✅
Attempts to extract valid JSON from the AI response three ways before failing:
1. Find outermost `[` and `]` and parse the slice
2. Strip markdown fences, then retry strategy 1
3. Walk the string character by character, extract all `{...}` objects, parse each individually

If all three fail, the error message shows the first 120 characters of the raw response for debugging.

### Post history and versioning 🔵
Track edit history per post field. Undo any field to a previous version without affecting the rest of the post. Stored as a stack per field per session.

---

## Summary table

| Category | Live | Planned | Total |
|----------|------|---------|-------|
| Content generation | 8 | 1 | 9 |
| Editing and refinement | 4 | 2 | 6 |
| Image prompt generation | 4 | 1 | 5 |
| Performance and strategy | 3 | 2 | 5 |
| Copy and export | 5 | 1 | 6 |
| Personas and sessions | 3 | 2 | 5 |
| UX and platform | 3 | 1 | 4 |
| **Total** | **30** | **10** | **40** |

---

*Generated for ContentForge v4 · Built with Claude Sonnet · June 2026*
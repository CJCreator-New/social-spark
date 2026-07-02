You can paste the prompt below into Claude Code to get a deep, opinionated review and concrete improvement suggestions for your “ContentForge – Create Calendar (Niche & Idea)” app. Customize the parts in ALL CAPS brackets as needed.

***

## Claude Code – Detailed Review Prompt for ContentForge

You are an expert full‑stack engineer, product designer, and content‑workflow specialist reviewing my AI content calendar application called **ContentForge**.  
It is a web app that generates a full week of platform‑native posts for any niche, tailored to the user’s voice, audience, and goals. [localhost](http://localhost:5174/app)

### 1. Context about the app

Here is what the current app does based on the UI:

- Primary purpose: Generate a full week of platform‑native posts (LinkedIn, X/Twitter, Instagram, Facebook, Newsletter, Blog) for a chosen niche, voice, and audience. [localhost](http://localhost:5174/app)
- Main flow (multi‑step wizard):  
  - Step 1 – Industry:  
    - User selects an “Industry / Niche”, such as Tech & Software, Health & Wellness, Finance & Fintech, Education & EdTech, E‑commerce & Retail, Marketing & Growth, Startups & VC, Legal & Compliance, HR & Future of Work, Sustainability, Creator Economy, Other / Custom. [localhost](http://localhost:5174/app)
    - User selects a content platform:  
      - LinkedIn (professional long‑form)  
      - Twitter / X (short punchy threads)  
      - Instagram (visual + caption)  
      - Facebook (community & stories)  
      - Newsletter (email‑first content)  
      - Blog / SEO (long‑form articles). [localhost](http://localhost:5174/app)
    - User defines a “Core idea / angle” text area (0–300 characters) which is the north star for all generated content. [localhost](http://localhost:5174/app)
  - Step 2 – Topics (not fully shown in this snippet, but assume users add several content topics or sub‑ideas). [localhost](http://localhost:5174/app)
  - Step 3 – Generate (AI generates a 7‑day calendar of posts). [localhost](http://localhost:5174/app)
  - Step 4 – Calendar (user sees the generated calendar and can adjust posts, days, and times). [localhost](http://localhost:5174/app)
- Generation mode and schedule:  
  - User selects “Generation mode”:  
    - Full week (7 posts, Mon → Sun), OR  
    - Single day (1 post for a chosen date). [localhost](http://localhost:5174/app)
  - User sets a week starting date using day / month / year inputs, with guidance like “Day 1 will be Mon · Jul 6” and each post gets a default time, adjustable in the next screen. [localhost](http://localhost:5174/app)
- Tailor Voice & Brand Settings panel (optional, expandable):  
  - Content language (English / Tamil, etc.). [localhost](http://localhost:5174/app)
  - Target audience (locked until industry is selected). [localhost](http://localhost:5174/app)
  - Voice / tone options such as: Technical & analytical, Conversational & warm, PM / product thinking, Opinionated & bold, Data‑driven, Storytelling‑first, Educational & clear, Contrarian / challenger, Founder POV, Academic & research‑backed, Humorous & witty, Inspirational & motivating. [localhost](http://localhost:5174/app)
  - Writing style options such as: Short punchy lines, Long‑form narrative, Lists & frameworks, Thread‑style breakdown, Stats‑led, Case study format, Question‑led, First‑person story, Industry insight, Myth‑busting, How‑to guide, Behind‑the‑scenes. [localhost](http://localhost:5174/app)
  - Copy style (plain text vs various styled text when copying/scheduling). [localhost](http://localhost:5174/app)
  - Output quality: Draft (fast) vs Polished (critique & rewrite using pro model). [localhost](http://localhost:5174/app)
  - Live voice preview (shows a 2‑line sample of how posts will sound). [localhost](http://localhost:5174/app)
  - Brand Memory:  
    - Local brand memory (browser‑only) – apply or clear.  
    - Profile sync (account‑level). [localhost](http://localhost:5174/app)
  - Goals (locked until industry is selected): Awareness, Engagement, Drive traffic, Lead generation, Thought leadership, Community building, Sales & conversion. [localhost](http://localhost:5174/app)
- Saved calendars: User can “pick up where you left off” and see previous calendars (e.g., AI in software development, AI and RAG models in hospitals, AI in healthcare in India). [localhost](http://localhost:5174/app)
- Quota and plans: User sees remaining free generations and a link to “See plans”. [localhost](http://localhost:5174/app)

Assume the front‑end stack is **React + TypeScript + a typical UI library / Tailwind**, and the back‑end uses **Node/TypeScript + an LLM API** to generate posts and store calendars. (If something is unclear, make reasonable assumptions and state them explicitly.)

My personal context and goals:

- I am an operations manager, full‑stack developer, and healthcare‑tech product builder who uses AI heavily (“vibe coder”).  
- I want to **upgrade this app using Claude Code**, focusing on:  
  - Deeper, more accurate AI behavior and prompt design.  
  - Cleaner, more extensible component architecture.  
  - Better UX for creators and founders using LinkedIn and other platforms.  
  - Reliability, observability, and production‑readiness.  

***

### 2. Your tasks

Act as a **senior staff‑level engineer + product designer + AI prompt engineer**.  
Read the UI description and then give me a **detailed, opinionated review** plus **concrete improvement guidance** for this app.

Organize your response into the following sections:

#### A. Product and UX review

1. Evaluate the current flow (Industry → Topics → Generate → Calendar).  
   - Is it intuitive and minimal‑friction for a solo creator / founder?  
   - Where is cognitive load high, and how can we simplify or progressively disclose options?  
2. Critique the **voice & brand settings** UX:  
   - Are language, tone, writing style, copy style, goals, brand memory, and live preview presented in a clear hierarchy?  
   - What should be defaulted, delayed to advanced settings, or auto‑inferred from prior usage?  
3. Suggest **specific UX improvements**, such as:  
   - Better defaults for typical users (e.g., LinkedIn founders in Tech & Software).  
   - Inline examples and microcopy for “Core idea / angle.”  
   - Smart presets or templates for common use‑cases (e.g., “Thought leadership for healthtech founders” or “Launch announcement week”).  
   - Ways to reduce form fatigue (e.g., one smart free‑text prompt that gets parsed into structured settings).  

Be precise and actionable, referencing concrete UI elements from the description above.

#### B. AI prompt and generation logic

Design an improved AI layer for the generator.  
Include:

1. A **high‑level prompt architecture**:  
   - System prompt, developer prompt, and user prompt structure for:  
     - a) Generating the 7‑day content plan (titles, hooks, CTAs, etc.).  
     - b) Generating platform‑native post copy for each day.  
     - c) Optional critique‑and‑rewrite pass for “Polished” quality.  
2. A **sample system prompt** tailored to this app that:  
   - Enforces platform‑specific constraints (length, style, hashtags, hooks).  
   - Respects industry, target audience, tone, writing style, goals, and language (including Tamil as an option).  
   - Encourages variety across the 7 days (no repetitive hooks).  
3. A **sample user prompt schema** you’d send from the front‑end/back‑end, showing the JSON structure with fields like:  
   - industry, platform, content_language, target_audience, voice_tone, writing_style, goals[], core_idea, topics[], generation_mode, start_date, copy_style, output_quality, brand_memory_snapshot, previous_calendars_summary.  
4. Concrete ideas for:  
   - Personalization using **Brand Memory** across sessions.  
   - Avoiding generic “AI LinkedIn” content by using the core idea and topics more deeply.  
   - Adding a lightweight RAG layer (e.g., feeding recent posts, website copy, or Notion docs into the model for more on‑brand content).

Write everything in a way that I can directly adapt into Claude Code calls.

#### C. Code‑architecture and component review (hypothetical but concrete)

Assume a React + TypeScript front‑end with a typical folder structure like:

- `pages/app.tsx` or `routes/app.tsx`  
- `components/CalendarWizard.tsx`  
- `components/IndustrySelector.tsx`  
- `components/PlatformSelector.tsx`  
- `components/VoiceSettingsPanel.tsx`  
- `components/BrandMemoryPanel.tsx`  
- `components/CalendarPreview.tsx`  
- `lib/api.ts` for calling the back‑end  
- `lib/types.ts` for shared types

Give specific suggestions for:

1. How to structure components and props so the wizard is **easy to extend** (e.g., adding new platforms, goals, or inputs without huge refactors).  
2. How to manage form state:  
   - Centralized state (e.g., React context, Zustand, or React Hook Form) vs local component state.  
   - How to model the “generation request” object that is eventually sent to the API.  
3. Types you would define in `lib/types.ts` for:  
   - `Platform`, `Industry`, `Goal`, `VoiceTone`, `WritingStyle`, `GenerationMode`, `LanguageCode`, `CalendarDay`, `Post`, `BrandMemory`.  
4. Suggestions for error states and loading states:  
   - Handling API errors from the AI generation.  
   - Letting users retry particular days instead of regenerating the entire week.  
   - Auto‑saving draft configurations.  

Make this section concrete enough that I can directly refactor my components based on your advice.

#### D. Back‑end and reliability improvements

Assume a Node/TypeScript back‑end (Next.js API routes or Express/Fastify) that calls Claude’s API.

Provide guidance on:

1. Designing an **idempotent, traceable generation endpoint**, e.g. `POST /api/generate-calendar`:  
   - Request and response shape.  
   - How to pass metadata to the model (platform, language, goals, etc.).  
   - Correlation IDs and logging of each model call.  
2. Observability and debugging:  
   - What to log for each request (inputs, latency, model, tokens, partial outputs).  
   - How to safely sample and store prompts/outputs for quality review without leaking private data.  
3. Rate‑limiting and quota enforcement that matches the “50 free generations left” UX. [localhost](http://localhost:5174/app)
4. Suggestions to make it **Claude‑friendly**:  
   - Streaming responses to show posts progressively in the UI.  
   - Using tool calls for structured output (e.g., returning a typed JSON calendar instead of free‑form text).  

#### E. Roadmap and feature ideas

Given everything above, propose a **short roadmap** with 3 phases:

- Phase 1 – Quick wins (can ship this week).  
- Phase 2 – High‑impact upgrades (can ship this month).  
- Phase 3 – Advanced features / “wow” moments (longer‑term).

Prioritize ideas that help:

- Solo founders and creators publishing on LinkedIn / X.  
- Healthcare and tech professionals (my primary niche) using this to build thought leadership content.  

For each phase, list 3–6 specific items, and briefly state *why* each item matters.

***

### 3. Output format

Return your analysis in **Markdown** with clear section headings matching A, B, C, D, and E, and use bullet points or short paragraphs for clarity.  
Be opinionated, specific, and practical, as if you are reviewing this for a real production refactor that I will implement immediately in Claude Code.

If any assumptions are needed, state them explicitly.
Social Spark — Content AI Engineering Plan
P0 — Broken (fix immediately)
#	Problem	File	Fix
P0-1	buildUserMessage has +- bullet prefix typo — malformed markdown reaches the model	_shared/promptHelpers.ts line 651	Change \n+- → \n- throughout
P0-2	Rate limiter uses token.slice(0, 32) instead of the JWT sub — two users can share a bucket	All 6 Edge Functions	Extract getUserIdFromToken(token) helper into _shared/promptHelpers.ts, use it everywhere
P0-3	requiredWords is parsed by cleanPayload but never injected into prompts or validated post-generation	_shared/promptHelpers.ts + all Edge Functions	Add buildRequiredWordsBlock() and call it in buildSystemMessage under [CONSTRAINTS]; add a post-generation presence check in normalizePost
P0-4	enrichTopics silently returns fewer than 7 topics — calendar can receive a short topic list	_shared/promptHelpers.ts line 886-894, generate-calendar/index.ts line 67	Pad enriched topics to 7 or instruct the model to self-generate angles to reach 7
P1 — Significant gaps
#	Problem	File	Fix
P1-1	No max_tokens cap on OpenAI/OpenRouter calendar calls — truncates mid-JSON	_shared/promptHelpers.ts callOpenAiCompatibleDirect	Add max_tokens: 8192 (12288 for calendar); thread optional param through callAIGateway
P1-2	Polish pass in generate-calendar omits userToken/userIp — BYOK audit log skips polish calls	generate-calendar/index.ts lines 213-222	Thread token and ipAddress into the polish-pass options object
P1-3	repurpose-post skips scoreVariants and omits image_prompt from required schema fields	repurpose-post/index.ts	Add variant-scoring block after parseAIResponse; add "image_prompt" to schema required array
P1-4	inline-rewrite reads BYOK fields raw from body, bypassing cleanPayload — spaces in provider name can break the switch	inline-rewrite/index.ts lines 86-87	Run cleanPayload(body) at top; read payload.userApiKey / payload.userApiProvider
P1-5	scoreVariants uses greedy regex for JSON parse — can capture wrong outer object	_shared/promptHelpers.ts line 957	Apply the multi-strategy parse already used in parseAIResponse
P1-6	buildBrandMemoryPrompt emits **bold** markdown — violates the no-markdown content rule if injected into post body	src/lib/brandMemory.ts lines 28-40	Replace **FORBIDDEN PHRASES** etc. with plain uppercase labels
P1-7	TikTok has zero platform guidance — falls through to LinkedIn defaults in every platform switch	_shared/promptHelpers.ts, postInsights.ts	Add case "TikTok" to buildEngagementRules, getPlatformPreset, and HASHTAG_RANGE
P1-8	cleanPayload does not validate userApiProvider — a tampered value causes a silent 400	_shared/promptHelpers.ts cleanPayload	Validate against ["openai","anthropic","openrouter"]; clear the field if invalid
P2 — Polish
#	Problem	Fix
P2-1	BRITISH_TO_AMERICAN map missing ~15 common pairs (centre, defence, licence, labour…)	Extend the map
P2-2	postPerformanceScore scoring is platform-blind — same thresholds for LinkedIn and X	Pass platform to scoreHookStrength / scoreCtaEffectiveness; add small platform adjustments
P2-3	overallScore drops readability from the average entirely	Weight formula: hook 35%, CTA 30%, hashtags 20%, readability 15%
P2-4	enrichTopics model hardcoded to gemini-2.5-flash-lite — no fallback if deprecated	Extract to named constant ENRICHMENT_MODEL
P2-5	generate-post-image fetch has no AbortController timeout — silent hang at 50s edge function limit	Wrap with 45s abort controller; return descriptive timeout error
P2-6	repurpose-post always uses Flash regardless of quality field	Apply same draft/polished model branching as other functions
Prompt Quality Findings
Missing global constraint: "Never fabricate statistics or named studies — use qualifying language ('roughly', 'studies suggest')."
LinkedIn: Missing paragraph-chunking guidance (1-3 sentences, blank lines between — the algorithm rewards dwell time)
X/Twitter: No 280-character enforcement instruction; no guidance against standalone hashtag blocks
Instagram: Missing double-newline visual spacing guidance; hashtag range [8,15] should be updated to [3,8] (post-2024 algorithm)
inline-rewrite system message: Too minimal — no length-change guard, no platform convention rules
repurpose-post X instruction: Says "write a 3-5 tweet thread" but the schema only supports a single post object — model stuffs the whole thread into body. Either extend the schema or change the instruction.
Redundancy: The stat-hook example "70% of startups fail..." appears in both getPlatformPreset and EXEMPLARS — remove from getPlatformPreset, let examples live only in the [EXAMPLES] section.
Scoring Accuracy Findings
scoreHookStrength misses high-performing contrarian patterns: /^most .+ (are|don't|never)/i, /^stop/i, /^the (real|truth|problem)/i
getWeakestPerformanceMetric mixes scales — readability gap measured in grade-points, hook gap in 0-10 points — making the sort unreliable. Normalize all gaps to 0-10.
Instagram HASHTAG_RANGE is out of date at [8,15]; modern best practice is [3,8]
hookScore length range [35,180] is platform-blind — for X it should be [20,100]
BYOK Flow Gaps
User can toggle keyMode = 'always' after deleting their key externally — resolveAiClient guards against null apiKey, so no crash, but the UX shows "always" mode silently doing nothing
getUserApiKey has no try/catch — a cold-start failure on decrypt-api-key will throw uncaught and surface as an unhandled error
platformAvailable param in resolveAiClient is effectively dead code client-side (platform key never returned client-side) — confusing but not broken
Image Generation Gaps
No timeout — silent hang possible at edge function execution limit (P2-5)
"9:16" aspect ratio not handled — falls through to "1:1" default (wrong for Stories/TikTok)
Orphaned storage files — each regeneration creates a new path; old files never cleaned up, media_references accumulates stale rows
upsertMediaReference failure is swallowed — image uploads but is never tracked; post shows broken image on reload
No platform-specific art direction in finalPrompt — LinkedIn vs Instagram image style differs substantially
Response shape logging missing — unknown API response shapes fail silently with no diagnostic output
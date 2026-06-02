# Next Features Plan

This plan selects a small set of high-leverage features from the strategy session and keeps the current working app stable.

## Selected Features

### 1. Performance-Driven Regeneration Loop

**Goal**: Use existing performance scoring and regeneration flows to help users improve a weak post without extra manual guessing.

**Why this first**:
- It builds directly on current `PerformanceScoreCard` and regeneration behavior.
- It increases the value of every generated post.
- It is additive and does not require changes to the core generation flow.

**Planned scope**:
- Add a simple "improve this post" path from the performance card.
- Bias the next regeneration toward the weakest metric.
- Keep the current regenerate button intact.

**Non-goals**:
- No rewrite of the generation pipeline.
- No new data model for scoring history in this phase.

---

### 2. Brand Memory and Style Lock

**Goal**: Let users preserve their brand voice, preferred phrases, and formatting preferences so output gets better over time.

**Why this matters**:
- Repeated edits and regenerations usually reveal stable brand preferences.
- Storing those preferences reduces repetitive setup work.
- It makes the app feel personalized without changing the core UI.

**Planned scope**:
- Save a small set of brand rules such as preferred tone, forbidden phrases, and CTA style.
- Reuse that memory when generating future calendars.
- Offer a simple opt-in toggle so the feature does not surprise existing users.

**Non-goals**:
- No full team-level brand governance in this phase.
- No complex AI training loop.

---

### 3. Topic Gap Indicator

**Goal**: Show when the app inferred topics instead of receiving them explicitly, and explain what was filled in.

**Why this matters**:
- It builds trust when the AI fills gaps.
- It is small, visible, and easy to ship.
- It helps users understand how to improve their inputs next time.

**Planned scope**:
- Surface a small confirmation when topics were inferred.
- Show the inferred topic summary in the post generation result.
- Keep the existing optional-topics flow unchanged.

**Non-goals**:
- No blocking validation on empty topics.
- No redesign of the topic picker.

## Suggested Sequence

### Phase 1: Safe UX wins
- Ship the topic gap indicator.
- Keep it informational only.
- Add analytics so you can see how often inference is happening.

### Phase 2: Value multiplier
- Ship performance-driven regeneration.
- Tie it to the existing score card.
- Keep the default regenerate behavior available.

### Phase 3: Personalization
- Ship brand memory and style lock.
- Start with a small, editable preference set.
- Use it as a default input layer for future generations.

## Guardrails to Avoid Disturbing the Working App

- Make every feature additive.
- Keep the current generation and export flows unchanged.
- Use feature flags or simple UI toggles for new behavior.
- Avoid refactoring shared generation code unless a bug forces it.
- Validate each feature independently with typecheck and tests.

## Recommended MVP Slice

If only one small slice is built next, start with:

1. Topic gap indicator
2. Performance-driven regeneration loop
3. Brand memory as a follow-up

That order gives you a low-risk confidence boost first, then a stronger product loop, then personalization.

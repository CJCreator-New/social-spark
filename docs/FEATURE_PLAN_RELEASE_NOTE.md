# Feature Plan Release Note

This release focuses on three additive improvements that keep the current social-spark experience stable while making the app more useful over time.

## What’s Included

### 1. Topic Gap Indicator
When users skip topics, the app now makes that inference visible and explains what was filled in. This keeps the optional-topics flow intact while building trust in the AI output.

### 2. Performance-Driven Regeneration
The Enhance path now targets the weakest post metric instead of acting like a generic rewrite. This makes each regeneration more focused and more likely to improve the post.

### 3. Brand Memory and Style Lock
Users can save a lightweight set of brand preferences and reapply them to future generations. This helps the app stay consistent with voice, CTA style, and phrase preferences without changing the core wizard.

## Why It Matters

- The app becomes more personalized without becoming more complicated.
- Users get clearer feedback about how the AI is working.
- Improvements are additive and do not change the current generation or export flow.

## Safe Rollout Notes

- Keep the existing wizard and generator behavior as the default.
- Let users opt into memory-based behavior.
- Keep the topic indicator informational rather than blocking.
- Validate each feature independently with typecheck and tests.

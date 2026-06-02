# Feature Plan Checklist

Use this checklist to ship the selected features in small, safe steps.

## Phase 1: Topic Gap Indicator

- [x] Add a visible note when topics are inferred.
- [x] Confirm the note only appears after a successful generation.
- [x] Keep empty-topics generation non-blocking.
- [x] Verify the existing generation flow still works unchanged.

## Phase 2: Performance-Driven Regeneration

- [x] Keep the Enhance button in the performance card.
- [x] Target the weakest score metric when Enhance is used.
- [x] Pass the chosen focus metric through the regeneration request.
- [x] Confirm other tweak actions still behave as before.

## Phase 3: Brand Memory and Style Lock

- [x] Add a small save/apply/clear control for brand preferences.
- [x] Persist voice, style, CTA, audiences, goals, and phrase preferences.
- [x] Feed saved preferences into future generation prompts.
- [x] Make the feature optional and easy to ignore.

## Guardrails

- [x] Do not refactor the core wizard unless necessary.
- [x] Do not change export, save, or schedule behavior.
- [x] Validate each phase with typecheck and tests.
- [x] Roll out one phase at a time.

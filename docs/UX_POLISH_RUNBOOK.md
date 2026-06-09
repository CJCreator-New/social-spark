# UX Polish & Runbook

This runbook lists small, high-impact UX polish elements implemented in the application and notes on maintaining their visual standards.

## 1. Autosave & Draft Recovery UX
- **Autosave**: User entries in the generation wizard are autosaved in real-time to local storage via the Zustand store configuration.
- **Recovery Dialog**: The `DraftRecoveryDialog.tsx` component runs on application load. If an uncommitted draft is found in local storage, it triggers a modal offering the user options to "Restore Draft" (loads saved state into the store) or "Start Fresh" (clears local cache).

## 2. Skeleton & Visual States during Ingestion/Generation
- **Generate Skeleton**: Component `SkeletonList.tsx` or `VirtualizedList.tsx` placeholder cards provide expected structural feedback while AI calls run in the background.
- **Loading Transition**: `RouteFallback.tsx` displays a unified loading spinner during route changes to prevent layout stutter.

## 3. Performance-Driven Regeneration UI
- **Scores Visualization**: `PerformanceScoreCard.tsx` displays distinct progress indicators for hook quality, readability, and CTA inclusion.
- **Targeted Action**: Clicking the "Enhance" button triggers a focused regeneration mutation targeting the user's lowest scored metric with specific enhancement prompts.

## 4. Cover Image Generator UI
- **Prompts & Aspect Ratios**: `CoverImageGenerator.tsx` provides a dialog where users write image generation instructions and select aspect ratios (16:9 Landscape, 1:1 Square, 9:16 Portrait).
- **Asset Upload Feedback**: The dialog displays active progress indicators while calling the Edge Function and loading the output image.

## 5. Topic Gap Indicators
- **Theme Warnings**: Displays `TopicGapBadge` context highlights next to calendar days/topics when the generation engine infers gaps or detects uneven topic coverage.

## 6. Asynchronous Chart Loading
- **Admin Optimization**: Defer loading the large `recharts` package inside `AdminCharts.tsx`. This ensures the main landing page and wizard bundles remain lightweight, only loading charts when the `/admin` view is accessed.

## Deployment Notes
- Run unit tests: `npm run test -- --run`
- Ensure code splitting: Open Developer Tools Network tab, navigate across routes, and verify that chunks are dynamically loaded (e.g., `AdminCharts` loads only on visiting `/admin`).

# Picture-board swipe navigation

The vocabulary grid (Home and category detail) and bottom category strip support touch swipes, horizontal trackpad wheel input and left-button mouse dragging. Leftward dragging or positive horizontal wheel input advances; reversing returns. Pages stop at their ends. Edge arrows remain available to touch, keyboard and assistive activation.

Paging must not open a category, append text or speak a word. A subsequent deliberate tile click/tap still selects it. Vertical movement, multitouch cancellation and control-key pinch zoom are not page turns. Wheel deltas are normalized and accumulated; one uninterrupted burst advances at most one page. A new burst is recognized after180ms without horizontal wheel input. Swipes/drags use the existing48px horizontal threshold with horizontal movement greater than1.5times vertical movement.

## Regression evidence and boundaries

The component tests cover touch cancellation/multitouch, mouse-drag click suppression, subsequent deliberate touch/mouse and detail-zero activation, wheel burst/reversal/bounds/line deltas, and responsive page-count reduction. Astra High re-review found no remaining defect against those source/component claims after two cycles.

Browser acceptance includes four non-touch WebKit/Chromium desktop scenarios for wheel/drag across both surfaces, deliberate selection and reload; nine touch scenarios cover category browsing and grid4/grid6 at iPhone390x844, iPad768x1024 and desktop1280x720. WebKit touch uses synthetic DOM touch input; Chromium touch uses browser-dispatched input. Desktop wheel/drag uses browser mouse input, not a physical trackpad. Runtime paths are exercised by [the E2E suite](../e2e/aac-touch-grid-swipe.spec.ts); behavior regressions live in [the component suite](../tests/category-panel.test.tsx).

These tests are not physical-device acceptance or a broad visual-system approval. Short desktop category-detail views can clip lower sidebar controls; iPad first-page category icons can be crowded; Home6 has an unresolved Excuse me pictogram asset. The swipe slice does not claim those visual gaps fixed, camera reliability, or native authentication changes.

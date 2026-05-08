/**
 * background — minimal service worker.
 *
 * Currently only opens the options page when the toolbar action icon
 * is clicked. Wiring it into a SW (vs the default options_ui flow)
 * lets us add cross-tab features later (sync state across PrismAAC
 * tabs, registered keyboard shortcut handlers, etc.) without
 * restructuring the manifest.
 */

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

// Reset settings when the user upgrades to a new version with a
// breaking schema change. Currently a no-op — kept as a hook so future
// migrations have a single touchpoint.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install — show the options page so the user sees the toggles
    // before they encounter the overlay on a real text field.
    void chrome.runtime.openOptionsPage();
  }
});

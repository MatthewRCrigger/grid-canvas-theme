import { dispatchPageView } from '@theme/page-view-event';

// Loaded once per full page load via snippets/theme-scripts.liquid. Module side effects only —
// see page-view-event.js for the pure helper imported by tests. Waits for
// later parser-inserted modules while the document is loading, then fires once.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => dispatchPageView(), { once: true }); // spec-audit-disable-line no-domcontentloaded
} else {
  dispatchPageView();
}

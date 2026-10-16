import { PageViewEvent } from '@shopify/standard-events';

// Dispatch a single PageViewEvent on initial load. Each link click is a full-page
// reload (SPA navigation was removed in #702), so the script runs fresh on every
// view and one dispatch per page is sufficient.
//
// `template` is read from <main data-template="..."> (set in layout/theme.liquid
// from {{ request.page_type }}). The event flows through @shopify/standard-events to any
// Standard Events listener (analytics integrations, the events inspector, etc.).
//
// This module exports the helper without side effects. The runtime entrypoint
// (page-view-event-init.js) calls it; tests import this file directly.
export function dispatchPageView(target = document) {
  const main = document.getElementById('main-content');
  const template = main?.dataset.template || '';

  target.dispatchEvent(
    new PageViewEvent({
      page: {
        template,
        title: document.title,
        url: window.location.href,
      },
    })
  );
}

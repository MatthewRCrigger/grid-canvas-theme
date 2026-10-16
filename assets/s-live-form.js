import { partials } from '@shopify/partial-rendering';
import { CollectionUpdateEvent, SearchUpdateEvent } from '@shopify/standard-events';
import { transition } from '@theme/view-transition';
import { announceGlobalLiveRegion } from '@theme/live-region';

/**
 * <s-live-form> — Wraps a <form> and re-fetches one or more partials on every input/change
 * event, keeping collection and search results in sync without a full page reload.
 *
 * Attributes (on <s-live-form>):
 *   partial    — Comma-separated list of {% partial 'name' %} region names to fetch/apply.
 *                Must exactly match the partial wrappers in templates/search.liquid or
 *                blocks/predictive-search.liquid — renaming either side silently breaks
 *                live updates.
 *   data-no-url-sync — Uses the form action as the request URL base without changing browser
 *                      history. User-initiated submits continue as native navigation.
 *   native-submit — If present, skips partial rendering and allows explicit submits to
 *                   continue natively. Select/checkbox changes do not auto-submit.
 *   data-canonical-origin — Optional canonical origin (protocol + host) for native-submit forms.
 *                           Resolves the form's existing action against this origin for theme-dev
 *                           workarounds without hardcoding endpoint paths in JS.
 *   debounce   — Debounce delay in ms for text `input` events (default 0 = immediate).
 *   data-updated-message — i18n string announced via #sr-announcer on success.
 *   data-error-message   — i18n string announced via #sr-announcer on fetch failure.
 *
 * Required child markup:
 *   form                      — The form element driving submissions; required.
 *   [name]                    — Any named input/select/checkbox whose values are serialized
 *                               into the request URL. `name` must match the URL param the
 *                               server-side Liquid template accepts (e.g. `q`, `sort_by`, `filter.v.*`)
 *                               — renaming breaks round-trip state rehydration.
 *
 * Update triggers:
 *   input event on text inputs — Debounced by `debounce` ms (0 = immediate). Keeps typing in
 *                                query fields to one fetch/replaceState per pause instead of
 *                                one per keystroke.
 *   change on select/checkbox  — Immediate form.requestSubmit() for partial-rendering forms;
 *                                native-submit forms wait for an explicit submit button.
 *   change on text inputs      — Commit points (focus-out/Enter) flush a pending debounced
 *                                submit immediately; no-op when the debounce already fired.
 *   [data-clear-search] press  — Cancels the pending debounced submit at pointerdown (ahead
 *                                of the focus-out change-commit flush) and again on click, then
 *                                clears input[name="q"] and re-dispatches input. For pointer
 *                                activation and focus-preserving activation (AT/synthetic click
 *                                with no prior focus shift out of an edited q), only the cleared
 *                                state fetches — never the abandoned typed query. Keyboard
 *                                Tab→Enter is a two-step commit: Tabbing off an edited q fires
 *                                the change-commit flush (fetching the typed value) before the
 *                                button can cancel it, then Enter fetches the cleared state.
 *                                Two fetches, correct cleared final state — baseline-equivalent.
 *   form submit                — Cancels any pending debounced submit, then: remote-action
 *                                forms get native navigation on user-initiated submits;
 *                                partial rendering on programmatic submits.
 *
 * Dispatches:
 *   s-live-form:updated — Bubbles after a successful partial apply.
 *
 * External coupling:
 *   aria-busy attribute (on self) — Set to "true" during fetch, removed on completion.
 *   history.replaceState          — URL updated with serialized form params (local forms only).
 *   #sr-announcer (global)        — Live region for success/error announcements.
 */
// The `partial` HTML attribute is a comma-separated list of {% partial 'name' %} region names
// in the server-rendered page. These strings are a naming contract: renaming a partial on
// either the Liquid side (templates/search.liquid, blocks/predictive-search.liquid) or here
// will silently break partial-rendering updates.
class LiveForm extends HTMLElement {
  #timer;
  #programmatic = false;
  #ac;
  #abortController;
  #firstApplyComplete = false;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    const debounce = parseInt(this.getAttribute('debounce'), 10) || 0;
    const nativeSubmit = this.hasAttribute('native-submit');
    const form = this.querySelector('form');
    if (!(form instanceof HTMLFormElement)) return;

    // Rehydration: restore URL-param-driven form controls from the URL query string.
    // Skip rehydration for native-submit POST forms — their state is server-rendered,
    // not URL state. Limit rehydration to value-bearing controls to avoid overwriting
    // submit button values (e.g. localization form country_code buttons).
    if (!nativeSubmit) {
      const params = new URLSearchParams(window.location.search);
      const valueControls = 'input:not([type=submit]):not([type=button]):not([type=hidden]), select, textarea';
      for (const el of this.querySelectorAll(valueControls)) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          const values = params.getAll(el.name);
          el.checked = values.includes(el.value);
        } else {
          this.#applyRehydratedValue(el, params.get(el.name));
        }
      }
    }

    // Single update path — all events funnel through form submit
    form.addEventListener('submit', (e) => {
      // A submit supersedes any pending debounced text edit; without this an
      // Enter-committed value would fetch again when the stale timer fired.
      this.#clearTimer();
      if (nativeSubmit) {
        this.#programmatic = false;
        // Change only the origin so Shopify remains the source of truth for the action path.
        if (this.dataset.canonicalOrigin) {
          const action = new URL(form.action);
          form.action = this.dataset.canonicalOrigin + action.pathname + action.search + action.hash;
        }
        return;
      }

      // For remote forms (action differs from current page), let user-initiated
      // submits (Enter key) navigate natively. Programmatic submits from
      // input/change handlers still do partial rendering.
      if (!this.#programmatic) {
        const actionUrl = new URL(form.action);
        const currentUrl = new URL(window.location.href);
        const isRemote = actionUrl.origin !== currentUrl.origin || actionUrl.pathname !== currentUrl.pathname;
        if (isRemote || this.hasAttribute('data-no-url-sync')) return;
      }
      this.#programmatic = false;
      e.preventDefault();
      this.#update();
    }, opts);

    // Text inputs: debounced
    this.addEventListener('input', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      // Selects and checkboxes submit from the change handler below.
      if (target.matches('select, input[type="checkbox"]')) return;
      this.#clearTimer();
      if (debounce) {
        this.#timer = setTimeout(() => {
          this.#timer = null;
          this.#programmatic = true;
          form.requestSubmit();
        }, debounce);
        return;
      }

      this.#programmatic = true;
      form.requestSubmit();
    }, opts);

    // Selects & checkboxes: immediate for partial-rendering forms, explicit submission
    // required for native-submit forms. Text inputs: `change` (focus-out/Enter commit)
    // flushes a pending debounced submit so committed edits apply without waiting.
    this.addEventListener('change', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('select, input[type="checkbox"]')) {
        this.#clearTimer();
        if (nativeSubmit) return;
        this.#programmatic = true;
        form.requestSubmit();
        return;
      }
      // Only flush when a debounce timer is still pending; otherwise the
      // debounced submit already ran and losing focus must not fetch again.
      if (this.#timer != null) {
        this.#clearTimer();
        this.#programmatic = true;
        form.requestSubmit();
      }
    }, opts);

    // Clear button: resets the search input and re-triggers the input handler
    // (preserving the debounce/fetch flow). Scoped via `[data-clear-search]`
    // so consumers opt in declaratively instead of wiring inline onclick.
    // Pressing clear abandons the typed query: cancel the pending debounce at
    // pointerdown, before the focus shift fires the change-commit flush, so
    // the abandoned value never fetches ahead of the cleared submit below.
    this.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('[data-clear-search]')) return;
      this.#clearTimer();
    }, opts);

    this.addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear-search]')) return;
      const input = form.querySelector('input[name="q"]');
      if (!input) return;
      // Keyboard/AT activation skips pointerdown: cancel any still-pending
      // debounce before dispatching the cleared input so the abandoned query
      // cannot submit. Note: when keyboard focus departs an edited q (Tab to
      // this button), the change-commit flush has already fetched the typed
      // value before this handler can cancel — the clear then fetches the
      // cleared state as a second, final step.
      this.#clearTimer();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Return focus to the input: the natural continuation is typing a new query.
      input.focus();
    }, opts);

  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#abortController?.abort();
    this.#clearTimer();
  }

  // #timer doubles as pending-debounce state: non-null only while a debounced
  // submit is scheduled, so a change commit can tell "flush now" from "already ran".
  #clearTimer() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  // URLSearchParams has already decoded the param, so encoded punctuation such
  // as %26 ("&") is legitimate data — restore it verbatim, never truncate it.
  // For single selects, only apply values that match an option so a malformed URL
  // cannot blank the server-rendered selection.
  #applyRehydratedValue(el, value) {
    if (value == null) return;
    const stringValue = String(value);
    if (!stringValue.trim()) return;
    if (el instanceof HTMLSelectElement && ![...el.options].some((option) => option.value === stringValue)) {
      return;
    }
    el.value = stringValue;
  }

  async #update() {
    // Abort stale response so fast typing can't let an earlier result overwrite a fresher one
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController; // capture before any yield

    const form = this.querySelector('form');
    if (!form) return;

    const actionUrl = new URL(form.action);
    const currentUrl = new URL(window.location.href);
    const isRemote = actionUrl.origin !== currentUrl.origin || actionUrl.pathname !== currentUrl.pathname;
    const syncUrl = !isRemote && !this.hasAttribute('data-no-url-sync');
    const url = syncUrl ? new URL(window.location) : new URL(actionUrl);
    const data = new FormData(form);

    // Clean up any existing form-related parameters first
    for (const el of this.querySelectorAll('[name]')) {
      url.searchParams.delete(el.name);
    }
    // Every live query update starts at page 1. Preserve direct URL parameters not
    // owned by this form so Standard Events still reflect active platform state.
    url.searchParams.delete('page');

    for (const [name, value] of data) {
      const normalizedValue = String(value).trim();
      if (normalizedValue) url.searchParams.append(name, normalizedValue);
    }

    const attr = this.getAttribute('partial');
    if (!attr) return;

    if (syncUrl) {
      // Yield a task so the browser can paint before the URL update — and so a
      // change-flush + implicit-submit pair (Enter commit) intentionally aborts
      // this pass via `signal`, coalescing to one fetch/replaceState.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (signal.aborted) return;
      history.replaceState(history.state, '', url);
    }

    this.setAttribute('aria-busy', 'true');

    const pendingEvent = this.#dispatchStandardEvent(url);

    try {
      const names = attr.split(/\s*,\s*/);
      // @partial-fetch-contract attributes=partial
      const html = await partials.fetch(...names, { url: url.toString(), signal });
      // Supersession check: abort landed after fetch resolved but before transition.
      if (signal.aborted) {
        pendingEvent?.reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      // Record focused element before partial replacement for potential focus restoration
      const activeBeforeApply = document.activeElement;
      const hadFocusInside = this.contains(activeBeforeApply);
      const focusedId = activeBeforeApply instanceof HTMLElement ? activeBeforeApply.id : '';
      const focusedName = activeBeforeApply instanceof HTMLInputElement ? activeBeforeApply.name : '';
      const focusedValue = activeBeforeApply instanceof HTMLInputElement ? activeBeforeApply.value : '';

      await transition(() => {
        // Supersession check: apply only when this update is still current.
        if (signal.aborted) return;
        partials.apply(html);
      });

      // Supersession check: clear busy state, resolve events, and announce only when current.
      if (!signal.aborted) {
        // Restore focus if it was inside this component and is now lost
        if (hadFocusInside && activeBeforeApply instanceof HTMLElement) {
          const focusNowLost = !activeBeforeApply.isConnected || document.activeElement === document.body;
          if (focusNowLost) {
            // Reconnect focus to the equivalent control when a sort toolbar or an open
            // filter drawer's value list is patched. Never send dialog focus to q.
            const candidate = focusedId ? document.getElementById(focusedId) : null;
            const byId = candidate && this.contains(candidate) ? candidate : null;
            const byValue = focusedName
              ? [...this.querySelectorAll('input[name]')].find((input) => input.name === focusedName && input.value === focusedValue)
              : null;
            const fallback = this.querySelector('dialog[open] button[command="close"]')
              ?? form?.querySelector('input[name="q"]')
              ?? form?.querySelector('button[command="show-modal"]');
            (byId ?? byValue ?? fallback)?.focus();
          }
        }

        this.removeAttribute('aria-busy');
        pendingEvent?.resolve();

        // Schedule dedicated/generic announcement BEFORE dispatching updated event, so
        // synchronous listeners (e.g. s-predictive-search) can supersede through live-region cancellation.
        const liveAnnounce = this.querySelector('[data-live-announce]');
        const message = liveAnnounce ? liveAnnounce.textContent.trim() : this.dataset.updatedMessage;
        announceGlobalLiveRegion(message);

        this.dispatchEvent(new CustomEvent('s-live-form:updated', { bubbles: true }));

        // After the first successful apply, mark settled to skip stagger reveal on subsequent refreshes.
        if (!this.#firstApplyComplete) {
          this.#firstApplyComplete = true;
          this.setAttribute('data-stagger-settled', '');
        }
      }
    } catch (error) {
      pendingEvent?.reject(error);
      if (error.name === 'AbortError') return;
      this.removeAttribute('aria-busy');
      console.error('[s-live-form] Partial fetch failed:', error);
      announceGlobalLiveRegion(this.dataset.errorMessage);
    }
  }

  #dispatchStandardEvent(url) {
    if (this.dataset.collectionId && this.dataset.collectionHandle) {
      const deferredPromise = CollectionUpdateEvent.createPromise();
      const productFilters = CollectionUpdateEvent.parseProductFilters(url.searchParams);
      this.dispatchEvent(new CollectionUpdateEvent({
        collection: {
          id: this.dataset.collectionId,
          handle: this.dataset.collectionHandle,
          productsCount: this.#getResultsCount(),
        },
        ...(productFilters && { productFilters }),
        sortKey: CollectionUpdateEvent.getSortKey(url.searchParams),
        promise: deferredPromise.promise,
      }));
      return {
        resolve: () => deferredPromise.resolve({ productsCount: this.#getResultsCount() }),
        reject: (error) => deferredPromise.reject(error),
      };
    }

    const isPredictive = !!this.closest('s-predictive-search');
    const query = url.searchParams.get('q')?.trim() || '';
    if (!query) return;

    const deferredPromise = SearchUpdateEvent.createPromise();
    const productFilters = isPredictive
      ? undefined
      : SearchUpdateEvent.parseProductFilters(url.searchParams);

    this.dispatchEvent(
      new SearchUpdateEvent({
        search: {
          query,
          ...(productFilters && { productFilters }),
          sortKey: isPredictive ? undefined : SearchUpdateEvent.getSortKey(url.searchParams),
        },
        promise: deferredPromise.promise,
      })
    );

    return {
      resolve: () => deferredPromise.resolve({ totalCount: this.#getResultsCount() }),
      reject: (error) => deferredPromise.reject(error),
    };
  }

  #getResultsCount() {
    const marker = this.querySelector('[data-results-count]');
    return Number(marker?.textContent || 0);
  }
}
customElements.define('s-live-form', LiveForm);

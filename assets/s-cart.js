/**
 * <s-cart> manages all cart quantity updates and removals via the command pattern.
 * It fetches partials after each mutation so the cart drawer, cart page, and header
 * counters all stay in sync — do not convert to a full page reload or direct DOM manipulation.
 *
 * Commands (dispatched via commandfor/command on descendant buttons):
 *   --update-quantity — Adjusts quantity by [data-delta] for [data-line-key]; debounced 200ms per line.
 *   --remove          — Cancels queued/in-flight work for [data-line-key], then sets quantity to 0.
 *   --apply-discount  — Applies the value of the descendant [data-discount-code] input.
 *
 * Required child markup (queried by selector/attribute):
 *   [data-variant-id]                                — Visual/fallback identifier for a line's row and controls.
 *   [data-line-key]                                  — Primary cart line identity ({{ item.key }}); sent to updateCart as the line id.
 *   [data-delta]                                     — Integer delta (±N) paired with --update-quantity.
 *   [data-qty-min]                                   — Minimum quantity from variant.quantity_rule.min (default 1).
 *   [data-qty-max]                                   — Maximum quantity from variant.quantity_rule.max (when absent, no max).
 *   [data-qty-step]                                  — Increment step from variant.quantity_rule.increment (default 1).
 *   [data-quantity-display][data-line-key]           — Input/element holding the current quantity (value or textContent).
 *   [data-discount-code]                             — Discount-code input read by --apply-discount and Enter.
 *   [style*="view-transition-name"]                  — Row wrapper used for removal focus-restore + view transitions.
 *
 * Element dataset (attributes on <s-cart> itself):
 *   data-partials — Comma-separated partial names to re-fetch (default: "cart-items,cart-count").
 *                   Must match {% partial 'name' %} blocks in cart.liquid / theme.liquid / cart-drawer.liquid.
 *
 * External coupling:
 *   Cart feedback (#sr-announcer + s-notification:add) is owned by the updateCart
 *   handler in standard-actions-override.js — do not duplicate here.
 */
import { partials } from '@shopify/partial-rendering';
import { transition } from '@theme/view-transition';
import { normalizeQuantity, quantityRulesFromDataset } from '@theme/quantity-rules';
import { ViewEventElement } from '@theme/s-view-event';

class CartItems extends ViewEventElement {
  static #pendingFocusStates = new Map();
  static #refreshRevision = 0;

  #lifecycleAc;
  #quantityAcs = new Map();
  #discountAc;
  #noteAc;
  #rafId;
  #debounceTimers = new Map();
  #rollbackValues = new Map();
  #openDetails = new Set();

  static async refreshMountedCarts({ signal } = {}) {
    const revision = ++CartItems.#refreshRevision;
    signal?.throwIfAborted();

    const carts = [...document.querySelectorAll('s-cart')].filter((cart) => cart instanceof CartItems);
    const partialNames = [...new Set(carts.flatMap((cart) => cart.#partialNames))];

    if (!partialNames.length) return;

    // Capture UI state before partial rendering replaces the DOM.
    const focusStates = new Map();
    for (const cart of carts) {
      cart.#saveTransientState();
      focusStates.set(
        cart.id,
        CartItems.#pendingFocusStates.get(cart.id) ?? cart.#refreshFocusState()
      );
    }

    let html;
    try {
      // @partial-fetch-contract attributes=data-partials fallback=cart-items,cart-count
      html = await partials.fetch(...partialNames, { signal });
    } catch (error) {
      signal?.throwIfAborted();
      if (revision !== CartItems.#refreshRevision) return;
      throw error;
    }

    signal?.throwIfAborted();
    if (revision !== CartItems.#refreshRevision) return;

    let applied = false;
    try {
      await transition(() => {
        if (revision !== CartItems.#refreshRevision) return;
        signal?.throwIfAborted();
        partials.apply(html);
        applied = true;
      });
    } catch (error) {
      signal?.throwIfAborted();
      if (revision !== CartItems.#refreshRevision) return;
      throw error;
    }

    signal?.throwIfAborted();
    if (!applied || revision !== CartItems.#refreshRevision) return;

    for (const previousCart of carts) {
      const cart = previousCart.#mountedCart();
      cart.#openDetails = new Set(previousCart.#openDetails);
      cart.#reconcileAfterRefresh();
      const focusState = focusStates.get(previousCart.id);
      cart.#restoreRefreshFocus(focusState);
      if (CartItems.#pendingFocusStates.get(previousCart.id) === focusState) {
        CartItems.#pendingFocusStates.delete(previousCart.id);
      }
    }

    signal?.throwIfAborted();
  }

  connectedCallback() {
    super.connectedCallback();

    this.#lifecycleAc = new AbortController();
    const opts = { signal: this.#lifecycleAc.signal };

    this.addEventListener('command', (e) => {
      const variantId = e.source.dataset.variantId;
      const lineKey = e.source.dataset.lineKey;

      if (e.command === '--update-quantity') {
        if (!lineKey) return;
        const display = this.#quantityDisplayForLine(lineKey, variantId);
        if (!display) return;
        const current = parseInt(display.value ?? display.textContent, 10) || 0;
        const delta = parseInt(e.source.dataset.delta, 10) || 0;
        const newQuantity = normalizeQuantity(
          current + delta,
          quantityRulesFromDataset(e.source),
          { allowZero: true }
        );

        display.value = newQuantity;
        const focusTarget = { lineKey, variantId, delta: e.source.dataset.delta };
        if (!this.#debounceTimers.has(lineKey)) this.#rollbackValues.set(lineKey, current);
        clearTimeout(this.#debounceTimers.get(lineKey));
        const rollbackValue = this.#rollbackValues.get(lineKey);
        this.#debounceTimers.set(lineKey, setTimeout(() => {
          this.#debounceTimers.delete(lineKey);
          this.#rollbackValues.delete(lineKey);
          this.#updateCart(lineKey, variantId, newQuantity, focusTarget, () => {
            const el = this.#quantityDisplayForLine(lineKey, variantId);
            if (el) el.value = rollbackValue;
          });
        }, 200));
      }

      if (e.command === '--remove') {
        if (!lineKey) return;
        this.#updateCart(lineKey, variantId, 0);
      }

      if (e.command === '--apply-discount') {
        this.#applyDiscount(this.querySelector('[data-discount-code]')?.value);
      }
    }, opts);

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches?.('[data-discount-code]')) {
        e.preventDefault();
        this.#applyDiscount(e.target.value);
      }
    }, opts);

    this.addEventListener('change', (e) => {
      const input = e.target;

      if (input.matches('[data-quantity-display]')) {
        const variantId = input.dataset.variantId;
        const lineKey = input.dataset.lineKey;
        if (!lineKey) return;
        const parsed = parseInt(input.value, 10);
        const quantity = normalizeQuantity(
          parsed,
          quantityRulesFromDataset(input),
          { allowZero: true }
        );

        // Capture the pre-edit committed value for rollback on mutation failure.
        // defaultValue reflects the server-committed state maintained by #reconcileAfterRefresh.
        const committedValue = input.defaultValue;
        input.value = quantity;
        this.#updateCart(lineKey, variantId, quantity, { lineKey, variantId, input: true }, () => {
          const el = this.#quantityDisplayForLine(lineKey, variantId);
          if (el) el.value = committedValue;
        });
      } else if (input.id === 'cart-note') {
        this.#updateNote(input.value);
      }
    }, opts);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#lifecycleAc?.abort();
    for (const controller of this.#quantityAcs.values()) controller.abort();
    this.#quantityAcs.clear();
    this.#discountAc?.abort();
    this.#noteAc?.abort();
    for (const timer of this.#debounceTimers.values()) clearTimeout(timer);
    this.#debounceTimers.clear();
    this.#rollbackValues.clear();
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
  }

  #findLineElement(selector, lineKey, variantId = null) {
    for (const el of this.querySelectorAll(selector)) {
      if (lineKey && el.dataset.lineKey === lineKey) return el;
    }

    if (!variantId) return null;
    for (const el of this.querySelectorAll(selector)) {
      if (el.dataset.variantId === variantId) return el;
    }

    return null;
  }

  #quantityDisplayForLine(lineKey, variantId) {
    return this.#findLineElement('[data-quantity-display]', lineKey, variantId);
  }

  #findCartRow(lineKey, variantId) {
    return this.#findLineElement('[data-line-key], [data-variant-id]', lineKey, variantId)
      ?.closest('[style*="view-transition-name"]');
  }

  #mountedCart() {
    if (this.isConnected) return this;

    const replacement = this.id ? this.ownerDocument.getElementById(this.id) : null;
    return replacement instanceof CartItems ? replacement : this;
  }

  #refreshFocusState() {
    const active = this.ownerDocument.activeElement;
    if (!active?.matches || !this.contains(active)) return null;

    if (active.matches('[data-discount-code], button[command="--apply-discount"]')) {
      return { discountTarget: active.matches('[data-discount-code]') ? 'input' : 'button' };
    }

    const lineKey = active.dataset.lineKey;
    const variantId = active.dataset.variantId;
    if (active.matches('button[command="--remove"]')) {
      const row = this.#findCartRow(lineKey, variantId);
      const sibling = row?.nextElementSibling || row?.previousElementSibling;
      const siblingLine = sibling?.querySelector('[data-line-key], [data-variant-id]');
      return {
        isRemoval: true,
        siblingLineKey: siblingLine?.dataset.lineKey,
        siblingVariantId: siblingLine?.dataset.variantId,
      };
    }

    if (active.matches('button[data-delta], [data-quantity-display]')) {
      return {
        focusTarget: {
          lineKey,
          variantId,
          delta: active.dataset.delta,
          input: active.matches('[data-quantity-display]'),
        },
      };
    }

    return null;
  }

  #restoreRefreshFocus(state) {
    if (!state) return;
    const { isRemoval, siblingLineKey, siblingVariantId, focusTarget, discountTarget } = state;

    if (isRemoval) {
      this.#focusAfterRemoval(siblingLineKey, siblingVariantId);
    } else if (discountTarget) {
      const selector = discountTarget === 'input'
        ? '[data-discount-code]'
        : 'button[command="--apply-discount"]';
      this.querySelector(selector)?.focus();
    } else {
      this.#focusTarget(focusTarget)?.focus();
    }
  }

  #focusTarget({ lineKey, variantId, delta, input } = {}) {
    const selector = input ? '[data-quantity-display]' : 'button[data-delta]';
    let variantFallback = null;

    for (const el of this.querySelectorAll(selector)) {
      const deltaMatches = input || delta == null || el.dataset.delta === delta;
      if (!deltaMatches) continue;
      if (lineKey && el.dataset.lineKey === lineKey) return el;
      if (!variantFallback && variantId && el.dataset.variantId === variantId) {
        variantFallback = el;
      }
    }

    return variantFallback;
  }

  #focusAfterRemoval(siblingLineKey, siblingVariantId) {
    const freshRow = siblingLineKey || siblingVariantId
      ? this.#findCartRow(siblingLineKey, siblingVariantId)
      : null;
    const siblingControl = freshRow?.querySelector('a, button');
    if (siblingControl) {
      siblingControl.focus();
      return;
    }

    const anyControl = this.querySelector('a, button');
    if (anyControl) {
      anyControl.focus();
      return;
    }

    const enclosingDialog = this.closest('dialog[open]');
    const closeButton = enclosingDialog?.querySelector('button[command="close"]');
    if (closeButton) {
      closeButton.focus();
      return;
    }

    const main = document.getElementById('main-content') || this.closest('main');
    main?.focus();
  }

  #restoreFocusAfterMutation(focusState) {
    const { isRemoval, siblingLineKey, siblingVariantId, focusTarget } = focusState;
    if (CartItems.#pendingFocusStates.get(this.id) === focusState) {
      CartItems.#pendingFocusStates.delete(this.id);
    }

    cancelAnimationFrame(this.#rafId);
    this.#rafId = requestAnimationFrame(() => {
      const cart = this.#mountedCart();

      if (isRemoval) {
        cart.#focusAfterRemoval(siblingLineKey, siblingVariantId);
      } else if (focusTarget) {
        cart.#focusTarget(focusTarget)?.focus();
      }

      this.#rafId = null;
    });
  }

  #abortQuantityMutation(lineKey) {
    // A queued debounce has no AbortSignal yet, so cancel it explicitly before
    // aborting active work. This ensures an immediate remove or input commit wins.
    clearTimeout(this.#debounceTimers.get(lineKey));
    this.#debounceTimers.delete(lineKey);
    this.#rollbackValues.delete(lineKey);

    const controller = this.#quantityAcs.get(lineKey);
    controller?.abort();
    this.#quantityAcs.delete(lineKey);
  }

  #settleQuantityMutation(lineKey, controller) {
    if (this.#quantityAcs.get(lineKey) !== controller) return;

    this.#quantityAcs.delete(lineKey);
    if (this.#quantityAcs.size === 0) this.removeAttribute('aria-busy');
  }

  get #partialNames() {
    // dataset.partials mirrors the Liquid-written data-partials="..." attribute.
    // The fallback names ('cart-items', 'cart-count') must stay in sync with the
    // {% partial %} block names in cart.liquid and theme.liquid (cart-count) — renaming either breaks cart updates.
    const names = this.dataset.partials;
    return names ? names.split(',').map((s) => s.trim()) : ['cart-items', 'cart-count'];
  }

  #saveTransientState() {
    this.#openDetails.clear();
    for (const details of this.querySelectorAll('details[open]')) {
      const id = details.querySelector('summary')?.textContent.trim();
      if (id) this.#openDetails.add(id);
    }
  }

  #reconcileAfterRefresh() {
    for (const input of this.querySelectorAll('[data-quantity-display]')) {
      if ((input instanceof HTMLInputElement)) {
        // partials.apply() preserves form control state, but cart quantities are
        // server-owned after a cart refresh and should reflect the new markup.
        input.value = input.defaultValue;
      }
    }

    // Restore <details> open state lost during partial rendering
    for (const details of this.querySelectorAll('details')) {
      const id = details.querySelector('summary')?.textContent.trim();
      if (id && this.#openDetails.has(id)) details.open = true;
    }
    this.#openDetails.clear();
  }

  async #updateCart(lineKey, variantId, quantity, focusTarget = null, onRollback = null) {
    // Cancel queued and in-flight work for this line so the latest action wins.
    this.#abortQuantityMutation(lineKey);
    const controller = new AbortController();
    this.#quantityAcs.set(lineKey, controller);
    const { signal } = controller;

    this.setAttribute('aria-busy', 'true');

    const isRemoval = quantity === 0;
    const row = isRemoval ? this.#findCartRow(lineKey, variantId) : null;
    const sibling = row?.nextElementSibling || row?.previousElementSibling;
    const siblingLine = sibling?.querySelector('[data-line-key], [data-variant-id]');
    const siblingLineKey = siblingLine?.dataset.lineKey;
    const siblingVariantId = siblingLine?.dataset.variantId;
    const pendingFocusState = {
      isRemoval,
      siblingLineKey,
      siblingVariantId,
      focusTarget,
    };
    if (this.id) CartItems.#pendingFocusStates.set(this.id, pendingFocusState);

    try {
      // Cart mutation goes through Standard Actions (Storefront API). The shared
      // updateCart override in standard-actions-override.js triggers a partial refresh
      // (cart-items, cart-count, etc.) via CartItems.refreshMountedCarts() after the
      // mutation resolves. The {% partial 'name' %} blocks in cart.liquid, theme.liquid,
      // and snippets/cart-drawer.liquid remain the source of truth for what gets re-rendered.
      const result = await window.Shopify.actions.updateCart(
        { lines: [{ id: lineKey, quantity }] },
        {
          event: { context: 'cart' },
          signal,
        }
      );

      const userError = result?.userErrors?.[0]?.message;
      if (userError) {
        throw new Error(userError, {
          cause: { userErrors: result.userErrors },
        });
      }

      const replacementApplied = signal.aborted && this.#mountedCart() !== this;
      if (signal.aborted && !replacementApplied) return;
      if (!signal.aborted) this.#settleQuantityMutation(lineKey, controller);

      // The Standard Actions override owns feedback: non-toast success uses
      // #sr-announcer, while any toast owns its live role. Avoid a local duplicate.
      this.#restoreFocusAfterMutation(pendingFocusState);
    } catch (error) {
      const replacementApplied = signal.aborted && this.#mountedCart() !== this;
      if (replacementApplied) {
        this.#restoreFocusAfterMutation(pendingFocusState);
        return;
      }
      if (CartItems.#pendingFocusStates.get(this.id) === pendingFocusState) {
        CartItems.#pendingFocusStates.delete(this.id);
      }
      if (signal.aborted) return;
      onRollback?.();
      this.#settleQuantityMutation(lineKey, controller);
      // Cart error toast feedback is owned by the Standard Actions override.
      // Don't duplicate the announcement on [data-cart-status].
    }
  }

  async #applyDiscount(code) {
    code = code?.trim();
    if (!code) return;

    this.#discountAc?.abort();
    this.#discountAc = new AbortController();
    const { signal } = this.#discountAc;

    this.setAttribute('aria-busy', 'true');
    try {
      const result = await window.Shopify.actions.updateCart(
        { discountCodes: [code] },
        { event: { context: 'cart' }, signal }
      );
      const userError = result?.userErrors?.[0]?.message;
      if (userError) throw new Error(userError, { cause: { userErrors: result.userErrors } });
      if (signal.aborted) return;
      this.removeAttribute('aria-busy');
    } catch (error) {
      if (signal.aborted) return;
      this.removeAttribute('aria-busy');
    }
  }

  async #updateNote(note) {
    this.#noteAc?.abort();
    this.#noteAc = new AbortController();
    const { signal } = this.#noteAc;

    this.setAttribute('aria-busy', 'true');
    try {
      await window.Shopify.actions.updateCart(
        { note },
        { event: { context: 'cart' }, signal }
      );
      if (signal.aborted) return;
      this.removeAttribute('aria-busy');
    } catch (error) {
      if (signal.aborted) return;
      this.removeAttribute('aria-busy');
    }
  }

}

if (!customElements.get('s-cart')) {
  customElements.define('s-cart', CartItems);
}

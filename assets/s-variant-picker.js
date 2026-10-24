/**
 * <s-variant-picker> — Listens for option `change` events and swaps the product form
 * and title via partial rendering, keeping price and add-to-cart state in
 * sync with the selected variant without a full page reload.
 *
 * Required child markup:
 *   [data-variant-id]           — On each swatch/radio/select option input; value used to
 *                                 build the ?variant= URL param and trigger the partial fetch.
 *   select > option[data-variant-id] — Alternative: variant id carried on <option> elements
 *                                       inside a <select> (read via selectedOptions[0].dataset).
 *   input[name="id"]            — Hidden product-form input kept in sync for add-to-cart.
 *   input[name="quantity"]      — Quantity input preserved across product-form swaps.
 *
 * Element dataset (on <s-variant-picker>):
 *   data-updated-message   — i18n string announced via #sr-announcer after the variant updates.
 *   data-error-message     — i18n string shown locally and announced after a current update fails.
 *
 * Optional child markup:
 *   [data-variant-picker-error] — Visible error owned by the picker; add-to-cart errors remain
 *                                 owned by [data-add-to-cart-error].
 *
 * Partial contract:
 *   "product-form"   — must match {% partial "product-form" %} in templates/product.liquid.
 *   "product-title"  — must match {% partial "product-title" %} in templates/product.liquid.
 *   "product-media"  — must match {% partial "product-media" %} in templates/product.liquid.
 *                      Renaming either side silently breaks variant switching.
 *
 * External coupling:
 *   history.replaceState                  — ?variant= URL param updated on every selection.
 *   #sr-announcer (global)                — Live region announced with success/error feedback.
 *   aria-busy (on self)                   — Set while the current variant update is pending.
 */
// <s-variant-picker> listens for option changes and swaps the product form +
// title via partial rendering. This keeps price and the add-to-cart
// button in sync with the selected variant without a full page reload.
import { partials } from '@shopify/partial-rendering';
import { ProductSelectEvent } from '@shopify/standard-events';
import { transition } from '@theme/view-transition';
import { announceGlobalLiveRegion } from '@theme/live-region';

const PRODUCT_VIEW_PAYLOAD_SELECTOR = 'script[type="application/json"][data-product-view-payload]';
const ACTIVE_UPDATE = Symbol('s-variant-picker-active-update');

class VariantPicker extends HTMLElement {
  #ac;
  #abortController;
  #committedHistoryState;
  #committedSelection;
  #committedUrl;
  #committedVariantId;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };
    const productForm = this.closest('[data-product-form]');

    // The server-rendered form is the committed state to restore if its replacement fails.
    this.#committedVariantId = this.#getSelectedVariantId(productForm);
    this.#committedUrl = location.href;
    this.#committedHistoryState = history.state;
    this.#committedSelection = this.#captureSelection();

    this.addEventListener('change', (e) => {
      const input = e.target;
      const variantId = input.dataset.variantId
        || input.selectedOptions?.[0]?.dataset?.variantId;
      if (variantId) {
        this.#update(variantId);
      }
    }, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#abortController?.abort();
  }

  async #update(variantId) {
    const productForm = this.closest('[data-product-form]');
    const updateHost = productForm || this;

    // The stable product-form host coordinates picker instances replaced by their own partial.
    // Refresh URL/history only when no optimistic update is active, never from a stale candidate.
    if (!updateHost[ACTIVE_UPDATE]) {
      this.#committedUrl = location.href;
      this.#committedHistoryState = history.state;
    }
    updateHost[ACTIVE_UPDATE]?.abort();
    this.#abortController?.abort();
    const controller = new AbortController();
    this.#abortController = controller;
    updateHost[ACTIVE_UPDATE] = controller;

    const quantityValue = this.#getQuantityValue(productForm);
    let focusCapture = null;
    this.#syncSelectedVariantId(variantId, productForm);
    this.#showError('');
    this.setAttribute('aria-busy', 'true');

    const deferredEvent = ProductSelectEvent.createPromise();
    this.dispatchEvent(
      new ProductSelectEvent({
        product: {
          id: this.dataset.productId || '',
          title: this.dataset.productTitle || '',
          handle: this.dataset.productHandle || '',
        },
        selectedOptions: this.#getSelectedOptions(),
        promise: deferredEvent.promise,
      })
    );

    const url = new URL(location.href);
    // ?variant is a Shopify platform contract — the server reads it to pre-select and render the
    // matching variant on page load / deep-link. Renaming this param breaks variant URL sharing.
    url.searchParams.set('variant', variantId);

    try {
      // Let the browser paint before URL update.
      await new Promise(resolve => setTimeout(resolve, 0));
      this.#throwIfSuperseded(controller, updateHost);
      history.replaceState(history.state, '', url);

      // 'product-form', 'product-title' and 'product-media' must match the {% partial %} names in
      // templates/product.liquid — changing any name here or there breaks variant switching.
      const html = await partials.fetch('product-form', 'product-title', 'product-media', { url: url.toString(), signal: controller.signal });
      this.#throwIfSuperseded(controller, updateHost);
      await transition(() => {
        this.#throwIfSuperseded(controller, updateHost);
        // Capture at replacement time so focus moved during the fetch is never stolen back.
        focusCapture = this.#captureFocus();
        partials.apply(html);
      });

      // Applying product-form disconnects this picker. Ownership, rather than its now-aborted
      // signal, distinguishes that expected replacement from a newer picker selection.
      if (updateHost[ACTIVE_UPDATE] !== controller) throw this.#abortError(controller);

      this.#syncSelectedVariantId(variantId, productForm);
      this.#syncQuantityValue(quantityValue, productForm);
      this.#restoreFocus(focusCapture, productForm);

      deferredEvent.resolve({ variant: this.#getSelectedVariantPayload(productForm) });

      if (this.isConnected) this.#commitState(variantId, url);
      announceGlobalLiveRegion(this.dataset.updatedMessage);
    } catch (error) {
      deferredEvent.reject(error);

      const superseded = updateHost[ACTIVE_UPDATE] !== controller;
      if (superseded || !this.isConnected) return;

      this.#restoreCommittedState(productForm);
      if (error?.name === 'AbortError') return;

      this.#showError(this.dataset.errorMessage);
      announceGlobalLiveRegion(this.dataset.errorMessage);
      console.error('[s-variant-picker] Partial fetch failed:', error);
    } finally {
      if (updateHost[ACTIVE_UPDATE] === controller) delete updateHost[ACTIVE_UPDATE];
      if (this.#abortController === controller) {
        this.#abortController = null;
        this.removeAttribute('aria-busy');
      }
    }
  }

  #getSelectedOptions() {
    return Array.from(
      this.querySelectorAll('select[name], input[type="radio"][name]:checked')
    ).map((control) => ({
      name: control.name,
      value: String(control.value ?? ''),
    }));
  }

  #captureSelection() {
    return Array.from(
      this.querySelectorAll('select[name], input[type="radio"][name]')
    ).map((control) => {
      if (control instanceof HTMLSelectElement) {
        return {
          control,
          selected: Array.from(control.options, (option) => option.selected),
        };
      }

      return { control, checked: control.checked };
    });
  }

  #restoreCommittedState(productForm) {
    for (const state of this.#committedSelection || []) {
      if (!this.contains(state.control)) continue;

      if (state.control instanceof HTMLSelectElement) {
        Array.from(state.control.options).forEach((option, index) => {
          option.selected = state.selected[index] || false;
        });
      } else {
        state.control.checked = state.checked;
      }
    }

    this.#syncSelectedVariantId(this.#committedVariantId, productForm);
    history.replaceState(this.#committedHistoryState, '', this.#committedUrl);
  }

  #commitState(variantId, url) {
    this.#committedVariantId = variantId;
    this.#committedUrl = url.toString();
    this.#committedHistoryState = history.state;
    this.#committedSelection = this.#captureSelection();
  }

  #captureFocus() {
    const activeElement = document.activeElement;
    if (!this.contains(activeElement)) return null;

    if (activeElement instanceof HTMLInputElement && activeElement.type === 'radio') {
      return {
        type: 'radio',
        name: activeElement.name,
        value: activeElement.value,
        control: activeElement,
      };
    }

    // Capture stable identity for select elements.
    if (activeElement instanceof HTMLSelectElement) {
      return {
        type: 'select',
        name: activeElement.name,
        control: activeElement,
      };
    }

    return null;
  }

  #restoreFocus(focusCapture, productForm = this.closest('[data-product-form]')) {
    if (!focusCapture || focusCapture.control.isConnected) return;
    if (document.activeElement !== document.body && document.activeElement !== document.documentElement) return;

    const newPicker = productForm?.querySelector('s-variant-picker');
    if (!newPicker) return;

    let candidates;
    if (focusCapture.type === 'radio') {
      candidates = newPicker.querySelectorAll('input[type="radio"][name]');
      candidates = [...candidates].filter((control) => (
        control.name === focusCapture.name && control.value === focusCapture.value
      ));
    } else {
      candidates = [...newPicker.querySelectorAll('select[name]')]
        .filter((control) => control.name === focusCapture.name);
    }

    candidates[0]?.focus();
  }

  #getSelectedVariantId(productForm = this.closest('[data-product-form]')) {
    const variantInput = productForm?.querySelector('input[name="id"]');
    return variantInput instanceof HTMLInputElement ? variantInput.value : '';
  }

  #syncSelectedVariantId(variantId, productForm = this.closest('[data-product-form]')) {
    const variantInput = productForm?.querySelector('input[name="id"]');
    if (variantInput instanceof HTMLInputElement) {
      variantInput.value = variantId;
    }
  }

  #showError(message) {
    const error = this.querySelector('[data-variant-picker-error]');
    if (!error) return;

    if (message) error.textContent = message;
    error.hidden = !message;
  }

  #throwIfSuperseded(controller, updateHost) {
    if (!controller.signal.aborted && updateHost[ACTIVE_UPDATE] === controller) return;
    throw this.#abortError(controller);
  }

  #abortError(controller) {
    const reason = controller.signal.reason;
    if (reason instanceof Error && reason.name === 'AbortError') return reason;
    return new DOMException('Variant update superseded', 'AbortError');
  }

  #getQuantityValue(productForm = this.closest('[data-product-form]')) {
    const quantityInput = productForm?.querySelector('input[name="quantity"]');
    return quantityInput instanceof HTMLInputElement ? quantityInput.value : null;
  }

  #syncQuantityValue(quantityValue, productForm = this.closest('[data-product-form]')) {
    if (!quantityValue) return;

    const quantityInput = productForm?.querySelector('input[name="quantity"]');
    if (quantityInput instanceof HTMLInputElement) {
      quantityInput.value = this.#clampQuantityValue(quantityValue, quantityInput);
      quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  #clampQuantityValue(quantityValue, quantityInput) {
    const parsedValue = Number(quantityValue);
    if (!Number.isFinite(parsedValue)) return quantityValue;

    let clampedValue = parsedValue;
    const min = Number(quantityInput.min);
    const max = Number(quantityInput.max);

    if (quantityInput.min && Number.isFinite(min)) {
      clampedValue = Math.max(min, clampedValue);
    }
    if (quantityInput.max && Number.isFinite(max)) {
      clampedValue = Math.min(max, clampedValue);
    }

    return String(clampedValue);
  }

  #getSelectedVariantPayload(productForm = this.closest('[data-product-form]')) {
    const marker = productForm?.querySelector(PRODUCT_VIEW_PAYLOAD_SELECTOR);
    const payload = marker?.textContent?.trim();
    if (!payload) return null;

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      console.error('[variant-picker] Failed to parse product view payload:', error);
      return null;
    }

    return parsedPayload?.product?.selectedVariant || null;
  }
}
customElements.define('s-variant-picker', VariantPicker);

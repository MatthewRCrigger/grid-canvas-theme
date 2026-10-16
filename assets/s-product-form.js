import { getCartErrorMessage } from '@theme/cart-feedback';

class SProductForm extends HTMLElement {
  #ac;
  #abortController;
  #activeSubmitter;
  #activeSubmitterAriaDisabled;
  #activeSubmitterHadOpacityClass;
  #activeSubmitterHadCursorWaitClass;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('submit', (event) => {
      if (!this.#shouldHandleSubmit(event)) return;

      event.preventDefault();
      if (this.getAttribute('aria-busy') === 'true') return;

      this.#submit(event.target, event.submitter);
    }, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#abortController?.abort();
    this.#setSubmitting(false);
  }

  #shouldHandleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return false;

    // If Standard Actions are unavailable, leave the Shopify product form native.
    if (!window.Shopify?.actions?.updateCart) return false;

    if (!this.#variantInput(form)) return false;

    const submitter = event.submitter;
    if (submitter instanceof HTMLElement && !submitter.matches('button[name="add"], input[name="add"]')) {
      return false;
    }

    return true;
  }

  async #submit(form, submitter) {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const line = this.#lineFromFormData(new FormData(form));
    if (!line) {
      this.#abortController = null;
      return;
    }

    this.#setSubmitting(true, submitter);
    this.#showError('');

    try {
      const result = await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: 'product',
            detail: this.#eventDetail(),
          },
          signal,
        }
      );

      this.#throwIfAborted(signal);

      const errorMessage = this.#resultErrorMessage(result);
      if (errorMessage) {
        this.#showError(errorMessage);
      } else {
        await this.#playTransfer(submitter);
        await window.Shopify.actions.openCart?.();
      }
    } catch (error) {
      if (signal.aborted) return;

      this.#showError(getCartErrorMessage(error) || this.dataset.errorMessage || '');
    } finally {
      if (!signal.aborted) {
        this.#setSubmitting(false);
        if (this.#abortController?.signal === signal) this.#abortController = null;
      }
    }
  }

  /**
   * GRID data transfer: a cyan packet flies from the add button to the header cart
   * trigger, which then blips, before the cart opens. Skipped under reduced motion,
   * when either end is off-screen, or when WAAPI is unavailable.
   */
  async #playTransfer(submitter) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = document.getElementById('header-cart-trigger');
    const origin = submitter instanceof HTMLElement ? submitter : this.querySelector('button[name="add"]');
    if (!target || !origin || typeof this.animate !== 'function') return;

    const from = origin.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (to.bottom < 0 || to.top > window.innerHeight || to.width === 0) return;

    const packet = document.createElement('span');
    packet.className = 'grid-transfer';
    packet.setAttribute('aria-hidden', 'true');
    document.body.append(packet);

    const startX = from.left + from.width / 2 - 6;
    const startY = from.top + from.height / 2 - 6;
    const endX = to.left + to.width / 2 - 6;
    const endY = to.top + to.height / 2 - 6;
    const animation = packet.animate([
      { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(startX + endX) / 2}px, ${Math.min(startY, endY) - 80}px) scale(0.8)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${endX}px, ${endY}px) scale(0.4)`, opacity: 0.2 },
    ], { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' });

    try {
      await animation.finished;
    } catch {
      // Cancelled: fall through to cleanup.
    }
    packet.remove();

    const trigger = document.getElementById('header-cart-trigger');
    if (trigger) {
      trigger.removeAttribute('data-blip');
      void trigger.offsetWidth;
      trigger.setAttribute('data-blip', '');
      trigger.addEventListener('animationend', () => trigger.removeAttribute('data-blip'), { once: true });
    }
  }

  #variantInput(form) {
    const input = form.elements.namedItem('id');
    return input instanceof HTMLInputElement ? input : null;
  }

  #lineFromFormData(formData) {
    const variantId = String(formData.get('id') || '').trim();
    if (!variantId) return null;

    const quantityValue = Number.parseInt(String(formData.get('quantity') || '1'), 10);
    const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
    const line = {
      merchandiseId: variantId,
      quantity,
    };

    const sellingPlanId = String(formData.get('selling_plan') || '').trim();
    if (sellingPlanId) line.sellingPlanId = sellingPlanId;

    const attributes = this.#lineAttributes(formData);
    if (attributes.length) line.attributes = attributes;

    return line;
  }

  #lineAttributes(formData) {
    const attributes = [];

    for (const [name, value] of formData) {
      const match = String(name).match(/^properties\[(.+)]$/);
      if (!match) continue;
      if (typeof File !== 'undefined' && value instanceof File) continue;

      const attributeValue = String(value).trim();
      if (!attributeValue) continue;

      attributes.push({ key: match[1], value: attributeValue });
    }

    return attributes;
  }

  #eventDetail() {
    const detail = { source: 's-product-form' };
    if (this.dataset.productId) detail.productId = this.dataset.productId;
    return detail;
  }

  #resultErrorMessage(result) {
    return result?.userErrors?.[0]?.message || '';
  }

  #showError(message) {
    const error = this.querySelector('[data-add-to-cart-error]');
    if (!error) return;

    error.textContent = message || '';
    error.hidden = !message;
  }

  #setSubmitting(submitting, submitter = this.#activeSubmitter) {
    if (submitting) {
      this.setAttribute('aria-busy', 'true');
      if (submitter instanceof HTMLElement) {
        this.#activeSubmitter = submitter;
        this.#activeSubmitterAriaDisabled = submitter.getAttribute('aria-disabled');
        this.#activeSubmitterHadOpacityClass = submitter.classList.contains('opacity-50');
        this.#activeSubmitterHadCursorWaitClass = submitter.classList.contains('cursor-wait');
        submitter.setAttribute('aria-disabled', 'true');
        submitter.classList.add('opacity-50', 'cursor-wait');
      }
      return;
    }

    this.removeAttribute('aria-busy');
    if (this.#activeSubmitter instanceof HTMLElement) {
      if (this.#activeSubmitterAriaDisabled == null) {
        this.#activeSubmitter.removeAttribute('aria-disabled');
      } else {
        this.#activeSubmitter.setAttribute('aria-disabled', this.#activeSubmitterAriaDisabled);
      }
      if (!this.#activeSubmitterHadOpacityClass) this.#activeSubmitter.classList.remove('opacity-50');
      if (!this.#activeSubmitterHadCursorWaitClass) this.#activeSubmitter.classList.remove('cursor-wait');
    }
    this.#activeSubmitter = null;
    this.#activeSubmitterAriaDisabled = null;
    this.#activeSubmitterHadOpacityClass = null;
    this.#activeSubmitterHadCursorWaitClass = null;
  }

  #throwIfAborted(signal) {
    if (!signal.aborted) return;

    if (typeof signal.throwIfAborted === 'function') {
      signal.throwIfAborted();
    }

    throw new DOMException('Aborted', 'AbortError');
  }
}

if (!customElements.get('s-product-form')) {
  customElements.define('s-product-form', SProductForm);
}

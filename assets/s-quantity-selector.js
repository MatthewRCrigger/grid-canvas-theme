/**
 * <s-quantity-selector> — Quantity selector with decrement/increment buttons,
 * clamping to [min, max], and sr-only live-region announcements.
 *
 * Commands (dispatched via commandfor/command on descendant buttons):
 *   --step-up   — Increment by step (clamped to max); announces + dispatches s-quantity:change.
 *   --step-down — Decrement by step (clamped to min); announces + dispatches s-quantity:change.
 *
 * Required child markup:
 *   input[type="number"] (or any input) — The quantity input; its value is the source of truth.
 *   [data-decrement]                    — Decrement button; `disabled` synced when value <= min.
 *   [data-increment]                    — Increment button; `disabled` synced when value >= max.
 *
 * Element attributes/dataset (on <s-quantity-selector>):
 *   min   — Integer minimum (default 1).
 *   max   — Integer maximum (when absent, no upper bound is enforced).
 *   step  — Integer step size (default 1).
 *   value — Optional initial value; falls back to input.value, then min.
 *   data-quantity-label — i18n prefix read out on change (e.g. "Quantity: 3").
 *
 * Events:
 *   s-quantity:change (bubbles) — { value, previousValue }
 */
import { normalizeQuantity } from '@theme/quantity-rules';
import {
  announceLiveRegion,
  cancelLiveRegionAnnouncement,
  createVisuallyHiddenLiveRegion,
} from '@theme/live-region';

class SQuantitySelector extends HTMLElement {
  #input;
  #ac;
  #liveRegion;
  #lastValue;
  #hasConnected = false;

  connectedCallback() {
    this.#input = this.querySelector('input[type="number"]') || this.querySelector('input');
    if (!this.#input) return;

    // Preserve the same announcer across temporary DOM moves.
    if (!this.#liveRegion) {
      this.#liveRegion = createVisuallyHiddenLiveRegion();
      this.appendChild(this.#liveRegion);
    }

    if (!this.#hasConnected) {
      const attrVal = parseInt(this.getAttribute('value'), 10);
      const inputVal = parseInt(this.#input.value, 10);
      const initial = !isNaN(attrVal) ? attrVal : (!isNaN(inputVal) ? inputVal : this.#min);
      this.#input.value = this.#normalize(initial);
      this.#lastValue = this.#value;
      this.#hasConnected = true;
    } else {
      // The child input, not the initial host attribute, owns state after first connection.
      const currentVal = parseInt(this.#input.value, 10);
      this.#input.value = isNaN(currentVal) ? this.#min : this.#normalize(currentVal);
      this.#lastValue = this.#value;
    }
    this.#updateButtons();

    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('command', (e) => {
      if (e.command === '--step-up') this.#step(1);
      else if (e.command === '--step-down') this.#step(-1);
    }, opts);
    this.#input.addEventListener('change', () => {
      const previousValue = this.#lastValue;
      const parsed = parseInt(this.#input.value, 10);
      this.#input.value = isNaN(parsed) ? this.#min : this.#normalize(parsed);
      this.#updateButtons();
      const value = this.#value;
      if (value !== previousValue) {
        this.#announce(value);
        this.#dispatch(previousValue);
      }
      this.#lastValue = value;
    }, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    cancelLiveRegionAnnouncement(this.#liveRegion);
  }

  get #min() { const v = parseInt(this.getAttribute('min'), 10); return isNaN(v) ? 1 : v; }
  get #max() {
    const attr = this.getAttribute('max');
    if (attr === null || attr === '') return Infinity;
    const v = parseInt(attr, 10);
    return isNaN(v) ? Infinity : v;
  }
  get #stepVal() { const v = parseInt(this.getAttribute('step'), 10); return isNaN(v) || v <= 0 ? 1 : v; }
  get #value() { const v = parseInt(this.#input.value, 10); return isNaN(v) ? this.#min : v; }

  #normalize(value) {
    return normalizeQuantity(value, {
      min: this.#min,
      max: this.#max,
      step: this.#stepVal,
    });
  }

  #step(direction) {
    const previousValue = this.#value;
    this.#input.value = this.#normalize(previousValue + direction * this.#stepVal);
    this.#updateButtons();
    const value = this.#value;
    if (value !== previousValue) {
      this.#announce(value);
      this.#dispatch(previousValue);
    }
    this.#lastValue = value;
  }

  #announce(value) {
    if (!this.#liveRegion) return;

    const label = this.dataset.quantityLabel;
    announceLiveRegion(this.#liveRegion, label ? `${label}: ${value}` : String(value));
  }

  #updateButtons() {
    const v = this.#value;
    const max = this.#max;
    const decrement = this.querySelector('[data-decrement]');
    const increment = this.querySelector('[data-increment]');
    if (decrement) decrement.disabled = v <= this.#min;
    if (increment) {
      const next = this.#normalize(v + this.#stepVal);
      increment.disabled = max !== Infinity && next === v;
    }
  }

  #dispatch(previousValue) {
    this.dispatchEvent(new CustomEvent('s-quantity:change', {
      bubbles: true,
      detail: { value: this.#value, previousValue },
    }));
  }
}

customElements.define('s-quantity-selector', SQuantitySelector);

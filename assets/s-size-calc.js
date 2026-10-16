/**
 * <s-size-calc> — GRID board size calculator. Reads the [name="height"] (cm) and
 * [name="weight"] (kg) inputs of its inner form and writes a recommended board length
 * range in cm into [data-size-result], announcing it through the result's live region.
 *
 * Formula: base = height × 0.88, nudged ±1 cm per 5 kg away from a height-matched weight
 * (height − 105), clamped to 130–175 cm; the range is base ± 2 cm.
 */
class SSizeCalc extends HTMLElement {
  #ac = null;

  connectedCallback() {
    const form = this.querySelector('form');
    if (!form) return;
    this.#ac = new AbortController();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#calculate(form);
    }, { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #calculate(form) {
    const height = Number.parseFloat(form.elements.namedItem('height')?.value || '');
    const weight = Number.parseFloat(form.elements.namedItem('weight')?.value || '');
    const result = this.querySelector('[data-size-result]');
    if (!result) return;

    if (!Number.isFinite(height) || height < 120 || height > 220) {
      result.textContent = this.dataset.invalid || '';
      return;
    }

    let base = height * 0.88;
    if (Number.isFinite(weight) && weight > 0) base += (weight - (height - 105)) / 5;
    base = Math.round(Math.min(175, Math.max(130, base)));
    result.textContent = `${base - 2}–${base + 2} CM`;
  }
}

customElements.define('s-size-calc', SSizeCalc);

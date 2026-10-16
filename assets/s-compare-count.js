/**
 * <s-compare-count> — a two-digit mono count of products in the compare list.
 */
import { readCompare } from '@theme/s-compare';

class SCompareCount extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const show = (count) => {
      this.textContent = String(count).padStart(2, '0');
      this.dataset.count = String(count);
    };
    show(readCompare().length);
    document.addEventListener('grid:compare-change', (event) => show(event.detail?.handles?.length || 0), { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }
}

customElements.define('s-compare-count', SCompareCount);

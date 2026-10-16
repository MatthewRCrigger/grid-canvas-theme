/**
 * <s-compare-toggle> — keeps its inner compare button's aria-pressed in sync with the
 * compare list. The button itself sends `--compare-toggle` to the compare window;
 * this element only reflects state. Reads data-handle from the button's data-compare JSON.
 */
import { readCompare } from '@theme/s-compare';

class SCompareToggle extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const button = this.querySelector('button');
    if (!button) return;

    let handle = '';
    try {
      handle = JSON.parse(button.dataset.compare || '{}').handle || '';
    } catch {
      return;
    }

    const sync = (handles) => button.setAttribute('aria-pressed', String(handles.includes(handle)));
    sync(readCompare().map((item) => item.handle));
    document.addEventListener('grid:compare-change', (event) => sync(event.detail?.handles || []), { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }
}

customElements.define('s-compare-toggle', SCompareToggle);

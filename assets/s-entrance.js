/**
 * <s-entrance> — one-shot frame entrances. Watches every `.frame[data-entrance]` on the
 * page (including frames added later by partial refreshes or the editor) and sets
 * data-entered the first time each one scrolls into view, then stops watching it:
 *   "static" — the frame was already on screen when it appeared (page load or a
 *              partial refresh), so it skips the animation.
 *   "play"   — the frame entered later; CSS plays the entrance once.
 * Frames never reset, so scrolling back up does not rewind them.
 */
const SELECTOR = '.frame[data-entrance]:not([data-entered])';

class SEntrance extends HTMLElement {
  #io = null;
  #mo = null;
  #seen = new WeakSet();

  connectedCallback() {
    if (!('IntersectionObserver' in window)) return;

    this.#io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const frame = entry.target;
        const firstReport = !this.#seen.has(frame);
        this.#seen.add(frame);
        if (!entry.isIntersecting) continue;

        frame.setAttribute('data-entered', firstReport ? 'static' : 'play');
        this.#io.unobserve(frame);
      }
    });

    this.#scan(document);

    this.#mo = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) this.#scan(node);
        }
      }
    });
    this.#mo.observe(document.body, { childList: true, subtree: true });
  }

  disconnectedCallback() {
    this.#io?.disconnect();
    this.#mo?.disconnect();
  }

  #scan(root) {
    if (root instanceof Element && root.matches(SELECTOR)) this.#io.observe(root);
    for (const frame of root.querySelectorAll(SELECTOR)) this.#io.observe(frame);
  }
}

customElements.define('s-entrance', SEntrance);

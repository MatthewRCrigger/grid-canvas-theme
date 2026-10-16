/**
 * <s-read-progress target="report-body"> — how much of an article body the reader has seen.
 *
 * Progress = the share of the body that sits above the bottom of the visible area. If half the
 * post is on screen when the page loads, the meter starts at half; it reaches full when the last
 * line comes into view, moving evenly with the scroll in between.
 * Writes `--read-progress` (0–1) on every [data-read-progress] element and keeps
 * aria-valuenow (0–100) current on any of them with role="progressbar".
 * Inside a desktop window it measures that window's scroll area.
 */
class SReadProgress extends HTMLElement {
  #ac = null;
  #frame = 0;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    const schedule = () => {
      if (this.#frame) return;
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0;
        this.#update();
      });
    };
    document.addEventListener('scroll', schedule, { capture: true, passive: true, signal });
    window.addEventListener('resize', schedule, { passive: true, signal });
    window.addEventListener('load', schedule, { once: true, signal });
    this.#update();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    if (this.#frame) cancelAnimationFrame(this.#frame);
  }

  #update() {
    const id = this.getAttribute('target');
    const body = id ? document.getElementById(id) : null;
    if (!body) return;
    const scroller = body.closest('[data-window-body]');
    const viewBottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
    const rect = body.getBoundingClientRect();
    const seen = rect.height > 0 ? (viewBottom - rect.top) / rect.height : 1;
    const progress = Math.min(1, Math.max(0, seen));
    const value = String(Math.round(progress * 100));
    for (const el of document.querySelectorAll('[data-read-progress]')) {
      el.style.setProperty('--read-progress', progress.toFixed(4));
      if (el.getAttribute('role') === 'progressbar') el.setAttribute('aria-valuenow', value);
    }
  }
}

customElements.define('s-read-progress', SReadProgress);

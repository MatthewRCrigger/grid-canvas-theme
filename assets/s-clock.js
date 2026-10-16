/**
 * <s-clock> — a live mono readout for GRID title bars and the status bar.
 *
 * Attributes:
 *   mode="time"   (default) local time as HH:MM:SS, updated every second.
 *   mode="scroll" page scroll position as a zero-padded percentage (000%–100%).
 *
 * Text only; callers mark the readout aria-hidden when it is decorative.
 */
class SClock extends HTMLElement {
  #ac = null;
  #timer = null;
  #frame = 0;

  connectedCallback() {
    this.#ac = new AbortController();
    if (this.getAttribute('mode') === 'scroll') {
      const update = () => {
        this.#frame = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
        this.textContent = `${String(Math.min(100, Math.max(0, pct))).padStart(3, '0')}%`;
      };
      window.addEventListener('scroll', () => {
        if (!this.#frame) this.#frame = requestAnimationFrame(update);
      }, { passive: true, signal: this.#ac.signal });
      update();
      return;
    }

    const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tick = () => { this.textContent = formatter.format(new Date()); };
    tick();
    this.#timer = setInterval(tick, 1000);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    if (this.#timer) clearInterval(this.#timer);
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#timer = null;
    this.#frame = 0;
  }
}

customElements.define('s-clock', SClock);

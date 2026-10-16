/**
 * <s-wallpaper> — the GRID OS grid-floor wallpaper behind every page.
 *
 * The floor is static. When mode="live", the grid cells near a mouse pointer light cyan: the glow
 * follows the pointer with a short ease and fades out 2.6s after the pointer rests or leaves.
 * Writes --wp-x / --wp-y (pointer in px) and data-lit. Work only happens while the pointer moves:
 * one rAF per frame at most, stopped once the glow has caught up.
 * Does nothing under prefers-reduced-motion, on coarse pointers, or below 64rem.
 */
class SWallpaper extends HTMLElement {
  #ac = null;
  #frame = 0;
  #target = { x: 0, y: 0 };
  #current = { x: 0, y: 0 };
  #restTimer = null;

  connectedCallback() {
    if (this.getAttribute('mode') !== 'live') return;
    const query = window.matchMedia('(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    this.#ac = new AbortController();
    const { signal } = this.#ac;

    query.addEventListener('change', () => {
      if (!query.matches) this.#rest();
    }, { signal });

    window.addEventListener('pointermove', (event) => {
      if (!query.matches || event.pointerType !== 'mouse') return;
      this.#target.x = event.clientX;
      this.#target.y = event.clientY;
      if (!this.dataset.lit) {
        // Jump the glow to the pointer on first contact instead of sweeping in from elsewhere.
        this.#current.x = event.clientX;
        this.#current.y = event.clientY;
        this.dataset.lit = '';
      }
      clearTimeout(this.#restTimer);
      this.#restTimer = setTimeout(() => this.#rest(), 2600);
      this.#start();
    }, { passive: true, signal });

    document.documentElement.addEventListener('pointerleave', () => this.#rest(), { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.#rest();
    }, { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
    clearTimeout(this.#restTimer);
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  #rest() {
    clearTimeout(this.#restTimer);
    delete this.dataset.lit;
  }

  #start() {
    if (!this.#frame) this.#frame = requestAnimationFrame(() => this.#tick());
  }

  #tick() {
    this.#frame = 0;
    const c = this.#current;
    const t = this.#target;
    c.x += (t.x - c.x) * 0.25;
    c.y += (t.y - c.y) * 0.25;
    this.style.setProperty('--wp-x', `${c.x.toFixed(1)}px`);
    this.style.setProperty('--wp-y', `${c.y.toFixed(1)}px`);
    if (Math.abs(t.x - c.x) > 0.5 || Math.abs(t.y - c.y) > 0.5) this.#start();
  }
}

if (!customElements.get('s-wallpaper')) customElements.define('s-wallpaper', SWallpaper);

/**
 * <s-screensaver id="os-screensaver" data-delay="3"> — the GRID OS screen saver.
 *
 * After `data-delay` minutes without input (64rem+, mouse or trackpad, never in the theme editor)
 * the screen fades to a slowly travelling grid floor with a large clock. Any pointer movement,
 * key, wheel or touch wakes it. It never starts while a pop-up is open, a video is playing or the
 * tab is hidden. start() (or the command --start) shows it on demand.
 * Under reduced motion the floor holds still.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const FINE = window.matchMedia('(pointer: fine)');
const WAKE = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];

class SScreensaver extends HTMLElement {
  #ac = null;
  #timer = 0;
  #shownAt = 0;

  connectedCallback() {
    if (window.Shopify?.designMode) return;
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    for (const type of WAKE) {
      document.addEventListener(type, (event) => this.#onActivity(event), { capture: true, passive: true, signal });
    }
    document.addEventListener('visibilitychange', () => this.#arm(), { signal });
    this.addEventListener('command', (event) => {
      if (event.command === '--start') this.start();
    }, { signal });
    this.#arm();
  }

  disconnectedCallback() {
    clearTimeout(this.#timer);
    this.#ac?.abort();
  }

  get #delay() {
    const minutes = Number.parseFloat(this.dataset.delay || '3');
    return Math.max(0.5, Number.isFinite(minutes) ? minutes : 3) * 60_000;
  }

  #arm() {
    clearTimeout(this.#timer);
    if (document.hidden || this.dataset.enabled === 'false') return;
    this.#timer = setTimeout(() => this.#idle(), this.#delay);
  }

  #idle() {
    const busy = document.querySelector('dialog[open]')
      || [...document.querySelectorAll('video')].some((v) => !v.paused)
      || document.documentElement.hasAttribute('data-mission');
    if (busy || !DESKTOP.matches || !FINE.matches) {
      this.#arm();
      return;
    }
    this.start();
  }

  start() {
    if (!this.hidden) return;
    this.hidden = false;
    this.#shownAt = performance.now();
    document.documentElement.setAttribute('data-screensaver', '');
  }

  stop() {
    if (this.hidden) return;
    this.hidden = true;
    document.documentElement.removeAttribute('data-screensaver');
  }

  #onActivity(event) {
    if (!this.hidden) {
      // The click or key that started it (from a menu) must not wake it straight away.
      if (performance.now() - this.#shownAt < 600) return;
      this.stop();
    }
    this.#arm();
  }
}

customElements.define('s-screensaver', SScreensaver);

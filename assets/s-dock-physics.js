/**
 * <s-dock-physics> — macOS-style dock physics for the GRID OS dock. Sits inside `.os-dock`
 * (display: contents) and drives three things:
 *
 * 1. Fisheye magnification (fine mouse, from 48rem, motion allowed): every tile, including
 *    minimized-window tiles in the tray, scales by its distance to the cursor on a cosine falloff.
 *    It writes `--mag` on each dock item / tray tile; CSS turns that into scale, lift and the extra
 *    inline padding that opens the dock up so magnified tiles never overlap. Entry and exit ramp
 *    over a short decelerating curve instead of jumping. While active the dock carries
 *    [data-physics], which switches off the CSS-only stepped hover fallback.
 * 2. Launch blip: activating a tile sends one 1px cyan ring out of it and flashes its running
 *    square. Skipped under reduced motion.
 * 3. Keyboard: arrow keys move focus across the dock tiles (Home / End jump to the ends),
 *    mirrored for right-to-left.
 */
const PHYSICS = window.matchMedia(
  '(min-width: 48rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

const MAX_SCALE = 1.4;
const RANGE = 150; // px from the cursor at which a tile is back to rest size
const RAMP_IN = 160; // ms
const RAMP_OUT = 220; // ms
const TILE_SELECTOR = '.os-dock-tile, .os-tray-tile';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

class SDockPhysics extends HTMLElement {
  #dock = null;
  #pointerX = null;
  #intensity = 0;
  #rampFrom = 0;
  #rampTo = 0;
  #rampStart = 0;
  #frame = 0;

  connectedCallback() {
    this.#dock = this.closest('.os-dock') || this;
    this.#dock.addEventListener('pointermove', this.#onMove);
    this.#dock.addEventListener('pointerleave', this.#onLeave);
    this.#dock.addEventListener('keydown', this.#onKey);
    this.#dock.addEventListener('click', this.#onClick);
    PHYSICS.addEventListener('change', this.#onMedia);
    this.#onMedia();
  }

  disconnectedCallback() {
    this.#dock?.removeEventListener('pointermove', this.#onMove);
    this.#dock?.removeEventListener('pointerleave', this.#onLeave);
    this.#dock?.removeEventListener('keydown', this.#onKey);
    this.#dock?.removeEventListener('click', this.#onClick);
    PHYSICS.removeEventListener('change', this.#onMedia);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  #onMedia = () => {
    this.#dock.toggleAttribute('data-physics', PHYSICS.matches);
    if (!PHYSICS.matches) {
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      this.#intensity = 0;
      this.#rampTo = 0;
      this.#write(new Map());
    }
  };

  // Magnified items: dock items, plus tray tiles (they have no list item around them).
  #targets() {
    const items = [...this.#dock.querySelectorAll('.os-dock-item, .os-tray-tile')];
    return items.filter((el) => el.offsetParent !== null);
  }

  #onMove = (event) => {
    if (!PHYSICS.matches || event.pointerType !== 'mouse') return;
    this.#pointerX = event.clientX;
    this.#rampTowards(1);
  };

  #onLeave = () => {
    if (!PHYSICS.matches) return;
    this.#rampTowards(0);
  };

  #rampTowards(target) {
    if (this.#rampTo !== target) {
      this.#rampFrom = this.#intensity;
      this.#rampTo = target;
      this.#rampStart = performance.now();
    }
    if (!this.#frame) this.#frame = requestAnimationFrame(this.#tick);
  }

  #tick = (now) => {
    this.#frame = 0;
    const duration = this.#rampTo > this.#rampFrom ? RAMP_IN : RAMP_OUT;
    const progress = Math.min(1, (now - this.#rampStart) / duration);
    this.#intensity = this.#rampFrom + (this.#rampTo - this.#rampFrom) * easeOut(progress);

    // Read every centre first, then write, so the frame lays out once.
    const targets = this.#targets();
    const scales = new Map();
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(this.#pointerX - (rect.left + rect.width / 2));
      const falloff = distance >= RANGE ? 0 : (Math.cos((Math.PI * distance) / RANGE) + 1) / 2;
      scales.set(el, 1 + (MAX_SCALE - 1) * falloff * this.#intensity);
    }
    this.#write(scales, targets);

    // Tick only while ramping; pointer moves schedule further frames.
    if (progress < 1) this.#frame = requestAnimationFrame(this.#tick);
    this.#dock.toggleAttribute('data-magnifying', this.#intensity > 0.001);
  };

  #write(scales, targets = [...this.#dock.querySelectorAll('.os-dock-item, .os-tray-tile')]) {
    for (const el of targets) {
      const scale = scales.get(el);
      if (scale === undefined || scale < 1.001) el.style.removeProperty('--mag');
      else el.style.setProperty('--mag', scale.toFixed(4));
    }
  }

  #onClick = (event) => {
    if (REDUCED.matches) return;
    const tile = event.target.closest('.os-dock-tile');
    if (!tile || !this.#dock.contains(tile)) return;
    const accent = getComputedStyle(this.#dock).getPropertyValue('--color-accent').trim() || 'currentColor';
    try {
      tile.animate(
        [
          { opacity: 1, scale: 1 },
          { opacity: 0, scale: 1.45 },
        ],
        { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::after' }
      );
    } catch {
      /* Pseudo-element animation unsupported: skip the ring. */
    }
    const run = tile.closest('.os-dock-item')?.querySelector('.os-dock-run');
    run?.animate(
      [
        { backgroundColor: accent, scale: 1.5 },
        { backgroundColor: accent, scale: 1, offset: 0.5 },
        {},
      ],
      { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  };

  #onKey = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const tiles = [...this.#dock.querySelectorAll(TILE_SELECTOR)].filter((el) => el.offsetParent !== null);
    const index = tiles.indexOf(document.activeElement);
    if (index === -1) return;
    const rtl = getComputedStyle(this.#dock).direction === 'rtl';
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tiles.length - 1;
    else {
      const forward = (event.key === 'ArrowRight') !== rtl;
      next = (index + (forward ? 1 : -1) + tiles.length) % tiles.length;
    }
    event.preventDefault();
    tiles[next].focus();
  };
}

customElements.define('s-dock-physics', SDockPhysics);

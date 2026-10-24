/**
 * <s-media-viewport> — GRID inspection viewport for the product gallery. One frame fills the
 * stage at a time: the stage is a native scroll-snap track (swipe on touch), and a filmstrip of
 * thumbnails plus previous/next buttons step through it. The readout counter, the thumbnails'
 * aria-current and the step buttons' disabled state follow whichever frame is in view.
 *
 * The whole element lives inside the {% partial 'product-media' %} region, so a variant change
 * replaces it with the new variant's frame set; nothing here needs to know about variants.
 *
 * Required markup:
 *   [data-viewport-track]        — the horizontal scroll-snap track.
 *   [data-viewport-track] > *    — one child per frame.
 * Optional markup:
 *   [data-frame-current]         — text node updated with the active frame number (zero-padded).
 *   button[data-frame-thumb][data-index] — thumbnails; command="--frame-go".
 *   button[data-frame-step]      — previous/next; command="--frame-prev" / "--frame-next".
 *   data-start (on self)         — zero-based frame to show on connect.
 */
class SMediaViewport extends HTMLElement {
  #ac = null;
  #track = null;
  #frames = [];
  #index = 0;
  #frameRequest = 0;

  connectedCallback() {
    this.#track = this.querySelector('[data-viewport-track]');
    if (!this.#track) return;
    this.#frames = Array.from(this.#track.children);

    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('command', (event) => this.#onCommand(event), opts);
    this.#track.addEventListener('scroll', () => this.#queueSync(), { ...opts, passive: true });
    this.#track.addEventListener('keydown', (event) => this.#onKeydown(event), opts);

    const start = Number.parseInt(this.dataset.start || '0', 10);
    this.#goTo(Number.isFinite(start) ? start : 0, 'instant');
    this.#render();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    cancelAnimationFrame(this.#frameRequest);
  }

  #onCommand(event) {
    switch (event.command) {
      case '--frame-prev':
        this.#goTo(this.#index - 1);
        break;
      case '--frame-next':
        this.#goTo(this.#index + 1);
        break;
      case '--frame-go': {
        const index = Number.parseInt(event.source?.dataset.index || '', 10);
        if (Number.isFinite(index)) this.#goTo(index);
        break;
      }
      default:
        return;
    }
  }

  #onKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    event.preventDefault();
    this.#goTo(this.#index + (forward ? 1 : -1));
  }

  #goTo(index, behavior) {
    if (!this.#frames.length) return;
    const clamped = Math.min(Math.max(index, 0), this.#frames.length - 1);
    const frame = this.#frames[clamped];
    const offset = frame.getBoundingClientRect().left - this.#track.getBoundingClientRect().left;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#track.scrollBy({ left: offset, behavior: behavior || (reduce ? 'instant' : 'smooth') });
    this.#index = clamped;
    this.#render();
  }

  #queueSync() {
    cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = requestAnimationFrame(() => {
      const trackLeft = this.#track.getBoundingClientRect().left;
      let closest = this.#index;
      let distance = Infinity;
      this.#frames.forEach((frame, i) => {
        const d = Math.abs(frame.getBoundingClientRect().left - trackLeft);
        if (d < distance) {
          distance = d;
          closest = i;
        }
      });
      if (closest !== this.#index) {
        this.#index = closest;
        this.#render();
      }
    });
  }

  #render() {
    const total = this.#frames.length;
    const current = this.querySelector('[data-frame-current]');
    if (current) current.textContent = String(this.#index + 1).padStart(2, '0');

    this.#frames.forEach((frame, i) => {
      frame.toggleAttribute('inert', i !== this.#index);
    });

    for (const thumb of this.querySelectorAll('[data-frame-thumb]')) {
      const active = Number.parseInt(thumb.dataset.index || '', 10) === this.#index;
      if (active) {
        thumb.setAttribute('aria-current', 'true');
        this.#revealThumb(thumb);
      } else {
        thumb.removeAttribute('aria-current');
      }
    }

    for (const step of this.querySelectorAll('[data-frame-step]')) {
      const atEdge = step.dataset.frameStep === 'prev' ? this.#index === 0 : this.#index === total - 1;
      step.toggleAttribute('disabled', atEdge);
    }
  }

  #revealThumb(thumb) {
    const strip = thumb.closest('[data-filmstrip]');
    if (!strip) return;
    const stripRect = strip.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    if (thumbRect.left < stripRect.left) {
      strip.scrollBy({ left: thumbRect.left - stripRect.left, behavior: 'instant' });
    } else if (thumbRect.right > stripRect.right) {
      strip.scrollBy({ left: thumbRect.right - stripRect.right, behavior: 'instant' });
    }
  }
}

if (!customElements.get('s-media-viewport')) {
  customElements.define('s-media-viewport', SMediaViewport);
}

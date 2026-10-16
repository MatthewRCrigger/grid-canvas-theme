/**
 * <s-inspect> — GRID inspection mode for product images. On fine pointers, hovering any
 * descendant [data-inspect-src] shows a square loupe (2.5x) with a crosshair and live
 * X/Y coordinates, positioned inside that element. The loupe is decorative
 * (aria-hidden); clicking still opens the full-screen zoom.
 *
 * Attributes: zoom (default 2.5), data-label (readout prefix, e.g. "MAG 2.5X").
 */
class SInspect extends HTMLElement {
  #ac = null;
  #loupe = null;
  #readout = null;
  #host = null;

  connectedCallback() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('pointermove', (event) => this.#move(event), opts);
    this.addEventListener('pointerleave', () => this.#hide(), opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#loupe?.remove();
    this.#loupe = null;
  }

  #ensureLoupe(host) {
    if (!this.#loupe) {
      this.#loupe = document.createElement('span');
      this.#loupe.className = 'grid-loupe';
      this.#loupe.setAttribute('aria-hidden', 'true');
      this.#readout = document.createElement('span');
      this.#readout.className = 'grid-loupe-readout';
      this.#loupe.append(this.#readout);
    }
    if (this.#host !== host) {
      this.#host = host;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.append(this.#loupe);
      this.#loupe.style.backgroundImage = `url("${host.dataset.inspectSrc}")`;
    }
  }

  #move(event) {
    const host = event.target instanceof Element ? event.target.closest('[data-inspect-src]') : null;
    if (!host || !this.contains(host)) {
      this.#hide();
      return;
    }
    this.#ensureLoupe(host);

    const rect = host.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const zoom = Number.parseFloat(this.getAttribute('zoom') || '2.5');
    const size = 180;

    // Image fills the host with object-cover; approximate with background-size relative to the host.
    this.#loupe.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
    this.#loupe.style.backgroundPosition = `${-(x * zoom - size / 2)}px ${-(y * zoom - size / 2)}px`;
    this.#loupe.style.left = `${Math.min(Math.max(x - size / 2, 0), rect.width - size)}px`;
    this.#loupe.style.top = `${Math.min(Math.max(y - size / 2, 0), rect.height - size)}px`;

    const px = String(Math.round((x / rect.width) * 1000)).padStart(4, '0');
    const py = String(Math.round((y / rect.height) * 1000)).padStart(4, '0');
    this.#readout.textContent = `${this.dataset.label || ''} X${px} Y${py}`.trim();
    this.#loupe.setAttribute('data-active', '');
  }

  #hide() {
    this.#loupe?.removeAttribute('data-active');
  }
}

customElements.define('s-inspect', SInspect);

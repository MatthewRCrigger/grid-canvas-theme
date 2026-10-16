/**
 * <s-sticky-header> — marks its parent <header> with `data-scrolled` once the page
 * has scrolled past the top, so the layout can shrink the logo and header row with
 * `group-data-[scrolled]/header:` utilities. Rendered by blocks/header.liquid only
 * when both the Sticky header and Shrink logo on scroll settings are on.
 *
 * GRID motion rule: the size change is an instant step, never an animation.
 * Two thresholds (on past 48px, off under 8px) stop the row's own height change
 * from flipping the state back and forth near the top.
 */
class SStickyHeader extends HTMLElement {
  #ac;
  #header;
  #frame = 0;

  connectedCallback() {
    this.#header = this.closest('header');
    if (!this.#header) return;

    this.#ac = new AbortController();
    window.addEventListener('scroll', () => this.#queue(), { passive: true, signal: this.#ac.signal });
    this.#update();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    cancelAnimationFrame(this.#frame);
    this.#header?.removeAttribute('data-scrolled');
  }

  #queue() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  }

  #update() {
    const y = window.scrollY;
    const scrolled = this.#header.hasAttribute('data-scrolled');
    if (!scrolled && y > 48) this.#header.setAttribute('data-scrolled', '');
    else if (scrolled && y < 8) this.#header.removeAttribute('data-scrolled');
  }
}

if (!customElements.get('s-sticky-header')) customElements.define('s-sticky-header', SStickyHeader);

/**
 * <s-dock target="<id>"> — GRID docked add-to-cart. Shows itself (data-docked) once the
 * element with id `target` (the main buy area) has scrolled above the viewport, and hides
 * again when it returns. Before each show it copies text from the elements named by
 * [data-dock-mirror="<selector>"] children, so the price and config follow the selected
 * variant after partial refreshes. The dock's submit button uses form="<form id>" with
 * name="add", so the product form's own add-to-cart flow handles it.
 */
class SDock extends HTMLElement {
  #io = null;

  connectedCallback() {
    const target = document.getElementById(this.getAttribute('target') || '');
    if (!target || !('IntersectionObserver' in window)) return;

    this.#io = new IntersectionObserver(([entry]) => {
      const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (above) this.#mirror();
      this.toggleAttribute('data-docked', above);
      this.toggleAttribute('inert', !above);
    });
    this.toggleAttribute('inert', true);
    this.#io.observe(target);
  }

  disconnectedCallback() {
    this.#io?.disconnect();
  }

  #mirror() {
    for (const slot of this.querySelectorAll('[data-dock-mirror]')) {
      const source = document.querySelector(slot.dataset.dockMirror);
      if (source) slot.textContent = source.textContent.replace(/\s+/g, ' ').trim();
    }
  }
}

customElements.define('s-dock', SDock);

/**
 * <s-dock-count source="#header-cart-trigger" attr="data-cart-count"> — mirrors a live count
 * written by Liquid on another element (the header cart trigger, refreshed by cart partials)
 * into a dock badge. Hides itself at zero. Watches the source's parent region because partial
 * swaps replace the source element itself.
 */
class SDockCount extends HTMLElement {
  #observer = null;

  connectedCallback() {
    const selector = this.getAttribute('source');
    const attr = this.getAttribute('attr') || 'data-count';
    if (!selector) return;

    const update = () => {
      const source = document.querySelector(selector);
      const count = Number.parseInt(source?.getAttribute(attr) || '0', 10) || 0;
      this.textContent = String(count);
      this.hidden = count === 0;
    };

    const region = document.querySelector(selector)?.closest('header') || document.body;
    this.#observer = new MutationObserver(update);
    this.#observer.observe(region, { childList: true, subtree: true, attributes: true, attributeFilter: [attr] });
    update();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }
}

customElements.define('s-dock-count', SDockCount);

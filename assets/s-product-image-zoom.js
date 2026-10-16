/**
 * <s-product-image-zoom> — PDP image zoom preloader.
 *
 * Gallery buttons still open native dialogs declaratively via commandfor/show-modal.
 * This component only warms the selected zoom image on hover/focus so the
 * fullscreen dialog has the high-resolution image ready when opened.
 *
 * Required markup:
 *   [data-zoom-preload][commandfor] — gallery trigger button; commandfor points to a dialog id.
 *   dialog img[data-zoom-image]     — high-resolution image inside the target dialog.
 */
class SProductImageZoom extends HTMLElement {
  #ac;
  #preloaded = new Set();
  #preloadLinks = [];

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('pointerover', this.#handlePreloadIntent, opts);
    this.addEventListener('focusin', this.#handlePreloadIntent, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();

    for (const link of this.#preloadLinks) {
      link.remove();
    }
    this.#preloadLinks = [];
    this.#preloaded.clear();
  }

  #handlePreloadIntent = (event) => {
    if (!(event.target instanceof Element)) return;

    const source = event.target.closest('[data-zoom-preload]');
    if (!source || !this.contains(source)) return;

    this.#preload(source);
  };

  #preload(source) {
    const dialogId = source.getAttribute('commandfor');
    if (!dialogId || this.#preloaded.has(dialogId)) return;

    const dialog = document.getElementById(dialogId);
    const image = dialog?.querySelector('img[data-zoom-image]');
    if (!(image instanceof HTMLImageElement)) return;

    this.#preloaded.add(dialogId);
    image.loading = 'eager';
    image.fetchPriority = 'high';

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = image.src;
    if (image.srcset) link.setAttribute('imagesrcset', image.srcset);
    if (image.sizes) link.setAttribute('imagesizes', image.sizes);
    document.head.append(link);
    this.#preloadLinks.push(link);

    if (typeof image.decode === 'function') {
      image.decode().catch(() => {});
    }
  }
}

if (!customElements.get('s-product-image-zoom')) {
  customElements.define('s-product-image-zoom', SProductImageZoom);
}

/**
 * <s-quick-look id="quick-look-viewer" data-dialog="quick-look" data-title="quick-look-title">
 *
 * macOS Quick Look and Get Info for products. Any element carrying data-quick-look="<product url>"
 * (product cards, desktop icons) can be previewed:
 *   Space      — Quick Look the focused, hovered or selected item (Space again closes it).
 *   Option+I   — Get Info: the same window showing the product's spec sheet.
 * Other components ask for it with document.dispatchEvent(new CustomEvent('os:quick-look',
 * { detail: { url, mode: 'preview' | 'info' } })).
 *
 * The product fragment comes from the product.quick-look template (?view=quick-look) and is moved
 * into this element. Commands: --toggle (switch between preview and info).
 */
const TEXT_FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

class SQuickLook extends HTMLElement {
  #ac = null;
  #hovered = null;
  #cache = new Map();
  #url = '';
  #mode = 'preview';
  #request = 0;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;

    document.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });
    document.addEventListener('pointerover', (event) => {
      this.#hovered = event.target.closest?.('[data-quick-look]') || null;
    }, { signal });
    document.addEventListener('os:quick-look', (event) => {
      const { url, mode } = event.detail || {};
      if (url) this.show(url, mode);
    }, { signal });
    // Adding to the cart opens the cart window; Quick Look steps aside for it.
    document.addEventListener('s-cart:opened', () => this.#dialog?.close(), { signal });

    this.addEventListener('change', (event) => {
      const select = event.target.closest('[data-ql-variant]');
      const input = select?.form?.elements.namedItem('id');
      if (input instanceof HTMLInputElement) input.value = select.value;
    }, { signal });

    this.addEventListener('command', (event) => {
      if (event.command === '--toggle' && this.#url) this.show(this.#url, this.#mode === 'info' ? 'preview' : 'info');
    }, { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  get #dialog() {
    return document.getElementById(this.dataset.dialog || '');
  }

  /** The item a shortcut acts on: focus first, then the pointer, then a selected desktop icon. */
  #target() {
    const active = document.activeElement;
    return active?.closest?.('[data-quick-look]')
      || (this.#hovered?.isConnected ? this.#hovered : null)
      || document.querySelector('.os-icon[data-selected][data-quick-look]');
  }

  #onKeydown(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
    const dialog = this.#dialog;
    const inField = event.target.closest?.(TEXT_FIELD);
    const isSpace = event.key === ' ' && !event.altKey && !event.shiftKey;
    const isInfo = event.altKey && event.code === 'KeyI';
    if (!isSpace && !isInfo) return;
    if (inField) return;

    // Space closes an open Quick Look unless it is pressing a control inside it.
    if (isSpace && dialog?.open) {
      if (event.target.closest('button, a, summary') && dialog.contains(event.target)) return;
      event.preventDefault();
      dialog.close();
      return;
    }
    if (document.querySelector('dialog[open]')) return;

    const target = this.#target();
    if (!target) return;
    event.preventDefault();
    this.show(target.dataset.quickLook, isInfo ? 'info' : 'preview');
  }

  async show(url, mode = 'preview') {
    const dialog = this.#dialog;
    if (!dialog) {
      location.href = url;
      return;
    }
    const request = ++this.#request;
    const sameProduct = url === this.#url && this.querySelector('[data-quick-look-root]');
    this.#url = url;
    this.#mode = mode === 'info' ? 'info' : 'preview';

    if (!sameProduct) {
      this.setAttribute('aria-busy', 'true');
      const loading = document.createElement('p');
      loading.className = 'type-data-sm p-6 uppercase text-ink-300';
      loading.textContent = this.dataset.loadingLabel || '';
      this.replaceChildren(loading);
    }
    if (!dialog.open) dialog.showModal();

    if (!sameProduct) {
      let html = '';
      try {
        html = await this.#fetch(url);
      } catch {
        if (request !== this.#request) return;
        dialog.close();
        document.dispatchEvent(new CustomEvent('s-notification:add', {
          detail: { message: this.dataset.errorLabel || '', variant: 'error' },
        }));
        return;
      }
      if (request !== this.#request) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const root = doc.querySelector('[data-quick-look-root]');
      if (!root) {
        location.href = url;
        return;
      }
      this.replaceChildren(document.adoptNode(root));
      this.removeAttribute('aria-busy');
    }
    this.#render();
  }

  #render() {
    const root = this.querySelector('[data-quick-look-root]');
    if (!root) return;
    for (const pane of root.querySelectorAll('[data-ql-pane]')) pane.hidden = pane.dataset.qlPane !== this.#mode;
    const title = document.getElementById(this.dataset.title || '');
    if (title) title.textContent = this.#mode === 'info' ? root.dataset.infoTitle : root.dataset.title;
    const toggle = this.#dialog?.querySelector('[data-ql-toggle]');
    if (toggle) {
      toggle.textContent = this.#mode === 'info' ? this.dataset.previewLabel : this.dataset.infoLabel;
    }
  }

  async #fetch(url) {
    if (this.#cache.has(url)) return this.#cache.get(url);
    const target = new URL(url, location.href);
    target.searchParams.set('view', 'quick-look');
    const response = await fetch(target.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    this.#cache.set(url, html);
    return html;
  }
}

customElements.define('s-quick-look', SQuickLook);

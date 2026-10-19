/**
 * <s-dock-recents> — the dock's Recents shelf: the last pages a visitor opened (products,
 * collections, journal posts, pages), as dock tiles after a hairline divider.
 *
 * mode="record": rendered by the layout inside #main-content with data-url, data-title,
 *   data-kind and data-image. It stores the page at the front of the list when it connects, so it
 *   records full page loads and pages streamed into desktop windows by s-window-manager alike.
 * default mode (in the dock): renders up to data-limit tiles, skipping data-current (the page
 *   loaded behind the desktop). Items with an image show it as the tile; others show the kind's
 *   wireframe glyph from the <template data-icon="…"> children Liquid renders. Tiles reuse the dock
 *   item markup, so magnification, the launch blip, arrow keys and running squares all apply.
 *
 * Storage key: grid:recents (localStorage), max 8. Updates live in this tab and across tabs.
 */
const KEY = 'grid:recents';
const MAX = 8;
const EVENT = 'grid:recents-change';
const KINDS = ['product', 'collection', 'list-collections', 'article', 'blog', 'page'];

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item && typeof item.url === 'string' && item.url.startsWith('/')) : [];
  } catch {
    return [];
  }
}

class SDockRecents extends HTMLElement {
  #ac = null;

  connectedCallback() {
    if (this.getAttribute('mode') === 'record') {
      this.#record();
      return;
    }
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    document.addEventListener(EVENT, () => this.#render(), { signal });
    window.addEventListener('storage', (event) => event.key === KEY && this.#render(), { signal });
    this.#render();
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #record() {
    const { url, title, kind, image } = this.dataset;
    if (!url || !title || !KINDS.includes(kind)) return;
    const list = read().filter((item) => item.url !== url);
    list.unshift({ url, title, kind, image: image || '' });
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      // Storage full or blocked: the shelf is a nicety, never required.
      return;
    }
    document.dispatchEvent(new CustomEvent(EVENT));
  }

  #glyph(kind) {
    const name = { product: 'bag', collection: 'folder', 'list-collections': 'folder', article: 'journal', blog: 'journal', page: 'file' }[kind] || 'file';
    const template = this.querySelector(`template[data-icon="${name}"]`);
    return template ? template.content.cloneNode(true) : document.createTextNode('');
  }

  #render() {
    const list = this.querySelector('[data-recents-list]');
    if (!list) return;
    const limit = Number.parseInt(this.dataset.limit || '3', 10) || 3;
    const current = this.dataset.current || '';
    const items = read()
      .filter((item) => item.url !== current)
      .slice(0, limit);

    const tiles = items.map((item) => {
      const li = document.createElement('li');
      li.className = 'os-dock-item os-dock-recent';
      const link = document.createElement('a');
      link.className = 'os-dock-tile';
      link.href = item.url;
      link.dataset.osDockUrl = item.url;
      link.dataset.kind = item.kind;
      if (item.image) {
        const img = document.createElement('img');
        img.className = 'os-dock-thumb';
        img.src = item.image;
        img.alt = '';
        img.width = 48;
        img.height = 48;
        img.loading = 'lazy';
        img.decoding = 'async';
        link.append(img);
      } else {
        link.append(this.#glyph(item.kind));
      }
      const label = document.createElement('span');
      label.className = 'os-dock-label';
      label.textContent = item.title;
      link.append(label);
      const run = document.createElement('span');
      run.className = 'os-dock-run';
      run.setAttribute('aria-hidden', 'true');
      li.append(link, run);
      return li;
    });

    list.replaceChildren(...tiles);
    this.hidden = tiles.length === 0;
  }
}

customElements.define('s-dock-recents', SDockRecents);

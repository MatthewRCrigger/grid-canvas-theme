/**
 * <s-recent> — recently viewed products as "minimized windows" in the status bar.
 *
 * mode="record": placed on the product page with data-handle, data-title, data-url
 *   and data-image; stores the product at the front of the list (max 6) and renders nothing.
 * default mode: renders up to `limit` (default 4) chips into itself, excluding
 *   data-exclude (the current product handle), and hides itself when empty.
 *
 * Storage key: grid:recent (localStorage). Product data comes from Liquid, rendered as text.
 */
const KEY = 'grid:recent';
const MAX = 6;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item && item.handle && item.url) : [];
  } catch {
    return [];
  }
}

class SRecent extends HTMLElement {
  connectedCallback() {
    if (this.getAttribute('mode') === 'record') {
      this.#record();
      return;
    }
    this.#render();
  }

  #record() {
    const { handle, title, url, image } = this.dataset;
    if (!handle || !url) return;
    const list = read().filter((item) => item.handle !== handle);
    list.unshift({ handle, title: title || handle, url, image: image || '' });
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      // Storage full or blocked: recent items are a nicety, never required.
    }
  }

  #render() {
    const limit = Number.parseInt(this.getAttribute('limit') || '4', 10);
    const exclude = this.dataset.exclude || '';
    const items = read().filter((item) => item.handle !== exclude).slice(0, limit);
    this.replaceChildren();
    this.hidden = items.length === 0;

    for (const item of items) {
      const link = document.createElement('a');
      link.className = 'recent-chip';
      link.href = item.url;
      link.title = item.title;
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.width = 14;
        img.height = 14;
        img.loading = 'lazy';
        link.append(img);
      }
      const label = document.createElement('span');
      label.textContent = item.title;
      link.append(label);
      this.append(link);
    }
  }
}

customElements.define('s-recent', SRecent);

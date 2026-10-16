import { announceGlobalLiveRegion } from '@theme/live-region';

/**
 * <s-spotlight> — the homepage Spotlight launcher (Apple Spotlight behaviour, GRID style).
 *
 * A combobox over Shopify's predictive search JSON endpoint, asking for every resource type:
 * products, collections, pages, articles and suggested queries. Results render as grouped rows
 * (Top hit, Suggestions, Products, Collections, Journal, Pages, then "Search all results")
 * cloned from the caller's <template> blueprints; all copy comes from Liquid via data-*.
 * Arrow keys or the pointer highlight a row. Suggestion rows fill the query and search again.
 * With no query, the server-rendered top hits and commands show; "/" filters to commands.
 * Enter runs the highlighted row; with none highlighted the form submits natively.
 *
 * Attributes: data-suggest-url, data-search-url (Liquid routes), data-currency (ISO code),
 *   data-label-*, data-search-all (with %TERMS%), data-command-unknown (with %CMD%),
 *   data-empty-message, data-error-message.
 *
 * Child markup: input[role="combobox"], [data-spotlight-list], [data-spotlight-default],
 *   [data-spotlight-commands], [data-spotlight-live], [data-spotlight-status] (with [data-text]),
 *   [data-spotlight-clear], template[data-spotlight-heading], template[data-spotlight-row]
 *   (with [data-sold-out]), template[data-glyph="<kind>"].
 */

class Spotlight extends HTMLElement {
  #ac;
  #fetchAc;
  #timer;
  #input;
  #list;
  #live;
  #defaults;
  #status;
  #commands;
  #active = -1;
  #uid = 0;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };
    this.#input = this.querySelector('input[role="combobox"]');
    this.#list = this.querySelector('[data-spotlight-list]');
    this.#live = this.querySelector('[data-spotlight-live]');
    this.#defaults = this.querySelector('[data-spotlight-default]');
    this.#status = this.querySelector('[data-spotlight-status]');
    this.#commands = this.querySelector('[data-spotlight-commands]');
    if (!this.#input || !this.#list || !this.#live) return;

    this.#input.addEventListener('input', () => {
      this.toggleAttribute('data-querying', this.#input.value.trim() !== '');
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#search(), 200);
    }, opts);
    this.#input.addEventListener('keydown', (event) => this.#onKey(event), opts);

    this.querySelector('[data-spotlight-clear]')?.addEventListener('click', () => {
      this.#setQuery('');
      this.#input.focus();
    }, opts);

    // Pointer highlights a row, like Spotlight.
    this.#list.addEventListener('pointerover', (event) => {
      const option = event.target instanceof Element ? event.target.closest('[role="option"]') : null;
      if (!option) return;
      const index = this.#options.indexOf(option);
      if (index !== this.#active) this.#setActive(index, false);
    }, opts);

    // Suggestion rows refine the query instead of navigating.
    // Window commands (cart, compare) open in place, as in the search pop-up.
    this.#list.addEventListener('click', (event) => {
      const option = event.target instanceof Element ? event.target.closest('[role="option"][data-query], [role="option"][data-dialog]') : null;
      if (!option) return;
      event.preventDefault();
      if (option.dataset.dialog) {
        this.#run(option);
        return;
      }
      this.#setQuery(option.dataset.query);
      this.#input.focus();
    }, opts);

    this.#syncExpanded();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#fetchAc?.abort();
    clearTimeout(this.#timer);
  }

  get #options() {
    return [...this.#list.querySelectorAll('[role="option"]')].filter((el) => !el.closest('[hidden]'));
  }

  #setQuery(value) {
    this.#input.value = value;
    this.toggleAttribute('data-querying', value.trim() !== '');
    clearTimeout(this.#timer);
    this.#search();
  }

  async #search() {
    const query = this.#input.value.trim();
    this.#fetchAc?.abort();
    this.#setActive(-1);

    if (!query || query.startsWith('/')) {
      this.#live.replaceChildren();
      this.#live.hidden = true;
      if (this.#defaults) this.#defaults.hidden = Boolean(query);
      this.#setStatus('');
      this.#filterCommands(query);
      this.#syncExpanded();
      if (query) this.#setActive(0, false);
      return;
    }
    if (this.#commands) this.#commands.hidden = true;

    this.#fetchAc = new AbortController();
    this.setAttribute('aria-busy', 'true');
    try {
      const url = new URL(`${this.dataset.suggestUrl}.json`, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('resources[type]', 'product,collection,article,page,query');
      url.searchParams.set('resources[limit]', '4');
      url.searchParams.set('resources[limit_scope]', 'each');
      url.searchParams.set('resources[options][unavailable_products]', 'last');
      url.searchParams.set('resources[options][fields]', 'title,product_type,variants.title,vendor,tag');
      const response = await fetch(url, { signal: this.#fetchAc.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      this.#render(query, data?.resources?.results || {});
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.#live.replaceChildren();
      this.#setStatus(this.dataset.errorMessage || '', true);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  #render(query, results) {
    const products = results.products || [];
    const collections = results.collections || [];
    const articles = results.articles || [];
    const pages = results.pages || [];
    const queries = (results.queries || []).filter((item) => item.text && item.text.toLowerCase() !== query.toLowerCase());
    const fragment = document.createDocumentFragment();
    const group = (label, items, build) => {
      if (!items.length) return;
      fragment.append(this.#heading(label, items.length));
      items.forEach((item) => fragment.append(build(item)));
    };

    // Top hit: the best product, else the best collection, article or page.
    const topSource = products.length ? 'product' : collections.length ? 'collection' : articles.length ? 'article' : pages.length ? 'page' : null;
    const lists = { product: products, collection: collections, article: articles, page: pages };
    let topHit = null;
    if (topSource) {
      topHit = lists[topSource][0];
      lists[topSource] = lists[topSource].slice(1);
      group(this.dataset.labelTopHit, [topHit], (item) => this.#row(topSource, item));
    }
    group(this.dataset.labelSuggestions, queries.slice(0, 3), (item) => this.#queryRow(item));
    group(this.dataset.labelProducts, lists.product, (item) => this.#row('product', item));
    group(this.dataset.labelCollections, lists.collection, (item) => this.#row('collection', item));
    group(this.dataset.labelJournal, lists.article, (item) => this.#row('article', item));
    group(this.dataset.labelPages, lists.page, (item) => this.#row('page', item));

    const total = products.length + collections.length + articles.length + pages.length;
    fragment.append(this.#searchAllRow(query));

    this.#live.replaceChildren(fragment);
    this.#live.hidden = false;
    if (this.#defaults) this.#defaults.hidden = true;
    this.#setStatus(total === 0 ? this.dataset.emptyMessage : '', total === 0);
    this.#syncExpanded();
    if (total > 0) this.#setActive(0, false);

    announceGlobalLiveRegion(total === 0 ? this.dataset.emptyMessage : `${total}`, { frames: 2 });
  }

  /**
   * Command palette, matching the search pop-up: no query lists every command under the top
   * hits; "/name" keeps prefix matches; an unknown name shows the ERR line over the full list.
   */
  #filterCommands(query) {
    const group = this.#commands;
    if (!group) return;
    group.hidden = false;
    const name = query ? query.slice(1).split(/\s+/)[0].toLowerCase() : '';
    const rows = [...group.querySelectorAll('[role="option"][data-command]')];
    const matches = rows.filter((row) => !name || row.dataset.command.startsWith(name));
    const unknown = Boolean(name) && matches.length === 0;
    rows.forEach((row) => { row.hidden = !(unknown || matches.includes(row)); });
    const error = group.querySelector('[data-spotlight-cmd-error]');
    if (error) {
      error.hidden = !unknown;
      const text = error.querySelector('[data-text]') || error;
      text.textContent = unknown ? (this.dataset.commandUnknown || '').replace('%CMD%', query) : '';
    }
  }

  /** Runs a row: window commands open their dialog in place; everything else navigates. */
  #run(option) {
    const dialogId = option?.dataset.dialog;
    const target = dialogId ? document.getElementById(dialogId) : null;
    if (target instanceof HTMLDialogElement) {
      if (this.#input.value.trim().startsWith('/')) this.#setQuery('');
      const host = this.closest("dialog");
      if (host && host !== target) host.close();
      if (!target.open) target.showModal();
      if (dialogId === 'cart-drawer') {
        target.dispatchEvent(new CustomEvent('s-cart:opened', { bubbles: true, detail: { dialogId } }));
      }
      return;
    }
    if (option?.dataset.url) window.location.href = option.dataset.url;
  }

  #clone(selector) {
    const template = this.querySelector(selector);
    return template ? template.content.firstElementChild.cloneNode(true) : document.createElement('div');
  }

  #glyph(kind) {
    const template = this.querySelector(`template[data-glyph="${kind}"]`);
    return template ? template.content.cloneNode(true) : document.createDocumentFragment();
  }

  #heading(label, count) {
    const row = this.#clone('template[data-spotlight-heading]');
    const labelEl = row.querySelector('[data-label]');
    const countEl = row.querySelector('[data-count]');
    if (labelEl) labelEl.textContent = label || '';
    if (countEl) countEl.textContent = String(count).padStart(2, '0');
    return row;
  }

  /** Builds a result row: thumbnail or glyph, title, a mono sub line and (products) the price. */
  #row(kind, item) {
    let sub = '';
    let end = '';
    if (kind === 'product') {
      sub = [item.vendor, item.type || item.product_type].filter(Boolean).join(' // ');
      end = this.#priceOf(item);
    } else if (kind === 'article' || kind === 'page') {
      sub = [item.author, this.#date(item.published_at)].filter(Boolean).join(' // ');
    } else if (kind === 'collection') {
      sub = this.#plain(item.body || '');
    }
    const row = this.#fill({ kind, url: item.url, title: item.title || '', image: this.#imageOf(item) }, sub, end);
    if (kind === 'product' && !item.available) row.querySelector('[data-sold-out]')?.removeAttribute('hidden');
    return row;
  }

  #queryRow(item) {
    const row = this.#fill({ kind: 'query', url: item.url, title: item.text }, '', '');
    row.dataset.query = item.text;
    return row;
  }

  #searchAllRow(query) {
    const url = new URL(this.dataset.searchUrl, window.location.origin);
    url.searchParams.set('q', query);
    const title = (this.dataset.searchAll || '').replace('%TERMS%', query);
    return this.#fill({ kind: 'search', url: url.pathname + url.search, title }, '', '');
  }

  #fill(data, sub, end) {
    const row = this.#clone('template[data-spotlight-row]');
    row.id = `${this.#input.id}-live-${++this.#uid}`;
    if (data.url) row.dataset.url = data.url;
    const link = row.querySelector('a');
    if (link && data.url) link.href = data.url;
    const title = row.querySelector('[data-title]');
    if (title) title.textContent = data.title;
    const subEl = row.querySelector('[data-sub]');
    if (subEl) subEl.textContent = sub;
    const endEl = row.querySelector('[data-end]');
    if (endEl) endEl.textContent = end;
    const img = row.querySelector('img');
    if (img && data.image) {
      img.src = this.#sized(data.image, 96);
      img.hidden = false;
    } else {
      row.querySelector('[data-glyph]')?.append(this.#glyph(data.kind));
    }
    return row;
  }

  #imageOf(item) {
    const featured = item.featured_image;
    if (featured && typeof featured === 'object' && featured.url) return featured.url;
    if (typeof item.image === 'string' && item.image) return item.image;
    return '';
  }

  #sized(src, width) {
    try {
      const url = new URL(src, window.location.origin);
      url.searchParams.set('width', String(width));
      return url.toString();
    } catch {
      return src;
    }
  }

  #priceOf(item) {
    const min = item.price_min ?? item.price;
    const max = item.price_max ?? item.price;
    const low = this.#money(min);
    return Number.parseFloat(max) > Number.parseFloat(min) ? `${low} – ${this.#money(max)}` : low;
  }

  #money(amount) {
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value)) return amount ? String(amount) : '';
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: this.dataset.currency || 'USD',
      }).format(value);
    } catch {
      return String(amount);
    }
  }

  #date(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
  }

  /** HTML from the API becomes plain text in an inert document (scripts never run). */
  #plain(html) {
    if (!html) return '';
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
  }

  #setStatus(message, visible = false) {
    if (!this.#status) return;
    const text = this.#status.querySelector('[data-text]') || this.#status;
    text.textContent = message || '';
    this.#status.hidden = !visible;
  }

  #syncExpanded() {
    this.#input.setAttribute('aria-expanded', String(this.#options.length > 0));
  }

  #setActive(index, scroll = true) {
    const options = this.#options;
    options.forEach((option) => option.setAttribute('aria-selected', 'false'));
    if (index < 0 || !options.length) {
      this.#active = -1;
      this.#input.removeAttribute('aria-activedescendant');
      return;
    }
    if (index >= options.length) index = 0;
    this.#active = index;
    const option = options[index];
    option.setAttribute('aria-selected', 'true');
    this.#input.setAttribute('aria-activedescendant', option.id);
    if (scroll) option.scrollIntoView({ block: 'nearest' });
  }

  #onKey(event) {
    const options = this.#options;
    switch (event.key) {
      case 'ArrowDown':
        if (!options.length) return;
        event.preventDefault();
        this.#setActive(this.#active + 1);
        break;
      case 'ArrowUp':
        if (!options.length) return;
        event.preventDefault();
        this.#setActive(this.#active <= 0 ? options.length - 1 : this.#active - 1);
        break;
      case 'Enter': {
        const option = options[this.#active];
        if (!option) break;
        event.preventDefault();
        if (option.dataset.query) this.#setQuery(option.dataset.query);
        else this.#run(option);
        break;
      }
      case 'Escape':
        if (this.#input.value) {
          event.preventDefault();
          event.stopPropagation();
          this.#setQuery('');
        }
        break;
    }
  }
}

customElements.define('s-spotlight', Spotlight);

/**
 * <s-window-manager template="os-window-template" data-native-paths="/cart,/account">
 *
 * The GRID OS window manager. From 64rem (and never in the theme editor) internal links open
 * as draggable windows: the page is fetched, its #main-content is moved into a window built
 * from the template, and the address bar follows the focused window so links, refreshes and
 * partial updates keep working. Links inside a page window navigate that window (with Back).
 * Minimized windows (page windows and desktop windows) get a restore button in the dock tray.
 * The menu bar's app title shows the focused window.
 *
 * Paths in data-native-paths (written from Liquid routes) always load as normal pages.
 * The root link shows the desktop on the home page instead of opening a window.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const MAX_WINDOWS = 6;
const SESSION_KEY = 'grid-os:session';
const SESSION_MAX = 4;

class SWindowManager extends HTMLElement {
  #ac = null;
  #count = 0;
  #baseUrl = '';
  #layer = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    this.#baseUrl = this.#key(location.href);
    this.#layer = this.querySelector('[data-os-layer]');

    document.addEventListener('os:focus', (e) => this.#onFocus(e.target), { signal });
    document.addEventListener('os:minimize', (e) => this.#addTrayButton(e.target), { signal });
    document.addEventListener('os:restore', (e) => this.#removeTrayButton(e.target), { signal });
    document.addEventListener('os:closed', (e) => this.#onClosed(e.target), { signal });
    document.addEventListener('os:back', (e) => this.#back(e.target), { signal });

    if (window.Shopify?.designMode) return;

    // On the homepage desktop, page windows join the desktop's own stack so they and the
    // desktop's windows share one z-order: whichever window was clicked last is on top.
    const desktop = document.querySelector('.os-desktop');
    if (desktop && this.#layer) {
      this.#layer.dataset.inDesktop = '';
      desktop.append(this.#layer);
    }
    document.addEventListener('click', (e) => this.#onClick(e), { signal });
    window.addEventListener('popstate', () => this.#onPopState(), { signal });
    // Page windows are remembered between visits (like macOS reopening windows at login): the
    // open ones are saved as the page is left and reopened on the next visit to the Desktop.
    window.addEventListener('pagehide', () => this.#saveSession(), { signal });
    if (DESKTOP.matches && desktop && this.#baseUrl === (this.dataset.root || '/')) this.#restoreSession();
  }

  #saveSession() {
    if (!DESKTOP.matches) return;
    const urls = this.#windows
      .filter((win) => win.dataset.state === 'open' && win.dataset.url)
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .map((win) => win.dataset.url)
      .slice(-SESSION_MAX);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(urls));
    } catch {
      // Storage unavailable: nothing is reopened next time.
    }
  }

  #restoreSession() {
    let urls = [];
    try {
      urls = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
    } catch {
      urls = [];
    }
    if (!Array.isArray(urls)) return;
    for (const key of urls.slice(-SESSION_MAX)) {
      if (typeof key !== 'string' || !key.startsWith('/')) continue;
      const url = new URL(key, location.origin);
      if (this.#isNative(url) || this.#key(url.href) === this.#baseUrl) continue;
      this.open(url, null, { push: false });
    }
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  // Path plus query identifies a window; hashes are ignored.
  #key(href) {
    const url = new URL(href, location.href);
    return url.pathname + url.search;
  }

  get #windows() {
    return [...(this.#layer?.querySelectorAll('s-window[data-dynamic]') || [])];
  }

  #isNative(url) {
    const roots = (this.dataset.nativePaths || '').split(',').map((p) => p.trim()).filter(Boolean);
    return roots.some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`))
      || /\/(checkouts?|apps|password|challenge)(\/|$)/.test(url.pathname);
  }

  #onClick(event) {
    if (!DESKTOP.matches || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || link.closest('[data-os-native]')) return;
    if (link.target && link.target !== '_self') return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || this.#isNative(url)) return;
    if (url.hash && this.#key(url.href) === this.#key(location.href)) return;

    const root = this.dataset.root || '/';
    if (url.pathname === root) {
      if (this.#baseUrl !== root) return;
      event.preventDefault();
      this.#showDesktop();
      return;
    }
    if (this.#key(url.href) === this.#baseUrl && !this.#windows.length) return;

    event.preventDefault();
    link.closest('dialog[open]')?.close();
    const host = link.closest('s-window[data-dynamic]');
    if (host) this.#navigate(host, url, { push: true });
    else this.open(url, link);
  }

  open(url, opener = null, { push = true } = {}) {
    const key = this.#key(url.href);
    const existing = this.#windows.find((win) => win.dataset.url === key);
    if (existing) {
      if (existing.dataset.state === 'minimized') existing.restore();
      else existing.open(opener);
      return existing;
    }

    const open = this.#windows.filter((win) => win.dataset.state !== 'closed');
    if (open.length >= MAX_WINDOWS) open[0].close();

    const template = document.getElementById(this.getAttribute('template') || '');
    const win = template?.content.firstElementChild?.cloneNode(true);
    if (!win || !this.#layer) {
      location.href = url.href;
      return null;
    }
    const id = `os-window-${++this.#count}`;
    win.id = id;
    win.dataset.url = key;
    win.history = [];
    for (const control of win.querySelectorAll('[commandfor="os-window"]')) control.setAttribute('commandfor', id);
    const title = win.querySelector('[data-window-title]');
    if (title) title.id = `${id}-title`;
    win.setAttribute('aria-labelledby', `${id}-title`);

    // Cascade from the top-start corner; physical left/top match the drag code in s-window.
    const layerWidth = this.#layer.clientWidth;
    const layerHeight = this.#layer.clientHeight;
    const width = Math.min(1180, layerWidth - 64);
    const height = Math.max(320, layerHeight - 120);
    const step = (this.#count - 1) % 5;
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
    win.style.left = `${Math.max(16, (layerWidth - width) / 2 - 48 + step * 28)}px`;
    win.style.top = `${12 + step * 24}px`;

    this.#layer.append(win);
    win.dataset.state = 'closed';
    win.open(opener);
    this.#navigate(win, url, { push });
    return win;
  }

  async #navigate(win, url, { push = true, record = true } = {}) {
    const key = this.#key(url.href);
    const body = win.querySelector('[data-window-body]');
    const titleEl = win.querySelector('[data-window-title]');
    const pathEl = win.querySelector('[data-window-path]');
    win.dataset.loading = '';
    win.setAttribute('aria-busy', 'true');
    if (titleEl && !titleEl.textContent.trim()) titleEl.textContent = this.dataset.loadingLabel || '';

    let doc;
    try {
      const response = await fetch(url.href, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
      if (!response.ok || new URL(response.url).origin !== location.origin) throw new Error(String(response.status));
      doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    } catch {
      location.href = url.href;
      return;
    }
    const main = doc.getElementById('main-content');
    if (!main) {
      location.href = url.href;
      return;
    }

    if (record) win.history.push(key);
    win.dataset.url = key;
    body.replaceChildren(...main.childNodes);
    body.scrollTop = 0;
    this.#prepare(body);

    const heading = doc.querySelector('#main-content h1');
    const title = (heading?.textContent || doc.title.split(/\s[–|-]\s/)[0] || '').replace(/\s+/g, ' ').trim();
    if (titleEl) titleEl.textContent = title;
    if (pathEl) pathEl.textContent = url.pathname;
    const openEl = win.querySelector('[data-window-open]');
    if (openEl) openEl.href = url.href;
    win.dataset.title = title;
    win.querySelector('[data-window-back]')?.toggleAttribute('hidden', win.history.length < 2);
    delete win.dataset.loading;
    win.removeAttribute('aria-busy');

    if (push) history.pushState({ osWindow: key }, '', url.pathname + url.search + url.hash);
    else if (win.dataset.active !== undefined) history.replaceState({ osWindow: key }, '', url.pathname + url.search);
    this.#onFocus(win);
    this.#syncDock();
    this.#announce(title);
  }

  // Scripts parsed by DOMParser never run, so module and inline scripts are re-created; data
  // scripts (JSON) stay as they are. Morph names would duplicate the desktop's, so they are dropped.
  #prepare(body) {
    for (const old of body.querySelectorAll('script')) {
      const type = old.getAttribute('type') || '';
      if (type && type !== 'module' && type !== 'text/javascript') continue;
      const script = document.createElement('script');
      for (const { name, value } of old.attributes) script.setAttribute(name, value);
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
    for (const el of body.querySelectorAll('[style*="view-transition-name"]')) el.style.viewTransitionName = '';
  }

  #back(win) {
    if (!win?.history || win.history.length < 2) return;
    win.history.pop();
    const previous = win.history[win.history.length - 1];
    this.#navigate(win, new URL(previous, location.origin), { push: false, record: false });
  }

  #onFocus(win) {
    if (window.Shopify?.designMode || !win) return;
    // The address bar follows the focused window; desktop windows belong to the base page.
    const target = win.dataset.dynamic !== undefined ? win.dataset.url : this.#baseUrl;
    if (target && this.#key(location.href) !== target) {
      history.replaceState(win.dataset.dynamic !== undefined ? { osWindow: target } : null, '', target);
    }
  }

  #onClosed(win) {
    this.#removeTrayButton(win);
    if (win.dataset.dynamic !== undefined) win.remove();
    this.#syncDock();
    this.#focusTop();
  }

  #focusTop() {
    const open = [...document.querySelectorAll('s-window[data-state="open"]')]
      .filter((win) => win.getClientRects().length)
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0));
    if (open[0] && open[0].dataset.dynamic !== undefined) {
      open[0].focusWindow();
      return;
    }
    this.#onFocus(null);
    if (!window.Shopify?.designMode && this.#key(location.href) !== this.#baseUrl) history.replaceState(null, '', this.#baseUrl);
  }

  #showDesktop() {
    for (const win of this.#windows) {
      if (win.dataset.state === 'open') win.minimize();
    }
  }

  #addTrayButton(win) {
    const tray = document.querySelector('[data-os-tray]');
    if (!tray || !win.id || tray.querySelector(`[data-restores="${win.id}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'os-tray-tile';
    button.dataset.restores = win.id;
    const label = (this.dataset.restoreLabel || '%TITLE%').replace('%TITLE%', win.windowTitle);
    button.setAttribute('aria-label', label);
    button.title = win.windowTitle;
    const glyph = document.createElement('span');
    glyph.className = 'os-tray-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = win.windowTitle.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '··';
    const name = document.createElement('span');
    name.className = 'os-dock-label';
    name.textContent = win.windowTitle;
    button.append(glyph, name);
    button.addEventListener('click', () => win.restore());
    tray.append(button);
    tray.hidden = false;
    this.#focusTop();
  }

  #removeTrayButton(win) {
    const tray = document.querySelector('[data-os-tray]');
    tray?.querySelector(`[data-restores="${win.id}"]`)?.remove();
    if (tray && !tray.children.length) tray.hidden = true;
  }

  // Running squares under dock tiles whose page is open as a window (or is the current page).
  #syncDock() {
    const open = new Set(this.#windows.filter((win) => win.dataset.state !== 'closed').map((win) => win.dataset.url));
    open.add(this.#baseUrl);
    for (const tile of document.querySelectorAll('[data-os-dock-url]')) {
      tile.closest('li')?.toggleAttribute('data-running', open.has(this.#key(tile.getAttribute('href'))));
    }
  }

  #onPopState() {
    const key = this.#key(location.href);
    if (key === this.#baseUrl) {
      this.#showDesktop();
      return;
    }
    if (!DESKTOP.matches) {
      location.reload();
      return;
    }
    this.open(new URL(location.href), null, { push: false });
  }

  #announce(title) {
    const live = this.querySelector('[data-os-live]');
    if (live && title) live.textContent = (this.dataset.openedLabel || '%TITLE%').replace('%TITLE%', title);
  }
}

customElements.define('s-window-manager', SWindowManager);

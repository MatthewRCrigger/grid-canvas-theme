/**
 * <s-app-switcher> — the GRID OS window switcher and window shortcuts (64rem+).
 *
 * Browsers keep Cmd+Tab, Cmd+W and Cmd+M for themselves, so GRID OS uses Option (Alt):
 *   Option+Tab        — hold Option and press Tab (Shift+Tab goes back) to step through the open
 *                       windows, most recent first; release Option to bring the chosen one forward.
 *                       Esc cancels.
 *   Option+W          — close the front window.
 *   Option+M          — minimize the front window to the dock.
 * The strip is decorative chrome over a live region that announces the chosen window.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const TEXT_FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

class SAppSwitcher extends HTMLElement {
  #ac = null;
  #windows = [];
  #index = 0;
  #open = false;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    document.addEventListener('keydown', (event) => this.#onKeydown(event), { capture: true, signal });
    document.addEventListener('keyup', (event) => {
      if (this.#open && event.key === 'Alt') this.#commit();
    }, { signal });
    window.addEventListener('blur', () => this.#cancel(), { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #list() {
    return [...document.querySelectorAll('s-window')]
      .filter((win) => (win.dataset.state === 'open' || win.dataset.state === 'minimized')
        && !win.isStatic && !win.isDialog && win.dataset.nested === undefined
        && (win.dataset.state === 'minimized' || win.getClientRects().length))
      .sort((a, b) => {
        const rank = (w) => (w.dataset.state === 'minimized' ? -1 : Number(w.style.zIndex || 0));
        return rank(b) - rank(a);
      });
  }

  #front() {
    return document.querySelector('s-window[data-active][data-state="open"]:not([data-mode="static"]):not([data-mode="dialog"])');
  }

  #onKeydown(event) {
    if (!DESKTOP.matches || !event.altKey || event.metaKey || event.ctrlKey) {
      if (this.#open && event.key === 'Escape') this.#cancel();
      return;
    }
    if (document.querySelector('dialog[open]') || document.documentElement.hasAttribute('data-mission')) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      if (!this.#open) {
        this.#windows = this.#list();
        if (!this.#windows.length) return;
        this.#show();
        this.#move(this.#windows.length > 1 && !event.shiftKey ? 1 : 0);
      } else {
        this.#move(this.#index + (event.shiftKey ? -1 : 1));
      }
      return;
    }
    if (this.#open && event.key === 'Escape') {
      event.preventDefault();
      this.#cancel();
      return;
    }
    if (event.target.closest?.(TEXT_FIELD) || this.#open) return;
    const front = this.#front();
    if (!front) return;
    if (event.code === 'KeyW') {
      event.preventDefault();
      front.close();
    } else if (event.code === 'KeyM') {
      event.preventDefault();
      front.minimize();
    }
  }

  #show() {
    const strip = this.querySelector('[data-switcher-strip]');
    if (!strip) return;
    strip.replaceChildren(...this.#windows.map((win) => {
      const tile = document.createElement('span');
      tile.className = 'os-switcher-tile';
      const glyph = document.createElement('span');
      glyph.className = 'os-tray-glyph';
      const title = win.windowTitle;
      glyph.textContent = title.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '··';
      const name = document.createElement('span');
      name.className = 'os-switcher-name';
      name.textContent = title;
      tile.append(glyph, name);
      if (win.dataset.state === 'minimized') tile.dataset.minimized = '';
      return tile;
    }));
    this.hidden = false;
    this.#open = true;
  }

  #move(index) {
    this.#index = (index + this.#windows.length) % this.#windows.length;
    const tiles = this.querySelectorAll('.os-switcher-tile');
    tiles.forEach((tile, i) => tile.toggleAttribute('data-current', i === this.#index));
    const live = this.querySelector('[data-switcher-live]');
    if (live) live.textContent = this.#windows[this.#index]?.windowTitle || '';
  }

  #commit() {
    const win = this.#windows[this.#index];
    this.#cancel();
    if (!win?.isConnected) return;
    if (win.dataset.state === 'minimized') win.restore();
    else win.open();
  }

  #cancel() {
    this.#open = false;
    this.hidden = true;
    this.#windows = [];
    this.querySelector('[data-switcher-strip]')?.replaceChildren();
  }
}

customElements.define('s-app-switcher', SAppSwitcher);

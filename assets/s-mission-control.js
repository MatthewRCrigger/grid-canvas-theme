/**
 * <s-mission-control id="os-mission"> — macOS Mission Control for GRID OS windows (64rem+).
 *
 * Option+↑, F3, the command --mission (commandfor="os-mission") or an `os:mission-control`
 * event on document spreads every open floating window (desktop windows and page windows) into a
 * tidy grid between the menu bar and the dock, each labelled with its title. Click a window, or
 * move with the arrow keys and press Enter, to bring it forward; Esc or a click on the empty
 * desktop leaves without changing anything. Windows only move with transforms, so their own
 * position and size are untouched.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const GAP = 32;

class SMissionControl extends HTMLElement {
  #ac = null;
  #active = false;
  #windows = [];
  #labels = [];
  #index = 0;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    document.addEventListener('keydown', (event) => this.#onKeydown(event), { capture: true, signal });
    document.addEventListener('os:mission-control', () => this.toggle(), { signal });
    this.addEventListener('command', (event) => {
      if (event.command === '--mission') this.toggle();
    }, { signal });
    document.addEventListener('click', (event) => this.#onClick(event), { capture: true, signal });
    // Windows must not start a drag or take focus while they are thumbnails.
    document.addEventListener('pointerdown', (event) => {
      if (this.#active) event.stopPropagation();
    }, { capture: true, signal });
    document.addEventListener('pointerover', (event) => {
      if (!this.#active) return;
      const index = this.#windows.findIndex((w) => w.contains(event.target));
      if (index > -1 && index !== this.#index) this.#highlight(index);
    }, { signal });
    window.addEventListener('resize', () => this.exit(), { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.exit();
  }

  toggle() {
    if (this.#active) this.exit();
    else this.enter();
  }

  #openWindows() {
    return [...document.querySelectorAll('s-window[data-state="open"]')]
      .filter((win) => !win.isStatic && !win.isDialog && win.dataset.nested === undefined && win.getClientRects().length)
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0));
  }

  enter() {
    if (!DESKTOP.matches || this.#active) return;
    const windows = this.#openWindows();
    this.#active = true;
    const header = document.querySelector('header, [data-header-nav-group]')?.getBoundingClientRect();
    // Hints sit below the real header (it is taller than the menu bar token), never on its border.
    this.style.setProperty('--os-mission-top', `${Math.round(header?.bottom || 44)}px`);
    document.documentElement.setAttribute('data-mission', windows.length ? '' : 'empty');
    this.hidden = false;
    const hint = this.querySelector('[data-mission-hint]');
    const empty = this.querySelector('[data-mission-empty]');
    if (empty) empty.hidden = windows.length > 0;
    if (hint) hint.hidden = windows.length === 0;
    if (!windows.length) return;

    const dock = document.querySelector('.os-dock')?.getBoundingClientRect();
    const top = (header?.bottom || 44) + 48;
    const bottom = (dock?.top || window.innerHeight - 96) - 24;
    const area = { left: GAP, top, width: window.innerWidth - GAP * 2, height: Math.max(200, bottom - top) };
    const cols = Math.ceil(Math.sqrt(windows.length * (area.width / area.height) / 1.6)) || 1;
    const columns = Math.min(windows.length, Math.max(1, cols));
    const rows = Math.ceil(windows.length / columns);
    const cellW = (area.width - GAP * (columns - 1)) / columns;
    const cellH = (area.height - GAP * (rows - 1)) / rows - 28;

    this.#windows = windows;
    this.#labels = windows.map((win, i) => {
      const rect = win.getBoundingClientRect();
      const col = i % columns;
      const row = Math.floor(i / columns);
      const scale = Math.min(cellW / rect.width, cellH / rect.height, 1);
      const cx = area.left + col * (cellW + GAP) + cellW / 2;
      const cy = area.top + row * (cellH + 28 + GAP) + cellH / 2;
      const dx = cx - (rect.left + rect.width / 2);
      const dy = cy - (rect.top + rect.height / 2);
      win.dataset.missionTransform = '';
      win.style.transformOrigin = 'center';
      win.style.transition = REDUCED.matches ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)';
      win.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

      const label = document.createElement('span');
      label.className = 'os-mission-label';
      label.textContent = win.windowTitle;
      label.style.left = `${cx}px`;
      label.style.top = `${cy + (rect.height * scale) / 2 + 10}px`;
      this.append(label);
      return label;
    });
    this.#highlight(0);
  }

  exit(focus = null) {
    if (!this.#active) return;
    this.#active = false;
    document.documentElement.removeAttribute('data-mission');
    this.hidden = true;
    for (const label of this.#labels) label.remove();
    for (const win of this.#windows) {
      delete win.dataset.missionTarget;
      win.style.transform = '';
      const done = () => {
        win.style.transition = '';
        win.style.transformOrigin = '';
        delete win.dataset.missionTransform;
      };
      if (REDUCED.matches) done();
      else setTimeout(done, 340);
    }
    this.#windows = [];
    this.#labels = [];
    focus?.focusWindow?.();
    focus?.focus?.({ preventScroll: true });
  }

  #highlight(index) {
    if (!this.#windows.length) return;
    this.#index = (index + this.#windows.length) % this.#windows.length;
    this.#windows.forEach((win, i) => win.toggleAttribute('data-mission-target', i === this.#index));
    this.#labels.forEach((label, i) => label.toggleAttribute('data-current', i === this.#index));
  }

  #onKeydown(event) {
    const trigger = (event.altKey && event.key === 'ArrowUp') || (event.key === 'F3' && !event.altKey);
    if (trigger && !event.metaKey && !event.ctrlKey && DESKTOP.matches && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      this.toggle();
      return;
    }
    if (!this.#active) return;
    const keys = {
      Escape: () => this.exit(),
      Enter: () => this.exit(this.#windows[this.#index]),
      ArrowRight: () => this.#highlight(this.#index + (document.dir === 'rtl' ? -1 : 1)),
      ArrowLeft: () => this.#highlight(this.#index + (document.dir === 'rtl' ? 1 : -1)),
      ArrowDown: () => this.#highlight(this.#index + 1),
      ArrowUp: () => this.#highlight(this.#index - 1),
      Tab: () => this.#highlight(this.#index + (event.shiftKey ? -1 : 1)),
    };
    if (keys[event.key]) {
      event.preventDefault();
      event.stopPropagation();
      keys[event.key]();
    }
  }

  // While active, a click picks a window (without reaching its contents) or leaves.
  #onClick(event) {
    if (!this.#active) return;
    event.preventDefault();
    event.stopPropagation();
    const win = this.#windows.find((w) => w.contains(event.target));
    this.exit(win || null);
  }
}

customElements.define('s-mission-control', SMissionControl);

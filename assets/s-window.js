/**
 * <s-window id="…" data-state="open|closed|minimized"> — a GRID OS desktop window.
 *
 * From 64rem the window drags by its title bar (first `.panel-header` or [data-window-bar]),
 * raises on pointer down or focus, zooms on a title-bar double click, and closes on Esc.
 * Below 64rem a window that starts closed opens as a full-screen sheet.
 *
 * Commands (buttons with commandfor = this id): --close, --minimize, --zoom, --open, --back.
 * Events (bubbling): os:focus, os:open, os:close, os:closed, os:minimize, os:restore, os:back.
 * data-dynamic windows (built by s-window-manager) are removed by the manager after os:closed.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
let topZ = 20;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

class SWindow extends HTMLElement {
  #ac = null;
  opener = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    if (!this.dataset.state) this.dataset.state = 'open';
    this.#seatControls();
    // A page streamed into another window keeps its markup but not its behavior: the outer
    // window owns the controls, focus and z-order.
    if (this.parentElement?.closest('s-window')) {
      this.dataset.nested = '';
      return;
    }
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
    if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      const title = this.windowTitle;
      if (title) this.setAttribute('aria-label', title);
    }

    this.addEventListener('command', (event) => {
      if (event.target !== this) return;
      const actions = {
        '--close': () => this.close(),
        '--minimize': () => this.minimize(),
        '--zoom': () => this.toggleZoom(),
        '--open': () => this.open(event.source),
        '--back': () => this.#emit('os:back'),
      };
      actions[event.command]?.();
    }, { signal });

    this.addEventListener('pointerdown', (event) => this.#onPointerDown(event), { signal });
    this.addEventListener('focusin', () => this.focusWindow(), { signal });
    this.addEventListener('dblclick', (event) => {
      const bar = event.target.closest('[data-window-bar], .panel-header');
      if (!bar || bar.closest('s-window') !== this || event.target.closest('button, a')) return;
      if (DESKTOP.matches) this.toggleZoom();
    }, { signal });
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || this.isStatic || this.isDialog) return;
      if (event.target.closest('dialog[open], [popover]:popover-open')) return;
      if (event.target.closest('s-window') !== this) return;
      event.preventDefault();
      this.close();
    }, { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  /**
   * Seats the window controls inside the title bar so they share its centre line with the title,
   * whatever frame style or readout the window has.
   */
  #seatControls() {
    const controls = this.querySelector(':scope > .frame-inner > [data-window-controls]');
    const bar = this.querySelector(':scope > .frame-inner > .panel-header');
    if (controls && bar) bar.prepend(controls);
  }

  /** Title used by the dock tray and the menu bar: the bar's heading, else its first label. */
  get windowTitle() {
    if (this.dataset.title) return this.dataset.title;
    const bar = this.querySelector('[data-window-bar]') || this.querySelector(':scope > .frame-inner > .panel-header');
    const label = bar?.querySelector('h1, h2, h3, h4, [data-window-title]')
      || [...(bar?.children || [])].find((child) => !child.matches('[data-window-controls], button') && child.textContent.trim());
    return (label?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  get isOpen() {
    return this.dataset.state === 'open';
  }

  focusWindow() {
    // A pop-up window is always the focused window while it is open; it leaves the page's focus alone.
    if (this.isDialog) return;
    if (this.dataset.active !== undefined && Number(this.style.zIndex) === topZ) return;
    if (!this.isStatic && (DESKTOP.matches || this.dataset.dynamic !== undefined)) this.style.zIndex = String(++topZ);
    for (const other of document.querySelectorAll('s-window[data-active]')) {
      if (other !== this) delete other.dataset.active;
    }
    this.dataset.active = '';
    this.#emit('os:focus');
  }

  open(opener = null) {
    if (opener instanceof Element) this.opener = opener;
    const wasOpen = this.isOpen;
    // A window that starts closed opens as a full-screen sheet on phones and tablets.
    const sheet = !DESKTOP.matches && this.dataset.defaultState === 'closed';
    this.toggleAttribute('data-sheet', sheet);
    document.documentElement.toggleAttribute('data-os-sheet', sheet);
    this.dataset.state = 'open';
    this.focusWindow();
    if (!wasOpen) {
      // Opened from a dock tile: the window pours up out of it (Genie); elsewhere it scales in.
      const tile = DESKTOP.matches && !this.isDialog && opener instanceof Element
        ? opener.closest('.os-dock-tile, .os-tray-tile, .os-dock a, .os-dock button')
        : null;
      if (!tile || !this.#genie(tile.getBoundingClientRect(), 'in', 340)) {
        this.#animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], 220);
      }
      this.#emit('os:open');
    }
    const heading = this.querySelector('[data-window-title]');
    (heading || this).focus({ preventScroll: true });
    if (sheet) this.scrollTop = 0;
  }

  /** Page windows and panes sit in the page flow; desktop windows float. */
  get isStatic() {
    return this.dataset.mode === 'static';
  }

  /** Pop-up windows (cart, search, compare, filters, menu) live inside a native modal <dialog>. */
  get isDialog() {
    return this.dataset.mode === 'dialog';
  }

  /** Closes the surrounding dialog through its own (animated) close. */
  #closeDialog() {
    delete this.dataset.zoomed;
    this.closest('dialog')?.close();
  }

  async close() {
    if (this.isDialog) {
      this.#closeDialog();
      return;
    }
    if (this.dataset.state === 'closed') return;
    // A page window closes to the Desktop; a pane goes to the dock like a minimize.
    if (this.isStatic) {
      if (this.dataset.role === 'page') location.href = this.dataset.closeUrl || '/';
      else this.minimize();
      return;
    }
    this.#emit('os:close');
    await this.#animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], 160);
    this.dataset.state = 'closed';
    delete this.dataset.active;
    delete this.dataset.zoomed;
    if (this.hasAttribute('data-sheet')) {
      this.removeAttribute('data-sheet');
      document.documentElement.removeAttribute('data-os-sheet');
    }
    const opener = this.opener;
    this.opener = null;
    this.#emit('os:closed');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  async minimize() {
    // A pop-up minimizes back into the dock tile or button that opened it.
    if (this.isDialog) {
      this.#closeDialog();
      return;
    }
    if (!DESKTOP.matches) {
      if (!this.isStatic) this.close();
      return;
    }
    // Genie into the dock tray: physical x/y here follow the measured screen positions.
    await this.#genie(this.#trayTarget(), 'out', 300);
    this.dataset.state = 'minimized';
    delete this.dataset.active;
    this.#emit('os:minimize');
  }

  restore() {
    // Measure the tray tile before it is removed, then Genie back out of it.
    const tile = document.querySelector(`[data-os-tray] [data-restores="${CSS.escape(this.id)}"]`);
    const from = tile?.getBoundingClientRect() || this.#trayTarget();
    this.dataset.state = 'open';
    this.focusWindow();
    if (!DESKTOP.matches || !this.#genie(from, 'in', 340)) {
      this.#animate([{ opacity: 0, transform: 'translateY(40px) scale(0.9)' }, { opacity: 1, transform: 'none' }], 260);
    }
    this.#emit('os:restore');
    (this.querySelector('[data-window-title]') || this).focus({ preventScroll: true });
  }

  toggleZoom() {
    if (!DESKTOP.matches) return;
    this.toggleAttribute('data-zoomed');
    this.focusWindow();
  }

  #onPointerDown(event) {
    if (event.target.closest('s-window') !== this) return;
    this.focusWindow();
    if (!DESKTOP.matches || this.isStatic || this.isDialog || event.button !== 0 || this.dataset.zoomed !== undefined) return;
    const bar = event.target.closest('[data-window-bar], .panel-header');
    if (!bar || bar.closest('s-window') !== this) return;
    if (event.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;

    event.preventDefault();
    const parent = this.offsetParent || document.body;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = this.offsetLeft;
    const startTop = this.offsetTop;
    const width = this.offsetWidth;
    bar.setPointerCapture(event.pointerId);
    this.dataset.dragging = '';

    // Pointer tracking is physical (left/top) in every direction; the inline inset reset drops the
    // logical start/end placement classes so the dragged position is the only one that applies.
    const move = (moveEvent) => {
      const left = clamp(startLeft + moveEvent.clientX - startX, 96 - width, parent.clientWidth - 96);
      const top = clamp(startTop + moveEvent.clientY - startY, 0, parent.clientHeight - 48);
      this.style.inset = 'auto';
      this.style.left = `${left}px`;
      this.style.top = `${top}px`;
    };
    const end = () => {
      delete this.dataset.dragging;
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', end);
      bar.removeEventListener('pointercancel', end);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  #animate(keyframes, duration, easing = 'cubic-bezier(0.16, 1, 0.3, 1)') {
    if (REDUCED.matches || !this.animate || !this.getClientRects().length) return Promise.resolve();
    return this.animate(keyframes, { duration, easing }).finished.catch(() => {});
  }


  /**
   * The macOS Genie warp between this window and a dock tile (`target`, a DOMRect-like box).
   * The window pinches into a curved funnel whose neck is the tile, then slides down through it
   * (`out`); `in` plays the same frames backwards. Built as WAAPI keyframes of a translate plus a
   * clip-path polygon traced along the funnel, so it stays interruptible and needs no snapshot.
   */
  #genie(target, direction = 'out', duration = 480) {
    const from = this.getBoundingClientRect();
    if (!target || !from.width || !from.height || !target.width) return null;
    const ease = (t) => 1 - (1 - t) ** 3;
    const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    const neckBottom = target.top + target.height;
    const travel = Math.max(1, neckBottom - from.top);
    // If the tile sits outside the window's span, the window drifts sideways so the neck fits.
    const shift = Math.max(0, target.right - from.right) + Math.min(0, target.left - from.left);
    const ROWS = 18;
    const FRAMES = 28;
    const frames = [];
    for (let i = 0; i <= FRAMES; i++) {
      const p = i / FRAMES;
      const pinch = ease(Math.min(1, p / 0.35));
      const slide = Math.max(0, (p - 0.15) / 0.85) ** 1.4;
      const dx = shift * pinch;
      const dy = slide * travel;
      const top = from.top + dy;
      const bottom = Math.min(top + from.height, neckBottom);
      const left = [];
      const right = [];
      for (let r = 0; r <= ROWS; r++) {
        const y = bottom > top ? lerp(top, bottom, r / ROWS) : neckBottom;
        const f = pinch * smooth(Math.min(1, Math.max(0, (y - from.top) / travel)));
        const ly = (y - top).toFixed(1);
        left.push(`${(lerp(from.left + dx, target.left, f) - from.left - dx).toFixed(1)}px ${ly}px`);
        right.unshift(`${(lerp(from.right + dx, target.right, f) - from.left - dx).toFixed(1)}px ${ly}px`);
      }
      frames.push({
        offset: p,
        transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`,
        clipPath: `polygon(${left.concat(right).join(', ')})`,
        opacity: p < 0.88 ? 1 : 1 - (p - 0.88) / 0.12,
      });
    }
    if (direction === 'in') {
      frames.reverse();
      for (const frame of frames) frame.offset = 1 - frame.offset;
    }
    this.dataset.genie = '';
    const done = this.#animate(frames, duration, 'cubic-bezier(0.4, 0, 0.2, 1)');
    return done.then(() => delete this.dataset.genie);
  }

  /** Where a minimized window lands: the end of the dock tray, else the end of the dock. */
  #trayTarget() {
    const tray = document.querySelector('[data-os-tray]');
    const tiles = tray && !tray.hidden ? tray.querySelectorAll('.os-tray-tile') : [];
    if (tiles.length) {
      const last = tiles[tiles.length - 1].getBoundingClientRect();
      const rtl = getComputedStyle(tray).direction === 'rtl';
      return new DOMRect(rtl ? last.left - last.width - 8 : last.right + 8, last.top, last.width, last.height);
    }
    const dock = document.querySelector('.os-dock')?.getBoundingClientRect();
    if (!dock?.width) return null;
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const size = Math.min(48, dock.height - 16);
    return new DOMRect(rtl ? dock.left + 8 : dock.right - size - 8, dock.bottom - size - 8, size, size);
  }

  #emit(type) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true }));
  }
}

customElements.define('s-window', SWindow);

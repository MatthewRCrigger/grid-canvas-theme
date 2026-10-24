/**
 * <s-desktop> — the GRID OS desktop surface on the home page.
 *
 * Desktop icons (.os-icon) behave like a computer: with a mouse the first click selects an icon
 * and a second click opens it; keyboard and touch open on the first activation. Icons with
 * data-window open the desktop window with that id; link icons fall through to
 * s-window-manager, which opens the page as a window. Clicking the empty desktop clears the
 * selection. In the theme editor, selecting a block inside a closed window opens that window.
 *
 * From 64rem with a mouse (never in the theme editor):
 *   - Drag on the empty desktop to draw a selection box (Shift adds to the selection).
 *   - Drag an icon (or every selected icon) to move it; positions snap to an 8px grid and are
 *     remembered per visitor in localStorage.
 *   - The `os:desktop-cleanup` event (context menu "Clean up icons") puts every icon back.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const STORE_KEY = 'grid-os:icons';
const SNAP = 8;
const THRESHOLD = 4;

class SDesktop extends HTMLElement {
  #ac = null;
  #gesture = null;
  #suppressClick = false;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;

    this.#boot();

    this.addEventListener('click', (event) => this.#onClick(event), { signal });
    this.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:block:select', (event) => {
        const win = event.target.closest?.('s-window');
        if (win && this.contains(win) && win.dataset.state !== 'open') win.open?.();
      }, { signal });
      return;
    }

    this.addEventListener('pointerdown', (event) => this.#onPointerDown(event), { signal });
    this.addEventListener('pointermove', (event) => this.#onPointerMove(event), { signal });
    this.addEventListener('pointerup', (event) => this.#onPointerUp(event), { signal });
    this.addEventListener('pointercancel', () => this.#endGesture(), { signal });
    // Link icons would otherwise start the browser's own link drag and cancel the move.
    this.addEventListener('dragstart', (event) => {
      if (DESKTOP.matches && event.target.closest?.('.os-icon')) event.preventDefault();
    }, { signal });
    document.addEventListener('os:desktop-cleanup', () => this.cleanUp(), { signal });
    // The system menu's "Clean up icons" commands this element: commandfor="os-desktop" command="--cleanup".
    this.addEventListener('command', (event) => {
      if (event.command === '--cleanup') this.cleanUp();
    }, { signal });
    DESKTOP.addEventListener('change', () => this.#applyPositions(), { signal });
    this.#applyPositions();
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  /**
   * Boot: from 64rem the desktop (and the window layer) stay hidden in CSS until this sets
   * data-ready, so a visitor never sees the fresh layout and then watches it jump to their saved
   * one. By the time s-window and s-window-manager are defined, every window has applied its
   * desktop state and saved position and the manager has reopened the last session; icon
   * positions were applied in connectedCallback. One frame later the restored state is painted.
   * CSS reveals the desktop on its own after 2.5s if a script never arrives.
   */
  async #boot() {
    if (window.Shopify?.designMode || !DESKTOP.matches) {
      this.dataset.ready = '';
      return;
    }
    await Promise.all(['s-window', 's-window-manager'].map((name) => customElements.whenDefined(name)));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    this.dataset.ready = '';
  }

  #onClick(event) {
    if (this.#suppressClick) {
      this.#suppressClick = false;
      event.preventDefault();
      return;
    }
    const icon = event.target.closest('.os-icon');
    if (!icon) {
      if (!event.target.closest('s-window')) this.#select(null);
      return;
    }
    const mouse = event.pointerType === 'mouse';
    if (mouse && !icon.hasAttribute('data-selected')) {
      event.preventDefault();
      this.#select(icon);
      return;
    }
    this.#select(icon);
    const id = icon.dataset.window;
    if (!id) return;
    event.preventDefault();
    const win = document.getElementById(id);
    if (win?.open) win.open(icon);
  }

  // Arrow keys move between icons in reading order, like a Finder icon grid.
  #onKeydown(event) {
    const icon = event.target.closest('.os-icon');
    if (!icon || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const icons = [...this.querySelectorAll('.os-icon')].filter((el) => el.getClientRects().length);
    const index = icons.indexOf(icon);
    const forward = event.key === 'ArrowDown' || event.key === (document.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    const next = icons[index + (forward ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    this.#select(next);
  }

  #select(icon) {
    for (const el of this.querySelectorAll('.os-icon[data-selected]')) {
      if (el !== icon) el.removeAttribute('data-selected');
    }
    icon?.setAttribute('data-selected', '');
  }

  /* ---- Moving icons and the selection box ---------------------------------------------- */

  #key(icon) {
    if (icon.dataset.window) return `w:${icon.dataset.window}`;
    if (icon.href) return `u:${new URL(icon.href, location.href).pathname}`;
    return `t:${icon.textContent.trim()}`;
  }

  #read() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  #write(positions) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(positions));
    } catch {
      // Storage unavailable: icons stay where they are for this visit only.
    }
  }

  #offset(item) {
    return [Number(item.dataset.dx || 0), Number(item.dataset.dy || 0)];
  }

  #place(item, dx, dy) {
    item.dataset.dx = String(dx);
    item.dataset.dy = String(dy);
    const moved = DESKTOP.matches && (dx || dy);
    item.style.translate = moved ? `${dx}px ${dy}px` : '';
    item.toggleAttribute('data-moved', Boolean(moved));
  }

  #applyPositions() {
    const positions = this.#read();
    for (const icon of this.querySelectorAll('.os-icon')) {
      const item = icon.closest('.os-icon-item');
      if (!item) continue;
      const [dx, dy] = positions[this.#key(icon)] || [0, 0];
      this.#place(item, dx, dy);
    }
  }

  cleanUp() {
    this.#write({});
    for (const item of this.querySelectorAll('.os-icon-item')) this.#place(item, 0, 0);
  }

  #onPointerDown(event) {
    if (!DESKTOP.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target.closest('s-window')) return;
    const icon = event.target.closest('.os-icon');
    if (icon) {
      const group = icon.hasAttribute('data-selected')
        ? [...this.querySelectorAll('.os-icon[data-selected]')]
        : [icon];
      this.#gesture = {
        type: 'move',
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        icon,
        items: group.map((el) => {
          const item = el.closest('.os-icon-item');
          return { icon: el, item, start: this.#offset(item) };
        }).filter((entry) => entry.item),
        active: false,
      };
      return;
    }
    if (event.target.closest('a, button, input, select, textarea, label, [role="button"]')) return;
    this.#gesture = { type: 'marquee', x: event.clientX, y: event.clientY, id: event.pointerId, additive: event.shiftKey, active: false, box: null };
  }

  #onPointerMove(event) {
    const g = this.#gesture;
    if (!g || event.pointerId !== g.id) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.active) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      g.active = true;
      this.setPointerCapture(event.pointerId);
      if (g.type === 'move') {
        if (!g.icon.hasAttribute('data-selected')) this.#select(g.icon);
        for (const entry of g.items) entry.item.dataset.dragging = '';
      } else {
        g.box = document.createElement('div');
        g.box.className = 'os-marquee';
        g.box.setAttribute('aria-hidden', 'true');
        document.body.append(g.box);
        if (!g.additive) this.#select(null);
      }
    }
    if (g.type === 'move') {
      for (const entry of g.items) this.#place(entry.item, entry.start[0] + dx, entry.start[1] + dy);
      return;
    }
    const left = Math.min(g.x, event.clientX);
    const top = Math.min(g.y, event.clientY);
    const right = Math.max(g.x, event.clientX);
    const bottom = Math.max(g.y, event.clientY);
    Object.assign(g.box.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    for (const icon of this.querySelectorAll('.os-icon')) {
      const r = icon.getBoundingClientRect();
      const hit = r.right > left && r.left < right && r.bottom > top && r.top < bottom;
      if (hit) icon.setAttribute('data-selected', '');
      else if (!g.additive) icon.removeAttribute('data-selected');
    }
  }

  #onPointerUp(event) {
    const g = this.#gesture;
    if (!g || event.pointerId !== g.id) return;
    if (g.active) {
      this.#suppressClick = true;
      // A click only follows when the pointer is released over the same element; clear the flag
      // after this turn so a drag that ends elsewhere never swallows the next real click.
      setTimeout(() => { this.#suppressClick = false; }, 0);
      if (g.type === 'move') {
        const positions = this.#read();
        const bounds = this.getBoundingClientRect();
        for (const entry of g.items) {
          let [dx, dy] = this.#offset(entry.item);
          dx = Math.round(dx / SNAP) * SNAP;
          dy = Math.round(dy / SNAP) * SNAP;
          // Keep the icon on the desktop.
          const r = entry.item.getBoundingClientRect();
          const curDx = Number(entry.item.dataset.dx);
          const curDy = Number(entry.item.dataset.dy);
          const baseLeft = r.left - curDx;
          const baseTop = r.top - curDy;
          dx = Math.min(Math.max(dx, bounds.left - baseLeft), bounds.right - r.width - baseLeft);
          dy = Math.min(Math.max(dy, bounds.top - baseTop), bounds.bottom - r.height - baseTop);
          this.#place(entry.item, dx, dy);
          positions[this.#key(entry.icon)] = [dx, dy];
        }
        this.#write(positions);
      }
    }
    this.#endGesture();
  }

  #endGesture() {
    const g = this.#gesture;
    this.#gesture = null;
    if (!g) return;
    g.box?.remove();
    if (g.type === 'move') for (const entry of g.items) delete entry.item.dataset.dragging;
  }
}

customElements.define('s-desktop', SDesktop);

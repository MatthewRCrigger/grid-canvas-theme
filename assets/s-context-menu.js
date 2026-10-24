/**
 * <s-context-menu> — GRID OS right-click menus (64rem+, mouse or trackpad, never in the editor).
 *
 * What the menu offers depends on what was clicked:
 *   link or desktop icon  — Open, Open in new tab, Copy link
 *   product (data-quick-look) — adds Quick Look and Get Info
 *   window title bar      — Minimize, Zoom, Close
 *   empty desktop / page  — New Terminal window, Mission Control, Clean up icons, Spotlight,
 *                           About This Site, Start screen saver
 * Shift + right-click, text fields, selected text, media and anything inside a pop-up keep the
 * browser's own menu. Labels come from the JSON <script data-labels> child (translated in Liquid).
 * The menu is a manual popover with role="menu"; arrows, Home/End, Enter and Esc work as in macOS.
 */
const DESKTOP = window.matchMedia('(min-width: 64rem)');
const FINE = window.matchMedia('(pointer: fine)');
const NATIVE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], video, audio, iframe';

class SContextMenu extends HTMLElement {
  #ac = null;
  #menu = null;
  #labels = {};
  #returnFocus = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;

    // Popover menus authored in Liquid ([data-os-menu], e.g. the system menu): a choice closes the
    // menu, opening focuses the first item, and the arrow keys move like this element's own menu.
    document.addEventListener('click', (event) => {
      const item = event.target.closest?.('[data-os-menu] .os-menu-item');
      if (item) queueMicrotask(() => item.closest('[popover]')?.hidePopover());
    }, { signal });
    for (const trigger of document.querySelectorAll('.os-system-trigger')) {
      trigger.addEventListener('click', () => {
        const menu = document.getElementById(trigger.getAttribute('popovertarget'));
        if (!menu) return;
        const rect = trigger.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 348))}px`;
        menu.style.top = `${rect.bottom + 4}px`;
      }, { signal });
    }
    for (const menu of document.querySelectorAll('[data-os-menu]')) {
      menu.addEventListener('toggle', (event) => {
        if (event.newState === 'open') menu.querySelector('.os-menu-item')?.focus({ preventScroll: true });
      }, { signal });
      menu.addEventListener('keydown', (event) => this.#onKeydown(event, menu), { signal });
    }

    if (window.Shopify?.designMode) return;
    try {
      this.#labels = JSON.parse(this.querySelector('script[data-labels]')?.textContent || '{}');
    } catch {
      this.#labels = {};
    }

    this.#menu = document.createElement('div');
    this.#menu.className = 'os-menu';
    this.#menu.setAttribute('role', 'menu');
    this.#menu.setAttribute('aria-label', this.#labels.label || '');
    this.#menu.popover = 'manual';
    this.append(this.#menu);

    document.addEventListener('contextmenu', (event) => this.#onContextMenu(event), { signal });
    document.addEventListener('pointerdown', (event) => {
      if (this.#isOpen && !this.#menu.contains(event.target)) this.close(false);
    }, { capture: true, signal });
    window.addEventListener('blur', () => this.close(false), { signal });
    window.addEventListener('resize', () => this.close(false), { signal });
    document.addEventListener('scroll', () => this.close(false), { capture: true, passive: true, signal });
    this.#menu.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  get #isOpen() {
    return this.#menu?.matches(':popover-open');
  }

  #onContextMenu(event) {
    if (!DESKTOP.matches || !FINE.matches || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(NATIVE) || target.closest('dialog[open]')) return;
    if (String(window.getSelection?.() || '').trim()) return;

    const items = this.#itemsFor(target);
    if (!items.length) return;
    event.preventDefault();
    this.#returnFocus = document.activeElement;

    // A keyboard-invoked menu (Menu key, Shift+F10) has no pointer position: open it at the element.
    let { clientX: x, clientY: y } = event;
    if (!x && !y) {
      const rect = target.getBoundingClientRect();
      x = rect.left + 8;
      y = rect.bottom;
    }
    this.#render(items);
    this.#open(x, y);
  }

  #itemsFor(target) {
    const L = this.#labels;
    const items = [];
    const ql = target.closest('[data-quick-look]');
    const icon = target.closest('.os-icon');
    const link = target.closest('a[href]') || ql?.querySelector('a[href]');
    const win = target.closest('s-window');
    const bar = target.closest('[data-window-bar], .panel-header');
    const floating = win && bar?.closest('s-window') === win && !win.isStatic && !win.isDialog;

    if (icon?.dataset.window) {
      items.push({ label: L.open, run: () => document.getElementById(icon.dataset.window)?.open?.(icon) });
    } else if (link) {
      const href = link.href;
      items.push({ label: L.open, run: () => link.click() });
      items.push({ label: L.open_new_tab, run: () => window.open(href, '_blank', 'noopener') });
      items.push({ label: L.copy_link, run: () => this.#copy(href) });
    }
    if (ql) {
      const url = ql.dataset.quickLook;
      items.push({ separator: true });
      items.push({ label: L.quick_look, key: 'Space', run: () => this.#quickLook(url, 'preview') });
      items.push({ label: L.get_info, key: '⌥I', run: () => this.#quickLook(url, 'info') });
    }
    if (floating && !link) {
      items.push({ label: L.minimize, key: '⌥M', run: () => win.minimize() });
      items.push({ label: L.zoom, run: () => win.toggleZoom() });
      items.push({ label: L.close, key: '⌥W', run: () => win.close() });
    }
    if (items.length) return items;

    // The empty desktop (or the page background outside any window): the Finder desktop menu.
    if (win || target.closest('a, button, img, picture, svg, label, summary, [role="option"]')) return items;
    const terminal = document.getElementById('win-terminal');
    if (terminal?.open) items.push({ label: L.new_terminal, run: () => terminal.open() });
    items.push({ label: L.mission_control, key: '⌥↑', run: () => document.dispatchEvent(new CustomEvent('os:mission-control')) });
    if (document.querySelector('s-desktop')) {
      items.push({ label: L.clean_up, run: () => document.dispatchEvent(new CustomEvent('os:desktop-cleanup')) });
    }
    items.push({ separator: true });
    const search = document.getElementById('predictive-search');
    if (search) items.push({ label: L.spotlight, key: '⌘K', run: () => search.showModal() });
    const about = document.getElementById('about-site');
    if (about) items.push({ label: L.about, run: () => about.showModal() });
    const saver = document.getElementById('os-screensaver');
    if (saver?.start) items.push({ label: L.screensaver, run: () => saver.start() });
    return items;
  }

  #render(items) {
    const nodes = [];
    items.forEach((item, index) => {
      if (item.separator) {
        if (index > 0 && index < items.length - 1) {
          const rule = document.createElement('div');
          rule.className = 'os-menu-sep';
          rule.setAttribute('role', 'separator');
          nodes.push(rule);
        }
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'os-menu-item';
      button.setAttribute('role', 'menuitem');
      button.tabIndex = -1;
      const label = document.createElement('span');
      label.textContent = item.label || '';
      button.append(label);
      if (item.key) {
        const key = document.createElement('span');
        key.className = 'os-menu-key';
        key.setAttribute('aria-hidden', 'true');
        key.textContent = item.key;
        button.append(key);
      }
      button.addEventListener('click', () => {
        this.close(false);
        item.run();
      });
      nodes.push(button);
    });
    this.#menu.replaceChildren(...nodes);
  }

  #open(x, y) {
    const menu = this.#menu;
    menu.style.left = '0px';
    menu.style.top = '0px';
    if (!this.#isOpen) menu.showPopover();
    const { width, height } = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - width - 8);
    const top = y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y;
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
    menu.querySelector('.os-menu-item')?.focus({ preventScroll: true });
  }

  close(restoreFocus = true) {
    if (!this.#isOpen) return;
    this.#menu.hidePopover();
    if (restoreFocus && this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    this.#returnFocus = null;
  }

  #onKeydown(event, menu = this.#menu) {
    const items = [...menu.querySelectorAll('.os-menu-item')];
    const index = items.indexOf(document.activeElement);
    const moves = {
      ArrowDown: () => items[(index + 1) % items.length],
      ArrowUp: () => items[(index - 1 + items.length) % items.length],
      Home: () => items[0],
      End: () => items[items.length - 1],
    };
    if (moves[event.key]) {
      event.preventDefault();
      moves[event.key]()?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      if (menu === this.#menu) this.close();
      else menu.hidePopover();
    }
  }

  #quickLook(url, mode) {
    document.dispatchEvent(new CustomEvent('os:quick-look', { detail: { url, mode } }));
  }

  async #copy(href) {
    try {
      await navigator.clipboard.writeText(new URL(href, location.href).href);
      document.dispatchEvent(new CustomEvent('s-notification:add', {
        detail: { message: this.#labels.link_copied, variant: 'success', duration: 2500 },
      }));
    } catch {
      // Clipboard blocked: nothing to announce.
    }
  }
}

customElements.define('s-context-menu', SContextMenu);

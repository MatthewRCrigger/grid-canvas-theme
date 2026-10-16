/**
 * <s-desktop> — the GRID OS desktop surface on the home page.
 *
 * Desktop icons (.os-icon) behave like a computer: with a mouse the first click selects an icon
 * and a second click opens it; keyboard and touch open on the first activation. Icons with
 * data-window open the desktop window with that id; link icons fall through to
 * s-window-manager, which opens the page as a window. Clicking the empty desktop clears the
 * selection. In the theme editor, selecting a block inside a closed window opens that window.
 */
class SDesktop extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;

    this.addEventListener('click', (event) => this.#onClick(event), { signal });
    this.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:block:select', (event) => {
        const win = event.target.closest?.('s-window');
        if (win && this.contains(win) && win.dataset.state !== 'open') win.open?.();
      }, { signal });
    }
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #onClick(event) {
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
}

customElements.define('s-desktop', SDesktop);

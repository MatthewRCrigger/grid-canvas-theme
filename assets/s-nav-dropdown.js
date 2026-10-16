/**
 * <s-nav-dropdown> — header navigation dropdown for a nav item that has a submenu.
 *
 * Each nav item that has children renders a plain link next to a separate toggle
 * button (`[data-nav-disclosure]`). The link goes to the item's page; the button
 * shows/hides the submenu. Keeping them separate means a keyboard or screen-reader
 * user who wants to open the submenu presses the button instead of accidentally
 * following the link.
 *
 * Required child markup:
 *   button[data-nav-disclosure] — the toggle button. Its `aria-controls` holds the
 *                                 `id` of the submenu it shows/hides; this component
 *                                 keeps its `aria-expanded` in sync with open state.
 *   .nav-dropdown               — top-level dropdown panel; `id` matches the top-level
 *                                 button's `aria-controls`.
 *   .nav-dropdown-submenu       — nested submenu panel; `id` matches its group's button
 *                                 `aria-controls`.
 *
 * How a submenu opens:
 *   - Mouse: hovering the item shows the submenu (handled entirely in CSS via `:hover`).
 *     This component only copies that hover state into `aria-expanded`.
 *   - Keyboard / click: pressing the toggle button sets `data-open` on the item's
 *     container, which the stylesheet uses to show the submenu.
 *   Moving keyboard focus onto an item never opens its submenu on its own — the button
 *   must be pressed. Escape closes the innermost open submenu and moves focus back to
 *   its button. Moving focus out of the component closes any submenus opened by button.
 */
class SNavDropdown extends HTMLElement {
  #ac;
  /** @type {Array<{ button: HTMLElement, container: HTMLElement, hovered: boolean, open: boolean }>} */
  #disclosures = [];

  connectedCallback() {
    // Reset instance collections to support reconnect (DOM move)
    this.#disclosures = [];
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    for (const button of this.querySelectorAll('[data-nav-disclosure]')) {
      if (!(button instanceof HTMLElement)) continue;
      const panelId = button.getAttribute('aria-controls');
      const panel = panelId ? this.querySelector(`[id="${panelId}"]`) : null;
      if (!panel) continue;

      // Nested disclosures live in a `.nav-dropdown-group`; the level-1 disclosure
      // toggles the whole component, so its container is the element itself.
      const container = button.closest('.nav-dropdown-group') ?? this;
      const disclosure = { button, container, hovered: false, open: false };
      this.#disclosures.push(disclosure);

      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => this.#toggle(disclosure), opts);
      container.addEventListener('mouseenter', () => this.#setHovered(disclosure, true), opts);
      container.addEventListener('mouseleave', () => this.#setHovered(disclosure, false), opts);
    }

    this.addEventListener('keydown', this.#onKeyDown, opts);
    this.addEventListener('focusout', this.#onFocusOut, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #toggle(disclosure) {
    disclosure.open = !disclosure.open;
    this.#sync(disclosure);
  }

  #setHovered(disclosure, hovered) {
    disclosure.hovered = hovered;
    this.#sync(disclosure);
    // Clear hover suppression when the pointer leaves.
    if (!hovered) {
      disclosure.container.removeAttribute('data-suppress-hover');
    }
  }

  /**
   * Reflect the current state onto the DOM. `aria-expanded` tracks whether the panel
   * is visible (hover or explicit open); `data-open` drives the keyboard/click reveal
   * that CSS honors alongside `:hover`.
   */
  #sync(disclosure) {
    disclosure.button.setAttribute('aria-expanded', disclosure.open || disclosure.hovered ? 'true' : 'false');
    disclosure.container.toggleAttribute('data-open', disclosure.open);
  }

  /**
   * Escape closes the innermost open panel and returns focus to its button.
   * If no panels are button-opened but some are hover-revealed, suppress the
   * hovered panel instead so pointer users can dismiss without moving the mouse.
   * @param {KeyboardEvent} event
   */
  #onKeyDown = (event) => {
    if (event.key !== 'Escape') return;

    const open = this.#disclosures.filter((disclosure) => disclosure.open);
    if (open.length > 0) {
      // Prefer the open panel that currently holds focus, then pick the innermost.
      const focused = open.filter((disclosure) => disclosure.container.contains(document.activeElement));
      const candidates = focused.length > 0 ? focused : open;
      const target = candidates.reduce((innermost, disclosure) =>
        innermost.container.contains(disclosure.container) ? disclosure : innermost
      );

      target.open = false;
      this.#sync(target);
      target.button.focus();
      event.stopPropagation();
      return;
    }

    // No button-opened panels; check for hover-revealed panels.
    const hovered = this.#disclosures.filter((disclosure) => disclosure.hovered);
    if (hovered.length === 0) return;

    // Prefer the hovered panel that currently holds focus, then pick the innermost.
    const focused = hovered.filter((disclosure) => disclosure.container.contains(document.activeElement));
    const candidates = focused.length > 0 ? focused : hovered;
    const target = candidates.reduce((innermost, disclosure) =>
      innermost.container.contains(disclosure.container) ? disclosure : innermost
    );

    // Suppress the hover reveal; it will be restored on mouseleave.
    target.container.setAttribute('data-suppress-hover', '');
    target.button.focus();
    event.stopPropagation();
  };

  /**
   * Close any button-opened panels once focus leaves the component entirely.
   * @param {FocusEvent} event
   */
  #onFocusOut = (event) => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    for (const disclosure of this.#disclosures) {
      if (!disclosure.open) continue;
      disclosure.open = false;
      this.#sync(disclosure);
    }
  };
}

customElements.define('s-nav-dropdown', SNavDropdown);

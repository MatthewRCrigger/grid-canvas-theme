/**
 * <s-finder-view> — Finder-style view switch (icon view / list view) for product folders.
 *
 * Buttons inside command this element: commandfor="<id>" command="--icons" | "--list".
 * The choice is written to <html data-finder-view>, so it survives partial re-renders of the
 * product grid (filters, sorting, pagination) and is remembered between visits.
 */
const KEY = 'grid:finder-view';
const VIEWS = ['icons', 'list'];

const read = () => {
  try {
    const value = localStorage.getItem(KEY);
    return VIEWS.includes(value) ? value : 'icons';
  } catch {
    return 'icons';
  }
};

class SFinderView extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    this.#apply(read(), false);
    this.addEventListener('command', (event) => {
      const view = event.command?.replace(/^--/, '');
      if (VIEWS.includes(view)) this.#apply(view, true);
    }, { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #apply(view, store) {
    document.documentElement.dataset.finderView = view;
    for (const button of this.querySelectorAll('[command]')) {
      button.setAttribute('aria-pressed', String(button.getAttribute('command') === `--${view}`));
    }
    if (!store) return;
    try {
      localStorage.setItem(KEY, view);
    } catch {
      /* Private mode: the view still switches for this page. */
    }
  }
}

customElements.define('s-finder-view', SFinderView);

/**
 * <s-compare> — the GRID compare window. Wraps the #compare-window <dialog> body.
 *
 * Commands (CommandEvent on the dialog, from buttons with commandfor="compare-window"):
 *   --compare-toggle  source carries data-compare (JSON: handle, title, url, image, price,
 *                     type, vendor, status). Adds or removes the product (max 3).
 *   --compare-remove  source carries data-handle.
 *   --compare-clear   empties the list.
 *
 * Renders a side-by-side spec sheet into [data-compare-body]; rows whose values differ
 * are flagged cyan. Row labels and the empty message come from data-* attributes so all
 * copy stays translated in Liquid. Broadcasts `grid:compare-change` on document with
 * { handles } so toggles and counters stay in sync. Storage: localStorage grid:compare.
 */
const KEY = 'grid:compare';
const MAX = 3;
const ROWS = ['price', 'type', 'vendor', 'status'];

export function readCompare() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item && item.handle) : [];
  } catch {
    return [];
  }
}

class SCompare extends HTMLElement {
  #ac = null;

  connectedCallback() {
    const dialog = this.closest('dialog');
    if (!dialog) return;
    this.#ac = new AbortController();

    dialog.addEventListener('command', (event) => {
      const source = event.source;
      if (!(source instanceof HTMLElement)) return;

      if (event.command === '--compare-toggle') {
        event.preventDefault();
        this.#toggle(source.dataset.compare);
      } else if (event.command === '--compare-remove') {
        event.preventDefault();
        this.#save(readCompare().filter((item) => item.handle !== source.dataset.handle));
      } else if (event.command === '--compare-clear') {
        event.preventDefault();
        this.#save([]);
      }
    }, { signal: this.#ac.signal });

    this.#render();
    this.#broadcast();
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #toggle(json) {
    let product;
    try {
      product = JSON.parse(json || '{}');
    } catch {
      return;
    }
    if (!product.handle) return;

    const list = readCompare();
    const exists = list.some((item) => item.handle === product.handle);
    const next = exists ? list.filter((item) => item.handle !== product.handle) : [...list, product].slice(-MAX);
    this.#save(next);
  }

  #save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // Blocked storage: compare still works for this page view.
    }
    this.#render(list);
    this.#broadcast(list);
  }

  #broadcast(list = readCompare()) {
    document.dispatchEvent(new CustomEvent('grid:compare-change', { detail: { handles: list.map((item) => item.handle) } }));
  }

  #render(list = readCompare()) {
    const body = this.querySelector('[data-compare-body]');
    if (!body) return;
    body.replaceChildren();

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'type-body p-6 text-ink-200';
      empty.textContent = this.dataset.empty || '';
      body.append(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'w-full table-fixed border-collapse text-start';

    const head = document.createElement('tr');
    head.append(this.#cell('th', '', 'w-28 border-b border-line-400 p-3'));
    for (const item of list) {
      const th = this.#cell('th', '', 'border-b border-s border-line-400 p-3 align-top');
      const wrap = document.createElement('div');
      wrap.className = 'flex flex-col gap-2';
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        img.className = 'aspect-square w-full border border-line-400 bg-surface object-cover';
        wrap.append(img);
      }
      const link = document.createElement('a');
      link.href = item.url;
      link.className = 'type-heading-sm text-on-surface no-underline hover:text-accent';
      link.textContent = item.title;
      wrap.append(link);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'compare-toggle self-start';
      remove.setAttribute('aria-pressed', 'true');
      remove.setAttribute('commandfor', this.closest('dialog').id);
      remove.setAttribute('command', '--compare-remove');
      remove.dataset.handle = item.handle;
      remove.textContent = this.dataset.removeLabel || '';
      wrap.append(remove);
      th.append(wrap);
      head.append(th);
    }
    table.append(head);

    for (const row of ROWS) {
      const values = list.map((item) => String(item[row] ?? ''));
      const differs = new Set(values).size > 1;
      const tr = document.createElement('tr');
      tr.append(this.#cell('th', this.dataset[`label${row[0].toUpperCase()}${row.slice(1)}`] || row, 'type-overline border-b border-line-400 p-3 text-ink-300'));
      for (const value of values) {
        tr.append(this.#cell('td', value || '—', `type-data border-b border-s border-line-400 p-3 text-[12px] ${differs ? 'text-info' : 'text-on-surface'}`));
      }
      table.append(tr);
    }

    body.append(table);
  }

  #cell(tag, text, className) {
    const cell = document.createElement(tag);
    cell.className = className;
    if (tag === 'th') cell.scope = text ? 'row' : 'col';
    cell.textContent = text;
    return cell;
  }
}

customElements.define('s-compare', SCompare);

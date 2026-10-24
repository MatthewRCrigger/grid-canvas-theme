/**
 * <s-terminal> — Terminal.app for GRID OS: a tiny shell over the store.
 *
 * The store is mounted as a filesystem that mirrors real Shopify routes:
 *   ~/collections/<handle>   ~/products/<handle>   ~/pages/<handle>
 *   ~/blogs/<blog>/<article> ~/policies/<handle>   ~/menu/<link>/…   ~/cart  ~/search  ~/account
 * `ls [PATH]` lists a directory, `cd PATH` moves there and opens that path's page (collections,
 * a collection, a product…) as a GRID OS window; `cd menu` summons the main menu drawer and
 * `cd cart` the cart drawer, and `cd search/WORDS` runs a search. Paths can be absolute (/collections/all), relative, `..`, `~`, or a
 * number from the last listing. Other commands: help, pwd, open, look, search, cart, cat, whoami,
 * date, history, clear, exit. Tab completes commands and paths; ↑/↓ walk the session history.
 *
 * Data and translated strings come from the JSON <script data-terminal-data> child, written by
 * Liquid: { products, collections, pages, blogs, policies, menu, routes, about, user, searchUrl, i18n }.
 */
const HISTORY_KEY = 'grid-os:terminal-history';
const COMMANDS = ['help', 'ls', 'cd', 'pwd', 'open', 'look', 'search', 'cart', 'cat', 'whoami', 'date', 'history', 'clear', 'exit'];
const PATH_COMMANDS = new Set(['ls', 'cd', 'open', 'look']);

/** @typedef {{ name: string, title?: string, url?: string|null, meta?: string, quick?: string, action?: string, children?: Map<string, TermNode>|null, parent?: TermNode|null }} TermNode */

class STerminal extends HTMLElement {
  #ac = null;
  #data = {};
  #history = [];
  #cursor = 0;
  #last = [];
  #output = null;
  #input = null;
  #label = null;
  /** @type {TermNode} */
  #root = null;
  /** @type {TermNode} */
  #cwd = null;

  connectedCallback() {
    this.#ac = new AbortController();
    const { signal } = this.#ac;
    try {
      this.#data = JSON.parse(this.querySelector('script[data-terminal-data]')?.textContent || '{}');
    } catch {
      this.#data = {};
    }
    try {
      this.#history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      this.#history = [];
    }
    this.#cursor = this.#history.length;
    this.#output = this.querySelector('[data-terminal-output]');
    this.#input = this.querySelector('[data-terminal-input]');
    this.#label = this.querySelector('.os-term-form .os-term-prompt');
    if (!this.#output || !this.#input) return;

    this.#root = this.#buildTree();
    this.#cwd = this.#root;
    this.#updatePrompt();

    if (!this.#output.childElementCount) this.#print(this.#t('greeting'), 'muted');

    this.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#run(this.#input.value);
      this.#input.value = '';
    }, { signal });
    this.#input.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });
    // Clicking anywhere in the screen puts the caret back in the prompt, like a real terminal.
    this.addEventListener('click', (event) => {
      if (!event.target.closest('a, button') && !String(window.getSelection?.() || '')) this.#input.focus({ preventScroll: true });
    }, { signal });
    this.closest('s-window')?.addEventListener('os:open', () => this.#input.focus({ preventScroll: true }), { signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #t(key, value = '') {
    return String(this.#data.i18n?.[key] ?? key).replace('%1', value);
  }

  /* ---------- filesystem ---------- */

  #dir(name, opts = {}) {
    return { name, children: new Map(), ...opts };
  }

  #add(parent, node) {
    if (!node?.name || parent.children.has(node.name)) return node;
    node.parent = parent;
    parent.children.set(node.name, node);
    return node;
  }

  #slug(value) {
    return String(value || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  }

  #buildTree() {
    const d = this.#data;
    const r = d.routes || {};
    const root = this.#dir('', { url: r.root || '/' });
    root.parent = null;

    const collections = this.#add(root, this.#dir('collections', { url: r.collections || null }));
    const list = d.collections || [];
    if (r.all && !list.some((c) => c.h === 'all')) this.#add(collections, { name: 'all', title: 'all', url: r.all });
    list.forEach((c) => this.#add(collections, { name: c.h, title: c.t, url: c.u, meta: c.n }));

    const products = this.#add(root, this.#dir('products', { url: r.all || null }));
    (d.products || []).forEach((p) => this.#add(products, { name: p.h, title: p.t, url: p.u, meta: p.p, quick: p.u }));

    const pages = this.#add(root, this.#dir('pages'));
    (d.pages || []).forEach((p) => this.#add(pages, { name: p.h, title: p.t, url: p.u }));

    const blogs = this.#add(root, this.#dir('blogs'));
    (d.blogs || []).forEach((b) => {
      const blog = this.#add(blogs, this.#dir(b.h, { title: b.t, url: b.u }));
      (b.a || []).forEach((a) => this.#add(blog, { name: a.h, title: a.t, url: a.u, meta: a.d }));
    });

    const policies = this.#add(root, this.#dir('policies'));
    (d.policies || []).forEach((p) => this.#add(policies, { name: p.h, title: p.t, url: p.u }));

    const menu = this.#add(root, this.#dir('menu', { action: 'menu' }));
    const addLinks = (parent, links) => (links || []).forEach((l) => {
      const name = l.h || this.#slug(l.t);
      const node = l.c?.length ? this.#dir(name, { title: l.t, url: l.u }) : { name, title: l.t, url: l.u };
      this.#add(parent, node);
      if (l.c?.length) addLinks(node, l.c);
    });
    addLinks(menu, d.menu);

    this.#add(root, { name: 'cart', title: 'cart', action: 'cart' });
    this.#add(root, { name: 'search', title: 'search', url: r.search || d.searchUrl || null });
    if (r.account) this.#add(root, { name: 'account', title: 'account', url: r.account });
    return root;
  }

  #pathOf(node) {
    const parts = [];
    for (let n = node; n && n.parent; n = n.parent) parts.unshift(n.name);
    return parts.length ? `~/${parts.join('/')}` : '~';
  }

  /** Resolve a path (absolute, relative, ~, .., or a number from the last listing) to a node. */
  #resolve(raw) {
    const arg = String(raw || '').trim();
    const n = Number.parseInt(arg, 10);
    if (String(n) === arg && this.#last[n - 1]) return this.#last[n - 1];
    let node = this.#cwd;
    let path = arg;
    if (!path || path === '~') return this.#root;
    if (path.startsWith('~/') || path.startsWith('/')) {
      node = this.#root;
      path = path.replace(/^~?\/+/, '');
    }
    for (const part of path.split('/').filter(Boolean)) {
      if (part === '.') continue;
      if (part === '..') {
        node = node.parent || node;
        continue;
      }
      const key = part.toLowerCase();
      const next = node.children?.get(key)
        || [...(node.children?.values() || [])].find((c) => c.name.toLowerCase() === key || c.title?.toLowerCase() === key);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  #updatePrompt() {
    if (this.#label) this.#label.textContent = this.#prompt();
  }

  #prompt() {
    return `${this.#data.user || this.#t('guest')}@grid ${this.#pathOf(this.#cwd)} %`;
  }

  /* ---------- output ---------- */

  #print(text, tone = '') {
    const line = document.createElement('p');
    line.className = 'os-term-line';
    if (tone) line.dataset.tone = tone;
    line.textContent = text;
    this.#output.append(line);
    this.#output.scrollTop = this.#output.scrollHeight;
    return line;
  }

  #printRows(nodes) {
    if (!nodes.length) {
      this.#print(this.#t('empty'), 'muted');
      return;
    }
    this.#last = nodes;
    nodes.forEach((node, i) => {
      const line = this.#print('');
      const n = document.createElement('span');
      n.className = 'os-term-num';
      n.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.textContent = node.children ? `${node.name}/` : node.name;
      if (node.children) name.className = 'os-term-cmd';
      line.append(n, name);
      const meta = [node.title !== node.name ? node.title : '', node.meta].filter(Boolean).join('  ·  ');
      if (meta) {
        const m = document.createElement('span');
        m.className = 'os-term-meta';
        m.textContent = meta;
        line.append(m);
      }
    });
  }

  #run(raw) {
    const input = raw.trim();
    const echo = this.#print('');
    const prompt = document.createElement('span');
    prompt.className = 'os-term-prompt';
    prompt.textContent = this.#prompt();
    echo.append(prompt, document.createTextNode(` ${input}`));
    if (!input) return;

    this.#history = [...this.#history.filter((h) => h !== input), input].slice(-50);
    this.#cursor = this.#history.length;
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(this.#history));
    } catch {
      // Storage unavailable: history lasts for this page only.
    }

    const [command, ...rest] = input.split(/\s+/);
    const arg = rest.join(' ');
    const handlers = {
      help: () => this.#help(),
      ls: () => this.#ls(arg),
      cd: () => this.#cd(arg),
      pwd: () => this.#print(this.#pathOf(this.#cwd), 'info'),
      open: () => this.#open(arg),
      look: () => this.#look(arg),
      search: () => this.#search(arg),
      cart: () => this.#cart(),
      cat: () => this.#print(this.#data.about || this.#t('no_about')),
      whoami: () => this.#print(this.#data.user || this.#t('guest')),
      date: () => this.#print(new Date().toString()),
      history: () => this.#history.forEach((h, i) => this.#print(`${String(i + 1).padStart(3, ' ')}  ${h}`, 'muted')),
      clear: () => this.#output.replaceChildren(),
      exit: () => this.closest('s-window')?.close(),
      sudo: () => this.#print(this.#t('sudo'), 'alert'),
      echo: () => this.#print(arg),
    };
    const handler = handlers[command.toLowerCase()];
    if (handler) handler();
    else this.#print(this.#t('unknown', command), 'alert');
  }

  #help() {
    for (const name of COMMANDS) {
      const line = this.#print('');
      const cmd = document.createElement('span');
      cmd.className = 'os-term-cmd';
      cmd.textContent = name.padEnd(9, ' ');
      line.append(cmd, document.createTextNode(this.#t(`help_${name}`)));
    }
  }

  /* ---------- commands ---------- */

  #ls(arg) {
    const node = arg.trim() ? this.#resolve(arg) : this.#cwd;
    if (!node) {
      this.#print(this.#t('no_such', arg), 'alert');
      return;
    }
    if (!node.children) {
      this.#printRows([node]);
      return;
    }
    this.#printRows([...node.children.values()]);
  }

  #cd(arg) {
    // `cd search/WORDS` (or /search/WORDS) runs a store search, like visiting /search?q=WORDS.
    const query = this.#searchQuery(arg);
    if (query) {
      this.#search(query);
      return;
    }
    const node = this.#resolve(arg);
    if (!node) {
      this.#print(this.#t('no_such', arg), 'alert');
      return;
    }
    if (node.children) {
      this.#cwd = node;
      this.#updatePrompt();
    }
    // `cd` on its own (or `cd ~`) just goes home in the shell; it doesn't navigate the page.
    if (node === this.#root) return;
    this.#activate(node);
  }

  /** The words after `search/` when a path points inside the search route, else ''. */
  #searchQuery(arg) {
    const match = String(arg || '').trim().match(/^(~?\/)?search\/(.+)$/i);
    if (!match || (!match[1] && this.#cwd !== this.#root)) return '';
    return match[2].replace(/\/+$/, '').trim();
  }

  /** Do what a path means in the store: open its page, or summon the menu / cart drawer. */
  #activate(node) {
    if (node.action === 'menu') {
      const drawer = document.getElementById('mobile-nav-drawer');
      if (drawer?.showModal && !drawer.open) {
        this.#print(this.#t('opening', this.#t('main_menu')), 'ok');
        drawer.showModal();
      }
      return;
    }
    if (node.action === 'cart') {
      this.#cart();
      return;
    }
    if (!node.url) return;
    this.#print(this.#t('opening', node.url), 'ok');
    this.#follow(node.url);
  }

  /** A path, a number from the last listing, else the best title match across every file. */
  #find(arg, quickOnly = false) {
    const query = arg.trim().toLowerCase();
    if (!query) return null;
    const direct = this.#resolve(arg);
    if (direct && direct !== this.#root && (!quickOnly || direct.quick)) return direct;
    const pool = [];
    const walk = (node) => node.children?.forEach((child) => {
      if (!quickOnly || child.quick) pool.push(child);
      walk(child);
    });
    walk(this.#root);
    const label = (item) => (item.title || item.name).toLowerCase();
    return pool.find((item) => label(item) === query || item.name === query)
      || pool.find((item) => label(item).startsWith(query) || item.name.startsWith(query))
      || pool.find((item) => label(item).includes(query))
      || null;
  }

  #follow(url) {
    const link = document.createElement('a');
    link.href = url;
    link.hidden = true;
    this.append(link);
    link.click();
    link.remove();
  }

  #open(arg) {
    if (!arg) {
      this.#print(this.#t('usage_open'), 'muted');
      return;
    }
    const query = this.#searchQuery(arg);
    if (query) {
      this.#search(query);
      return;
    }
    const item = this.#find(arg);
    if (!item) {
      this.#print(this.#t('not_found', arg), 'alert');
      return;
    }
    this.#activate(item);
  }

  #look(arg) {
    if (!arg) {
      this.#print(this.#t('usage_look'), 'muted');
      return;
    }
    const item = this.#find(arg, true);
    if (!item?.quick) {
      this.#print(this.#t('not_found', arg), 'alert');
      return;
    }
    document.dispatchEvent(new CustomEvent('os:quick-look', { detail: { url: item.quick, mode: 'preview' } }));
  }

  #search(arg) {
    if (!arg) {
      this.#print(this.#t('usage_search'), 'muted');
      return;
    }
    const url = new URL(this.#data.searchUrl || this.#data.routes?.search || '/search', location.href);
    url.searchParams.set('q', arg);
    this.#print(this.#t('opening', arg), 'ok');
    this.#follow(url.pathname + url.search);
  }

  #cart() {
    const count = document.getElementById('header-cart-trigger')?.dataset.cartCount || '0';
    this.#print(this.#t('cart_items', count), 'info');
    document.getElementById('cart-drawer')?.showModal?.();
  }

  #onKeydown(event) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.#cursor = Math.min(this.#history.length, Math.max(0, this.#cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      this.#input.value = this.#history[this.#cursor] || '';
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.#complete();
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      this.#output.replaceChildren();
    }
  }

  #complete() {
    const value = this.#input.value;
    const parts = value.split(/\s+/);
    if (parts.length <= 1) {
      const match = COMMANDS.filter((c) => c.startsWith(parts[0].toLowerCase()));
      if (match.length === 1) this.#input.value = `${match[0]} `;
      else if (match.length) this.#print(match.join('   '), 'muted');
      return;
    }
    const [command, ...rest] = parts;
    if (!PATH_COMMANDS.has(command.toLowerCase())) return;
    // Complete the last path segment against the directory the rest of the path points at.
    const typed = rest.join(' ');
    const slash = typed.lastIndexOf('/');
    const base = slash >= 0 ? typed.slice(0, slash + 1) : '';
    const partial = typed.slice(slash + 1).toLowerCase();
    const dir = base ? this.#resolve(base) : this.#cwd;
    if (!dir?.children) return;
    const match = [...dir.children.values()].filter((c) => c.name.toLowerCase().startsWith(partial));
    if (match.length === 1) {
      const node = match[0];
      this.#input.value = `${command} ${base}${node.name}${node.children ? '/' : ''}`;
    } else if (match.length) {
      const names = match.map((m) => m.name);
      let prefix = names[0];
      for (const name of names) while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
      if (prefix.length > partial.length) this.#input.value = `${command} ${base}${prefix}`;
      else this.#print(names.slice(0, 24).map((name, i) => (match[i].children ? `${name}/` : name)).join('   '), 'muted');
    }
  }
}

customElements.define('s-terminal', STerminal);

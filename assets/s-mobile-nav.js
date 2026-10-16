/**
 * <s-mobile-nav> — Stacked panel navigation inside a modal dialog.
 * Shows one panel at a time, pushes child panels onto a stack, pops back via
 * --pop, and syncs the dialog's contextual title + back button with the active panel.
 *
 * Commands (dispatched via commandfor/command on descendant buttons):
 *   --pop — Pop the current panel off the stack and restore the previous one.
 *
 * Required ancestor markup:
 *   <dialog> — Must be a <dialog> ancestor (closest('dialog')); otherwise the header
 *              title/back button lookups silently no-op. The dialog's 'close' event
 *              triggers a reset to the root panel.
 *
 * Required DOM inside the dialog (queried via dialog.querySelector):
 *   #mobile-nav-title  — Text node hidden at the root and showing a nested panel's title.
 *                       Its initial text labels the dialog through aria-labelledby.
 *   #mobile-nav-back   — Back button; display toggled based on stack depth.
 *
 * Required child markup inside <s-mobile-nav>:
 *   [id$="-root"]                    — The root panel (required for stack init).
 *   [id^="mobile-nav-panel-"]        — Nested panels (targets of push/pop navigation).
 *   [data-mobile-nav-push]           — Button that pushes a panel. Value = target panel id.
 *                                      aria-expanded is toggled here to expose open/closed state.
 *   [data-panel-title]               — Optional title shown in the dialog header while active.
 *   <details> / <summary> / <ul>     — Optional disclosures with animated height transitions.
 *
 * Direction:
 *   Panels park with paired transform utilities that mirror in RTL.
 *   The entrance animation reads the resolved direction once so
 *   a pushed panel always slides in from the reading-forward side.
 *
 * External coupling:
 *   None — panel hidden state is driven by this component only.
 */
class SMobileNav extends HTMLElement {
  #stack = [];
  #titleEl;
  #backBtn;
  #defaultTitle;
  #ac;
  #rafIds = new Set();
  #animatingContent = new Set();
  // 1 in LTR, -1 in RTL; multiplies the inline-axis entrance offset.
  #inlineDirection = 1;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };
    this.#inlineDirection = getComputedStyle(this).direction === 'rtl' ? -1 : 1;

    const dialog = this.closest('dialog');
    this.#titleEl = dialog?.querySelector('#mobile-nav-title');
    this.#backBtn = dialog?.querySelector('#mobile-nav-back');
    this.#defaultTitle = this.#titleEl?.textContent ?? '';

    const rootPanel = this.querySelector('[id$="-root"]');
    this.#stack = [{ panelId: rootPanel?.id, title: '' }];

    // Only one panel is rendered at a time so stale off-screen transforms cannot overlap.
    for (const panel of this.#panels()) {
      panel.id === rootPanel?.id ? this.#showPanel(panel) : this.#hidePanel(panel);
    }
    this.#updateHeader();

    this.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mobile-nav-push]');
      if (btn) this.#push(btn.dataset.mobileNavPush, btn.dataset.panelTitle || '', btn);
    }, opts);

    this.addEventListener('command', (e) => {
      if (e.command === '--pop') this.#pop();
    }, opts);

    for (const details of this.querySelectorAll('details')) {
      this.#animateDetails(details, opts);
    }

    dialog?.addEventListener('close', () => this.#reset(), opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    for (const id of this.#rafIds) cancelAnimationFrame(id);
    this.#rafIds.clear();
    for (const content of this.#animatingContent) {
      content.style.height = '';
      content.classList.remove('transition-[height]', 'duration-180', 'duration-250', 'ease-ui');
    }
    this.#animatingContent.clear();
  }

  #updateHeader() {
    if (!this.#backBtn || !this.#titleEl) return;
    const atRoot = this.#stack.length <= 1;
    this.#backBtn.classList.toggle('hidden', atRoot);
    this.#backBtn.classList.toggle('flex', !atRoot);
    this.#titleEl.textContent = atRoot ? this.#defaultTitle : this.#stack.at(-1).title;
    this.#titleEl.classList.toggle('hidden', atRoot);
  }

  #focusFirst(panel) {
    panel.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
  }

  #panels() {
    return this.querySelectorAll('[id$="-root"], [id^="mobile-nav-panel-"]');
  }

  #showPanel(panel) {
    panel.hidden = false;
    panel.classList.remove('transform-[translateX(100%)]', 'rtl:transform-[translateX(-100%)]');
    panel.classList.add('transform-[translateX(0)]');
    panel.inert = false;
  }

  #hidePanel(panel) {
    panel.hidden = true;
    panel.classList.remove('transform-[translateX(0)]');
    panel.classList.add('transform-[translateX(100%)]', 'rtl:transform-[translateX(-100%)]');
    panel.inert = true;
  }

  #showOnly(panel) {
    for (const candidate of this.#panels()) {
      candidate === panel ? this.#showPanel(candidate) : this.#hidePanel(candidate);
    }
  }

  #animatePanelIn(panel, direction) {
    if (this.#prefersReducedMotion()) return;

    for (const animation of panel.getAnimations()) animation.cancel();
    panel.animate([
      { opacity: 0, transform: `translateX(${direction * this.#inlineDirection * 16}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], { duration: 220, easing: this.#uiEasing() });
  }

  #push(panelId, title, trigger) {
    const current = this.querySelector(`#${CSS.escape(this.#stack.at(-1).panelId)}`);
    const next = this.querySelector(`#${CSS.escape(panelId)}`);
    if (!current || !next || current === next) return;
    this.#showOnly(next); // must be before #focusFirst — hidden/inert blocks .focus()
    this.#animatePanelIn(next, 1);
    trigger?.setAttribute('aria-expanded', 'true');
    this.#stack.push({ panelId, title, trigger });
    this.#updateHeader();
    this.#focusFirst(next);
  }

  #pop() {
    if (this.#stack.length <= 1) return;
    const leaving = this.#stack.at(-1);
    leaving.trigger?.setAttribute('aria-expanded', 'false');
    const current = this.querySelector(`#${CSS.escape(leaving.panelId)}`);
    this.#stack.pop();
    const prev = this.querySelector(`#${CSS.escape(this.#stack.at(-1).panelId)}`);
    if (!current || !prev) return;
    this.#showOnly(prev); // must be before #focusFirst — hidden/inert blocks .focus()
    this.#animatePanelIn(prev, -1);
    this.#updateHeader();
    this.#focusFirst(prev);
  }

  #reset() {
    const rootId = this.#stack[0]?.panelId;
    for (const panel of this.#panels()) {
      panel.id === rootId ? this.#showPanel(panel) : this.#hidePanel(panel);
    }
    for (const btn of this.querySelectorAll('[data-mobile-nav-push]')) {
      btn.setAttribute('aria-expanded', 'false');
    }
    this.#stack = [{ panelId: rootId, title: '' }];
    this.#updateHeader();
  }

  #prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  #uiEasing() {
    return getComputedStyle(this).getPropertyValue('--ease-ui').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
  }

  #animateDetails(details, { signal }) {
    const summary = details.querySelector('summary');
    const content = details.querySelector('ul');
    if (!summary || !content) return;
    content.classList.add('overflow-hidden');

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        details.open ? details.removeAttribute('open') : details.setAttribute('open', '');
        return;
      }

      // One controller per animation: whichever of transitionend/transitioncancel
      // fires first removes both listeners, so stale handlers never target a
      // later animation's transition events.
      const animationAc = new AbortController();
      const cleanUp = () => {
        animationAc.abort();
        content.style.height = '';
        content.classList.remove('transition-[height]', 'duration-180', 'duration-250', 'ease-ui');
        this.#animatingContent.delete(content);
      };

      if (details.open) {
        // Closing: 0.18s
        content.style.height = `${content.scrollHeight}px`;
        this.#animatingContent.add(content);
        const outer = requestAnimationFrame(() => {
          this.#rafIds.delete(outer);
          const inner = requestAnimationFrame(() => {
            this.#rafIds.delete(inner);
            content.classList.remove('duration-250');
            content.classList.add('transition-[height]', 'duration-180', 'ease-ui');
            content.style.height = '0';
            content.addEventListener('transitionend', () => {
              details.removeAttribute('open');
              cleanUp();
            }, { once: true, signal: animationAc.signal });
            content.addEventListener('transitioncancel', () => {
              // If interrupted mid-close, restore to open state
              if (!details.open) details.setAttribute('open', '');
              cleanUp();
            }, { once: true, signal: animationAc.signal });
          });
          this.#rafIds.add(inner);
        });
        this.#rafIds.add(outer);
      } else {
        // Opening: 0.25s
        details.setAttribute('open', '');
        const h = content.scrollHeight;
        content.style.height = '0';
        this.#animatingContent.add(content);
        const outer = requestAnimationFrame(() => {
          this.#rafIds.delete(outer);
          const inner = requestAnimationFrame(() => {
            this.#rafIds.delete(inner);
            content.classList.remove('duration-180');
            content.classList.add('transition-[height]', 'duration-250', 'ease-ui');
            content.style.height = `${h}px`;
            content.addEventListener('transitionend', () => {
              cleanUp();
            }, { once: true, signal: animationAc.signal });
            content.addEventListener('transitioncancel', () => {
              // If interrupted mid-open, close the details
              if (details.open) details.removeAttribute('open');
              cleanUp();
            }, { once: true, signal: animationAc.signal });
          });
          this.#rafIds.add(inner);
        });
        this.#rafIds.add(outer);
      }
    }, { signal });
  }
}

customElements.define('s-mobile-nav', SMobileNav);

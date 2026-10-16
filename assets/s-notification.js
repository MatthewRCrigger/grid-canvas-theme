/**
 * <s-notification> — Notification/Toast Web Component
 * Manages toast creation, stacking, auto-dismiss, and pause-on-hover.
 * Listen for `s-notification:add` events on `document` to create toasts.
 *
 * Accessibility:
 * - Each toast includes a visible close button with aria-label="Dismiss"
 * - Pressing Escape dismisses the most recent toast
 * - Each toast is its sole live-region owner: status for info/success/warning, alert for error
 * - Active-modal toasts use a nested popover portal so their controls are not inert
 * - Focus is not stolen from the user's current action
 */
class SNotification extends HTMLElement {
  #toasts = new Map();
  #modalStack = [];
  #isPaused = false;
  #ac;
  #dialogObserver;
  #portal;

  connectedCallback() {
    const pos = this.getAttribute('position') || 'bottom-right';
    this.dataset.position = pos;
    // The host is only a queue/positioning container; generated toasts own announcements.
    this.removeAttribute('role');
    this.removeAttribute('aria-live');

    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };
    this.#portal = document.createElement('div');
    this.#portal.className = 'contents';
    this.#portal.dataset.notificationPortal = '';
    this.appendChild(this.#portal);

    document.addEventListener('s-notification:add', (e) => {
      const { message, variant = 'info', duration } = e.detail || {};
      if (!message) return;
      this.#createToast(message, variant, duration);
    }, opts);

    document.addEventListener('s-cart:opened', (event) => {
      const dialog = event.target instanceof HTMLDialogElement
        ? event.target
        : document.getElementById(event.detail?.dialogId);
      this.#promoteModal(dialog);
      this.#placePortal(dialog);
    }, opts);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#toasts.size > 0) {
        const toasts = [...this.#toasts.keys()];
        this.#dismiss(toasts[toasts.length - 1]);
      }
    }, opts);

    for (const surface of [this, this.#portal]) {
      surface.addEventListener('mouseenter', () => this.#pauseAll(), opts);
      surface.addEventListener('mouseleave', (event) => {
        if (!this.#ownsNode(event.relatedTarget)) this.#resumeAll();
      }, opts);
      surface.addEventListener('focusin', () => this.#pauseAll(), opts);
      surface.addEventListener('focusout', (event) => {
        if (!this.#ownsNode(event.relatedTarget)) this.#resumeAll();
      }, opts);
    }

    this.#dialogObserver = new MutationObserver((records) => {
      for (const { target } of records) {
        if (!(target instanceof HTMLDialogElement)) continue;
        if (this.#isActiveModal(target)) {
          this.#promoteModal(target);
        } else {
          this.#modalStack = this.#modalStack.filter((dialog) => dialog !== target);
        }
      }
      this.#placePortal();
    });
    this.#dialogObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    });

    for (const dialog of document.querySelectorAll('dialog[open]')) this.#promoteModal(dialog);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#dialogObserver?.disconnect();
    this.#dialogObserver = null;
    for (const [toast, state] of this.#toasts) {
      clearTimeout(state.timeoutId);
      toast.remove();
    }
    this.#toasts.clear();
    this.#hidePortal();
    this.#portal?.remove();
    this.#portal = null;
    this.#modalStack = [];
    this.#isPaused = false;
  }

  get #defaultDuration() {
    return parseInt(this.getAttribute('duration'), 10) || 5000;
  }

  #createToast(message, variant, duration) {
    const requestedDuration = Number(duration ?? this.#defaultDuration);
    const dur = Number.isFinite(requestedDuration)
      ? Math.max(0, requestedDuration)
      : this.#defaultDuration;
    const variantClasses = {
      error: 'bg-critical text-interactive-text',
      info: 'bg-info text-interactive-text',
      success: 'bg-success text-interactive-text',
      warning: 'bg-warning text-warning-text',
    };
    const toast = document.createElement('div');
    // Keep transform (not individual translate) aligned with the WAAPI dismiss pose.
    toast.className = `pointer-events-auto flex items-start gap-2 px-4 py-3 rounded text-sm leading-normal shadow-lg opacity-100 [transform:translateY(0)] [transition:opacity_0.2s_var(--ease-ui),transform_0.25s_var(--ease-ui),display_0.25s_allow-discrete] cursor-pointer starting:opacity-0 starting:[transform:translateY(100%)] ${variantClasses[variant] || variantClasses.info}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');

    const text = document.createElement('span');
    text.className = 'flex-auto min-w-0';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'flex-none inline-flex items-center justify-center size-6 min-w-touch-target min-h-touch-target p-0 border-none rounded bg-transparent text-inherit text-sm leading-none cursor-pointer opacity-70 motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-ui hover:opacity-100 active:transform-[scale(0.90)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2';
    closeBtn.setAttribute('aria-label', this.dataset.dismissLabel || 'Dismiss');
    closeBtn.textContent = '\u2715'; // × (multiplication sign used as close icon)
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#dismiss(toast);
    }, { signal: this.#ac.signal });

    toast.append(text, closeBtn);
    toast.addEventListener('click', () => this.#dismiss(toast), { signal: this.#ac.signal });
    this.#portal?.appendChild(toast);

    const state = {
      persistent: dur === 0,
      remainingTime: dur,
      timeoutId: null,
      startTime: Date.now(),
    };
    if (!state.persistent && !this.#isPaused) {
      state.timeoutId = setTimeout(() => this.#dismiss(toast), dur);
    }
    this.#toasts.set(toast, state);
    this.#placePortal();
  }

  async #dismiss(toast) {
    const state = this.#toasts.get(toast);
    if (!state) return;
    clearTimeout(state.timeoutId);
    this.#toasts.delete(toast);

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        await toast.animate(
          [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }],
          { duration: 150, easing: this.#uiEasing() }
        ).finished;
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
    toast.remove();
    if (this.#toasts.size === 0) this.#placePortal();
  }

  #uiEasing() {
    return getComputedStyle(this).getPropertyValue('--ease-ui').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
  }

  #ownsNode(node) {
    return node instanceof Node && (this.contains(node) || this.#portal?.contains(node));
  }

  #isActiveModal(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return false;

    try {
      return dialog.matches(':modal');
    } catch {
      return true;
    }
  }

  #promoteModal(dialog) {
    if (!this.#isActiveModal(dialog)) return;
    this.#modalStack = this.#modalStack.filter((candidate) => candidate !== dialog);
    this.#modalStack.push(dialog);
  }

  #activeModal() {
    const focusedDialog = document.activeElement?.closest?.('dialog[open]');
    if (this.#isActiveModal(focusedDialog)) return focusedDialog;

    this.#modalStack = this.#modalStack.filter((dialog) => this.#isActiveModal(dialog));
    return this.#modalStack.at(-1) || null;
  }

  #hidePortal() {
    try {
      this.#portal?.hidePopover?.();
    } catch {
      // A portal that is not currently shown has nothing to hide.
    }
  }

  #isPortalOpen() {
    try {
      return this.#portal?.matches(':popover-open') || false;
    } catch {
      return false;
    }
  }

  #placePortal(preferredDialog = null) {
    if (!this.#portal) return;
    const dialog = this.#toasts.size > 0 && this.#isActiveModal(preferredDialog)
      ? preferredDialog
      : this.#toasts.size > 0 ? this.#activeModal() : null;

    if (!dialog && this.#portal.parentElement === this && !this.#portal.hasAttribute('popover')) {
      this.#portal.className = 'contents';
      return;
    }
    if (dialog && this.#portal.parentElement === dialog && this.#isPortalOpen()) {
      return;
    }

    this.#hidePortal();

    if (!dialog) {
      this.#portal.removeAttribute('popover');
      this.#portal.className = 'contents';
      if (this.#portal.parentElement !== this) this.appendChild(this.#portal);
      return;
    }

    this.#portal.setAttribute('popover', 'manual');
    this.#portal.className = this.className;
    if (this.#portal.parentElement !== dialog) dialog.appendChild(this.#portal);

    try {
      this.#portal.showPopover?.();
    } catch {
      // Without an open popover, nesting still keeps the portal operable inside the modal.
      this.#portal.removeAttribute('popover');
    }
  }

  #pauseAll() {
    if (this.#isPaused) return;
    this.#isPaused = true;
    for (const [, state] of this.#toasts) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
        state.timeoutId = null;
        state.remainingTime = Math.max(0, state.remainingTime - (Date.now() - state.startTime));
      }
    }
  }

  #resumeAll() {
    if (!this.#isPaused) return;
    this.#isPaused = false;
    for (const [toast, state] of this.#toasts) {
      if (state.persistent) continue;
      if (state.remainingTime <= 0) {
        this.#dismiss(toast);
      } else if (!state.timeoutId) {
        state.startTime = Date.now();
        state.timeoutId = setTimeout(() => this.#dismiss(toast), state.remainingTime);
      }
    }
  }
}

customElements.define('s-notification', SNotification);

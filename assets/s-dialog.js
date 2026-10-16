/**
 * <s-dialog> — Dialog Web Component
 * Handles backdrop-click-to-close for native <dialog> modals.
 * Open/close and password visibility are driven by Invoker Commands.
 *
 * Focus management (WCAG 2.4.3):
 *   Captures the native show-modal command source or the active element for a
 *   programmatic showModal(), then restores the original or same-ID replacement.
 *
 * Attributes:
 *   close-on-navigate — close the dialog when an <a> inside it is clicked
 *                       (useful with client-side navigation)
 *   open-on-connect   — open modally after connection (for server-returned feedback)
 *   reset-on-close    — reset forms, password visibility, and marked error state
 *
 * Commands:
 *   --toggle-password — toggle the password input named by event.source aria-controls
 */
class SDialog extends HTMLElement {
  #dialog;
  #ac;
  #triggerElement = null;
  #triggerElementId = null;
  #originalShowModal = null;
  #originalClose = null;
  #closeAnimations = null;

  connectedCallback() {
    this.#dialog = this.querySelector('dialog');
    if (!this.#dialog) return;

    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.#interceptShowModal();
    this.#interceptClose();

    // Native invoker `command="close"` and Escape bypass dialog.close(); route both through the animated exit.
    this.#dialog.addEventListener('command', (e) => {
      if (e.command === 'close' && this.#animatesExit()) {
        e.preventDefault();
        this.#dialog.close();
      }
    }, opts);
    this.#dialog.addEventListener('cancel', (e) => {
      if (this.#animatesExit()) {
        e.preventDefault();
        this.#dialog.close();
      }
    }, opts);

    // CommandEvent does not bubble, so capture its source on the controlled dialog.
    this.#dialog.addEventListener('command', (e) => {
      if (!(e.source instanceof HTMLElement)) return;

      if (e.command === 'show-modal') {
        if (this.#closeAnimations) this.#finishClose();
        this.#triggerElement = e.source;
        this.#triggerElementId = e.source.id || null;
        return;
      }

      if (e.command === '--toggle-password') {
        e.preventDefault();
        this.#togglePassword(e.source);
      }
    }, opts);

    this.#dialog.addEventListener('close', () => {
      if (this.hasAttribute('reset-on-close')) this.#resetContent();
      this.#restoreFocus();
    }, opts);

    this.#dialog.addEventListener('click', (e) => {
      if (e.target === this.#dialog) this.#dialog.close();
    }, opts);

    this.#setupBreakpointListener();

    if (this.hasAttribute('close-on-navigate')) {
      this.addEventListener('click', (e) => {
        if (e.target.closest('a')) this.#dialog.close();
      }, opts);
    }

    if (this.hasAttribute('open-on-connect') && !this.#dialog.open) {
      this.#dialog.showModal();
    }
  }

  disconnectedCallback() {
    this.#ac?.abort();
    // Restore original showModal to support reconnect (DOM move)
    if (this.#dialog && this.#originalShowModal) {
      this.#dialog.showModal = this.#originalShowModal;
      this.#originalShowModal = null;
    }
    if (this.#dialog && this.#originalClose) {
      this.#finishClose();
      this.#dialog.close = this.#originalClose;
      this.#originalClose = null;
    }
  }

  /**
   * Exit motion for GRID windows (.grid-window drawers, .grid-window-modal search).
   * CSS `@starting-style` handles the entrance, but closing a dialog drops it from
   * the top layer at once in browsers without `overlay` transitions (Safari,
   * Firefox), so the exit is played with WAAPI first and the real close follows.
   * `data-closing` turns CSS transitions off so nothing replays after the close.
   */
  #animatesExit() {
    return this.#dialog.matches('.grid-window, .grid-window-modal')
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  #interceptClose() {
    if (this.#originalClose) return;
    this.#originalClose = this.#dialog.close.bind(this.#dialog);
    this.#dialog.close = (returnValue) => {
      if (!this.#dialog.open) return;
      if (this.#closeAnimations) return;
      if (!this.#animatesExit()) {
        this.#originalClose(returnValue);
        return;
      }
      this.#playExit(returnValue);
    };
  }

  #playExit(returnValue) {
    const dialog = this.#dialog;
    const styles = getComputedStyle(dialog);
    const closedTransform = styles.getPropertyValue('--panel-closed-transform').trim() || 'none';
    const closedOpacity = styles.getPropertyValue('--panel-closed-opacity').trim() || '1';
    const timing = { duration: 240, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' };

    dialog.setAttribute('data-closing', '');
    const animations = [
      dialog.animate([{ transform: 'none', opacity: 1 }, { transform: closedTransform, opacity: closedOpacity }], timing),
    ];
    try {
      animations.push(dialog.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, pseudoElement: '::backdrop' }));
    } catch {
      // Browsers without ::backdrop WAAPI support simply drop the scrim with the close.
    }
    this.#closeAnimations = animations;

    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (this.#closeAnimations !== animations) return;
      this.#originalClose(returnValue);
      this.#finishClose();
    }, () => {});
  }

  #finishClose() {
    this.#closeAnimations?.forEach((animation) => animation.cancel());
    this.#closeAnimations = null;
    this.#dialog?.removeAttribute('data-closing');
  }

  #interceptShowModal() {
    if (this.#originalShowModal) return;
    this.#originalShowModal = this.#dialog.showModal.bind(this.#dialog);
    this.#dialog.showModal = (...args) => {
      // Reopened mid-exit: stop the exit and stay open.
      if (this.#closeAnimations) {
        this.#finishClose();
        return undefined;
      }
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && activeElement !== document.body
        && activeElement !== document.documentElement
        && !this.#triggerElement
      ) {
        this.#triggerElement = activeElement;
        this.#triggerElementId = activeElement.id || null;
      }
      return this.#originalShowModal(...args);
    };
  }

  #togglePassword(source) {
    const inputId = source.getAttribute('aria-controls');
    const input = inputId ? document.getElementById(inputId) : null;
    if (!(input instanceof HTMLInputElement) || !this.#dialog.contains(input)) return;
    if (input.type !== 'password' && input.type !== 'text') return;

    const reveal = input.type === 'password';
    const label = reveal ? source.dataset.hideLabel : source.dataset.showLabel;
    input.type = reveal ? 'text' : 'password';
    source.setAttribute('aria-pressed', String(reveal));

    const labelElement = source.querySelector('[data-password-toggle-label]');
    if (label && labelElement) labelElement.textContent = label;
  }

  #resetContent() {
    const form = this.#dialog.closest('form');
    form?.reset();

    for (const source of this.#dialog.querySelectorAll('button[command="--toggle-password"]')) {
      const inputId = source.getAttribute('aria-controls');
      const input = inputId ? document.getElementById(inputId) : null;
      if (input instanceof HTMLInputElement && this.#dialog.contains(input)) input.type = 'password';
      source.setAttribute('aria-pressed', 'false');

      const label = source.dataset.showLabel;
      const labelElement = source.querySelector('[data-password-toggle-label]');
      if (label && labelElement) labelElement.textContent = label;
    }

    const errors = [...this.#dialog.querySelectorAll('[data-dialog-error]')];
    const errorIds = new Set(errors.map((error) => error.id).filter(Boolean));
    for (const error of errors) error.hidden = true;

    for (const control of this.#dialog.querySelectorAll('[aria-invalid="true"]')) {
      control.removeAttribute('aria-invalid');
      const describedBy = (control.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && !errorIds.has(id));
      if (describedBy.length > 0) control.setAttribute('aria-describedby', describedBy.join(' '));
      else control.removeAttribute('aria-describedby');
    }
  }

  #restoreFocus() {
    const trigger = this.#triggerElement;
    const triggerId = this.#triggerElementId;
    this.#triggerElement = null;
    this.#triggerElementId = null;

    if (this.#canRestoreFocus(trigger)) {
      trigger.focus();
      return;
    }

    const replacement = triggerId ? document.getElementById(triggerId) : null;
    if (this.#canRestoreFocus(replacement)) replacement.focus();
  }

  #canRestoreFocus(element) {
    return element instanceof HTMLElement
      && element.isConnected
      && element !== document.body
      && element !== document.documentElement
      && !element.hidden;
  }

  #setupBreakpointListener() {
    const breakpoints = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' };

    for (const [bp, width] of Object.entries(breakpoints)) {
      if (this.#dialog.classList.contains(`${bp}:hidden`)) {
        const mq = window.matchMedia(`(min-width: ${width})`);
        const handler = (e) => { if (e.matches && this.#dialog.open) this.#dialog.close(); };
        mq.addEventListener('change', handler);
        this.#ac.signal.addEventListener('abort', () => mq.removeEventListener('change', handler));
        return;
      }
      if (this.#dialog.classList.contains(`max-${bp}:hidden`)) {
        const mq = window.matchMedia(`(width < ${width})`);
        const handler = (e) => { if (e.matches && this.#dialog.open) this.#dialog.close(); };
        mq.addEventListener('change', handler);
        this.#ac.signal.addEventListener('abort', () => mq.removeEventListener('change', handler));
        return;
      }
    }
  }
}

customElements.define('s-dialog', SDialog);

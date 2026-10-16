class SGiftCard extends HTMLElement {
  #ac;
  #announcementFrame;
  #copyResetTimer;
  #motionFrame;
  #motionSurface;
  #pointerPosition;

  connectedCallback() {
    this.#ac?.abort();
    this.#ac = new AbortController();
    const options = { signal: this.#ac.signal };

    this.addEventListener('command', (event) => {
      if (event.command === '--copy-code') this.#copyCode(event.source);
    }, options);

    this.#motionSurface = this.querySelector('[data-gift-card-motion]');
    const visual = this.querySelector('[data-gift-card-visual]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    if (!visual || !this.#motionSurface) return;

    const resetMotion = () => this.#resetMotion();
    const syncMotion = () => {
      if (reducedMotion.matches || !finePointer.matches) resetMotion();
    };

    visual.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches || !finePointer.matches) return;

      this.#pointerPosition = { x: event.clientX, y: event.clientY };
      if (this.#motionFrame) return;

      this.#motionFrame = requestAnimationFrame(() => {
        this.#motionFrame = undefined;
        const bounds = visual.getBoundingClientRect();
        if (!this.#pointerPosition || bounds.width === 0 || bounds.height === 0) return;

        const x = Math.max(-1, Math.min(1, ((this.#pointerPosition.x - bounds.left) / bounds.width - 0.5) * 2));
        const y = Math.max(-1, Math.min(1, ((this.#pointerPosition.y - bounds.top) / bounds.height - 0.5) * 2));
        this.#motionSurface?.style.setProperty('--gift-card-rx', `${(10 - y * 4).toFixed(2)}deg`);
        this.#motionSurface?.style.setProperty('--gift-card-ry', `${(-3 + x * 4).toFixed(2)}deg`);
      });
    }, { ...options, passive: true });
    visual.addEventListener('pointerleave', resetMotion, options);
    visual.addEventListener('pointercancel', resetMotion, options);
    reducedMotion.addEventListener('change', syncMotion, options);
    finePointer.addEventListener('change', syncMotion, options);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    clearTimeout(this.#copyResetTimer);
    cancelAnimationFrame(this.#announcementFrame);
    cancelAnimationFrame(this.#motionFrame);

    const copyButton = this.querySelector('button[command="--copy-code"]');
    copyButton?.removeAttribute('aria-busy');
    if (copyButton && this.dataset.copyLabel) copyButton.textContent = this.dataset.copyLabel;

    this.#resetMotion();
  }

  async #copyCode(source) {
    if (!(source instanceof HTMLButtonElement) || source.getAttribute('aria-disabled') === 'true') return;
    if (source.getAttribute('aria-busy') === 'true') return;

    const code = this.dataset.code?.trim();
    const feedback = this.querySelector('[data-gift-card-feedback]');
    if (!code || !feedback) return;

    source.setAttribute('aria-busy', 'true');
    const signal = this.#ac.signal;
    let copied = false;

    try {
      // Only a real write counts: without this guard `await undefined` would resolve silently
      // where the Clipboard API is absent, and the selection fallback would never run.
      if (typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied && !signal.aborted) {
      copied = this.#copyWithSelection(code);
      if (source.isConnected) source.focus({ preventScroll: true });
    }
    if (signal.aborted) return;

    source.removeAttribute('aria-busy');
    clearTimeout(this.#copyResetTimer);

    if (copied) {
      source.textContent = this.dataset.copySuccess;
      this.#announce(feedback, this.dataset.copySuccess);
      this.#copyResetTimer = window.setTimeout(() => {
        if (!source.isConnected) return;
        source.textContent = this.dataset.copyLabel;
      }, 1600);
    } else {
      this.#selectVisibleCode();
      source.textContent = this.dataset.copyLabel;
      this.#announce(feedback, this.dataset.copyError);
    }
  }

  #copyWithSelection(code) {
    const input = document.createElement('textarea');
    input.value = code;
    input.tabIndex = -1;
    input.className = 'fixed start-[-9999px] opacity-0';
    document.body.append(input);

    try {
      input.select();
      return document.execCommand?.('copy') === true;
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }

  #selectVisibleCode() {
    const code = this.querySelector('code');
    if (!code) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #announce(region, message) {
    cancelAnimationFrame(this.#announcementFrame);
    region.textContent = '';
    this.#announcementFrame = requestAnimationFrame(() => {
      if (region.isConnected) region.textContent = message || '';
    });
  }

  #resetMotion() {
    cancelAnimationFrame(this.#motionFrame);
    this.#motionFrame = undefined;
    this.#pointerPosition = undefined;
    this.#motionSurface?.style.removeProperty('--gift-card-rx');
    this.#motionSurface?.style.removeProperty('--gift-card-ry');
  }
}

customElements.define('s-gift-card', SGiftCard);

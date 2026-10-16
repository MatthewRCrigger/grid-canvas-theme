class LocalizationDropdown extends HTMLElement {
  #ac;
  #closingAnimation;
  #outsideAc;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('command', (event) => {
      if (event.command === '--toggle') this.#toggle();
    }, opts);

    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || this.#isHidden) return;
      event.stopPropagation();
      void this.#hide();
      this.#button?.focus();
    }, opts);
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#removeOutsideListeners();
    this.#closingAnimation?.cancel();
  }

  get #button() {
    return this.querySelector('[data-localization-trigger]');
  }

  get #panel() {
    return this.querySelector('[data-localization-panel]');
  }

  get #isHidden() {
    return this.#panel?.hasAttribute('hidden') ?? true;
  }

  #toggle() {
    if (this.#isHidden) {
      this.#show();
    } else {
      void this.#hide();
    }
  }

  #show() {
    const panel = this.#panel;
    const button = this.#button;
    if (!panel || !button || !this.#isHidden) return;

    this.#closingAnimation?.cancel();
    this.#closingAnimation = null;
    panel.removeAttribute('hidden');
    button.setAttribute('aria-expanded', 'true');
    this.#addOutsideListeners();

    if (this.#prefersReducedMotion() || typeof panel.animate !== 'function') return;

    try {
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(20px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 220, easing: this.#uiEasing() }
      );
    } catch {
      // Keep the panel open if WAAPI rejects an easing value in an older browser.
    }
  }

  async #hide() {
    const panel = this.#panel;
    const button = this.#button;
    if (!panel || !button || this.#isHidden) return;

    this.#removeOutsideListeners();
    button.setAttribute('aria-expanded', 'false');

    if (this.#prefersReducedMotion() || typeof panel.animate !== 'function') {
      panel.setAttribute('hidden', '');
      return;
    }

    this.#closingAnimation?.cancel();
    let animation;

    try {
      animation = panel.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(12px)' },
        ],
        { duration: 150, easing: this.#uiEasing() }
      );
    } catch {
      panel.setAttribute('hidden', '');
      return;
    }

    this.#closingAnimation = animation;

    try {
      await animation.finished;
    } catch {
      return;
    }

    if (this.#closingAnimation !== animation) return;
    this.#closingAnimation = null;
    panel.setAttribute('hidden', '');
  }

  #addOutsideListeners() {
    this.#removeOutsideListeners();
    this.#outsideAc = new AbortController();
    const opts = { capture: true, signal: this.#outsideAc.signal };

    document.addEventListener('pointerdown', this.#onOutsideInteraction, opts);
    document.addEventListener('click', this.#onOutsideInteraction, opts);
  }

  #onOutsideInteraction = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) return;
    void this.#hide();
  };

  #removeOutsideListeners() {
    this.#outsideAc?.abort();
    this.#outsideAc = null;
  }

  #prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  #uiEasing() {
    return getComputedStyle(this).getPropertyValue('--ease-ui').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
  }
}

customElements.define('s-localization-dropdown', LocalizationDropdown);

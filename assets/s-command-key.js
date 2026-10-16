/**
 * <s-command-key target="predictive-search"> — opens the GRID command palette (the
 * search window) from the keyboard: Cmd/Ctrl+K anywhere, or "/" when focus is not in
 * a text field. The target is the <dialog> id; it is opened with showModal().
 */
class SCommandKey extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    document.addEventListener('keydown', (event) => {
      const isPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const isSlash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !this.#isTyping(event.target);
      if (!isPalette && !isSlash) return;

      const dialog = document.getElementById(this.getAttribute('target') || '');
      if (!(dialog instanceof HTMLDialogElement)) return;

      event.preventDefault();
      if (!dialog.open) dialog.showModal();
    }, { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #isTyping(target) {
    return target instanceof HTMLElement
      && (target.isContentEditable || target.matches('input, textarea, select'));
  }
}

customElements.define('s-command-key', SCommandKey);

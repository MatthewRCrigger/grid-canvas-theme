/**
 * <s-password-field> — an inline password input with a Show / Hide toggle.
 *
 * Commands (Invoker Commands, sent with commandfor="<this element's id>"):
 *   --toggle-password — switch the input between hidden and visible text; the
 *                       source button's [data-password-toggle-label] swaps between
 *                       its data-show-label and data-hide-label, and aria-pressed follows.
 *   --focus           — move focus to the input (the dock's Enter tile uses it).
 */
class SPasswordField extends HTMLElement {
  #ac = null;

  connectedCallback() {
    this.#ac = new AbortController();
    this.addEventListener('command', (event) => this.#onCommand(event), { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  get #input() {
    return this.querySelector('input[name="password"]');
  }

  #onCommand(event) {
    const input = this.#input;
    if (!input) return;

    if (event.command === '--focus') {
      input.focus();
      return;
    }

    if (event.command === '--toggle-password') {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      const source = event.source;
      if (!source) return;
      source.setAttribute('aria-pressed', String(visible));
      const label = source.querySelector('[data-password-toggle-label]');
      const text = visible ? source.dataset.hideLabel : source.dataset.showLabel;
      if (label && text) label.textContent = text;
    }
  }
}

if (!customElements.get('s-password-field')) customElements.define('s-password-field', SPasswordField);

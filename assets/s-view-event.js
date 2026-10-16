import { createViewEventElement } from '@shopify/standard-events';

export const ViewEventElement = createViewEventElement();

if (!customElements.get('s-view-event')) {
  customElements.define('s-view-event', ViewEventElement);
}

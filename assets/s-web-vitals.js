/**
 * <s-web-vitals> — live real-user Core Web Vitals for the visitor's current page view.
 *
 * Fills descendant [data-metric] elements (lcp, inp, cls, ttfb) from the browser's own
 * PerformanceObserver entries; no third-party library and nothing is sent anywhere.
 * Each filled element gets data-rating="good|needs-improvement|poor" for styling.
 *
 * Attributes (translated strings written by Liquid):
 *   data-unit-ms   unit suffix for milliseconds (e.g. "ms")
 *   data-unit-s    unit suffix for seconds (e.g. "s")
 *   data-na        text shown when the browser does not expose a metric
 */
const THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  ttfb: [800, 1800],
};

class SWebVitals extends HTMLElement {
  #observers = [];
  #ac = null;
  #lcpDone = false;
  #cls = { value: 0, session: 0, first: 0, last: 0 };
  #interactions = new Map();

  connectedCallback() {
    this.#ac = new AbortController();
    const supported = PerformanceObserver?.supportedEntryTypes ?? [];

    this.#ttfb();

    if (supported.includes('largest-contentful-paint')) {
      this.#observe('largest-contentful-paint', (entries) => {
        if (this.#lcpDone) return;
        const last = entries[entries.length - 1];
        if (last) this.#set('lcp', Math.max(last.startTime - this.#activationStart(), 0));
      });
      // LCP stops being reported once the visitor interacts or leaves the tab.
      const stop = () => { this.#lcpDone = true; };
      for (const type of ['keydown', 'pointerdown', 'visibilitychange']) {
        addEventListener(type, stop, { once: true, capture: true, signal: this.#ac.signal });
      }
    } else {
      this.#unsupported('lcp');
    }

    if (supported.includes('layout-shift')) {
      this.#set('cls', 0);
      this.#observe('layout-shift', (entries) => {
        const s = this.#cls;
        for (const entry of entries) {
          if (entry.hadRecentInput) continue;
          // Session windows: shifts less than 1s apart, capped at 5s, keep the worst window.
          if (s.session && entry.startTime - s.last < 1000 && entry.startTime - s.first < 5000) {
            s.session += entry.value;
          } else {
            s.session = entry.value;
            s.first = entry.startTime;
          }
          s.last = entry.startTime;
          s.value = Math.max(s.value, s.session);
        }
        this.#set('cls', s.value);
      });
    } else {
      this.#unsupported('cls');
    }

    if (supported.includes('event')) {
      const onEvents = (entries) => {
        for (const entry of entries) {
          if (!entry.interactionId) continue;
          const prev = this.#interactions.get(entry.interactionId) ?? 0;
          this.#interactions.set(entry.interactionId, Math.max(prev, entry.duration));
        }
        const durations = [...this.#interactions.values()].sort((a, b) => b - a);
        if (!durations.length) return;
        // Approximate the 98th percentile: skip one worst interaction per 50.
        const index = Math.min(durations.length - 1, Math.floor(durations.length / 50));
        this.#set('inp', durations[index]);
      };
      this.#observe('event', onEvents, { durationThreshold: 16 });
      if (supported.includes('first-input')) this.#observe('first-input', onEvents);
    } else {
      this.#unsupported('inp');
    }
  }

  disconnectedCallback() {
    for (const observer of this.#observers) observer.disconnect();
    this.#observers = [];
    this.#ac?.abort();
  }

  #observe(type, callback, options = {}) {
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true, ...options });
      this.#observers.push(observer);
    } catch {
      this.#unsupported(type === 'event' || type === 'first-input' ? 'inp' : type);
    }
  }

  #ttfb() {
    const [nav] = performance.getEntriesByType?.('navigation') ?? [];
    if (!nav || !nav.responseStart) {
      this.#unsupported('ttfb');
      return;
    }
    this.#set('ttfb', Math.max(nav.responseStart - this.#activationStart(), 0));
  }

  #activationStart() {
    const [nav] = performance.getEntriesByType?.('navigation') ?? [];
    return nav?.activationStart ?? 0;
  }

  #format(metric, value) {
    if (metric === 'cls') return value.toFixed(3);
    if (value >= 1000) return `${(value / 1000).toFixed(2)} ${this.dataset.unitS ?? 's'}`;
    return `${Math.round(value)} ${this.dataset.unitMs ?? 'ms'}`;
  }

  #set(metric, value) {
    const el = this.querySelector(`[data-metric="${metric}"]`);
    if (!el) return;
    const [good, poor] = THRESHOLDS[metric];
    el.textContent = this.#format(metric, value);
    el.dataset.rating = value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
  }

  #unsupported(metric) {
    const el = this.querySelector(`[data-metric="${metric}"]`);
    if (!el) return;
    el.textContent = this.dataset.na ?? 'n/a';
    delete el.dataset.rating;
  }
}

customElements.define('s-web-vitals', SWebVitals);

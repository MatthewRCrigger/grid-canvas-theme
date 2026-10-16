/**
 * <s-video> — Click-to-load video player web component.
 *
 * Clicking [data-play] replaces the poster with the iframe/video from
 * <template data-video>. Injects preconnect hints on hover/focus to reduce
 * time-to-play for third-party embeds. Shopify-hosted <video> plays natively
 * and gets a caption track injected if data-caption-url is provided.
 *
 * Commands (dispatched via commandfor/command on descendant buttons):
 *   --play — Replace the poster with the embed inside <template data-video>.
 *
 * Required child markup:
 *   [data-play]              — The poster/play button (receives click + preconnect hooks).
 *                               [data-preconnect] attribute is the origin to preconnect to.
 *   template[data-video]     — <template> whose content is cloned into place on --play.
 *                               Expected to contain a single <iframe> or <video> element.
 *   video (optional)         — When present, a native caption <track> is injected on mount.
 *
 * Element dataset (on <s-video> itself):
 *   data-caption-url      — If set + a native <video> is present, injects <track kind="captions">.
 *   data-caption-srclang  — srclang for the caption track (defaults to <html lang> or "en").
 *   data-caption-label    — human-readable caption track label.
 *   data-video-title      — Fallback title attribute injected onto <iframe> for a11y.
 *
 * Events:
 *   s-video:play (bubbles) — Dispatched after the embed is swapped in.
 */
class SVideo extends HTMLElement {
  #playBtn;
  #template;
  #ac;
  #inFlightAc;
  #autoplayRaf;
  #preconnected = false;
  #preconnectLink;

  connectedCallback() {
    this.#playBtn = this.querySelector('[data-play]');
    this.#template = this.querySelector('template[data-video]');
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    // For native Shopify-hosted video: inject caption track, apply playsinline, and wire pause-on-hover
    const nativeVideo = this.querySelector('video');
    if (nativeVideo) {
      if (this.dataset.captionUrl) {
        let track = nativeVideo.querySelector('track[data-s-video-caption]');
        if (!track) {
          track = document.createElement('track');
          track.dataset.sVideoCaption = '';
          track.kind = 'captions';
          track.default = true;
          nativeVideo.appendChild(track);
        }
        track.src = this.dataset.captionUrl;
        track.srclang = this.dataset.captionSrclang || document.documentElement.lang || 'en';
        track.label = this.dataset.captionLabel;
      }

      // plays-inline: add playsinline for inline playback on iOS (video_tag doesn't expose this attr)
      if (this.classList.contains('plays-inline')) {
        nativeVideo.setAttribute('playsinline', '');
      }

      if (this.classList.contains('pause-on-hover')) {
        this.#bindPauseOnHover(nativeVideo, opts);
      }
    }

    if (!this.#playBtn || !this.#template) return;

    this.addEventListener('command', (e) => {
      if (e.command === '--play') this.#load();
    }, opts);
    this.#playBtn.addEventListener('pointerenter', () => this.#preconnect(), { ...opts, once: true });
    this.#playBtn.addEventListener('focusin', () => this.#preconnect(), { ...opts, once: true });

    if (this.classList.contains('autoplay')) {
      this.#autoplayRaf = requestAnimationFrame(() => {
        this.#autoplayRaf = null;
        this.#load({ animate: false, focus: false });
      });
    }
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#inFlightAc?.abort();
    if (this.#autoplayRaf !== null && this.#autoplayRaf !== undefined) {
      cancelAnimationFrame(this.#autoplayRaf);
      this.#autoplayRaf = null;
    }
    this.#preconnectLink?.remove();
    this.#preconnectLink = null;
    this.#preconnected = false;
  }

  async #load({ animate = true, focus = true } = {}) {
    if (!this.isConnected || !this.#playBtn || !this.#template) return;

    this.#inFlightAc?.abort();
    const controller = new AbortController();
    this.#inFlightAc = controller;
    const signal = controller.signal;

    const content = this.#template.content.cloneNode(true);
    const media = content.querySelector('iframe, video');

    // Ensure iframes always have a title for screen reader accessibility
    if (media && media.tagName === 'IFRAME' && !media.getAttribute('title')) {
      if (this.dataset.videoTitle) media.title = this.dataset.videoTitle;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduceMotion) {
      try {
        await this.#playBtn.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        ).finished;
      } catch (e) {
        if (e.name !== 'AbortError') throw e;
        return;
      }
      // Supersession and disconnect both funnel through abort, so one signal check carries the contract.
      if (signal.aborted) return;
    }

    this.#playBtn.replaceWith(content);
    this.#template.remove();
    this.#playBtn = null;
    this.#template = null;
    this.#inFlightAc = null;

    if (media && this.classList.contains('pause-on-hover')) {
      this.#bindPauseOnHover(media, { signal: this.#ac.signal });
    }

    if (media && animate && !reduceMotion) {
      media.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    }

    if (media && focus) media.focus();

    this.dispatchEvent(new CustomEvent('s-video:play', { bubbles: true }));
  }

  #bindPauseOnHover(media, opts) {
    if (!media) return;

    if (media.tagName === 'VIDEO') {
      let wasPlaying = false;
      this.addEventListener('mouseenter', () => {
        wasPlaying = !media.paused;
        media.pause();
      }, opts);
      this.addEventListener('mouseleave', () => {
        if (wasPlaying) media.play().catch(() => {});
      }, opts);
      return;
    }

    if (media.tagName !== 'IFRAME') return;

    const src = media.getAttribute('src');
    if (!src) return;

    const targetOrigin = new URL(src).origin;
    let pauseMessage;

    if (targetOrigin.includes('youtube')) {
      pauseMessage = JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] });
    } else if (targetOrigin.includes('vimeo')) {
      pauseMessage = JSON.stringify({ method: 'pause' });
    }

    if (!pauseMessage) return;

    this.addEventListener('mouseenter', () => {
      media.contentWindow?.postMessage(pauseMessage, targetOrigin);
    }, opts);
  }

  #preconnect() {
    if (this.#preconnected) return;
    this.#preconnected = true;

    const origin = this.#playBtn.dataset.preconnect;
    if (!origin) return;

    this.#preconnectLink = document.createElement('link');
    this.#preconnectLink.rel = 'preconnect';
    this.#preconnectLink.href = origin;
    this.#preconnectLink.crossOrigin = 'anonymous';
    document.head.appendChild(this.#preconnectLink);
  }
}

if (!customElements.get('s-video')) {
  customElements.define('s-video', SVideo);
}

const pendingAnnouncements = new WeakMap();

function cancelLiveRegionAnnouncement(region) {
  const cancel = region && pendingAnnouncements.get(region);
  if (cancel) cancel();
}

function announceLiveRegion(region, message, { frames = 1 } = {}) {
  if (!region) return;
  if (message == null || message === '') return;

  cancelLiveRegionAnnouncement(region);
  region.textContent = '';

  const text = String(message);
  let remaining = Math.max(1, Number.parseInt(frames, 10) || 1);

  return new Promise((resolve) => {
    let cancel;
    let rafId = 0;
    const finish = () => {
      if (pendingAnnouncements.get(region) === cancel) pendingAnnouncements.delete(region);
      resolve();
    };
    const schedule = () => {
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (--remaining > 0) return schedule();
        region.textContent = text;
        finish();
      });
    };

    cancel = () => {
      if (rafId) cancelAnimationFrame(rafId);
      finish();
    };

    pendingAnnouncements.set(region, cancel);
    schedule();
  });
}

function announceGlobalLiveRegion(message, options) {
  return announceLiveRegion(document.getElementById('sr-announcer'), message, options);
}

function globalLiveRegionMessage(name) {
  return document.getElementById('sr-announcer')?.dataset[name];
}

function createVisuallyHiddenLiveRegion() {
  const region = document.createElement('span');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  return region;
}

export { announceGlobalLiveRegion, announceLiveRegion, cancelLiveRegionAnnouncement, createVisuallyHiddenLiveRegion, globalLiveRegionMessage };

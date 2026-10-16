/**
 * Runs a callback inside a view transition when supported and the user
 * hasn't opted into "prefers-reduced-motion". Falls back to calling the
 * callback directly.
 *
 * Returns a promise that resolves once the callback has finished updating
 * the DOM, so callers can safely read the post-update DOM.
 */
export async function transition(callback) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const vt = document.startViewTransition(callback);
    await vt.updateCallbackDone;
  } else {
    await callback();
  }
}

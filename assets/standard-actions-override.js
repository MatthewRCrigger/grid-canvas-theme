import {
  announceCartFeedback,
  getCartErrorMessage,
  getCartRefreshErrorMessage,
  getCartSuccessMessage,
} from '@theme/cart-feedback';


const cartElement = 's-cart';
// Theme product-context mutations originate in s-product-form, whose inline alert owns errors.
const hasInlineMutationErrorOwner = (options) => options?.event?.context === 'product';
const isRecoveredCartError = (error) => (
  error?.code === 'INVALID'
  && Array.isArray(error.field)
  && error.field.length === 1
  && error.field[0] === 'cartId'
);

function normalizeRecoveredCartResult(result) {
  if (!result?.cart?.id || !Array.isArray(result.userErrors)) return result;

  // Storefront can replace an invalid or consumed cart, commit the mutation, and
  // return the new cart alongside this non-actionable cartId error.
  const userErrors = result.userErrors.filter((error) => !isRecoveredCartError(error));
  if (userErrors.length === result.userErrors.length) return result;

  const normalizedResult = { ...result };
  if (userErrors.length) {
    normalizedResult.userErrors = userErrors;
  } else {
    delete normalizedResult.userErrors;
  }
  return normalizedResult;
}

export async function handleOpenCart() {
  /** @type {HTMLDialogElement | null} */
  const dialog = document.getElementById('cart-drawer');
  if (!(dialog instanceof HTMLDialogElement)) return;

  if (!dialog.open) dialog.showModal();
  if (!dialog.open) return;

  dialog.dispatchEvent(new CustomEvent('s-cart:opened', {
    bubbles: true,
    detail: { dialogId: dialog.id },
  }));
}

export async function handleUpdateCart(defaultHandler, payload, options) {
  let result;

  try {
    result = normalizeRecoveredCartResult(await defaultHandler());
  } catch (error) {
    if (!options?.signal?.aborted && !hasInlineMutationErrorOwner(options)) {
      await announceCartFeedback(getCartErrorMessage(error), { toast: true });
    }

    throw error;
  }

  const userErrorMessage = result?.userErrors?.[0]?.message;
  if (userErrorMessage) {
    if (!hasInlineMutationErrorOwner(options)) {
      await announceCartFeedback(userErrorMessage, { toast: true });
    }
    return result;
  }

  try {
    await customElements.whenDefined(cartElement);
    await customElements.get(cartElement)?.refreshMountedCarts?.({ signal: options?.signal });
  } catch (error) {
    // The mutation has already committed. Keep that successful result outside caller
    // rollback boundaries and classify only the display refresh as stale.
    if (!options?.signal?.aborted) {
      await announceCartFeedback(getCartRefreshErrorMessage(), {
        toast: true,
        variant: 'warning',
        duration: 0,
      });
    }

    return result;
  }

  const message = result?.warnings?.[0]?.message || getCartSuccessMessage(payload?.lines);
  await announceCartFeedback(message);

  return result;
}

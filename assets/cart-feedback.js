import {
  announceGlobalLiveRegion,
  globalLiveRegionMessage,
} from '@theme/live-region';

const getCartFeedbackMessage = (name) => globalLiveRegionMessage(name);

const announceCartFeedback = async (
  message,
  { toast = false, variant = 'error', duration } = {}
) => {
  if (!message) return;

  if (toast) {
    document.dispatchEvent(new CustomEvent('s-notification:add', {
      detail: {
        message,
        variant,
        ...(duration == null ? {} : { duration }),
      },
    }));
    return;
  }

  await announceGlobalLiveRegion(message);
};

const getCartSuccessMessage = (lines = []) => {
  let hasAdd = false;
  let hasUpdate = false;
  let hasRemove = false;

  for (const line of lines) {
    if (!line?.id) {
      hasAdd = true;
    } else if (line.quantity === 0) {
      hasRemove = true;
    } else {
      hasUpdate = true;
    }

    if ((hasAdd && hasUpdate) || (hasAdd && hasRemove) || (hasUpdate && hasRemove)) {
      return getCartFeedbackMessage('updatedMessage');
    }
  }

  if (hasAdd) return getCartFeedbackMessage('addedMessage');
  if (hasRemove) return getCartFeedbackMessage('removedMessage');
  return getCartFeedbackMessage('updatedMessage');
};

const getCartErrorMessage = (error) => (typeof error === 'string'
  ? error
  : error?.cause?.userErrors?.[0]?.message || getCartFeedbackMessage('updateError'));

const getCartRefreshErrorMessage = () => (
  getCartFeedbackMessage('refreshError') || getCartFeedbackMessage('updateError')
);

export {
  announceCartFeedback,
  getCartErrorMessage,
  getCartRefreshErrorMessage,
  getCartSuccessMessage,
};

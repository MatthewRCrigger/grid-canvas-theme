/**
 * Shared quantity-rule helpers for product and cart quantity controls.
 * Shopify quantity rules define a minimum, optional maximum, and increment.
 */
export function quantityRulesFromDataset(source) {
  const min = parseInt(source.dataset.qtyMin, 10);
  const max = source.dataset.qtyMax ? parseInt(source.dataset.qtyMax, 10) : Infinity;
  const step = parseInt(source.dataset.qtyStep, 10);

  return {
    min: Number.isFinite(min) ? min : 1,
    max: Number.isFinite(max) ? max : Infinity,
    step: Number.isFinite(step) && step > 0 ? step : 1,
  };
}

export function normalizeQuantity(value, rules, { allowZero = false } = {}) {
  const min = Number.isFinite(rules?.min) ? rules.min : 1;
  const max = Number.isFinite(rules?.max) ? rules.max : Infinity;
  const step = Number.isFinite(rules?.step) && rules.step > 0 ? rules.step : 1;

  if (!Number.isFinite(value)) return min;
  if (allowZero && value <= 0) return 0;

  let quantity = Math.max(min, value);
  if (max !== Infinity) quantity = Math.min(max, quantity);

  const stepsFromMin = Math.round((quantity - min) / step);
  quantity = min + (stepsFromMin * step);

  if (max !== Infinity && quantity > max) {
    const maxSteps = Math.max(0, Math.floor((max - min) / step));
    quantity = min + (maxSteps * step);
  }

  return Math.max(min, quantity);
}

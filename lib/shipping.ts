export function calculateShippingCents(
  subtotalCents: number,
  flatShippingCents: number,
  freeShippingThresholdCents: number | null
) {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error("Subtotal must be a non-negative integer");
  }
  if (!Number.isInteger(flatShippingCents) || flatShippingCents < 0) {
    throw new Error("Shipping fee must be a non-negative integer");
  }
  if (
    freeShippingThresholdCents !== null &&
    (!Number.isInteger(freeShippingThresholdCents) || freeShippingThresholdCents <= 0)
  ) {
    throw new Error("Free shipping threshold must be a positive integer or null");
  }

  if (freeShippingThresholdCents !== null && subtotalCents >= freeShippingThresholdCents) {
    return 0;
  }

  return flatShippingCents;
}

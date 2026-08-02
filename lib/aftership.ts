const AFTERSHIP_API_URL = "https://api.aftership.com/tracking/2024-04/trackings";

// AfterShip's carrier slugs, inferred from their public carrier page URLs
// (aftership.com/carriers/aramex, aftership.com/carriers/emirates-post). If
// tracking creation ever fails with an "invalid slug" error, verify the
// exact current slug via AfterShip's "Get couriers" endpoint rather than
// assuming these are still correct — carrier slugs occasionally change.
export const CARRIER_SLUGS: Record<string, string> = {
  aramex: "aramex",
  emirates_post: "emirates-post",
};

export type SupportedCarrier = keyof typeof CARRIER_SLUGS;

/**
 * Registers a tracking number with AfterShip so it polls the carrier and
 * pushes status updates (including delivery) to our webhook. Fails soft —
 * returns null instead of throwing — because a merchant marking an order
 * shipped shouldn't be blocked by a tracking-registration hiccup; the
 * tracking number is already stored on the order regardless.
 */
export async function createAftershipTracking(params: {
  trackingNumber: string;
  carrier: SupportedCarrier;
  orderId: string;
}) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) {
    // Not configured — tracking number still gets stored on the order, it
    // just won't receive automated delivery-status updates.
    return null;
  }

  try {
    const res = await fetch(AFTERSHIP_API_URL, {
      method: "POST",
      headers: {
        "as-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking: {
          tracking_number: params.trackingNumber,
          slug: CARRIER_SLUGS[params.carrier],
          order_id: params.orderId,
        },
      }),
    });

    if (!res.ok) {
      console.error("AfterShip tracking creation failed:", await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("AfterShip tracking creation error:", err);
    return null;
  }
}

const AFTERSHIP_API_URL = "https://api.aftership.com/tracking/2024-04/trackings";

export const CARRIER_SLUGS: Record<string, string> = {
  aramex: "aramex",
  emirates_post: "emirates-post",
};

export type SupportedCarrier = keyof typeof CARRIER_SLUGS;

export async function createAftershipTracking(params: {
  trackingNumber: string;
  carrier: SupportedCarrier;
  orderId: string;
}) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) throw new Error("AfterShip is not configured");

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
    throw new Error(`AfterShip tracking creation failed with HTTP ${res.status}`);
  }

  return await res.json();
}

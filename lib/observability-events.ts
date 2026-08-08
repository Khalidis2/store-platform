export const OBSERVABILITY_EVENTS = {
  checkoutOrderCreated: "checkout.order.created",
  inventoryReserved: "inventory.reserved",
  checkoutSessionCreated: "checkout.session.created",
  checkoutPaymentFailed: "checkout.payment.failed",
  stripeWebhookFailed: "webhook.stripe.failed",
  aftershipWebhookFailed: "webhook.aftership.failed",
  emailDeliveryFailed: "email.delivery.failed",
} as const;

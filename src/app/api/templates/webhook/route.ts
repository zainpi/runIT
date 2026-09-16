import Stripe from "stripe";
import { fulfillOrder, StoreError, TEMPLATE_STORE } from "@/lib/templates/payment";
import { errorResponse, jsonResponse, readBody, stripeForStore } from "@/lib/templates/server";
export async function POST(request: Request) {
  try {
    const { stripe, webhookSecret } = await stripeForStore();
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new StoreError("Missing signature.");
    const raw = await readBody(request, 262144);
    let event: Stripe.Event;
    try { event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider()); }
    catch { throw new StoreError("Invalid signature."); }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.metadata?.store === TEMPLATE_STORE && session.payment_status === "paid") {
        try { await fulfillOrder(stripe, session.id); }
        catch (error) {
          // Already-refunded/disputed or obsolete orders must not cause endless retries.
          if (!(error instanceof StoreError && error.status === 403)) throw error;
        }
      }
    }
    return jsonResponse({ received: true });
  } catch (error) { return errorResponse(error); }
}

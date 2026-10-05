import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

/**
 * Punto de integración con Stripe (NO implementado en el MVP).
 *
 * Pasos sugeridos:
 *  1. `npm i stripe -w @bmb/server` y definir STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
 *  2. createPayment: `stripe.paymentIntents.create({ amount, currency: 'usd',
 *     metadata: { orderId } })` y devolver `{ status: 'requires_action',
 *     reference: intent.id, clientSecret: intent.client_secret }`.
 *  3. En el frontend confirmar con Stripe Elements usando `clientSecret`.
 *  4. Agregar un webhook `payment_intent.succeeded` que llame a `markOrderPaid`
 *     (orderService) — nunca marcar como pagada solo por la respuesta del cliente.
 *  5. refund: `stripe.refunds.create({ payment_intent: reference, amount })`.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  async createPayment(_req: PaymentRequest): Promise<PaymentResult> {
    throw new Error('StripePaymentProvider aún no está implementado. Usa PAYMENT_PROVIDER=mock.');
  }

  async refund(): Promise<{ ok: boolean; reference: string }> {
    throw new Error('StripePaymentProvider aún no está implementado.');
  }
}

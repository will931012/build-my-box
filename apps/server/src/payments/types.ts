/**
 * Interfaz de pasarela de pagos. El MVP usa `MockPaymentProvider`; para integrar
 * Stripe basta con implementar esta interfaz (ver `stripeProvider.ts`) y
 * seleccionarla con PAYMENT_PROVIDER=stripe.
 */
export interface PaymentRequest {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: 'USD';
  description: string;
  customerName: string;
}

export type PaymentStatus = 'succeeded' | 'requires_action' | 'failed';

export interface PaymentResult {
  status: PaymentStatus;
  /** Identificador de la transacción en la pasarela. */
  reference: string;
  /** Para pasarelas con confirmación en el cliente (p. ej. Stripe PaymentIntent). */
  clientSecret?: string;
  failureMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(req: PaymentRequest): Promise<PaymentResult>;
  refund(reference: string, amountCents: number): Promise<{ ok: boolean; reference: string }>;
}

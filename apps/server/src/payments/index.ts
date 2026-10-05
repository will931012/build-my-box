import { randomUUID } from 'node:crypto';
import { env } from '../env';
import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';
import { StripePaymentProvider } from './stripeProvider';

export type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

/** Pasarela simulada: aprueba todos los pagos al instante. No mueve dinero real. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createPayment(_req: PaymentRequest): Promise<PaymentResult> {
    return { status: 'succeeded', reference: `sim_${randomUUID()}` };
  }

  async refund(reference: string) {
    return { ok: true, reference: `sim_refund_${reference}` };
  }
}

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) provider = env.paymentProvider === 'stripe' ? new StripePaymentProvider() : new MockPaymentProvider();
  return provider;
}

/** Permite inyectar otra pasarela (pruebas). */
export function setPaymentProvider(p: PaymentProvider): void {
  provider = p;
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPrice, formatWeight, recipientSchema, STATUS_LABELS, type RecipientInput } from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Alert, Button, Card, Field, Input, Spinner, Textarea } from '../../components/ui';
import { useCart } from '../../store/cart';
import { useBuilder } from '../builder/useBuilder';

type FormState = Record<keyof RecipientInput, string>;
const empty: FormState = { name: '', phone: '', address: '', city: '', province: '', country: 'Cuba', notes: '' };

export function CheckoutPage() {
  const { box, lines, analysis, pending, stockIssues, subtotalCents } = useBuilder();
  const { clear } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof RecipientInput, string>>>({});

  const mutation = useMutation({
    mutationFn: (action: 'pay' | 'save') => {
      const parsed = recipientSchema.parse(form);
      return api.createOrder({
        boxId: box!.id,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        recipient: parsed,
        action,
      });
    },
    onSuccess: (order) => {
      clear();
      qc.invalidateQueries({ queryKey: ['products'] });
      navigate(`/ordenes/${order.id}`);
    },
  });

  if (!box || lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert title="Tu caja está vacía">
          <Link to="/" className="underline">
            Vuelve a construir tu caja
          </Link>
          .
        </Alert>
      </div>
    );
  }

  const result = analysis?.result;
  const ready = !pending && result?.status === 'FITS' && stockIssues.length === 0;

  const submit = (action: 'pay' | 'save') => (e?: FormEvent) => {
    e?.preventDefault();
    const r = recipientSchema.safeParse(form);
    if (!r.success) {
      const errs: typeof errors = {};
      for (const i of r.error.issues) errs[i.path[0] as keyof RecipientInput] = i.message;
      setErrors(errs);
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setErrors({});
    mutation.mutate(action);
  };

  const field = (k: keyof RecipientInput, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={`f-${k}`} error={errors[k]}>
      <Input
        id={`f-${k}`}
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        aria-invalid={!!errors[k]}
        {...props}
      />
    </Field>
  );

  const apiError = mutation.error instanceof ApiError ? mutation.error : mutation.error ? new ApiError(0, String(mutation.error)) : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-3 py-6 sm:px-4 md:grid-cols-[1fr_340px]">
      <Card className="p-4 sm:p-6">
        <h1 className="text-xl font-bold">Checkout</h1>
        <Alert tone="amber" className="mt-3">
          Pago <strong>simulado</strong>: no se realizará ningún cobro real.
        </Alert>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit('pay')} noValidate>
          <div className="sm:col-span-2">
            <h2 className="font-semibold">Destinatario</h2>
          </div>
          <div className="sm:col-span-2">{field('name', 'Nombre completo', { autoComplete: 'name' })}</div>
          {field('phone', 'Teléfono', { autoComplete: 'tel', inputMode: 'tel' })}
          {field('country', 'País')}
          <div className="sm:col-span-2">{field('address', 'Dirección', { autoComplete: 'street-address' })}</div>
          {field('city', 'Municipio / ciudad')}
          {field('province', 'Provincia')}
          <div className="sm:col-span-2">
            <Field label="Notas para la entrega (opcional)" htmlFor="f-notes">
              <Textarea id="f-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>

          {apiError && (
            <div className="sm:col-span-2">
              <Alert tone="red" title="No se pudo crear la orden">
                {apiError.message}
              </Alert>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <Button type="submit" size="lg" disabled={!ready || mutation.isPending} className="sm:flex-1">
              {mutation.isPending && mutation.variables === 'pay' ? <Spinner /> : null}
              Pagar {formatPrice(subtotalCents + box.priceCents)} (simulado)
            </Button>
            <Button size="lg" variant="secondary" disabled={!ready || mutation.isPending} onClick={() => submit('save')()}>
              Guardar orden sin pagar
            </Button>
          </div>
        </form>
      </Card>

      <Card className="h-fit p-4">
        <h2 className="font-semibold">Tu caja</h2>
        <p className="text-sm text-stone-600">{box.name}</p>
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {lines.map((l) => (
            <li key={l.product.id} className="flex justify-between gap-2 py-1">
              <span>
                {l.quantity} × {l.product.name}
              </span>
              <span className="tabular-nums">{formatPrice(l.product.priceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-stone-200 pt-2 text-sm">
          <div className="flex justify-between">
            <span>Caja y envío</span>
            <span>{formatPrice(box.priceCents)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(subtotalCents + box.priceCents)}</span>
          </div>
          {result && (
            <p className="mt-2 text-xs text-stone-600">
              Peso estimado {formatWeight(result.totals.weightG)} · Estado: {STATUS_LABELS[result.status]}
            </p>
          )}
        </div>
        {!ready && !pending && (
          <Alert tone="red" className="mt-3">
            La caja no está lista (no cabe o falta stock).{' '}
            <Link to="/" className="underline">
              Volver a ajustarla
            </Link>
          </Alert>
        )}
        <Link to="/" className="mt-3 inline-block text-sm text-brand-700 underline">
          ← Seguir editando la caja
        </Link>
      </Card>
    </div>
  );
}

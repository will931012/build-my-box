import { lazy, Suspense, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDims, formatPrice, formatWeight, ORDER_STATUS_LABELS, type OrderDto, type OrderStatus } from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui';
import { buildColorMap } from '../../lib/colors';
import { ViewerFallback } from '../builder/BuilderPage';

const BoxViewer3D = lazy(() => import('../../components/BoxViewer3D'));

export const statusTone: Record<OrderStatus, 'amber' | 'green' | 'blue' | 'neutral'> = {
  PENDING_PAYMENT: 'amber',
  PAID: 'green',
  FULFILLED: 'blue',
  CANCELLED: 'neutral',
};

export function useOrderColors(order: OrderDto | undefined) {
  const products = useQuery({ queryKey: ['products'], queryFn: api.products });
  return useMemo(() => {
    const itemIds = order?.items.map((i) => i.productId) ?? [];
    return buildColorMap(products.data?.map((p) => p.id) ?? itemIds, itemIds);
  }, [products.data, order]);
}

export function OrderSummary({ order }: { order: OrderDto }) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <h3 className="font-semibold">Destinatario</h3>
        <p>{order.recipient.name}</p>
        <p className="text-stone-600">
          {order.recipient.address}, {order.recipient.city}
          {order.recipient.province ? `, ${order.recipient.province}` : ''}, {order.recipient.country}
        </p>
        <p className="text-stone-600">Tel. {order.recipient.phone}</p>
      </div>
      <div>
        <h3 className="font-semibold">Caja</h3>
        <p>
          {order.box.name} · {formatDims(order.box.innerLengthMm, order.box.innerWidthMm, order.box.innerHeightMm)}
        </p>
        <p className="text-stone-600">Peso estimado {formatWeight(order.totalWeightG)}</p>
      </div>
      <div className="sm:col-span-2">
        <table className="w-full text-left">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1 font-medium">Producto</th>
              <th className="py-1 text-right font-medium">Cant.</th>
              <th className="py-1 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {order.items.map((i) => (
              <tr key={i.productId}>
                <td className="py-1">{i.name}</td>
                <td className="py-1 text-right tabular-nums">{i.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatPrice(i.unitPriceCents * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 text-stone-600" colSpan={2}>
                Caja y envío
              </td>
              <td className="pt-2 text-right tabular-nums">{formatPrice(order.boxPriceCents)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={2}>Total</td>
              <td className="text-right tabular-nums">{formatPrice(order.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function OrderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.order(id) });
  const colors = useOrderColors(q.data);
  const onDone = (o: OrderDto) => {
    qc.setQueryData(['order', id], o);
    qc.invalidateQueries({ queryKey: ['products'] });
  };
  const pay = useMutation({ mutationFn: () => api.payOrder(id), onSuccess: onDone });
  const cancel = useMutation({ mutationFn: () => api.cancelOrder(id), onSuccess: onDone });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8">
        <Spinner /> Cargando orden…
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert tone="red">{(q.error as Error)?.message ?? 'Orden no encontrada'}</Alert>
      </div>
    );
  }
  const o = q.data;
  const err = (pay.error ?? cancel.error) as ApiError | null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Orden {o.numberLabel}</h1>
          <p className="text-sm text-stone-600">Creada el {new Date(o.createdAt).toLocaleString('es')}</p>
        </div>
        <Badge tone={statusTone[o.status]} className="text-sm">
          {ORDER_STATUS_LABELS[o.status]}
        </Badge>
      </div>

      {o.status === 'PAID' && (
        <Alert tone="green" className="mt-4" title="¡Pago simulado aprobado!">
          Tu caja está lista para que el almacén la prepare. Referencia {o.paymentReference}.
        </Alert>
      )}
      {o.status === 'PENDING_PAYMENT' && (
        <Alert tone="amber" className="mt-4" title="Orden guardada, pendiente de pago">
          El stock de tus productos quedó reservado. Puedes pagar ahora o cancelar para liberarlo.
        </Alert>
      )}
      {err && (
        <Alert tone="red" className="mt-4">
          {err.message}
        </Alert>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
        <Card className="p-4">
          <OrderSummary order={o} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/ordenes/${o.id}/packing-list`} className="inline-flex items-center rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700">
              Ver packing list
            </Link>
            {o.status === 'PENDING_PAYMENT' && (
              <>
                <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                  Pagar ahora (simulado)
                </Button>
                <Button variant="secondary" onClick={() => confirm('¿Cancelar la orden y liberar el stock?') && cancel.mutate()} disabled={cancel.isPending}>
                  Cancelar orden
                </Button>
              </>
            )}
            <Link to="/" className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm text-brand-700 hover:underline">
              Armar otra caja
            </Link>
          </div>
        </Card>
        <div className="h-[420px]">
          <Suspense fallback={<ViewerFallback />}>
            <BoxViewer3D box={o.box} result={o.packingPlan} colors={colors} className="h-full" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

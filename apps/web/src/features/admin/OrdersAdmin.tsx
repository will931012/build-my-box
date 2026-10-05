import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPrice, formatWeight, ORDER_STATUS_LABELS, placementsByLayer, type OrderDto, type OrderStatus } from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Alert, Badge, Button, Select, Spinner } from '../../components/ui';
import { ViewerFallback } from '../builder/BuilderPage';
import { OrderSummary, statusTone, useOrderColors } from '../orders/OrderPage';

const BoxViewer3D = lazy(() => import('../../components/BoxViewer3D'));

export function OrdersAdmin() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin', 'orders', status], queryFn: () => api.admin.orders(status || undefined) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm">
            Estado
          </label>
          <Select id="status-filter" className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Todas</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        {q.isLoading ? (
          <Spinner />
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-stone-600">No hay órdenes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {q.data!.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setSelected(o.id)}
                  aria-pressed={selected === o.id}
                  className={`w-full rounded-xl bg-white p-3 text-left text-sm ring-1 hover:ring-stone-400 ${selected === o.id ? 'ring-2 ring-brand-600' : 'ring-stone-200'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{o.numberLabel}</span>
                    <Badge tone={statusTone[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </span>
                  <span className="block text-stone-600">
                    {o.recipient.name} · {o.box.name} · {formatWeight(o.totalWeightG)} · {formatPrice(o.totalCents)}
                  </span>
                  <span className="block text-xs text-stone-500">{new Date(o.createdAt).toLocaleString('es')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>{selected ? <OrderDetail id={selected} /> : <p className="text-sm text-stone-600">Selecciona una orden para ver su plano de packing.</p>}</div>
    </div>
  );
}

function OrderDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => api.admin.order(id) });
  const colors = useOrderColors(q.data);
  const onDone = (o: OrderDto) => {
    qc.setQueryData(['admin', 'order', id], o);
    qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };
  const pay = useMutation({ mutationFn: () => api.admin.payOrder(id), onSuccess: onDone });
  const cancel = useMutation({ mutationFn: () => api.admin.cancelOrder(id), onSuccess: onDone });
  const fulfill = useMutation({ mutationFn: () => api.admin.fulfillOrder(id), onSuccess: onDone });
  if (!q.data) return <Spinner />;
  const o = q.data;
  const err = (pay.error ?? cancel.error ?? fulfill.error) as ApiError | null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{o.numberLabel}</h2>
        <Badge tone={statusTone[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
      </div>
      {err && <Alert tone="red">{err.message}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link to={`/ordenes/${o.id}/packing-list`} className="inline-flex items-center rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700">
          Packing list
        </Link>
        {o.status === 'PENDING_PAYMENT' && (
          <Button size="sm" onClick={() => pay.mutate()}>
            Marcar pagada (simulado)
          </Button>
        )}
        {o.status === 'PAID' && (
          <Button size="sm" onClick={() => confirm('¿Confirmar despacho? Se descontará el stock.') && fulfill.mutate()}>
            Marcar empacada / despachada
          </Button>
        )}
        {(o.status === 'PENDING_PAYMENT' || o.status === 'PAID') && (
          <Button size="sm" variant="danger" onClick={() => confirm('¿Cancelar la orden y liberar el stock reservado?') && cancel.mutate()}>
            Cancelar y liberar stock
          </Button>
        )}
      </div>
      <OrderSummary order={o} />
      <div className="h-[360px]">
        <Suspense fallback={<ViewerFallback />}>
          <BoxViewer3D box={o.box} result={o.packingPlan} colors={colors} className="h-full" />
        </Suspense>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Plano por capas ({o.packingPlan.algorithm})</summary>
        <ul className="mt-1 list-disc pl-5 text-stone-700">
          {placementsByLayer(o.packingPlan).map((l) => (
            <li key={l.layer}>
              Capa {l.layer}: {l.placements.map((p) => p.name).join(', ')}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

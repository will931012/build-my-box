import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatDims,
  formatWeight,
  mmToCm,
  ORDER_STATUS_LABELS,
  ORIENTATION_LABELS,
  packingInstructions,
  usableWeightG,
} from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Alert, Button, Spinner, Textarea } from '../../components/ui';
import { LayerDiagrams } from '../../components/LayerDiagram';
import { useOrderColors } from './OrderPage';

/** Packing list imprimible para el almacén. */
export function PackingListPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.order(id) });
  const colors = useOrderColors(q.data);
  const [customs, setCustoms] = useState('');
  useEffect(() => {
    if (q.data) setCustoms(q.data.customsDeclaration);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api.updateCustoms(id, customs),
    onSuccess: (o) => qc.setQueryData(['order', id], o),
  });

  // Numeración de unidades en orden de colocación (capa por capa).
  const numbering = useMemo(() => {
    const m = new Map<string, number>();
    const sorted = [...(q.data?.packingPlan.placements ?? [])].sort((a, b) => a.layer - b.layer || a.z - b.z || a.y - b.y || a.x - b.x);
    sorted.forEach((p, i) => m.set(p.unitId, i + 1));
    return m;
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8">
        <Spinner /> Cargando…
      </div>
    );
  }
  if (!q.data) return <Alert tone="red">Orden no encontrada</Alert>;
  const o = q.data;
  const plan = o.packingPlan;
  const editable = o.status !== 'CANCELLED' && o.status !== 'FULFILLED';
  const sortedPlacements = [...plan.placements].sort((a, b) => (numbering.get(a.unitId) ?? 0) - (numbering.get(b.unitId) ?? 0));

  return (
    <div className="mx-auto max-w-4xl bg-white px-4 py-6 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>Imprimir</Button>
        <Link to={`/ordenes/${o.id}`} className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-brand-700 hover:underline">
          ← Volver a la orden
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-stone-900 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Packing list · Build My Box</p>
          <h1 className="text-2xl font-bold">Orden {o.numberLabel}</h1>
          <p className="text-sm">Estado: {ORDER_STATUS_LABELS[o.status]} · {new Date(o.createdAt).toLocaleString('es')}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{o.box.name}</p>
          <p>Interior {formatDims(o.box.innerLengthMm, o.box.innerWidthMm, o.box.innerHeightMm)}</p>
          <p>
            Peso estimado <strong>{formatWeight(o.totalWeightG)}</strong> (máx. útil {formatWeight(usableWeightG(o.box))})
          </p>
        </div>
      </header>

      <section className="mt-4 grid gap-4 text-sm sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="font-semibold">Destinatario (simulado)</h2>
          <p>{o.recipient.name}</p>
          <p>
            {o.recipient.address}, {o.recipient.city}
            {o.recipient.province ? `, ${o.recipient.province}` : ''}, {o.recipient.country}
          </p>
          <p>Tel. {o.recipient.phone}</p>
          {o.recipient.notes && <p className="text-stone-600">Notas: {o.recipient.notes}</p>}
        </div>
        <div>
          <h2 className="font-semibold">Productos</h2>
          <table className="w-full">
            <tbody>
              {o.items.map((i) => (
                <tr key={i.productId} className="border-b border-stone-100">
                  <td className="py-0.5 pr-2">
                    <span className="mr-1 inline-block size-4 border border-stone-500 align-middle" aria-hidden="true" /> {i.name}
                    <span className="block text-xs text-stone-500">SKU {i.sku}</span>
                  </td>
                  <td className="py-0.5 text-right font-semibold tabular-nums">× {i.quantity}</td>
                  <td className="py-0.5 pl-2 text-right text-xs tabular-nums">{formatWeight(i.weightG * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="font-semibold">Instrucciones de empaque</h2>
        <ol className="mt-1 list-decimal pl-5 text-sm">
          {packingInstructions(plan).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {plan.requiresReview && (
          <p className="mt-2 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
            ⚠ Acomodo estimado por el sistema: requiere revisión del personal de empaque antes de cerrar.
          </p>
        )}
      </section>

      <section className="mt-5 break-before-auto">
        <h2 className="mb-2 font-semibold">Plano por capas</h2>
        <LayerDiagrams box={o.box} result={plan} colors={colors} numbering={numbering} />
      </section>

      <section className="mt-5">
        <h2 className="font-semibold">Posiciones</h2>
        <p className="text-xs text-stone-500">Origen (0 · 0 · 0): esquina superior izquierda del plano, sobre el piso de la caja. x = largo, y = ancho, z = alto (cm).</p>
        <div className="overflow-x-auto">
          <table className="mt-1 w-full text-left text-xs">
            <thead className="border-b border-stone-400">
              <tr>
                <th className="py-1">#</th>
                <th>Producto</th>
                <th>Capa</th>
                <th>x · y · z</th>
                <th>Medidas usadas</th>
                <th>Orientación</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlacements.map((p) => (
                <tr key={p.unitId} className="border-b border-stone-100 align-top">
                  <td className="py-0.5 font-semibold">{numbering.get(p.unitId)}</td>
                  <td>{p.name}</td>
                  <td>{p.layer}</td>
                  <td className="tabular-nums">
                    {mmToCm(p.x)} · {mmToCm(p.y)} · {mmToCm(p.z)}
                  </td>
                  <td>{formatDims(p.lengthMm, p.widthMm, p.heightMm)}</td>
                  <td>{ORIENTATION_LABELS[p.orientation] ?? p.rotationLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 break-inside-avoid">
        <h2 className="font-semibold">Declaración de contenido internacional</h2>
        <p className="text-xs text-stone-600">
          Borrador editable. La aplicación no garantiza el cumplimiento de normas aduanales ni de restricciones alimentarias: el personal debe
          verificarla según las reglas vigentes del país de destino.
        </p>
        <label htmlFor="customs" className="sr-only">
          Declaración de contenido
        </label>
        <Textarea
          id="customs"
          rows={10}
          className="mt-2 font-mono text-xs print:hidden"
          value={customs}
          onChange={(e) => setCustoms(e.target.value)}
          disabled={!editable}
        />
        <pre className="mt-2 hidden whitespace-pre-wrap rounded border border-stone-300 p-2 font-mono text-xs print:block">{customs}</pre>
        <div className="no-print mt-2 flex items-center gap-2">
          <Button onClick={() => save.mutate()} disabled={!editable || save.isPending || customs === o.customsDeclaration}>
            Guardar declaración
          </Button>
          {save.isSuccess && customs === o.customsDeclaration && <span className="text-sm text-emerald-700">Guardada.</span>}
          {save.error && <span className="text-sm text-red-700">{(save.error as ApiError).message}</span>}
        </div>
      </section>

      <footer className="mt-6 grid grid-cols-2 gap-6 text-sm print:mt-10">
        <div className="border-t border-stone-500 pt-1">Empacado por</div>
        <div className="border-t border-stone-500 pt-1">Peso verificado en báscula (kg)</div>
      </footer>
    </div>
  );
}

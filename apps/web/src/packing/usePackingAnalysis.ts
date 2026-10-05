import { useEffect, useMemo, useRef, useState } from 'react';
import type { Box, CartLine, Product } from '@bmb/shared';
import { analyze, type Analysis, type AnalysisRequest } from './analyze';

let worker: Worker | null | undefined;
const listeners = new Set<(msg: { ok: boolean; analysis?: Analysis; key?: string; error?: string }) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./packing.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => listeners.forEach((l) => l(e.data));
  } catch {
    worker = null; // sin soporte de workers: se calcula en el hilo principal
  }
  return worker;
}

/**
 * Recalcula el acomodo completo y la "capacidad" del catálogo cada vez que cambia
 * la caja o el carrito. `pending` es true mientras el resultado no corresponde al
 * carrito actual: en ese lapso no se permite agregar productos.
 */
export function usePackingAnalysis(box: Box | undefined, lines: CartLine<Product>[], catalog: Product[], catalogVersion: number) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestKey = useRef('');

  const key = useMemo(
    () => (box ? `${box.id}|${box.safetyMarginPct}|${lines.map((l) => `${l.product.id}:${l.quantity}`).join(',')}|${catalogVersion}` : ''),
    [box, lines, catalogVersion],
  );

  useEffect(() => {
    const onMsg = (msg: { ok: boolean; analysis?: Analysis; key?: string; error?: string }) => {
      const k = msg.analysis?.key ?? msg.key;
      if (k !== latestKey.current) return; // respuesta obsoleta
      if (msg.ok && msg.analysis) {
        setAnalysis(msg.analysis);
        setError(null);
      } else setError(msg.error ?? 'Error en el motor de packing');
    };
    listeners.add(onMsg);
    return () => {
      listeners.delete(onMsg);
    };
  }, []);

  useEffect(() => {
    if (!box || !key) return;
    latestKey.current = key;
    const qty = new Map(lines.map((l) => [l.product.id, l.quantity]));
    const req: AnalysisRequest = {
      key,
      box,
      lines,
      candidates: catalog.filter((p) => p.available > (qty.get(p.id) ?? 0)),
    };
    const w = getWorker();
    if (w) w.postMessage(req);
    else {
      try {
        setAnalysis(analyze(req));
      } catch (e) {
        setError(String(e));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { analysis, pending: !analysis || analysis.key !== key, error };
}

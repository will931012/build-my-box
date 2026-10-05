import { lazy, Suspense, useEffect, useState } from 'react';
import { FAILURE_LABELS, formatDims } from '@bmb/shared';
import { Alert, Card, Spinner } from '../../components/ui';
import { useCart } from '../../store/cart';
import { BoxSelector } from './BoxSelector';
import { Catalog } from './Catalog';
import { MiniBoxBar } from './MiniBoxBar';
import { SummaryPanel } from './SummaryPanel';
import { useBuilder } from './useBuilder';

const BoxViewer3D = lazy(() => import('../../components/BoxViewer3D'));

export function ViewerFallback() {
  return (
    <div className="flex h-full items-center justify-center gap-2 rounded-2xl bg-stone-200/60 text-sm text-stone-600">
      <Spinner /> Cargando vista 3D…
    </div>
  );
}

export function BuilderPage() {
  const state = useBuilder();
  const { box, boxes, boxesQ, analysis, pending, products, quantities, engineError } = state;
  const { setBox, add } = useCart();
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 5000);
    return () => clearTimeout(t);
  }, [announcement]);

  // ¿El visor grande está en pantalla? Si no, se pausa y aparece la mini caja flotante.
  const [viewerEl, setViewerEl] = useState<HTMLDivElement | null>(null);
  const [viewerVisible, setViewerVisible] = useState(true);
  useEffect(() => {
    if (!viewerEl || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setViewerVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(viewerEl);
    return () => io.disconnect();
  }, [viewerEl]);
  const showBox = () => viewerEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /** Agrega solo si el motor confirma que cabe; si no, explica por qué. */
  const handleAdd = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const qty = quantities[id] ?? 0;
    if (qty >= p.available) {
      setAnnouncement(`No hay más stock de ${p.name}.`);
      return;
    }
    if (pending || !analysis) {
      setAnnouncement('Espera un momento: recalculando el acomodo.');
      return;
    }
    const check = analysis.additions[id];
    if (!check?.fits) {
      setAnnouncement(`${p.name} no cabe. ${check?.code ? FAILURE_LABELS[check.code] + ': ' : ''}${check?.message ?? ''}`);
      return;
    }
    add(id);
    setAnnouncement(`${p.name} agregado a la caja.`);
  };

  if (boxesQ.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-stone-600">
        <Spinner /> Cargando…
      </div>
    );
  }
  if (boxesQ.isError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert tone="red" title="No se pudo conectar con la API">
          {(boxesQ.error as Error).message}
        </Alert>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-[1680px] px-3 py-4 sm:px-4 ${box ? 'pb-32 xl:pb-4' : ''}`}>
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Construye tu caja</h1>
        <p className="text-sm text-stone-600">
          Agrega productos y el sistema los acomoda automáticamente y de forma segura. Solo podrás agregar lo que realmente cabe.
        </p>
      </div>

      {!box ? (
        <Card className="p-4 sm:p-6">
          <BoxSelector boxes={boxes} onSelect={setBox} large />
        </Card>
      ) : (
        <>
          <details className="mb-3 rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{box.name}</span>{' '}
              <span className="text-stone-600">· {formatDims(box.innerLengthMm, box.innerWidthMm, box.innerHeightMm)} · cambiar caja</span>
            </summary>
            <div className="py-2">
              <BoxSelector boxes={boxes} selectedId={box.id} onSelect={setBox} />
            </div>
          </details>

          <p className="sr-only" aria-live="assertive">
            {announcement}
          </p>
          {announcement && (
            <div className="mb-3" aria-hidden="true">
              <Alert tone={announcement.includes('agregado') ? 'green' : 'amber'}>{announcement}</Alert>
            </div>
          )}
          {engineError && (
            <Alert tone="red" title="Error en el motor de packing" className="mb-3">
              {engineError}
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.45fr)_360px]">
            <div className="order-1 xl:order-2">
              <div ref={setViewerEl} className="h-[52vh] min-h-[320px] lg:h-[60vh] xl:sticky xl:top-[68px] xl:h-[calc(100vh-84px)]">
                {analysis ? (
                  <Suspense fallback={<ViewerFallback />}>
                    <BoxViewer3D box={box} result={analysis.result} colors={state.colors} className="h-full" paused={!viewerVisible} />
                  </Suspense>
                ) : (
                  <ViewerFallback />
                )}
              </div>
            </div>
            <SummaryPanel state={state} onAdd={handleAdd} className="order-2 xl:sticky xl:top-[68px] xl:order-3 xl:max-h-[calc(100vh-84px)] xl:self-start xl:overflow-y-auto" />
            <Catalog state={state} onAdd={handleAdd} className="order-3 lg:col-span-2 xl:order-1 xl:col-span-1" />
          </div>
          {!viewerVisible && <MiniBoxBar state={state} announcement={announcement} onShowBox={showBox} />}
        </>
      )}
    </div>
  );
}

/// <reference lib="webworker" />
// Ejecuta el motor de packing fuera del hilo principal para que la UI y la
// animación 3D no se traben mientras se evalúa todo el catálogo.
import { analyze, type AnalysisRequest } from './analyze';

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  try {
    self.postMessage({ ok: true, analysis: analyze(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, key: e.data.key, error: String(err) });
  }
};

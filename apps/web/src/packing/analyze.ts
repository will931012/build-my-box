import { checkAdditions, packCart, type AdditionCheck, type Box, type CartLine, type PackableProduct, type PackingResult } from '@bmb/shared';

export interface AnalysisRequest {
  key: string;
  box: Box;
  lines: CartLine[];
  candidates: PackableProduct[];
}

export interface Analysis {
  key: string;
  result: PackingResult;
  /** ¿Cabe una unidad más de cada candidato? (mismo motor que el servidor). */
  additions: Record<string, AdditionCheck>;
  ms: number;
}

export function analyze(req: AnalysisRequest): Analysis {
  const t0 = performance.now();
  const result = packCart(req.box, req.lines);
  const additions = checkAdditions(
    req.box,
    req.lines,
    req.candidates.map((product) => ({ product })),
  );
  return { key: req.key, result, additions, ms: performance.now() - t0 };
}

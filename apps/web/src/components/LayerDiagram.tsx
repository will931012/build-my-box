import { mmToCm, placementsByLayer, type Box, type PackingResult } from '@bmb/shared';

/**
 * Plano imprimible: vista superior de cada capa con los productos numerados.
 * Complementa la vista 3D (que no se imprime bien).
 */
export function LayerDiagrams({ box, result, colors, numbering }: { box: Box; result: PackingResult; colors?: Map<string, string>; numbering: Map<string, number> }) {
  const layers = placementsByLayer(result);
  const L = box.innerLengthMm;
  const W = box.innerWidthMm;
  return (
    <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
      {layers.map(({ layer, placements }) => (
        <figure key={layer} className="break-inside-avoid rounded-lg p-2 ring-1 ring-stone-300">
          <figcaption className="mb-1 text-xs font-semibold">
            Capa {layer}
            {layer === 1 ? ' (fondo)' : ''} · vista superior · {mmToCm(L)} × {mmToCm(W)} cm
          </figcaption>
          <svg viewBox={`-10 -10 ${L + 20} ${W + 20}`} className="w-full" role="img" aria-label={`Plano de la capa ${layer}`}>
            <rect x={0} y={0} width={L} height={W} fill="#fafaf9" stroke="#57534e" strokeWidth={3} />
            {placements.map((p) => {
              const n = numbering.get(p.unitId);
              return (
                <g key={p.unitId}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.lengthMm}
                    height={p.widthMm}
                    fill={colors?.get(p.productId) ?? '#d6d3d1'}
                    fillOpacity={0.75}
                    stroke="#1c1917"
                    strokeWidth={2}
                  />
                  <text
                    x={p.x + p.lengthMm / 2}
                    y={p.y + p.widthMm / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.max(14, Math.min(28, Math.min(p.lengthMm, p.widthMm) / 2.5))}
                    fontWeight={700}
                    fill="#1c1917"
                  >
                    {n}
                  </text>
                </g>
              );
            })}
          </svg>
        </figure>
      ))}
    </div>
  );
}

/**
 * Visualización 3D de la caja con el acomodo REAL devuelto por el motor de packing.
 *
 * Convención de ejes: el motor usa x = largo, y = ancho, z = alto (vertical).
 * Three.js usa Y vertical, así que se mapea: X3 = x, Y3 = z, Z3 = y.
 * Escala: 1 unidad 3D = 10 cm.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, Edges, Line } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import { Vector3 } from 'three';
import {
  describePosition,
  formatDims,
  formatPercent,
  formatWeight,
  ORIENTATION_LABELS,
  type Box,
  type PackingResult,
  type Placement,
} from '@bmb/shared';
import { Button, cx } from './ui';

const S = 0.01; // mm → unidades 3D

type View = 'perspective' | 'front' | 'top' | 'side';
const VIEWS: { id: View; label: string }[] = [
  { id: 'perspective', label: 'Perspectiva' },
  { id: 'front', label: 'Frontal' },
  { id: 'top', label: 'Superior' },
  { id: 'side', label: 'Lateral' },
];

function centerOf(p: Placement, box: Box): [number, number, number] {
  return [
    (p.x + p.lengthMm / 2 - box.innerLengthMm / 2) * S,
    (p.z + p.heightMm / 2) * S,
    (p.y + p.widthMm / 2 - box.innerWidthMm / 2) * S,
  ];
}

function UnitMesh({
  p,
  box,
  color,
  selected,
  exiting,
  onSelect,
}: {
  p: Placement;
  box: Box;
  color: string;
  selected: boolean;
  exiting?: boolean;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<Mesh>(null);
  const target = useMemo(() => new Vector3(...centerOf(p, box)), [p, box]);
  const scale = useRef(exiting ? 1 : 0.01);
  const [hover, setHover] = useState(false);

  // Posición inicial: cae desde arriba de la caja (no se pasa `position` como prop
  // para que React no la reinicie en cada render y la interpolación sea suave).
  useLayoutEffect(() => {
    if (ref.current && !exiting) ref.current.position.set(target.x, target.y + box.innerHeightMm * S * 0.8, target.z);
    else if (ref.current) ref.current.position.copy(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const k = 1 - Math.exp(-dt * 9);
    if (!exiting) m.position.lerp(target, k);
    const goal = exiting ? 0.001 : 1;
    scale.current += (goal - scale.current) * k;
    m.scale.setScalar(scale.current);
  });

  const w = p.lengthMm * S * 0.985;
  const h = p.heightMm * S * 0.985;
  const d = p.widthMm * S * 0.985;

  return (
    <mesh
      ref={ref}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect?.(p.unitId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        emissive={selected ? '#ffffff' : hover ? '#888888' : '#000000'}
        emissiveIntensity={selected ? 0.35 : hover ? 0.15 : 0}
        transparent={exiting}
        opacity={exiting ? 0.6 : 1}
      />
      <Edges color={selected ? '#000000' : '#292524'} lineWidth={selected ? 2 : 1} />
    </mesh>
  );
}

function BoxShell({ box, result }: { box: Box; result: PackingResult }) {
  const L = box.innerLengthMm * S;
  const W = box.innerWidthMm * S;
  const H = box.innerHeightMm * S;
  const uh = result.usableRegion.heightMm * S;
  const ux = result.usableRegion.lengthMm * S;
  const uz = result.usableRegion.widthMm * S;
  const ox = (result.usableRegion.offset.x * S) - L / 2;
  const oz = (result.usableRegion.offset.y * S) - W / 2;
  return (
    <group>
      {/* Paredes semitransparentes */}
      <mesh position={[0, H / 2, 0]} renderOrder={10}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color="#d6a46b" transparent opacity={0.12} depthWrite={false} />
        <Edges color="#9a3412" />
      </mesh>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#c49a6c" />
      </mesh>
      {/* Límite útil (descontando el margen de seguridad) */}
      <Line
        points={[
          [ox, uh, oz],
          [ox + ux, uh, oz],
          [ox + ux, uh, oz + uz],
          [ox, uh, oz + uz],
          [ox, uh, oz],
        ]}
        color="#ea580c"
        dashed
        dashSize={0.15}
        gapSize={0.1}
        lineWidth={1.5}
      />
    </group>
  );
}

/** Animación de salida: las unidades quitadas se encogen antes de desaparecer. */
function useExiting(result: PackingResult): Placement[] {
  const prev = useRef(new Map<string, Placement>());
  const [exiting, setExiting] = useState<Placement[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const curr = new Map(result.placements.map((p) => [p.unitId, p]));
    const gone = [...prev.current.values()].filter((p) => !curr.has(p.unitId));
    prev.current = curr;
    setExiting((e) => [...e.filter((x) => !curr.has(x.unitId)), ...gone]);
    if (gone.length > 0) {
      timers.current.push(setTimeout(() => setExiting((e) => e.filter((x) => !gone.includes(x))), 500));
    }
  }, [result]);
  return exiting;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 9, 6]} intensity={1.4} />
      <directionalLight position={[-6, 4, -5]} intensity={0.4} />
      <hemisphereLight args={['#fff7ed', '#78716c', 0.35]} />
    </>
  );
}

function Scene({
  box,
  result,
  colors,
  selected,
  onSelect,
  view,
}: {
  box: Box;
  result: PackingResult;
  colors: Map<string, string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  view: { id: View; n: number };
}) {
  const controls = useRef<CameraControls>(null);
  const L = box.innerLengthMm * S;
  const W = box.innerWidthMm * S;
  const H = box.innerHeightMm * S;
  const exiting = useExiting(result);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const dist = Math.max(L, W, H) * 2.1;
    const ty = H * 0.4;
    switch (view.id) {
      case 'front':
        c.setLookAt(0, ty, dist, 0, ty, 0, true);
        break;
      case 'top':
        c.setLookAt(0, dist * 1.1, 0.001, 0, 0, 0, true);
        break;
      case 'side':
        c.setLookAt(dist, ty, 0, 0, ty, 0, true);
        break;
      default:
        c.setLookAt(L * 1.1, H * 1.6, W * 2.1, 0, H * 0.35, 0, true);
    }
  }, [view, L, W, H]);

  return (
    <>
      <Lights />
      <BoxShell box={box} result={result} />
      {result.placements.map((p) => (
        <UnitMesh
          key={p.unitId}
          p={p}
          box={box}
          color={colors.get(p.productId) ?? '#a8a29e'}
          selected={selected === p.unitId}
          onSelect={onSelect}
        />
      ))}
      {exiting.map((p) => (
        <UnitMesh key={`x-${p.unitId}`} p={p} box={box} color={colors.get(p.productId) ?? '#a8a29e'} selected={false} exiting />
      ))}
      <CameraControls ref={controls} makeDefault minDistance={1.5} maxDistance={25} />
    </>
  );
}

export default function BoxViewer3D({
  box,
  result,
  colors,
  className,
  compact = false,
  paused = false,
}: {
  box: Box;
  result: PackingResult;
  colors: Map<string, string>;
  className?: string;
  compact?: boolean;
  /** Detiene el render (p. ej. cuando el visor salió de la pantalla) para ahorrar batería. */
  paused?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<{ id: View; n: number }>({ id: 'perspective', n: 0 });
  const sel = result.placements.find((p) => p.unitId === selected) ?? null;
  const selQty = sel ? result.placements.filter((p) => p.productId === sel.productId).length : 0;

  useEffect(() => {
    if (selected && !sel) setSelected(null);
  }, [selected, sel]);

  const L = box.innerLengthMm * S;
  const H = box.innerHeightMm * S;
  const W = box.innerWidthMm * S;

  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-stone-200', className)}>
      <p className="sr-only" aria-live="polite">
        Vista 3D de la caja {box.name}: {result.placements.length} productos colocados. Usa los botones de vista para cambiar el ángulo.
      </p>
      <Canvas
        camera={{ position: [L * 1.1, H * 1.6, W * 2.1], fov: 40 }}
        dpr={[1, 2]}
        frameloop={paused ? 'never' : 'always'}
        onPointerMissed={() => setSelected(null)}
        aria-hidden="true"
      >
        <Suspense fallback={null}>
          <Scene box={box} result={result} colors={colors} selected={selected} onSelect={setSelected} view={view} />
        </Suspense>
      </Canvas>

      {/* Controles de vista */}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1" role="toolbar" aria-label="Vistas de la caja">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={view.id === v.id ? 'primary' : 'secondary'}
            onClick={() => setView((s) => ({ id: v.id, n: s.n + 1 }))}
            aria-pressed={view.id === v.id}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {/* Aviso de acomodo estimado */}
      {!compact && (
        <div className="pointer-events-none absolute left-2 top-12 max-w-[calc(100%-1rem)]">
          {result.requiresReview ? (
            <span className="pointer-events-auto inline-block rounded-lg bg-amber-100/95 px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-300" title={result.reviewReasons.join('\n')}>
              ⚠ Acomodo estimado · requiere revisión del personal de empaque
            </span>
          ) : (
            <span className="inline-block rounded-lg bg-white/90 px-2 py-1 text-xs text-stone-600 ring-1 ring-stone-200">
              Acomodo estimado por el sistema
            </span>
          )}
        </div>
      )}

      {result.placements.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-stone-600">
          Caja vacía · {formatDims(box.innerLengthMm, box.innerWidthMm, box.innerHeightMm)} interior
        </div>
      )}

      {/* Detalle del producto seleccionado */}
      {sel && (
        <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/95 p-3 text-sm shadow-lg ring-1 ring-stone-200 sm:left-2 sm:right-auto sm:w-80" role="dialog" aria-label={`Detalle de ${sel.name}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">
              <span className="mr-1.5 inline-block size-3 rounded-sm align-middle ring-1 ring-black/20" style={{ background: colors.get(sel.productId) }} />
              {sel.name}
            </p>
            <button className="rounded px-1 text-stone-500 hover:bg-stone-100" onClick={() => setSelected(null)} aria-label="Cerrar detalle">
              ✕
            </button>
          </div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-stone-700">
            <dt className="text-stone-500">Cantidad en caja</dt>
            <dd>{selQty}</dd>
            <dt className="text-stone-500">Peso (unidad)</dt>
            <dd>{formatWeight(sel.weightG)}</dd>
            <dt className="text-stone-500">Posición</dt>
            <dd>{describePosition(sel)}</dd>
            <dt className="text-stone-500">Medidas usadas</dt>
            <dd>{formatDims(sel.lengthMm, sel.widthMm, sel.heightMm)}</dd>
            <dt className="text-stone-500">Orientación</dt>
            <dd>{ORIENTATION_LABELS[sel.orientation] ?? sel.rotationLabel}</dd>
            <dt className="text-stone-500">Capa</dt>
            <dd>
              {sel.layer} · apoyo {formatPercent(sel.supportRatio)}
            </dd>
            <dt className="text-stone-500">Carga encima</dt>
            <dd>{sel.loadCapacityG === 0 ? 'No admite peso encima' : `${formatWeight(sel.loadOnTopG)} de ${formatWeight(sel.loadCapacityG)}`}</dd>
          </dl>
          <p className="mt-1.5 text-xs text-stone-600">{sel.reason}</p>
        </div>
      )}
    </div>
  );
}

/** Gira lentamente la escena del mini visor para que se aprecie el volumen. */
function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>{children}</group>;
}

function LookAt({ y }: { y: number }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => camera.lookAt(0, y, 0), [camera, y]);
  return null;
}

/**
 * Versión pequeña y no interactiva del visor (para la barra flotante en móvil).
 * Muestra el mismo acomodo, con las mismas animaciones al agregar o quitar.
 */
export function MiniBoxViewer({ box, result, colors, className }: { box: Box; result: PackingResult; colors: Map<string, string>; className?: string }) {
  const L = box.innerLengthMm * S;
  const H = box.innerHeightMm * S;
  const W = box.innerWidthMm * S;
  const d = Math.max(L, W, H);
  const exiting = useExiting(result);
  return (
    <div className={cx('pointer-events-none overflow-hidden rounded-xl bg-gradient-to-b from-stone-50 to-stone-200', className)} aria-hidden="true">
      <Canvas camera={{ position: [d * 1.25, d * 1.25, d * 1.6], fov: 34 }} dpr={[1, 1.5]}>
        <LookAt y={H * 0.4} />
        <Lights />
        <Turntable>
          <BoxShell box={box} result={result} />
          {result.placements.map((p) => (
            <UnitMesh key={p.unitId} p={p} box={box} color={colors.get(p.productId) ?? '#a8a29e'} selected={false} />
          ))}
          {exiting.map((p) => (
            <UnitMesh key={`x-${p.unitId}`} p={p} box={box} color={colors.get(p.productId) ?? '#a8a29e'} selected={false} exiting />
          ))}
        </Turntable>
      </Canvas>
    </div>
  );
}

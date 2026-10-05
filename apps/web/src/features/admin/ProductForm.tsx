import { useState, type FormEvent } from 'react';
import {
  LEVEL_LABELS,
  ORIENTATION_LABELS,
  ORIENTATIONS,
  PACKAGING_LABELS,
  PACKAGING_TYPES,
  productInputSchema,
  UPRIGHT_ORIENTATIONS,
  type Orientation,
  type Product,
  type ProductInput,
} from '@bmb/shared';
import { Alert, Button, Field, Input, Select, Textarea } from '../../components/ui';

type Errors = Record<string, string>;

const blank: ProductInput = {
  sku: '',
  name: '',
  description: '',
  category: '',
  imageUrl: null,
  priceCents: 0,
  stock: 0,
  lengthMm: 100,
  widthMm: 100,
  heightMm: 100,
  weightG: 500,
  packagingType: 'BOX',
  allowedOrientations: [...ORIENTATIONS],
  canSupportWeight: true,
  maxLoadOnTopG: 5000,
  fragility: 0,
  compressibility: 0,
  shippingRestrictions: '',
  active: true,
};

export function toProductInput(p: Product): ProductInput {
  return {
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    stock: p.stock,
    lengthMm: p.lengthMm,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    weightG: p.weightG,
    packagingType: p.packagingType,
    allowedOrientations: p.allowedOrientations,
    canSupportWeight: p.canSupportWeight,
    maxLoadOnTopG: p.maxLoadOnTopG,
    fragility: p.fragility,
    compressibility: p.compressibility,
    shippingRestrictions: p.shippingRestrictions ?? '',
    active: p.active,
  };
}

export function ProductForm({
  initial,
  categories,
  onSubmit,
  submitting,
  serverError,
}: {
  initial?: ProductInput;
  categories: string[];
  onSubmit: (p: ProductInput) => void;
  submitting: boolean;
  serverError?: string;
}) {
  const [v, setV] = useState<ProductInput>(initial ?? blank);
  const [price, setPrice] = useState(((initial ?? blank).priceCents / 100).toFixed(2));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof ProductInput>(k: K, val: ProductInput[K]) => setV((s) => ({ ...s, [k]: val }));
  const num = (k: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value === '' ? 0 : Number(e.target.value)) as never);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const candidate = { ...v, priceCents: Math.round(Number(price.replace(',', '.')) * 100) };
    const r = productInputSchema.safeParse(candidate);
    if (!r.success) {
      const errs: Errors = {};
      for (const i of r.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(r.data);
  };

  const toggleOrientation = (o: Orientation) =>
    set('allowedOrientations', v.allowedOrientations.includes(o) ? v.allowedOrientations.filter((x) => x !== o) : [...v.allowedOrientations, o]);

  const numberField = (k: keyof ProductInput, label: string, hint?: string) => (
    <Field label={label} htmlFor={`p-${k}`} error={errors[k]} hint={hint}>
      <Input id={`p-${k}`} type="number" min={0} step={1} value={String(v[k] ?? '')} onChange={num(k)} aria-invalid={!!errors[k]} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label="SKU" htmlFor="p-sku" error={errors.sku}>
        <Input id="p-sku" value={v.sku} onChange={(e) => set('sku', e.target.value)} aria-invalid={!!errors.sku} />
      </Field>
      <Field label="Nombre" htmlFor="p-name" error={errors.name}>
        <Input id="p-name" value={v.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descripción" htmlFor="p-description">
          <Textarea id="p-description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>
      <Field label="Categoría" htmlFor="p-category" error={errors.category}>
        <Input id="p-category" list="categories" value={v.category} onChange={(e) => set('category', e.target.value)} aria-invalid={!!errors.category} />
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="URL de la foto (opcional)" htmlFor="p-imageUrl" error={errors.imageUrl} hint="Si se deja vacío se muestra una ilustración.">
        <Input id="p-imageUrl" type="url" value={v.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || null)} />
      </Field>
      <Field label="Precio (USD)" htmlFor="p-price" error={errors.priceCents}>
        <Input id="p-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      {numberField('stock', 'Stock disponible (unidades)')}

      <fieldset className="grid gap-3 rounded-xl p-3 ring-1 ring-stone-200 sm:col-span-2 sm:grid-cols-4">
        <legend className="px-1 text-sm font-semibold">Medidas y peso de envío</legend>
        {numberField('lengthMm', 'Largo (mm)', `${v.lengthMm / 10} cm`)}
        {numberField('widthMm', 'Ancho (mm)', `${v.widthMm / 10} cm`)}
        {numberField('heightMm', 'Alto (mm)', `${v.heightMm / 10} cm`)}
        {numberField('weightG', 'Peso (g)', `${v.weightG / 1000} kg`)}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl p-3 ring-1 ring-stone-200 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Reglas de empaque</legend>
        <Field label="Tipo de empaque" htmlFor="p-packagingType">
          <Select id="p-packagingType" value={v.packagingType} onChange={(e) => set('packagingType', e.target.value as ProductInput['packagingType'])}>
            {PACKAGING_TYPES.map((t) => (
              <option key={t} value={t}>
                {PACKAGING_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand-600" checked={v.canSupportWeight} onChange={(e) => set('canSupportWeight', e.target.checked)} />
            Puede soportar peso encima
          </label>
          {v.canSupportWeight && numberField('maxLoadOnTopG', 'Peso máximo encima (g)', 'Carga acumulada de todo lo que quede encima.')}
        </div>
        <Field label="Fragilidad" htmlFor="p-fragility">
          <Select id="p-fragility" value={v.fragility} onChange={(e) => set('fragility', Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {LEVEL_LABELS[n as 0]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Compresibilidad" htmlFor="p-compressibility">
          <Select id="p-compressibility" value={v.compressibility} onChange={(e) => set('compressibility', Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {LEVEL_LABELS[n as 0]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="text-sm font-medium text-stone-700">Orientaciones permitidas</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => set('allowedOrientations', [...ORIENTATIONS])}>
              Cualquiera
            </Button>
            <Button size="sm" variant="secondary" onClick={() => set('allowedOrientations', [...UPRIGHT_ORIENTATIONS])}>
              Solo vertical (este lado arriba)
            </Button>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {ORIENTATIONS.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-brand-600" checked={v.allowedOrientations.includes(o)} onChange={() => toggleOrientation(o)} />
                <span className="font-mono text-xs text-stone-500">{o}</span> {ORIENTATION_LABELS[o]}
              </label>
            ))}
          </div>
          {errors.allowedOrientations && <p className="text-xs text-red-700">{errors.allowedOrientations}</p>}
        </div>
        <div className="sm:col-span-2">
          <Field label="Restricciones o advertencias de envío" htmlFor="p-shippingRestrictions" hint="Se muestran al cliente y en la packing list. No sustituyen la revisión aduanal.">
            <Textarea id="p-shippingRestrictions" rows={2} value={v.shippingRestrictions} onChange={(e) => set('shippingRestrictions', e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand-600" checked={v.active} onChange={(e) => set('active', e.target.checked)} />
        Producto activo (visible en el catálogo)
      </label>

      {serverError && (
        <div className="sm:col-span-2">
          <Alert tone="red">{serverError}</Alert>
        </div>
      )}
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={submitting}>
          Guardar producto
        </Button>
      </div>
    </form>
  );
}

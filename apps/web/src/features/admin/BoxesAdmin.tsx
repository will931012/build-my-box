import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boxInputSchema, formatDims, formatPrice, formatWeight, usableWeightG, type Box, type BoxInput } from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Alert, Badge, Button, Field, Input, Spinner, Textarea } from '../../components/ui';

const blank: BoxInput = {
  name: '',
  description: '',
  innerLengthMm: 500,
  innerWidthMm: 400,
  innerHeightMm: 400,
  maxWeightG: 25000,
  priceCents: 3500,
  safetyMarginPct: 10,
  active: true,
};

export function BoxesAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'boxes'], queryFn: api.admin.boxes });
  const [editing, setEditing] = useState<Box | 'new' | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'boxes'] });
    qc.invalidateQueries({ queryKey: ['boxes'] });
  };
  const save = useMutation({
    mutationFn: (b: BoxInput) => (editing && editing !== 'new' ? api.admin.updateBox(editing.id, b) : api.admin.createBox(b)),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.admin.deleteBox(id), onSuccess: refresh });

  return (
    <div>
      <div className="mb-3">
        <Button
          onClick={() => {
            save.reset();
            setEditing('new');
          }}
        >
          + Nueva caja
        </Button>
      </div>
      {del.error && (
        <Alert tone="red" className="mb-3">
          {(del.error as ApiError).message}
        </Alert>
      )}
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((b) => (
            <div key={b.id} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{b.name}</p>
                {b.active ? <Badge tone="green">Activa</Badge> : <Badge>Inactiva</Badge>}
              </div>
              <p className="text-sm text-stone-600">{formatDims(b.innerLengthMm, b.innerWidthMm, b.innerHeightMm)} interior</p>
              <p className="text-sm text-stone-600">
                Máx. {formatWeight(b.maxWeightG)} · útil {formatWeight(usableWeightG(b))} · margen {b.safetyMarginPct}%
              </p>
              <p className="text-sm font-semibold">{formatPrice(b.priceCents)}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    save.reset();
                    setEditing(b);
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`¿Eliminar ${b.name}?`) && del.mutate(b.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Nueva caja' : 'Editar caja'}>
        {editing !== null && (
          <BoxForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? blank : { ...editing }}
            onSubmit={(b) => save.mutate(b)}
            submitting={save.isPending}
            serverError={(save.error as ApiError | null)?.message}
          />
        )}
      </Modal>
    </div>
  );
}

function BoxForm({ initial, onSubmit, submitting, serverError }: { initial: BoxInput; onSubmit: (b: BoxInput) => void; submitting: boolean; serverError?: string }) {
  const [v, setV] = useState<BoxInput>({
    name: initial.name,
    description: initial.description,
    innerLengthMm: initial.innerLengthMm,
    innerWidthMm: initial.innerWidthMm,
    innerHeightMm: initial.innerHeightMm,
    maxWeightG: initial.maxWeightG,
    priceCents: initial.priceCents,
    safetyMarginPct: initial.safetyMarginPct,
    active: initial.active,
  });
  const [price, setPrice] = useState((initial.priceCents / 100).toFixed(2));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const n = (k: keyof BoxInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = boxInputSchema.safeParse({ ...v, priceCents: Math.round(Number(price.replace(',', '.')) * 100) });
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    onSubmit(r.data);
  };

  const num = (k: keyof BoxInput, label: string, hint?: string) => (
    <Field label={label} htmlFor={`b-${k}`} error={errors[k]} hint={hint}>
      <Input id={`b-${k}`} type="number" min={0} value={String(v[k])} onChange={n(k)} aria-invalid={!!errors[k]} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <Field label="Nombre" htmlFor="b-name" error={errors.name}>
          <Input id="b-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="Descripción" htmlFor="b-description">
          <Textarea id="b-description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
      </div>
      {num('innerLengthMm', 'Largo interior (mm)', `${v.innerLengthMm / 10} cm`)}
      {num('innerWidthMm', 'Ancho interior (mm)', `${v.innerWidthMm / 10} cm`)}
      {num('innerHeightMm', 'Alto interior (mm)', `${v.innerHeightMm / 10} cm`)}
      {num('maxWeightG', 'Peso máximo (g)', `${v.maxWeightG / 1000} kg`)}
      <Field label="Precio caja / envío (USD)" htmlFor="b-price" error={errors.priceCents}>
        <Input id="b-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      {num('safetyMarginPct', 'Margen de seguridad (%)', 'Se reserva en peso y en volumen (0–50).')}
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input type="checkbox" className="accent-brand-600" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
        Caja activa
      </label>
      {serverError && (
        <div className="sm:col-span-3">
          <Alert tone="red">{serverError}</Alert>
        </div>
      )}
      <div className="flex justify-end sm:col-span-3">
        <Button type="submit" disabled={submitting}>
          Guardar caja
        </Button>
      </div>
    </form>
  );
}

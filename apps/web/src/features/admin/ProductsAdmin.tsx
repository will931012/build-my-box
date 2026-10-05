import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDims, formatPrice, formatWeight, PACKAGING_LABELS, type Product, type ProductInput } from '@bmb/shared';
import { api, ApiError } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Alert, Badge, Button, Input, Spinner } from '../../components/ui';
import { ProductForm, toProductInput } from './ProductForm';

export function ProductsAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'products'], queryFn: api.admin.products });
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const save = useMutation({
    mutationFn: (p: ProductInput) => (editing && editing !== 'new' ? api.admin.updateProduct(editing.id, p) : api.admin.createProduct(p)),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.admin.deleteProduct(id), onSuccess: refresh });
  const stock = useMutation({ mutationFn: ({ id, n }: { id: string; n: number }) => api.admin.setStock(id, n), onSuccess: refresh });

  const categories = useMemo(() => [...new Set((q.data ?? []).map((p) => p.category))].sort(), [q.data]);
  const rows = (q.data ?? []).filter((p) => !filter || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(filter.toLowerCase()));
  const err = (del.error ?? stock.error) as ApiError | null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" type="search" placeholder="Filtrar productos" aria-label="Filtrar productos" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button
          onClick={() => {
            save.reset();
            setEditing('new');
          }}
        >
          + Nuevo producto
        </Button>
      </div>
      {err && (
        <Alert tone="red" className="mb-3">
          {err.message}
        </Alert>
      )}
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-stone-200">
          <table className="w-full min-w-[900px] bg-white text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-600">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Medidas / peso</th>
                <th className="px-3 py-2">Reglas</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'bg-stone-50 text-stone-500'}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-xs text-stone-500">{p.sku}</p>
                    {!p.active && <Badge>Inactivo</Badge>}
                  </td>
                  <td className="px-3 py-2">{p.category}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPrice(p.priceCents)}</td>
                  <td className="px-3 py-2">
                    <StockEditor product={p} onSave={(n) => stock.mutate({ id: p.id, n })} />
                    <p className="text-xs text-stone-500">
                      Reservado {p.reserved} · disponible {p.available}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatDims(p.lengthMm, p.widthMm, p.heightMm)}
                    <br />
                    {formatWeight(p.weightG)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge>{PACKAGING_LABELS[p.packagingType]}</Badge>
                      {p.fragility >= 2 && <Badge tone="red">Frágil {p.fragility}</Badge>}
                      {p.compressibility >= 2 && <Badge tone="amber">Blando {p.compressibility}</Badge>}
                      {!p.canSupportWeight ? <Badge tone="red">Sin peso encima</Badge> : <Badge tone="green">Soporta {formatWeight(p.maxLoadOnTopG)}</Badge>}
                      <Badge tone="blue">{p.allowedOrientations.length} orient.</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        save.reset();
                        setEditing(p);
                      }}
                    >
                      Editar
                    </Button>{' '}
                    <Button size="sm" variant="ghost" onClick={() => confirm(`¿Eliminar ${p.name}?`) && del.mutate(p.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Nuevo producto' : `Editar ${editing?.name ?? ''}`}>
        {editing !== null && (
          <ProductForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : toProductInput(editing)}
            categories={categories}
            onSubmit={(p) => save.mutate(p)}
            submitting={save.isPending}
            serverError={(save.error as ApiError | null)?.message}
          />
        )}
      </Modal>
    </div>
  );
}

function StockEditor({ product, onSave }: { product: Product; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(product.stock));
  const changed = Number(v) !== product.stock;
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed && Number.isInteger(Number(v)) && Number(v) >= 0) onSave(Number(v));
      }}
    >
      <Input className="w-20 py-1" type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} aria-label={`Stock de ${product.name}`} />
      {changed && (
        <Button type="submit" size="sm">
          OK
        </Button>
      )}
    </form>
  );
}

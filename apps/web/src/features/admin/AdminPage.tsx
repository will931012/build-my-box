import { useState, type FormEvent } from 'react';
import { adminToken, api, ApiError } from '../../api/client';
import { Button, Card, cx, Field, Input } from '../../components/ui';
import { BoxesAdmin } from './BoxesAdmin';
import { OrdersAdmin } from './OrdersAdmin';
import { ProductsAdmin } from './ProductsAdmin';

type Tab = 'products' | 'boxes' | 'orders';
const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Productos e inventario' },
  { id: 'boxes', label: 'Cajas' },
  { id: 'orders', label: 'Órdenes' },
];

export function AdminPage() {
  const [authed, setAuthed] = useState(!!adminToken.get());
  const [tab, setTab] = useState<Tab>('products');

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Administración</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            adminToken.set(null);
            setAuthed(false);
          }}
        >
          Cerrar sesión
        </Button>
      </div>
      <div role="tablist" aria-label="Secciones de administración" className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-300">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-600 hover:text-stone-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'products' && <ProductsAdmin />}
        {tab === 'boxes' && <BoxesAdmin />}
        {tab === 'orders' && <OrdersAdmin />}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    adminToken.set(token);
    try {
      await api.admin.verify();
      onLogin();
    } catch (err) {
      adminToken.set(null);
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-sm px-3 py-10">
      <Card className="p-6">
        <h1 className="text-xl font-bold">Acceso de administración</h1>
        <p className="mt-1 text-sm text-stone-600">Introduce el token configurado en ADMIN_TOKEN (por defecto en desarrollo: admin-demo).</p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Field label="Token" htmlFor="admin-token" error={error || undefined}>
            <Input id="admin-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={busy || !token}>
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}

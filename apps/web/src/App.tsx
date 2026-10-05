import { NavLink, Route, Routes } from 'react-router-dom';
import { cx } from './components/ui';
import { AdminPage } from './features/admin/AdminPage';
import { BuilderPage } from './features/builder/BuilderPage';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { OrderPage } from './features/orders/OrderPage';
import { PackingListPage } from './features/orders/PackingListPage';
import { useCart } from './store/cart';

function Header() {
  const count = useCart((s) => Object.values(s.quantities).reduce((a, b) => a + b, 0));
  const link = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-200');
  return (
    <header className="no-print sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <NavLink to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
            <path d="M16 3 28 9v14l-12 6-12-6V9z" fill="#c2410c" />
            <path d="M4 9l12 6 12-6M16 15v14" stroke="#fff7ed" strokeWidth="2" fill="none" />
          </svg>
          Build My Box
        </NavLink>
        <nav aria-label="Principal" className="flex items-center gap-1">
          <NavLink to="/" end className={link}>
            Mi caja{count > 0 ? ` (${count})` : ''}
          </NavLink>
          <NavLink to="/admin" className={link}>
            Admin
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<BuilderPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/ordenes/:id" element={<OrderPage />} />
          <Route path="/ordenes/:id/packing-list" element={<PackingListPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<p className="p-8">Página no encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}

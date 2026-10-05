import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Estado del carrito: una caja y cantidades por producto. La validación de si un
 * producto cabe se hace ANTES de llamar a `add` (ver usePackingAnalysis), con el
 * mismo motor que usa el servidor.
 */
interface CartState {
  boxId: string | null;
  quantities: Record<string, number>;
  setBox: (boxId: string) => void;
  add: (productId: string, n?: number) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      boxId: null,
      quantities: {},
      setBox: (boxId) => set({ boxId }),
      add: (productId, n = 1) =>
        set((s) => ({ quantities: { ...s.quantities, [productId]: (s.quantities[productId] ?? 0) + n } })),
      decrement: (productId) =>
        set((s) => {
          const q = (s.quantities[productId] ?? 0) - 1;
          const quantities = { ...s.quantities };
          if (q <= 0) delete quantities[productId];
          else quantities[productId] = q;
          return { quantities };
        }),
      remove: (productId) =>
        set((s) => {
          const quantities = { ...s.quantities };
          delete quantities[productId];
          return { quantities };
        }),
      clear: () => set({ quantities: {} }),
    }),
    {
      name: 'bmb-cart',
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          return sessionStorage;
        }
      }),
    },
  ),
);

import type {
  AdditionCheck,
  Box,
  BoxInput,
  CreateOrderInput,
  OrderDto,
  OrderStatus,
  PackingResult,
  Product,
  ProductInput,
} from '@bmb/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const ADMIN_TOKEN_KEY = 'bmb-admin-token';

export const adminToken = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
      else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

async function request<T>(method: string, url: string, body?: unknown, admin = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-token'] = adminToken.get() ?? '';
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Error ${res.status}`, data.details);
  return data as T;
}

export const api = {
  products: () => request<Product[]>('GET', '/api/products'),
  boxes: () => request<Box[]>('GET', '/api/boxes'),
  evaluate: (boxId: string, items: { productId: string; quantity: number }[]) =>
    request<PackingResult>('POST', '/api/packing/evaluate', { boxId, items }),
  checkAdditions: (boxId: string, items: { productId: string; quantity: number }[]) =>
    request<Record<string, AdditionCheck>>('POST', '/api/packing/check-additions', { boxId, items }),
  createOrder: (input: CreateOrderInput) => request<OrderDto>('POST', '/api/orders', input),
  order: (id: string) => request<OrderDto>('GET', `/api/orders/${id}`),
  payOrder: (id: string) => request<OrderDto>('POST', `/api/orders/${id}/pay`),
  cancelOrder: (id: string) => request<OrderDto>('POST', `/api/orders/${id}/cancel`),
  updateCustoms: (id: string, customsDeclaration: string) =>
    request<OrderDto>('PATCH', `/api/orders/${id}/customs`, { customsDeclaration }),

  admin: {
    verify: () => request<{ ok: boolean }>('GET', '/api/admin/verify', undefined, true),
    products: () => request<Product[]>('GET', '/api/admin/products', undefined, true),
    createProduct: (p: ProductInput) => request<Product>('POST', '/api/admin/products', p, true),
    updateProduct: (id: string, p: ProductInput) => request<Product>('PUT', `/api/admin/products/${id}`, p, true),
    setStock: (id: string, stock: number) => request<Product>('PATCH', `/api/admin/products/${id}/stock`, { stock }, true),
    deleteProduct: (id: string) => request<void>('DELETE', `/api/admin/products/${id}`, undefined, true),
    boxes: () => request<Box[]>('GET', '/api/admin/boxes', undefined, true),
    createBox: (b: BoxInput) => request<Box>('POST', '/api/admin/boxes', b, true),
    updateBox: (id: string, b: BoxInput) => request<Box>('PUT', `/api/admin/boxes/${id}`, b, true),
    deleteBox: (id: string) => request<void>('DELETE', `/api/admin/boxes/${id}`, undefined, true),
    orders: (status?: OrderStatus) =>
      request<OrderDto[]>('GET', `/api/admin/orders${status ? `?status=${status}` : ''}`, undefined, true),
    order: (id: string) => request<OrderDto>('GET', `/api/admin/orders/${id}`, undefined, true),
    payOrder: (id: string) => request<OrderDto>('POST', `/api/admin/orders/${id}/pay`, undefined, true),
    cancelOrder: (id: string) => request<OrderDto>('POST', `/api/admin/orders/${id}/cancel`, undefined, true),
    fulfillOrder: (id: string) => request<OrderDto>('POST', `/api/admin/orders/${id}/fulfill`, undefined, true),
  },
};

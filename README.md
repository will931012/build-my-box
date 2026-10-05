# Build My Box

Aplicación web de e-commerce para armar una **caja de envío internacional de tamaño fijo** con productos de mercado. Mientras el cliente agrega o quita productos, un **motor de packing 3D determinista** recalcula el acomodo real y lo muestra en una vista 3D rotatable. Solo se pueden agregar productos que **caben físicamente**: respetan peso, dimensiones, orientación, fragilidad y estabilidad. El sistema no se limita a sumar volúmenes.

> Interfaz en español. Pagos **simulados** (sin cobros reales), con una interfaz lista para integrar Stripe.

---

## Contenido

- [Stack y estructura](#stack-y-estructura)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Cómo funciona el motor de packing](#cómo-funciona-el-motor-de-packing)
- [Flujos de la app](#flujos-de-la-app)
- [API](#api)
- [Asistente inteligente (arquitectura preparada)](#asistente-inteligente-arquitectura-preparada)
- [Integrar Stripe](#integrar-stripe)
- [Suposiciones del MVP](#suposiciones-del-mvp)
- [Limitaciones y siguientes pasos](#limitaciones-y-siguientes-pasos)

---

## Stack y estructura

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7, Tailwind CSS 4, Radix (diálogos), React Router, TanStack Query, Zustand |
| 3D | Three.js con React Three Fiber + Drei |
| Backend | Node.js + Express 5 + TypeScript (ejecutado con `tsx`) |
| Datos | PostgreSQL + Prisma 6 |
| Validación | Zod 4 (esquemas compartidos entre cliente y servidor) |
| Pruebas | Vitest (motor y API) y Playwright (flujo e2e en escritorio y móvil) |

Monorepo con npm workspaces:

```
packages/shared/        Motor de packing + tipos + esquemas Zod + datos de prueba (TS puro)
  src/packing/          extremePoints.ts (algoritmo), geometry.ts, messages.ts, types.ts
  src/recommendations.ts, orders.ts (instrucciones, declaración), seedData.ts
  test/                 Pruebas unitarias del motor y benchmark
apps/server/            API Express
  prisma/               schema.prisma, migraciones, seed.ts
  src/services/         catálogo, órdenes (reserva/liberación de stock)
  src/payments/         PaymentProvider (mock) + punto de integración de Stripe
  src/assistant/        Herramientas de solo lectura para un futuro asistente
  src/routes/           públicas, admin (token) y asistente
apps/web/               Frontend
  src/features/builder  "Construye tu caja": catálogo, visor 3D, resumen
  src/features/checkout Checkout simulado
  src/features/orders   Orden y packing list imprimible
  src/features/admin    CRUD de productos/cajas, stock y órdenes
  src/packing/          Web Worker que ejecuta el motor fuera del hilo principal
e2e/                    Pruebas Playwright
```

El **mismo motor** corre en el navegador (para la respuesta instantánea, en un Web Worker) y en el servidor. El servidor **vuelve a calcular** el acomodo al crear la orden y nunca confía en el del cliente.

---

## Instalación y ejecución

Requisitos: **Node.js ≥ 20** y una base **PostgreSQL**.

```bash
npm install                 # instala todo y genera el cliente de Prisma
cp .env.example .env        # ajusta DATABASE_URL
```

### Base de datos (elige una opción)

**A. Railway (la que se usó en desarrollo).** El proyecto `build-my-box` tiene un servicio PostgreSQL con proxy TCP público. Copia su URL pública en `DATABASE_URL` dentro de `.env`. Con el CLI de Railway: `railway variables --service Postgres` (host del proxy y puerto en la pestaña *Networking*).

**B. Docker Compose.** Levanta Postgres 16 en el puerto **5433**, para no chocar con un Postgres local:

```bash
npm run db:up               # docker compose up -d db
# .env: DATABASE_URL="postgresql://bmb:bmb@localhost:5433/buildmybox?schema=public"
```

**C. PostgreSQL local.** Crea una base `buildmybox` y apunta `DATABASE_URL` a ella.

### Migraciones y datos de prueba

```bash
npm run db:deploy           # aplica las migraciones (en desarrollo: npm run db:migrate)
npm run db:seed             # 3 cajas y 34 productos realistas (idempotente)
```

El seed incluye arroz, frijoles, aceite (1 L y 5 L), leche en polvo, café, latas (atún, sardinas, frijoles, leche condensada), galletas, pasta, detergente en polvo y líquido, shampoo, papel higiénico, productos blandos (papas fritas) y frágiles (frascos de vidrio, pan tostado). Hay casos que no caben a propósito: el aceite de 5 L no entra de pie en la caja pequeña y el café en grano está agotado.

### Ejecutar

```bash
npm run dev                 # API en http://localhost:4000 + web en http://localhost:5173
```

- Tienda: <http://localhost:5173>
- Administración: <http://localhost:5173/admin>. El token es el de `ADMIN_TOKEN` (en desarrollo, `admin-demo`).

Producción simple: `npm run build` compila el frontend en `apps/web/dist` y `npm start` sirve la API y ese frontend desde el mismo puerto.

### Variables de entorno (`.env` en la raíz)

| Variable | Descripción | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL | — |
| `PORT` | Puerto de la API | `4000` |
| `CORS_ORIGIN` | Orígenes permitidos (separados por coma) | `http://localhost:5173` |
| `ADMIN_TOKEN` | Token del panel de administración | `admin-demo` (**cámbialo**) |
| `PAYMENT_PROVIDER` | `mock` o `stripe` (no implementado todavía) | `mock` |

---

## Pruebas

```bash
npm test                    # Vitest: motor de packing (27) + API sin BD (6)
npm run test:e2e            # Playwright: requiere BD con seed; levanta API y web si no están corriendo
npm run bench               # benchmark del motor
npm run typecheck           # TypeScript en todos los paquetes
```

La primera vez, instala el navegador de Playwright con `npx playwright install chromium`.

Las pruebas del motor (`packages/shared/test/packing.test.ts`) cubren:

- **Límites:** región útil con margen de seguridad, productos demasiado grandes.
- **Colisiones:** pruebas de propiedades con 60 carritos aleatorios del catálogo real; se verifica que ningún par de productos se superponga.
- **Geometría vs. volumen:** dos cubos de 60 cm no caben en 1 m³ aunque el volumen sobre.
- **Sobrepeso:** se rechaza la unidad que excede el peso útil.
- **Orientación:** "este lado arriba" nunca se acuesta; se elige la orientación más estable.
- **Frágiles y blandos:** van encima, nada se apoya sobre lo que no admite peso, nada pesado se apoya sobre lo delicado, y se respeta la carga acumulada propagada hacia abajo.
- **Estabilidad:** nada queda flotando ni con menos del 75% de apoyo; se acepta el apoyo compartido.
- **Determinismo:** `checkAdditions` es equivalente a un repack completo; se verifica en 30 carritos × 34 productos.

Las pruebas e2e recorren el flujo completo (elegir caja → agregar → vistas 3D → checkout → orden pagada → packing list) y el caso "no cabe por orientación", en escritorio y en móvil (Pixel 7).

---

## Despliegue

Producción usa **Railway** (API + PostgreSQL) y **Vercel** (frontend). Cada push a `main` redespliega ambos automáticamente.

| Pieza | Dónde | Configuración |
|---|---|---|
| PostgreSQL | Railway, proyecto `build-my-box`, servicio `Postgres` | — |
| API (Express) | Railway, servicio `api` → <https://api-production-ca1f.up.railway.app> | [railway.json](railway.json): build `npm run build`, arranque `npm run start:prod` (aplica migraciones y arranca), healthcheck `/api/health` |
| Frontend | Vercel, *Root Directory* = `apps/web` | [apps/web/vercel.json](apps/web/vercel.json): reenvía `/api/*` a la API de Railway y sirve el SPA |

Variables del servicio `api` en Railway: `DATABASE_URL=${{Postgres.DATABASE_URL}}` (red privada), `ADMIN_TOKEN` (aleatorio; consúltalo con `railway variables --service api`), `NODE_ENV=production`, `PAYMENT_PROVIDER=mock`, `PORT=8080`.

La URL de Railway también sirve la app completa (el servidor incluye el frontend compilado), útil como respaldo de Vercel.

---

## Cómo funciona el motor de packing

Código: [packages/shared/src/packing/extremePoints.ts](packages/shared/src/packing/extremePoints.ts). Contrato intercambiable: `PackingEngine` en [types.ts](packages/shared/src/packing/types.ts).

1. **Unidades.** Cada producto se trata como un prisma rectangular con sus medidas de envío. El carrito se expande en unidades individuales.
2. **Región útil.** Se reserva `safetyMarginPct` (10% por defecto) del **volumen**, repartido en las tres dimensiones (factor ∛(1−m)), y del **peso**.
3. **Orden de colocación** (determinista):
   - Nivel 0: rígido y resistente.
   - Nivel 1: delicado (fragilidad o compresibilidad media).
   - Nivel 2: frágil, blando o que no admite peso encima.
   - Dentro de cada nivel: de más pesado a más liviano y de mayor a menor base.
4. **Heurística de extreme points** (Crainic, Perboli y Tadei, 2008). Cada producto colocado genera nuevos puntos candidatos (esquinas y sus proyecciones hacia las paredes y superficies). Para cada unidad se prueban todos los puntos × orientaciones permitidas, ordenados por **tope más bajo** (capas planas, centro de gravedad bajo) y luego por posición (z, y, x).
5. **Verificaciones** de cada candidato: dentro de los límites, sin colisión, **apoyo ≥ 75%** de la base con el centro sobre la zona de apoyo, y reglas de carga. La carga de cada unidad se reparte entre sus soportes según el área de contacto y se **propaga hacia abajo**. Ningún producto puede superar su `maxLoadOnTopG`. Además, nada se apoya sobre productos con `canSupportWeight = false`, y un producto de más de 500 g no se apoya sobre uno delicado.
6. **Pasadas de respaldo.** Si el orden principal deja algo fuera sin exceder el peso, se reintenta con dos órdenes alternativos: primero la base más grande, y luego los productos que fallaron. Las reglas físicas son las mismas; solo cambia la prioridad.
7. **Resultado.** Una lista de `placements` con producto, posición x/y/z (mm), medidas usadas, orientación, capa, apoyo, carga encima y **razón de colocación**. Si algo no cabe, lo explica: `EXCEEDS_WEIGHT`, `TOO_LARGE`, `ORIENTATION_NOT_ALLOWED`, `NO_SPACE`, `INSUFFICIENT_SUPPORT` o `FRAGILITY_RULE`.

**El indicador de capacidad sale del motor, no del volumen.** Tras cada cambio se evalúa `checkAdditions` para todo el catálogo ("¿cabe una unidad más de X?"). De ahí salen los botones habilitados, los mensajes "No cabe", las sugerencias de productos pequeños y los sustitutos. Para que sea rápido, se reanuda desde una instantánea del prefijo común del orden de colocación, con un resultado idéntico a un repack completo. El "espacio utilizado" que se muestra es solo informativo.

Rendimiento medido: un pack de 25 a 80 unidades tarda menos de 10 ms. Evaluar los 34 productos tarda entre 1 y 70 ms (más en cajas casi llenas), y en el navegador corre en un Web Worker.

Para **sustituir el algoritmo**, implementa `PackingEngine` (`pack` y `checkAdditions`) y asígnalo a `defaultPackingEngine` en [packing/index.ts](packages/shared/src/packing/index.ts).

---

## Flujos de la app

**Cliente** (`/`)
1. Elige una caja (Pequeña, Estándar o Grande; cada una con dimensiones, peso máximo, margen y precio propios) y ve la caja vacía.
2. Explora el catálogo: buscador, filtros por categoría, "solo lo que cabe" y sugerencias de productos pequeños que caben en el espacio restante.
3. Al agregar, la caja se reacomoda en 3D con animación. La vista se puede rotar, hacer zoom y desplazar, y hay vistas frontal, superior, lateral y en perspectiva. Al hacer clic en un producto se ven su nombre, cantidad, peso, posición, orientación, capa, apoyo y carga.
4. El resumen muestra cantidades, subtotal, peso actual/útil, espacio estimado, estado ("Todo cabe", "No cabe", "Excede peso", "Caja llena"), barras de progreso, lo que resta y recomendaciones.
5. Si un producto no cabe o está agotado, se muestra el motivo y sustitutos de la misma categoría que sí caben.
6. Checkout simulado: pagar al instante o guardar la orden pendiente. Luego se puede ver la orden y la **packing list imprimible**.

**Administración** (`/admin`)
- CRUD de productos con todos los campos físicos y reglas (orientaciones, carga, fragilidad, compresibilidad, restricciones). Ajuste rápido de stock.
- CRUD de cajas (dimensiones, peso máximo, precio, margen, activa/inactiva).
- Órdenes: filtro por estado, detalle con el plano 3D y por capas, y acciones de pagar, cancelar (libera stock) y despachar (consume stock).

**Stock.** Al crear una orden se **reserva** (`reserved += qty`) con un `UPDATE` condicional atómico, sin sobreventa. Al cancelar se **libera**. Al despachar se **consume** (`stock -= qty`, `reserved -= qty`). Disponible = `stock − reserved`.

**Packing list:** número de orden, caja y dimensiones, destinatario simulado, productos y cantidades, peso estimado, instrucciones de empaque generadas desde el plano, plano superior por capas (imprimible), tabla de posiciones y una **declaración de contenido editable** (borrador).

---

## API

Públicas (`/api`):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado (incluye conexión a BD) |
| GET | `/products?search=&category=` | Catálogo activo con `available` |
| GET | `/categories`, `/boxes` | Categorías y cajas activas |
| POST | `/packing/evaluate` | `{boxId, items}` → `PackingResult` autoritativo |
| POST | `/packing/check-additions` | `{boxId, items, candidateProductIds?}` → ¿cabe una unidad más? |
| POST | `/orders` | `{boxId, items, recipient, action: 'pay' \| 'save'}` |
| GET | `/orders/:id` | Orden con su plano de packing |
| POST | `/orders/:id/pay` · `/orders/:id/cancel` | Pago simulado / cancelación (si está pendiente) |
| PATCH | `/orders/:id/customs` | Editar la declaración de contenido |

Administración (`/api/admin`, header `x-admin-token`): `GET/POST/PUT/DELETE /products`, `PATCH /products/:id/stock`, `GET/POST/PUT/DELETE /boxes`, `GET /orders?status=`, `GET /orders/:id`, `POST /orders/:id/{pay,cancel,fulfill}`. Eliminar un producto o una caja con órdenes asociadas devuelve 409 (en ese caso, desactívalo).

---

## Asistente inteligente (arquitectura preparada)

En [apps/server/src/assistant/tools.ts](apps/server/src/assistant/tools.ts) hay un registro de herramientas con esquema Zod (exportado como JSON Schema, listo para "tool use" de un LLM):

`search_products`, `get_box_contents`, `explain_fit`, `recommend_fitting_products`, `recommend_substitutes`, `suggest_best_fill`, `prepare_picking_list`.

- `GET /api/assistant/tools` lista las definiciones; `POST /api/assistant/tools/:name` con `{input}` ejecuta una herramienta.
- **Todas son de solo lectura.** Consultan y proponen, pero no modifican inventario, órdenes ni pagos.
- Toda respuesta sobre "si cabe" sale del motor determinista, así que el asistente **no puede saltarse las restricciones físicas**.
- Una herramienta futura que modifique datos debe declarar `mutates: true`. El registro la rechaza (403) si no hay una aprobación humana explícita (`humanApproval`).
- `suggest_best_fill` devuelve una **propuesta**: el cliente debe confirmarla antes de agregar nada.

No se construyó ningún agente autónomo; solo la capa de servicios.

---

## Integrar Stripe

La interfaz `PaymentProvider` ([apps/server/src/payments/types.ts](apps/server/src/payments/types.ts)) define `createPayment` y `refund`. Hoy se usa `MockPaymentProvider`, que aprueba al instante. En [stripeProvider.ts](apps/server/src/payments/stripeProvider.ts) están los pasos: crear un PaymentIntent, confirmar con Stripe Elements usando `clientSecret`, y marcar la orden como pagada **solo desde el webhook** con `markOrderPaid`. Para activarlo: `PAYMENT_PROVIDER=stripe`.

---

## Suposiciones del MVP

- **Unidades:** mm, gramos y centavos de USD (enteros). La UI muestra cm y kg.
- **Margen de seguridad:** se aplica igual al peso y al volumen útil. El volumen se reparte en los tres ejes; la holgura vertical queda arriba (relleno), centrada en planta.
- **Prismas rectangulares:** cilindros, botellas y bolsas usan su caja envolvente. La compresibilidad **no** se usa para "apretar" productos, solo en las reglas de apoyo.
- **Orientación:** códigos `LWH…HWL` (qué dimensión del producto queda en cada eje). En bolsas, la posición natural es acostada, con H = grosor.
- **Apoyo mínimo:** 75% de la base, con el centro sobre la zona de apoyo. "Pesado" significa más de 500 g. "Delicado" significa fragilidad o compresibilidad ≥ 2. Todo es configurable en `PackingOptions`.
- **Aproximaciones físicas:** la carga se reparte por área de contacto. No se modelan fricción, golpes ni deformación. Por eso la app siempre muestra "Acomodo estimado" y marca "requiere revisión" cuando hay vidrio, líquidos, apoyo parcial o la caja está muy llena.
- **Aduanas:** la app **no afirma cumplir** normas aduanales ni restricciones alimentarias. Solo ofrece campos de restricciones por producto, advertencias y un borrador editable de la declaración.
- **Acceso:** el panel de administración usa un token simple, adecuado solo para un MVP. Las órdenes son accesibles por ID (cuid, difícil de adivinar). No hay cuentas de cliente.
- **Una orden = una caja.**
- **Precio de la caja:** incluye el costo de envío.
- **Fotos:** si un producto no tiene `imageUrl`, se muestra una ilustración SVG según su tipo de empaque, en el mismo color que en la vista 3D.

## Limitaciones y siguientes pasos

- **Aprovechamiento:** con mezclas aleatorias muy heterogéneas, el llenado geométrico ronda el 60% del volumen útil. Lo limitan las reglas de seguridad (productos verticales, cosas que no admiten peso encima). En la práctica el **peso** suele agotarse antes. Mejoras posibles: búsqueda local o metaheurística sobre el orden, o un solver por capas para productos repetidos.
- **Autenticación:** falta autenticación real (cuentas de cliente y roles de administración) y un registro de auditoría de cambios de inventario.
- **Stripe y webhooks:** pendientes; ya hay un punto único `markOrderPaid` para conectarlos.
- **Tamaño del frontend:** el visor 3D se carga bajo demanda (chunk de unos 950 kB). Se podría reducir importando solo los módulos necesarios de Drei.

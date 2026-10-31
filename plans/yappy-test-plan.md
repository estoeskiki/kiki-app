# Plan: Yappy Botón de Pago (UAT) en Plaza Mayor — versión endurecida

## Contexto

Edgar tiene credenciales UAT de Yappy y el dominio registrado `https://order.estoeskiki.com`. Objetivo: el cliente paga **antes**, con Yappy, en el checkout de order-web; la orden de Kiki se crea solo cuando Yappy confirma el pago (IPN `E`). Solo se activa en **Plaza Mayor Food Hall** (`fc000000-…0001`). COS y los kioskos no cambian.

El plan fue revisado contra el código real buscando cinco fallas: cobro sin orden, orden sin cobro, doble cobro, IPN perdido y abuso. Cada decisión de abajo cierra al menos una.

### Principios
1. **El registro del dinero nunca se pierde.** El estado `executed` se guarda aunque falle la creación de la orden; si falla, queda marcado para atención.
2. **Una sola transacción de Postgres crea la orden** (sin `waitUntil` ni inserts sueltos), de forma síncrona dentro del IPN.
3. **Se cobra lo que se guardó.** La orden se crea desde el snapshot congelado al momento de cobrar; nunca se lee el monto del IPN.
4. **Radio de impacto cero sobre COS.** No se tocan `create-web-order`, `get_public_storefront`, el kiosk ni el KDS. Todo lo de Yappy es aditivo.
5. **Toda falla tiene salida visible.** Cada caso termina en un estado del cliente y en una fila de `yappy_attention` con su runbook.

### Adaptación del documento a Kiki
| Documento | Kiki |
|---|---|
| API routes en Vercel | Supabase Edge Functions: `yappy-create` y `yappy-ipn`, separadas para que un mal deploy de create nunca rompa el IPN, y para que el IPN arranque rápido (límite de 5 s). |
| "Marcar la orden como pagada" | Hoy las órdenes entran `confirmed` y cocina las ve al instante. Por eso la orden se crea recién con el IPN `E`, desde el snapshot. POS y KDS no cambian. |
| `order_id NOT NULL` | Es nullable y `UNIQUE`; se llena al cumplir la orden. |
| Montos `numeric` | Centavos `int`. Se pasan a `"5.35"` con aritmética entera solo al llamar a Yappy. |
| RLS "cliente lee su pago" | Los clientes son anónimos. Se usa la RPC `get_yappy_payment_status` (SECURITY DEFINER, mismo patrón que `get_order_status_public`) con polling. |
| "Siempre 200" | 200 solo **después** de guardar el evento crudo. Si la DB está caída: 5xx y `console.log` del query completo para que no se pierda. Hash malo u orderId desconocido: 200 sin cambiar nada. |

## Cambios

### 1. Migración `049_yappy_payments.sql` (aditiva)
- **`yappy_merchants`** (`food_court_id` PK/FK, `env` `'uat'|'prod'`, `enabled`, `domain`): solo una fila, Plaza Mayor/uat. Los secretos **no** van aquí.
- **`yappy_payments`**:
  - Identificación y contexto: `id`, `yappy_order_id` (unique), `env`, `food_court_id`, `table_id`, `checkout_key`, `alias_yappy`, `client_ip`.
  - Montos y snapshot: `subtotal_cents`, `tax_cents`, `total_cents`, `snapshot` jsonb listo para insertar (filas exactas de order, sub_orders, items y customizations).
  - Estado de Yappy: `transaction_id`, `status`, `confirmation_number`, `error_code`.
  - Control: `fulfillment_error`, `fulfillment_warning`, `duplicate_of`, `refund_required`, `client_reported_success_at`, `order_id` (unique FK, `on delete set null`), `created_at`, `updated_at`, `expires_at`.
  - Estados: `creating | created | unknown | failed | cancelled | expired | executed`.
  - **`executed` es terminal.** `E` se acepta desde cualquier estado no ejecutado: un `payment-wc` que dio timeout pudo haber cobrado igual.
  - Índices únicos parciales sobre `alias_yappy` y sobre `checkout_key` cuando `status in ('creating','created','unknown')`: un intento activo por teléfono y por carrito, garantizado por la DB.
- **`yappy_ipn_events`** (append-only): `raw_query`, `yappy_order_id`, `status`, `hash_valid`, `outcome`, `received_at`.
- **Seguridad**, según la convención de 035:
  - RLS más policies explícitas `USING (false)`.
  - `REVOKE ALL` a `anon` y `authenticated`.
  - Fuera de `supabase_realtime`.
- **Funciones SQL** (SECURITY DEFINER, `search_path` fijo, `REVOKE … FROM PUBLIC, anon, authenticated`, `GRANT` solo a `service_role`):
  - `yappy_begin_payment(...)`, en una transacción con `pg_advisory_xact_lock` por venue:
    1. Pasa a `expired` las filas activas de más de 10 min.
    2. Si hay un intento activo con el mismo `checkout_key`, lo devuelve.
    3. Aplica los rate limits: alias ≤3 cada 10 min, mesa ≤10, IP ≤10. Además, un circuit breaker: más de 40 creates en 10 min en la venue apaga Yappy y deja una fila en attention.
    4. Inserta la fila `creating`.
  - `yappy_mark_created/failed/unknown(...)`: updates condicionales (`where status = 'creating'`).
  - `yappy_apply_ipn(p_yappy_order_id, p_status, p_confirmation)`:
    1. `SELECT … FOR UPDATE`. Si ya está `executed`, termina (idempotente).
    2. Con `C` o `X`: pasa a `cancelled` o `expired` si no está ejecutada. Una letra desconocida solo se registra.
    3. Con `E`: marca `executed` más `confirmation_number`; ese registro siempre hace commit. Luego toma `pg_advisory_xact_lock(hashtext(checkout_key))`; si un intento hermano ya creó la orden, queda `duplicate_of` + `refund_required` y no se crea otra.
    4. Si no, en un bloque `BEGIN … EXCEPTION` (savepoint) llama a `next_order_number` (scope `fc:<id>`, no toca a COS) e inserta order, sub_orders, items y customizations desde el snapshot con `payment_method='yappy'` y `payment_status='paid'` en orders **y** sub_orders. Luego llena `order_id`.
    5. Ante una excepción, guarda `fulfillment_error`. El pago queda `executed` y aparece en attention.
    6. Recalcula los totales del snapshot. Si no cuadran, o si el restaurante cerró o un item no está disponible, guarda `fulfillment_warning` **pero crea la orden igual**, porque el cliente ya pagó.
- **RPCs para anon**:
  - `get_payment_options(p_table_token)` → `{yappy: bool, reason}`. Considera el token válido, la fila habilitada y el horario UAT (L–V 7:00–18:30, hora de Panamá).
  - `get_yappy_payment_status(p_payment_id)` → `{status, order_id (solo si executed), order_number, error_code, expires_at}`. TTL de 24 h; no expone teléfono ni snapshot.
- **Vista `yappy_attention`**, solo para service role y platform admin. Lista:
  - Pagos `created` o `unknown` de más de 10 min.
  - Pagos `executed` sin `order_id`.
  - Filas con `fulfillment_error` o `fulfillment_warning`.
  - Filas con `refund_required`.
  - Éxito reportado por el cliente sin IPN.
  - Pagos `executed` con algún sub_order cancelado, con el monto a devolver.
- Antes de aplicar: se prueban todas las funciones sobre prod dentro de `BEGIN … ROLLBACK` (patrón de 046).

### 2. Edge Functions (nuevas; `create-web-order` no se toca)
- **`_shared/pricing.ts`**: **copia** (no extracción) de los pasos 1–5 de `create-web-order/index.ts`: resolver token, scope, restaurantes abiertos, items disponibles, customizations requeridas y repricing. Devuelve el snapshot listo para insertar con el mismo shape de error `cart_invalid`. Consolidar con `create-web-order` queda como follow-up, en un deploy aparte con smoke test de COS.
- **`_shared/yappy.ts`**:
  - Config por `env`, leída de los secrets `YAPPY_UAT_MERCHANT_ID`, `YAPPY_UAT_SECRET`, `YAPPY_UAT_BASE_URL` y `YAPPY_UAT_DOMAIN`.
  - `centsToYappy(c)` con aritmética entera, más el assert `subtotal + taxes − discount == total` y el rango 1–999 999 ¢.
  - `computeYappyHash` / `validateYappyHash`:
    - La clave es el primer segmento (separado por `.`) del secret decodificado en base64.
    - HMAC-SHA256 en hex de `orderId+status+domain`.
    - Comparación en tiempo constante y en minúsculas.
  - `fetchWithTimeout` de 8 s.
- **`yappy-create`** (POST; CORS restringido a `YAPPY_DOMAIN` y a localhost en dev):
  1. Body: el carrito, `tableToken`, `checkoutKey` (uuid), `aliasYappy` y los datos del cliente.
  2. Valida el alias (`^\d{8}$` tras normalizar).
  3. Llama a `get_payment_options`; si Yappy no está disponible, responde 409 `yappy_unavailable`.
  4. Precia con `pricing.ts`.
  5. Llama a `yappy_begin_payment`. Si devuelve un intento existente, devuelve el mismo `transactionId`, `token` y `documentName` sin llamar a Yappy de nuevo.
  6. Llama a `validate/merchant` (token nuevo en cada intento) y luego a `payment-wc` (`Authorization: <token>`, `ipnUrl=${SUPABASE_URL}/functions/v1/yappy-ipn`).
  7. Resultados:
     - Un código E00x definido → `failed` con un mensaje en español (doc §4).
     - Timeout, 5xx o respuesta ilegible → `unknown`, con el mensaje "No pudimos iniciar el pago" y sin reintento automático.
     - OK → `created`.
  8. Responde `{paymentId, transactionId, token, documentName, expiresAt}`.
  9. Una acción aparte, `{action:'client_success', paymentId}`, solo marca `client_reported_success_at` como pista. **Nunca crea la orden.**
- **`yappy-ipn`** (GET, `verify_jwt=false`, mínima):
  1. `console.log` del query y luego INSERT en `yappy_ipn_events`. Si ese insert falla, responde 5xx.
  2. Busca el pago por `orderId`; si no existe: 200 `{success:false}`.
  3. Valida el hash con el secret del `env` de la fila y que `domain` coincida. Si falla: 200 `{success:false}`.
  4. Llama de forma síncrona a `yappy_apply_ipn` y responde 200 `{success:true}`. Es un solo round trip a la DB, muy por debajo de 5 s.
- **Deploy por MCP**: `index.ts` y `../_shared/*.ts` van en `files`. Si el MCP no resuelve rutas relativas, los módulos se copian dentro de cada función.

### 3. order-web
- `lib/yappy.ts`: `getPaymentOptions`, `createYappyPayment` (`functions.invoke('yappy-create')`), `getYappyPaymentStatus`, `reportClientSuccess`, y la lectura y escritura del pago pendiente en localStorage (`kiki-yappy-pending` = `{paymentId, checkoutKey, createdAt}`).
- `components/checkout/YappyButton.tsx` (solo cliente):
  - Carga una vez `NEXT_PUBLIC_YAPPY_CDN_URL`. Si `onerror` falla o `isYappyOnline` da false, cae a los métodos de pago en entrega con un aviso.
  - Renderiza `<btn-yappy>` con la declaración JSX para React 19.
  - En `eventClick`: guarda el pending, llama a `createYappyPayment` y luego a `eventPayment`, con `isButtonLoading` activo para bloquear el doble clic.
- `components/checkout/YappyWaitingOverlay.tsx`, con el estilo de `DemoPaymentOverlay`:
  - "Abre Yappy y confirma". La cuenta regresiva parte del `expiresAt` del servidor y hace polling cada 3 s.
  - `executed` con orden: `clearCart`, `setLastOrder`, borra el pending y navega a `/order/{id}/thank-you`.
  - `executed` sin orden todavía: "Pago recibido, creando tu pedido…". Sigue haciendo polling y, después de 60 s, muestra "Pago recibido; el comercio lo está revisando" con el número de confirmación.
  - `cancelled`, `failed` o `expired` (vía IPN): ofrece reintentar con un `checkoutKey` nuevo.
  - Pasan 5:00 sin IPN: **no** ofrece reintentar. Muestra "Si ya confirmaste en Yappy, no pagues de nuevo" y sigue haciendo polling 10 min más. "No pagué, reintentar" aparece solo al final de esa ventana.
- **Reanudar**: al cargar el storefront o el checkout con un pending vivo, reabre el overlay. Si ve `executed`, limpia el carrito.
- `app/checkout/page.tsx`: llama a `getPaymentOptions(tableToken)` al montar.
  - Si devuelve `yappy:true`: la opción "Yappy — pagas ahora" reemplaza a "Yappy (en entrega)", con el campo "Número Yappy" precargado desde el celular. El botón de Yappy reemplaza a "Confirmar" y respeta `canSubmit`.
  - Si no: queda todo exactamente igual que hoy. Los demos tampoco cambian.
- Tracker: "Pagado con Yappy" cuando `payment_status='paid'` (el banner de "pago en entrega" ya se oculta en ese caso).
- Variable de Vercel: `NEXT_PUBLIC_YAPPY_CDN_URL` con el CDN de UAT.

### 4. POS (`apps/admin`): solo visual
- Chip **PAGADO** o **POR COBRAR** en `OrderCard`, en `OrderDetailsModal` y en el ticket (`printerService.ts`), a partir de `payment_status`, que ya se carga en `useOrdersStore`. Así el personal no cobra dos veces ni entrega sin cobrar; también ayuda a COS. Se publica con el siguiente OTA o build del POS.

### 5. Tests
- `supabase/functions/_shared/yappy.test.ts` (`node --experimental-strip-types --test`). Compara el hash contra `node:crypto` (válido, malo, mayúsculas, longitud distinta, sin `.`) y prueba `centsToYappy` (0, 1, 99, 100, 535, 999999, rechazo de 1000000).
- SQL en `BEGIN … ROLLBACK` sobre prod:
  - `apply_ipn E` crea la orden y el número.
  - Un `E` repetido no hace nada.
  - `C` y luego `E` termina en `executed`.
  - `E` y luego `C` se ignora.
  - Dos intentos con el mismo `checkout_key` y ambos en `E` dejan una sola orden y `refund_required`.
  - Un snapshot con FK rota deja `executed`, `fulfillment_error` y ninguna orden.
  - Rate limit y circuit breaker.
  - Las RPCs anon no exponen columnas sensibles.
  - `anon` no puede ejecutar `yappy_apply_ipn` (prueba por REST).

## Tareas de Edgar
1. En Supabase → Edge Functions → Secrets: `YAPPY_UAT_MERCHANT_ID`, `YAPPY_UAT_SECRET`, `YAPPY_UAT_BASE_URL=https://api-comecom-uat.yappycloud.com` y `YAPPY_UAT_DOMAIN=https://order.estoeskiki.com`. Nunca pasan por el chat ni por git.
2. En Vercel: `NEXT_PUBLIC_YAPPY_CDN_URL=https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js`, y desplegar order-web. El botón no funciona en localhost ni en previews porque el dominio tiene que coincidir.
3. Tener lista la app Yappy de pruebas (Android) y el número de prueba.
4. **Antes de producción** (no bloquea UAT): decidir quién es el *merchant of record*. Un solo `merchantId` cobrando carritos de varios locales implica liquidar después a cada local.

## Verificación
1. Los tests de Node pasan y la matriz SQL con rollback pasa.
2. **No regresión en COS**: `create-web-order` y `get_public_storefront` siguen en la misma versión; abrir el storefront de COS y el de demo-1 sin cambios.
3. **T4 (hash falso)**: curl al IPN con `hash=deadbeef` → 200 `{success:false}`, sin cambios de estado y con el evento `hash_valid=false`. Un orderId desconocido da el mismo resultado.
4. **Create por curl** en horario UAT (hoy jueves 22-oct; en Ámsterdam es de 14:00 a 01:30) → `transactionId`. Repetir el mismo `checkoutKey` devuelve el mismo intento sin llamar a Yappy.
5. **T1, T2 y T3** en `order.estoeskiki.com/t/13ce08bf3c526920f71a7540` (Plaza Mayor, Mesa 5):
   - **E**: orden PAGADO en el POS de Kiki Centro y Kiki Sushi; el tracker avanza.
   - **C**: reintentar, sin orden.
   - **X**: aviso de "no pagues de nuevo" y luego expirado.
6. **T5**: reenviar la URL real del IPN de T1 → 200, sin orden duplicada.
7. **Resiliencia**: cerrar la pestaña mientras se espera, reabrir y ver que se reanuda. Dos pestañas a la vez: la segunda queda bloqueada por el índice de alias.
8. **T6 y T7**: número sin Yappy (E005), alias de 7 dígitos y monto fuera de rango, todos con un mensaje claro. Fuera del horario UAT, la opción no aparece.
9. `yappy_attention` vacía, o con cada fila explicada. Al final, borrar las órdenes de prueba de Plaza Mayor.

## Runbook (UAT)
- **Pagado sin orden** (`fulfillment_error`): corregir la causa y re-ejecutar el fulfill desde el snapshot con SQL.
- **`refund_required` o sub_order cancelado**: anular o devolver desde Yappy Comercial el mismo día y anotarlo en la fila.
- **`unknown` o `created` viejo, o éxito del cliente sin IPN**: revisar en Yappy Comercial. Si está pagado, aplicar `yappy_apply_ipn('E', …)` a mano.
- Conciliación diaria contra el reporte de Yappy Comercial mientras dure UAT.

**Fuera de alcance:** pasar a producción y que `create-web-order` rechace `yappy` en venues con Yappy activo. Esto último se hace antes de habilitar cualquier venue real, en un deploy aislado con smoke test de COS.


## Yappy handover from docs
# Plan de implementación — Botón de Pago Yappy en Kiki (ambiente UAT)

> **Para el agente:** este documento resume TODA la documentación de Yappy (https://yappy-docs.vercel.app/boton-pago/*, manual v1.0.3, changelog v2.1 de sep 2026) y la traduce en tareas concretas para la app web de Kiki. Antes de escribir código, inspecciona el repo para identificar el stack real (React + Supabase + Vercel es lo esperado) y adapta los snippets. No inventes campos ni endpoints que no estén aquí.

---

## 0. Contexto y estado actual

- **Paso 1 (credenciales) — HECHO por Edgar.** Ya existen `merchantId` (UUID) y `CLAVE_SECRETA` (base64). La clave se muestra una sola vez y regenerarla invalida la anterior.
- **Pendiente:** paso 2 (web component), paso 3 (backend: crear orden + IPN), paso 4 (validación de hash), paso 5 (pruebas en UAT).
- **Objetivo de este plan:** tener el flujo completo funcionando en **UAT** y probado con los 3 estados (E, C, X). La salida a producción queda documentada en la sección 9, pero NO se ejecuta todavía.

### Cómo funciona el flujo (resumen)

```
Usuario (checkout Kiki) → click en <btn-yappy>
  → Frontend llama POST /api/yappy/create-order  (nuestro backend)
      → Backend: POST {BASE}/payments/validate/merchant   → token (TTL 10 min, uso único) + epochTime
      → Backend: POST {BASE}/payments/payment-wc          → transactionId + token + documentName
  → Frontend llama btnYappy.eventPayment({ transactionId, token, documentName })
  → Al cliente le llega el cobro en su app Yappy → tiene 5 MINUTOS para confirmar
  → Yappy llama GET {ipnUrl}?orderId&hash&status&domain&confirmationNumber   (asíncrono)
      → Backend valida HMAC-SHA256 → actualiza la orden → responde HTTP 200 (< 5 s)
  → Frontend se entera del estado final leyendo la BD (no confía solo en eventos del botón)
```

Reglas clave: el backend **nunca espera** el pago; el **IPN es la única fuente oficial** del resultado; solo hay 3 estados finales: `E` (ejecutado), `C` (cancelado), `X` (expirado).

---

## 1. Prerrequisitos (tareas humanas de Edgar — verificar antes de probar)

- [ ] **Confirmar que las credenciales son de UAT.** Deben haberse generado en la plataforma UAT `https://comwebuat.yappycloud.com/`, NO en la productiva (`https://comercial.yappy.com.pa/`). Mezclar credenciales de un ambiente con el otro es uno de los 5 errores más comunes.
- [ ] **Anotar el dominio exacto registrado** en Yappy Comercial WEB al crear el botón (ej. `https://kiki.app`). Se usa tal cual en `urlDomain` y `domain`; debe coincidir exactamente (http vs https, slash final, subdominio, mayúsculas).
- [ ] **Solicitar la app Yappy de pruebas** (no es la de Play Store) a `botondepagoyappy@bgeneral.com` enviando:
  - Nombre del comercio (afiliado a Yappy Comercial) y datos de contacto de los responsables.
  - Correo para la invitación (idealmente el del dispositivo Android) y versión de Android.
  - Llega invitación de **Firebase App Distribution** → instalar **App Tester** → instalar la versión cuyo nombre contenga `release/REP-XXXX`.
- [ ] **Recibir número de teléfono + contraseña de prueba** del equipo de Yappy Comercial. Primer login: "Inicio de sesión" → si aparece un segundo formulario, confirmar el token → "Ir a Banco Mock" → Siguiente → Confirmar. Configurar biometría (Preferencias y seguridad → Configuración de biometría) para evitar bloqueos del número.
- [ ] **Tener un dispositivo Android** para la app de pruebas.
- [ ] **Horario UAT:** lunes a viernes, 7:00 AM – 6:30 PM hora de Panamá (UTC‑5). En Ámsterdam: **14:00–01:30** hasta el 25 oct 2026; **13:00–00:30** desde el 26 oct (horario de invierno). Fuera de ese horario las APIs de UAT no responden — no lo confundas con un bug.

---

## 2. Variables de entorno

Nunca hacer commit de estos valores. Secretos solo en el servidor (Vercel env / Supabase secrets).

```bash
YAPPY_ENV=uat
YAPPY_BASE_URL=https://api-comecom-uat.yappycloud.com
YAPPY_MERCHANT_ID=<uuid de UAT>                 # servidor
YAPPY_CLAVE_SECRETA=<base64 de UAT>             # servidor, SECRETO
YAPPY_DOMAIN=<dominio exacto registrado>        # servidor, ej. https://kiki.app
YAPPY_IPN_URL=<url pública GET del IPN>         # servidor, ej. https://kiki.app/api/yappy/ipn

# Frontend (público, prefijo según framework: VITE_ / NEXT_PUBLIC_)
YAPPY_CDN_URL=https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js
```

Recomendado: un único `YAPPY_ENV` (`uat` | `production`) que seleccione el set de URLs, para facilitar el cambio y rollbacks.

---

## 3. Modelo de datos (Supabase / Postgres)

Crear una migración. Ajustar nombres a las tablas existentes de órdenes de Kiki.

```sql
create table yappy_payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id),   -- orden de Kiki
  yappy_order_id      text not null unique,                   -- orderId enviado a Yappy (alfanumérico, ≤32)
  alias_yappy         text not null,                          -- 8 dígitos
  subtotal            numeric(10,2) not null,
  taxes               numeric(10,2) not null default 0,
  shipping            numeric(10,2) not null default 0,
  discount            numeric(10,2) not null default 0,
  total               numeric(10,2) not null,
  transaction_id      text,                                   -- devuelto por payment-wc
  status              text not null default 'creating'
                      check (status in ('creating','created','executed','cancelled','expired','failed')),
  confirmation_number text,                                   -- del IPN, para conciliación
  error_code          text,                                   -- E002, E004, E005...
  env                 text not null default 'uat',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table yappy_ipn_events (                               -- log de seguridad/auditoría
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  query       jsonb not null,                                 -- todos los params recibidos
  hash_valid  boolean not null,
  applied     boolean not null default false,
  note        text
);
```

- **RLS:** el cliente puede **leer** el estado de su propio pago (para mostrarlo / realtime) pero **nunca escribir**. Todas las escrituras van con service role desde el backend.
- Un intento de pago = una fila nueva (cada reintento genera un `yappy_order_id` nuevo, porque debe ser único).
- La orden de Kiki solo pasa a "pagada" / se envía a cocina cuando el IPN llega con `E` y hash válido.

---

## 4. Backend — Endpoint A: crear orden (`POST /api/yappy/create-order`)

Ubicación: donde viva el backend de Kiki (Vercel API route / Next route handler, o Supabase Edge Function). El `merchantId` y la clave **nunca** deben llegar al frontend (la doc dice que el backend es obligatorio).

**Input desde el frontend:** `{ kikiOrderId, phone }`. Los montos se calculan en el servidor desde la orden en BD — nunca confiar en montos del cliente.

**Pasos:**

1. Cargar la orden de Kiki; verificar que pertenece a la sesión/mesa y que está pendiente de pago.
2. Validar `phone` con `/^\d{8}$/` (celular panameño, sin guiones ni prefijo `+507`).
3. Calcular montos en centavos (enteros) y formatear como **string con 2 decimales**: `(cents/100).toFixed(2)`.
   - `subtotal` ≥ `"0.01"`, `total` entre `"0.01"` y `"9999.99"`; `shipping`, `discount`, `taxes` ≥ `"0.00"`.
   - Validar `total = subtotal + taxes + shipping - discount` (E010 = montos incorrectos).
4. Generar `yappyOrderId`: **alfanumérico, 1–32 chars, único**. Recomendado: `crypto.randomUUID().replace(/-/g, '')` (exactamente 32 hex). Insertar fila `yappy_payments` con status `creating`.
5. **Validar comercio** (pedir token NUEVO en cada intento; no cachear — TTL 10 min y uso único):
   ```http
   POST {YAPPY_BASE_URL}/payments/validate/merchant
   Content-Type: application/json

   { "merchantId": "<YAPPY_MERCHANT_ID>", "urlDomain": "<YAPPY_DOMAIN>" }
   ```
   Respuesta OK: `{ "status": { "code": "0000", ... }, "body": { "token": "...", "epochTime": 1777301827 } }`.
   401 ⇒ `merchantId` o `urlDomain` no coinciden con lo registrado.
6. **Crear orden de pago:**
   ```http
   POST {YAPPY_BASE_URL}/payments/payment-wc
   Content-Type: application/json
   Authorization: <token>            ← SIN "Bearer"

   {
     "merchantId": "<YAPPY_MERCHANT_ID>",
     "orderId": "<yappyOrderId>",
     "domain": "<YAPPY_DOMAIN>",
     "paymentDate": <epochTime de validate, como número>,
     "aliasYappy": "<8 dígitos>",
     "ipnUrl": "<YAPPY_IPN_URL>",
     "shipping": "0.00",
     "discount": "0.00",
     "taxes": "0.35",
     "subtotal": "5.00",
     "total": "5.35"
   }
   ```
   - **NO enviar `successUrl` ni `failUrl`** (este producto no usa redirects; puede fallar).
   - Respuesta OK: `{ "status": { "code": "0000" }, "body": { "transactionId": "MRALB-83409803", "token": "...", "documentName": "transactions" } }`.
7. Guardar `transaction_id`, status `created`. Si `status.code !== "0000"`, guardar `error_code`, status `failed`, y devolver error legible.
8. **Responder al frontend con la misma forma que espera el snippet oficial:**
   `{ "body": { "transactionId", "token", "documentName" } }`.

**Detalles de robustez:** timeout de ~10 s en cada fetch (AbortController); loguear request/response sin el secreto; `JSON.stringify` siempre (evita "smart quotes"); nunca concatenar JSON a mano.

**Mapeo de errores de Yappy → mensaje al usuario:**

| Código | Significado | Qué mostrar / hacer |
|---|---|---|
| E002, E006, E008 | Algo salió mal | "Intenta nuevamente" (permitir reintento) |
| E004 | Atributos inválidos / campo vacío | Bug nuestro: revisar alias 8 dígitos, orderId ≤32 alfanum., montos "0.00", comillas |
| E005 | Número no registrado en Yappy | "Este número no tiene Yappy" → pedir otro número |
| E010 | Montos incorrectos | Bug nuestro: revisar suma de montos |
| E100 | Bad Request | Bug nuestro: revisar payload/headers |

---

## 5. Backend — Endpoint B: IPN (`GET /api/yappy/ipn`)

Requisitos duros de la doc:

- Método **GET** (no POST). Los datos llegan como **query params**.
- Accesible desde internet con **HTTPS** (no localhost, no detrás de firewall/protección).
- Responder **HTTP 200 en < 5 segundos**, SIEMPRE — incluso si el hash es inválido (devolver `{"success": false}`). Nunca 4xx/5xx (Yappy podría reintentar y saturar).
- **Idempotente:** el mismo `orderId` puede llegar más de una vez (hay reintentos limitados).

**Query params:** `orderId`, `hash`, `status` (E|C|X), `domain`, `confirmationNumber`.

```
GET https://kiki.app/api/yappy/ipn?orderId=ORD12345&hash=a3c1f8...&status=E&domain=https://kiki.app&confirmationNumber=8f3e2c91-...
```

**Lógica:**

1. Leer params (el framework ya los URL-decodifica; usar los valores decodificados).
2. Validar hash (sección 6). Insertar en `yappy_ipn_events` con `hash_valid`.
3. Si hash inválido → **no tocar la orden**, log de seguridad, responder `200 {"success": false}`. Si hay >3 fallos consecutivos, alertar (y eventualmente ticket a `yappy@bgeneral.com`).
4. Si válido → actualizar de forma atómica e idempotente:
   ```sql
   update yappy_payments
      set status = case $status when 'E' then 'executed' when 'C' then 'cancelled' when 'X' then 'expired' end,
          confirmation_number = $confirmationNumber,
          updated_at = now()
    where yappy_order_id = $orderId
      and status = 'created';          -- si ya está en estado final, no hace nada
   ```
   Si `E`: marcar la orden de Kiki como pagada y disparar fulfillment (enviar a cocina/KDS, factura fiscal si aplica). Hacerlo de forma que no bloquee la respuesta (> 5 s) — p. ej. trigger de BD o cola.
   Verificar también que `domain` == `YAPPY_DOMAIN` y que el `orderId` existe.
5. Responder `200 {"success": true}`.

**Gotchas de hosting (MUY importantes para que el IPN llegue):**

- **Supabase Edge Function:** por defecto exige JWT → Yappy recibiría 401. Desplegar la función del IPN con `--no-verify-jwt` (o `verify_jwt = false` en `config.toml`) y usar el hash como autenticación.
- **Vercel:** los preview deployments suelen tener *Deployment Protection* (Vercel Authentication) → Yappy recibiría 401/redirect. Usar el dominio de producción/estable registrado, o desactivar la protección para esa ruta.
- Para desarrollo local se puede usar un túnel (ngrok/cloudflared), pero el `domain` registrado en Yappy debe coincidir; lo más simple es probar contra el despliegue en el dominio registrado.

---

## 6. Validación del hash (obligatoria)

**Algoritmo:**

1. Decodificar `CLAVE_SECRETA` de **base64 → texto UTF-8**.
2. Hacer `split('.')` y usar **solo el primer segmento** como llave HMAC (si no hay `.`, se usa el texto completo).
3. Mensaje = `orderId + status + domain` concatenados **sin separadores ni espacios** (ej. `abc123Ehttps://tudominio.com`), en UTF-8.
4. `HMAC-SHA256(mensaje, llave)` → **hex en minúsculas**.
5. Comparar en tiempo constante con el `hash` recibido.

**Node.js (Vercel / Next):**

```ts
import crypto from 'node:crypto';

export function validateYappyHash(orderId: string, status: string, domain: string, receivedHash: string): boolean {
  const decoded = Buffer.from(process.env.YAPPY_CLAVE_SECRETA!, 'base64').toString('utf-8');
  const key = decoded.split('.')[0];
  const expected = crypto.createHmac('sha256', key).update(orderId + status + domain, 'utf8').digest('hex');
  const a = Buffer.from((receivedHash || '').toLowerCase(), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;          // timingSafeEqual lanza error si difieren
  return crypto.timingSafeEqual(a, b);
}
```

**Deno / Supabase Edge Functions (Web Crypto):**

```ts
export async function validateYappyHash(orderId: string, status: string, domain: string, receivedHash: string) {
  const b64 = Deno.env.get('YAPPY_CLAVE_SECRETA')!;
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  const keyStr = decoded.split('.')[0];
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(orderId + status + domain)));
  const expected = [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
  const received = (receivedHash || '').toLowerCase();
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}
```

**Errores típicos:** no decodificar el base64; usar la clave completa en vez del primer segmento; separadores/espacios en la concatenación; usar `sha256` en vez de `hmac-sha256`; hex en mayúsculas; encoding distinto de UTF-8.

**Tests unitarios:** escribir un test que genere un hash con una clave de prueba conocida y verifique válido/inválido, longitud distinta, mayúsculas. Para depurar casos reales, usar el **Validador de Hash** de la doc: https://yappy-docs.vercel.app/boton-pago/hash-validator (corre local en el navegador).

---

## 7. Frontend — Web Component en el checkout de Kiki

**Cargar el script (una sola vez, como módulo):**

```html
<script type="module" src="https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js"></script>
```
En React: inyectarlo desde un `useEffect` usando `YAPPY_CDN_URL` (evitar duplicados si ya existe), o en el `index.html`/layout.

**Insertar el botón:**

```html
<btn-yappy theme="blue" rounded="true"></btn-yappy>
```
Themes oficiales (únicos permitidos, no se puede modificar color/tipografía/ícono): `blue`, `darkBlue`, `orange`, `dark`, `sky`, `light`. `rounded="true"` opcional. Elegir el que mejor contraste con el diseño de Kiki (dark navy/lime → probablemente `light` o `sky`).

**API del componente:**

| Nombre | Tipo | Uso |
|---|---|---|
| `eventClick` | evento (requerido) | Usuario hizo click → llamar a nuestro `POST /api/yappy/create-order` |
| `eventSuccess` | evento (requerido) | Transacción ejecutada; detalle en `event.detail` |
| `eventError` | evento (requerido) | Transacción fallida; detalle en `event.detail` |
| `eventPayment(...)` | **método** | Lo invocamos nosotros con `{ transactionId, token, documentName }` tras crear la orden |
| `isYappyOnline` | opcional | true si el canal Yappy está disponible (ocultar/deshabilitar el botón si es false) |
| `isButtonLoading` | property | `true` para mostrar estado de carga mientras creamos la orden |
| `triggerModal` | property | Controla si se muestra el modal con el contador de la transacción |

**Captura del número Yappy:** `payment-wc` exige `aliasYappy` (8 dígitos) pero el componente no lo envía. Añadir en el checkout un input de teléfono (`inputmode="numeric"`, validación `^\d{8}$`, prefijo visual "+507") y no permitir el click si es inválido. Enviarlo en el body de `create-order`.

**Componente React (esqueleto):**

```tsx
// Declaración de tipos para el custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { theme?: string; rounded?: string };
    }
  }
}

type YappyEl = HTMLElement & {
  eventPayment: (p: { transactionId: string; token: string; documentName: string }) => void;
  isButtonLoading?: boolean;
};

export function YappyButton({ kikiOrderId, phone, onPending }: { kikiOrderId: string; phone: string; onPending: (txId: string) => void }) {
  const ref = useRef<YappyEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = async () => {
      if (!/^\d{8}$/.test(phone)) return; // mostrar error en UI
      el.isButtonLoading = true;
      try {
        const res = await fetch('/api/yappy/create-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kikiOrderId, phone }),
        });
        const result = await res.json();
        const b = result?.body;
        if (b?.token && b?.documentName && b?.transactionId) {
          el.eventPayment({ transactionId: b.transactionId, documentName: b.documentName, token: b.token });
          onPending(b.transactionId); // UI: "Abre tu app Yappy y confirma (5 min)"
        } else { /* mostrar error mapeado */ }
      } finally { el.isButtonLoading = false; }
    };
    const onSuccess = (e: Event) => console.log('eventSuccess', (e as CustomEvent).detail);
    const onError   = (e: Event) => console.log('eventError',   (e as CustomEvent).detail);
    el.addEventListener('eventClick', onClick);
    el.addEventListener('eventSuccess', onSuccess);
    el.addEventListener('eventError', onError);
    return () => {
      el.removeEventListener('eventClick', onClick);
      el.removeEventListener('eventSuccess', onSuccess);
      el.removeEventListener('eventError', onError);
    };
  }, [kikiOrderId, phone]);

  return <btn-yappy ref={ref as any} theme="light" rounded="true" />;
}
```

**Estado final en la UI:** los eventos `eventSuccess`/`eventError` son solo para feedback visual. La confirmación real es el IPN → la UI debe suscribirse a la fila de `yappy_payments` (Supabase Realtime) o hacer polling cada ~3 s hasta `executed` / `cancelled` / `expired`, con contador de 5 min. Pantallas:
- `executed` → "Pago confirmado / Gracias por tu compra", orden enviada a cocina.
- `cancelled` / `expired` → mensaje + botón "Reintentar" (crea un intento nuevo con nuevo `yappyOrderId`).

---

## 8. Plan de pruebas en UAT (en horario UAT)

Usar el número de prueba de Yappy como `aliasYappy` y la app de pruebas en Android. Registrar para cada caso: `yappyOrderId`, `transactionId`, query del IPN, resultado del hash.

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| T1 | **Pago ejecutado (E)** | Checkout → click → confirmar en la app de prueba | IPN `status=E`, hash válido, orden pagada y en cocina, UI muestra éxito |
| T2 | **Cancelado (C)** | Click → cancelar en la app | IPN `status=C`, orden no pagada, UI permite reintentar |
| T3 | **Expirado (X)** | Click → no hacer nada 5 min | IPN `status=X`, UI muestra expirado + reintento |
| T4 | **Hash falso** | `curl "https://<dominio>/api/yappy/ipn?orderId=<existente>&status=E&domain=<dominio>&hash=deadbeef&confirmationNumber=x"` | HTTP 200 `{"success":false}`, orden SIN cambios, evento en `yappy_ipn_events` con `hash_valid=false` |
| T5 | **IPN repetido** | Re-enviar la misma URL del IPN real de T1 | 200, sin doble fulfillment ni cambios |
| T6 | **Número sin Yappy** | Usar un número de 8 dígitos no registrado | E005 manejado con mensaje claro |
| T7 | **Validación local** | Teléfono de 7 dígitos, monto 0, monto > 9,999.99 | Bloqueado antes de llamar a Yappy |
| T8 | **Duplicados** | Dos intentos con mismo número y mismo monto en < 5 min | Yappy retiene como duplicado; la UI no se rompe (documentar comportamiento observado) |
| T9 | **Token no reutilizado** | Dos pagos seguidos | Cada uno llama a `validate/merchant` de nuevo, sin 401 |
| T10 | **Latencia IPN** | Medir tiempo de respuesta del endpoint | < 5 s (idealmente < 1 s) |
| T11 | **Fuera de horario UAT** | Intentar fuera de horario | Error controlado, sin estados corruptos |

**Criterio de "hecho":** T1–T5 pasan, con al menos un caso real E, C y X con hash válido (es requisito del checklist de producción).

### Resultados UAT (Plaza Mayor)

| # | Resultado | Evidencia |
|---|---|---|
| T1 | ✅ | 2026-10-29 `99a7dc6a` QBRZY-87919484 (IPN +1:21); 2026-10-30 `b1b4bd9d` LEKTN-65431487 (IPN +24 s). Orden pagada, sub_orders pagadas, totales cuadran |
| T2 | ✅ | 2026-10-30 `d4725ac9` (C +30 s), `85763508` (C +9 s), hash válido. Un rechazo previo (`9e3be2fe`, 16:27 UTC) nunca recibió IPN (ni C ni X) → expirado por nuestro servidor |
| T3 | ✅ | `292f12e2`, `a8eb1123`, `230ea27a`, `070b7ea5`: X ~4–7 s tras expirar, hash válido |
| T4 | ✅ | hash falso → `{"success":false}`, `invalid_hash`, sin cambios. 2026-10-30: IPN real con `status` cambiado a C → `invalid_hash`, pago sigue `executed` |
| T5 | ✅ | 2026-10-30 IPN real de `b1b4bd9d` reenviado 2× → 200 `{"success":true}`, `already_executed`, 1 sola orden, sin attention |
| T6 | ✅ | 60800558 → E005 con mensaje claro |
| T7 | ⚠️ | 7 dígitos bloqueado local + servidor; monto fuera de rango → `amount_out_of_range`. `12345678` (no empieza con 6) llega a Yappy → YAPPY-004 con mensaje genérico (pendiente: validar `^6\d{7}$` + mapear YAPPY-004) |
| T8 | ➖ | Mismo número y monto (38.97) tras un C en < 1 min → Yappy aceptó y ejecutó (no lo trató como duplicado). Dos activos a la vez los bloquea nuestro servidor (`alias_busy` / mismo intento) |
| T9 | ✅ | Pagos seguidos 20:50 / 20:55 (2026-10-29) y 21:43–21:44 (2026-10-30) sin 401 |
| T10 | ✅ | IPN 653–821 ms (logs), reenvíos 0.9–1.7 s |
| T11 | ✅ | Domingo: `outside_uat_hours`, sin estados corruptos |
| Reanudar | ✅ | Cerrar pestaña durante la espera y volver → retoma el intento (Edgar, 2026-10-30) |
| Límite | ✅ | 4º intento del mismo número en 10 min → "Demasiados intentos" (`rate_limited`) |

**Si algo falla:**
- 401 en validate → `merchantId` o `urlDomain` no coinciden exactamente / credenciales de otro ambiente.
- 401 en payment-wc → token vencido/reutilizado o se envió con "Bearer".
- E004 → alias, orderId, formato de montos o comillas.
- No llegan IPNs → ruta declarada como POST, URL no pública (JWT de Supabase / protección de Vercel), `ipnUrl` distinta a la real, o respuesta lenta/4xx.
- Hash no coincide → usar el Validador de Hash con los valores reales del IPN.
- Soporte: `botondepagoyappy@bgeneral.com` (incluir nombre del comercio, descripción, `orderId` afectado, logs/screenshots).

---

## 9. Salida a producción (NO ejecutar aún — solo dejar preparado)

Checklist:
- [ ] Hash validado con casos E, C y X en UAT.
- [ ] Endpoint IPN público, HTTPS, 200 en < 5 s.
- [ ] **Credenciales productivas nuevas** generadas en `https://comercial.yappy.com.pa/` (las de UAT no sirven en prod) y guardadas en gestor de secretos.
- [ ] Swap de URLs vía `YAPPY_ENV=production`:
  - Backend: `https://apipagosbg.bgeneral.cloud`
  - CDN: `https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js`
- [ ] `ipnUrl` apuntando a la URL productiva permanente (no túneles).
- [ ] Smoke test con **$0.01** y un número Yappy real; verificar IPN y hash.
- [ ] Plaza Mayor apunta al merchant productivo; luego migración con la regla `uat_account_on_live_owner` (merchants UAT solo en patios demo, `plans/payments-onboarding.md` 4.4).
- [ ] Monitoreo: logs estructurados por IPN, alerta si falla la validación de hash, conteo de transacciones por estado; vigilar 24 h tras el lanzamiento.

Producción funciona 24/7 y con la app Yappy pública (multi-banco, 8 bancos en Panamá).

---

## 10. Notas y puntos abiertos

- **Reglas de plataforma:** límites por transacción $0.01–$9,999.99 (no acumulativos). Duplicado = mismo alias origen + mismo alias destino + mismo monto en 5 min.
- **Descripción del cobro:** la doc menciona sanitización (solo letras, números, espacios y `-`; tildes → sin tilde; vacío → "A YAPPY"), pero `payment-wc` no lista un campo de descripción. No enviarlo salvo que Yappy lo confirme.
- **Conciliación:** guardar siempre `confirmationNumber`. Existen "APIs de Integración" (historial, consulta puntual, anulación hasta medianoche del mismo día) que NO están documentadas aquí — fuera de alcance; pedirlas al Customer Success Officer si se necesitan reembolsos.
- **Semántica de `isYappyOnline` / `triggerModal`:** la doc solo los describe brevemente. Inspeccionar el componente en runtime antes de depender de ellos.
- **Fuente:** https://yappy-docs.vercel.app/boton-pago/overview (y subpáginas: quickstart, credentials, auth, web-component, api-validate, api-payment-wc, ipn, hash-validation, transaction-handling, errors, uat, production, troubleshooting, faq, hash-validator) + /changelog.
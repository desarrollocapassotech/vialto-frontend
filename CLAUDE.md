## Multi-tenant (obligatorio antes de tocar llamadas a la API)

Antes de crear o modificar llamadas a la API o manejar datos de empresa, seguí las reglas
de higiene multi-tenant. **No las dupliques acá**: la fuente de verdad es un solo archivo.

@docs/reglas-multitenant.md

---

## Arquitectura del proyecto

A continuación se incluye el contenido completo del documento de arquitectura
que debés respetar en todo momento:

# Vialto Frontend — Arquitectura

> SPA React para operación logística multi-tenant.
> Este archivo adapta la arquitectura general de Vialto al contexto de frontend.
> Leer antes de crear páginas, componentes o flujos nuevos.

---

## Objetivo del frontend

El frontend debe ofrecer una experiencia clara para empresas de transporte y logística, respetando el modelo multi-tenant y los permisos por rol definidos en Clerk, sin duplicar lógica y sin crecer en código monolítico.

---

## Stack tecnológico (frontend)

| Capa | Tecnología | Uso |
|---|---|---|
| App SPA | React 19 + TypeScript | UI principal y navegación |
| Routing | React Router | Rutas públicas y privadas |
| Auth | Clerk (`@clerk/clerk-react`) | Sesión, organización activa, roles |
| Estilos | Tailwind CSS v4 | Sistema visual y utilidades |
| Build | Vite 6 | Desarrollo local y build de producción |
| Observabilidad | Sentry (`@sentry/react`) | Errores en cliente y trazas |

---

## Principios de arquitectura (CRÍTICO)

1. **Priorizar modularización**: separar por dominio y responsabilidad (`pages`, `components`, `hooks`, `lib`, `types`).
2. **Reutilización primero**: extraer componentes, hooks y utilidades antes de copiar/pegar lógica.
3. **Evitar código extenso**: componentes/páginas grandes se deben dividir en piezas chicas, legibles y testeables.
4. **Datos y permisos desde el backend**: el frontend no implementa reglas de negocio de seguridad; solo refleja estado y permisos.
5. **Tipado fuerte**: toda integración API debe usar tipos explícitos en `src/types`.

### Reglas prácticas para mantener el código corto y reutilizable

- Si una pantalla mezcla layout, fetch, formularios y tablas, dividir en subcomponentes por responsabilidad.
- Si una lógica se repite en 2 lugares, moverla a `hooks` o `lib`.
- Si un componente supera un tamaño difícil de mantener, separarlo en versión contenedora + componentes presentacionales.
- Evitar helpers ad-hoc dentro de páginas cuando pueden vivir en `lib`.

---

## Modelo multi-tenant en frontend

El tenant se define por la organización activa de Clerk.

### Reglas absolutas

1. **Nunca confiar en tenantId ingresado manualmente por usuario final**.
2. **Las vistas tenant operan con el contexto de organización de Clerk**.
3. **Las vistas superadmin usan endpoints de plataforma y selección de empresa explícita**.
4. **El frontend debe asumir que el backend valida tenant y módulos habilitados**.
5. **Ante `403`, mostrar mensaje funcional y no técnico para guiar al usuario**.

---

## Estructura actual del frontend

> Este bloque muestra la forma de las carpetas, no un listado exhaustivo de archivos — cada módulo del backend (viajes, stock, combustible, facturación, integración ARCA/liquidaciones, destinatarios, direcciones de entrega, transportistas, importaciones, etc.) tiene hoy su propia carpeta en `components/` y su propio grupo de páginas en `pages/`, siguiendo la convención `XPage` / `XSuperadminPage` / `XTenantPage` descripta abajo. Antes de asumir que un archivo puntual no existe, buscarlo — esta lista no se mantiene campo a campo.

```txt
src/
  components/
    ui/                      # componentes shadcn/base
    superadmin/
    tenant/                  # TenantOwnerDashboard.tsx — dashboard real del tenant, montado en TenantHomePage
    combustible/             # CombustibleDashboardSection.tsx, CombustibleDashboardPanels.tsx
    stock/, viajes/, facturacion/, liquidaciones/, choferes/, clientes/,
    transportistas/, vehiculos/, destinatarios/, direcciones-entrega/
    crud/                    # CrudFieldLabel, CrudInput, CrudSelect, CrudFieldError, CrudFormErrorAlert
    forms/, listado/, shared/
    AppShell.tsx
    MissingClerkConfig.tsx
    Logo.tsx
  hooks/                     # useTenantsList.ts, useCurrentTenant.ts, useEntityList.ts,
                             # useTenantOwnerDashboard.ts, useImportWizard.ts, y uno por listado/módulo paginado
  lib/
    api.ts, friendlyError.ts, roleLabels.ts, sentry.ts, tenantModules.ts
    # + utilidades específicas por módulo (stock*, viajes*, combustible*, micCrt*, arca*, etc.)
  pages/
    HomePage.tsx             # decide SuperadminHomePage o TenantHomePage
    TenantHomePage.tsx       # monta TenantOwnerDashboard — este es el dashboard real
    SuperadminHomePage.tsx
    DashboardPage.tsx        # ⚠️ código huérfano, sin ruta en App.tsx — no es el dashboard activo, no editar pensando que sí
    ViajesPage.tsx / ViajeCreatePage.tsx / *SuperadminPage.tsx / *TenantPage.tsx
    ClientesPage.tsx, ChoferesPage.tsx, VehiculosPage.tsx, TransportistasPage.tsx,
    DestinatariosPage.tsx, DireccionesEntregaPage.tsx  # + Create/Edit por entidad
    Stock*Page.tsx           # panel, movimientos, ingresos, egresos, divisiones, productos, presentaciones, depósitos
    CombustiblePage.tsx / CombustibleTenantPage.tsx
    LiquidacionesTenantPage.tsx, ArcaConfigTenantPage.tsx, SuperadminArcaPage.tsx
    FacturacionPage.tsx / *SuperadminPage.tsx / *TenantPage.tsx
    SuperadminEmpresasPage.tsx, SuperadminUsersPage.tsx, UsuariosTenantPage.tsx, BaseDeDatosPage.tsx
  types/
    api.ts, ownerDashboard.ts, combustibleDashboard.ts, micCrtDocumento.ts
  App.tsx
  main.tsx
```

### Convención de páginas por módulo

- `XPage.tsx`: orquestador que decide variante por rol/contexto.
- `XSuperadminPage.tsx`: vista global de plataforma.
- `XTenantPage.tsx`: vista para organización activa.

Este patrón evita condicionales gigantes y mejora reutilización.

---

## Ruteo y auth

- `main.tsx` monta `ClerkProvider`, `BrowserRouter` e inicialización de Sentry.
- Si falta `VITE_CLERK_PUBLISHABLE_KEY`, se muestra `MissingClerkConfig`.
- `App.tsx` define:
  - rutas públicas: `/sign-in/*`, `/sign-up/*`
  - rutas protegidas con `RequireAuth`
  - shell principal con navegación y `Outlet`

---

## Capa de datos (API)

- `src/lib/api.ts` centraliza `apiFetch` y `apiJson`.
- En desarrollo, el frontend apunta por defecto a `http://localhost:8080` si no existe `VITE_API_URL`.
- Todas las requests autenticadas deben usar token de Clerk (`Authorization: Bearer`).
- Las páginas no deberían usar `fetch` directo; deben pasar por la capa de `lib/api.ts`.

---

## Manejo de errores y observabilidad

- `friendlyError.ts` transforma errores técnicos a mensajes útiles por contexto de pantalla.
- `sentry.ts` inicializa monitoreo cuando existe `VITE_SENTRY_DSN`.
- Los mensajes de UI deben ser claros, accionables y sin filtrar detalles internos del backend.

---

## Sistema visual

- Colores y tipografías del manual de marca definidos en `src/index.css`.
- Usar tokens (`vialto-*`) en lugar de colores hardcodeados.
- Mantener consistencia visual entre vistas tenant y superadmin.

---

## Integración con arquitectura general de Vialto

- El frontend consume módulos del backend (viajes, clientes, choferes, vehículos, etc.) sin romper aislamiento por tenant.
- Clerk es fuente de verdad para sesión, organización y rol.
- La suscripción comercial es por módulos habilitados por empresa (sin planes fijos).
- Firestore (si se usa en futuros módulos de tiempo real) debe limitarse a casos de actualización en vivo; el resto continúa en flujo API sobre PostgreSQL vía backend.

---

## Variables de entorno (frontend)

```env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

---

## Patrón de grilla: VER + modal read-only → EDITAR

**Regla global para todos los módulos actuales y futuros.**

La columna de acciones de cualquier listado debe exponer **únicamente el botón "Ver"** por fila. Al hacer clic se abre un modal en modo solo lectura (read-only). Dentro del modal hay un botón "Editar" que transiciona al formulario de edición.

### Dos patrones según el tipo de edición

| Tipo de edición | Patrón |
|---|---|
| Edición en página separada (`/entidad/:id/editar`) | Crear `EntidadViewModal.tsx` con `editTo: string` (Link interno). |
| Edición en modal existente | Agregar `modo: 'view'` al modal; `onEdit?: () => void` que cambia al modo edit. |

### Estructura de un ViewModal

```tsx
// src/components/<dominio>/<Entidad>ViewModal.tsx
export function EntidadViewModal({ entidad, onClose, editTo }: {
  entidad: Entidad;
  onClose: () => void;
  editTo: string;   // URL de edición, incluye ?tenantId= en superadmin
}) {
  // Escape key → onClose
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded border border-black/10 bg-white shadow-lg">
        {/* header: título + botón × */}
        {/* body: campos en grid grid-cols-2 usando patrón Campo */}
        {/* footer: botón Cerrar + Link/button Editar (bg-vialto-charcoal) */}
      </div>
    </div>
  );
}
```

### Campo helper (read-only)

```tsx
function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value ?? '—'}</p>
    </div>
  );
}
```

### Aplicación en páginas

```tsx
// Estado
const [viewingEntidad, setViewingEntidad] = useState<Entidad | null>(null);

// Botón en la grilla
<button onClick={() => setViewingEntidad(e)} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist">
  Ver
</button>

// Modal al final del JSX
{viewingEntidad && (
  <EntidadViewModal
    entidad={viewingEntidad}
    onClose={() => setViewingEntidad(null)}
    editTo={`/entidades/${viewingEntidad.id}/editar`}
  />
)}
```

### Para modales con `modo: 'view'` (Productos)

```tsx
// Estado
| { mode: 'view'; producto: Producto }

// Botón en grilla
<button onClick={() => setModal({ mode: 'view', producto: r })}>Ver</button>

// Modal
{modal.mode === 'view' && (
  <ProductoModal
    modo="view"
    productoInicial={modal.producto}
    onEdit={() => setModal({ mode: 'edit', producto: modal.producto })}
    ...
  />
)}
```

---

## Badges de estado: ejes aditivos, nunca se reemplazan (Facturas, Liquidaciones, Viajes)

**Regla global para toda pantalla que muestre el estado de un comprobante o de un viaje.**

Facturas y Liquidaciones separan el **ciclo de vida** del comprobante (`estado`: borrador / esperando AFIP / facturado o liquidado / error de AFIP / anulado) de otros ejes independientes, que se muestran como **badges adicionales al lado, sin reemplazar nunca** al badge de ciclo de vida:

- `cobrado` / `vencida` — solo Facturas (Liquidaciones no tiene noción de cobro separada del comprobante, por eso su `estado` sigue siendo un solo campo).
- `AmbienteTestBadge` ("Ambiente de pruebas") — cuando el comprobante se emitió en homologación.

El modelo de datos completo (por qué `estado` de Factura no incluye `cobrado`, cómo se calcula, y el sync de `Viaje.facturacionEstado`/`liquidacionEstado`) está documentado en `vialto-backend/CLAUDE.md`. Reglas prácticas de este lado:

- Los labels van siempre en **MAYÚSCULA**: `BORRADOR`, `ESPERANDO AFIP`, `FACTURADO`, `COBRADO`, `ERROR DE AFIP`, `ANULADO`, `VENCIDA`.
- El badge `ANULADO` lleva `line-through` y el mismo gris (`bg-gray-100 text-gray-500 border-gray-300/80`) en Facturas y Liquidaciones — no un color propio por pantalla.
- Patrón de referencia a copiar (no reinventar un badge combinado): `renderEstadoBadges` en `FacturacionTenantPage.tsx` (grilla) y el header de `FacturaViewModal.tsx` / snapshot de `FacturaEditModal.tsx` — un `<span>` de ciclo de vida seguido de badges condicionales para `cobrado`/`vencida`/`AmbienteTestBadge`.
- `AmbienteTestBadge` (`components/liquidaciones/AmbienteTestBadge.tsx`) es compartido por Facturas y Liquidaciones y acepta `to?: string`:
  - **Sin `to`** → badge estático. Usar en snapshots por-comprobante (`factura.ambiente`, `liquidacion.ambiente`).
  - **Con `to="/configuracion/arca?tab=ambiente"`** → se vuelve un `<Link>` clickeable. Usar solo en los banners de "ambiente actual del tenant" (ej. `arcaConfig?.ambiente` en los headers de página o antes de emitir), y solo en vistas de tenant — nunca en variantes `embeddedInSuperadmin`, que no tienen una ruta de configuración alcanzable para un tenant elegido.
- En la grilla de Viajes, los badges de facturación/liquidación (`ViajeFacturacionIndicador`/`ViajeLiquidacionIndicador`) son **de lectura únicamente**: el click, si ya hay factura/liquidación vinculada, abre directo su vista completa (`FacturaViewModal`/`LiquidacionViewModal`, fetch on click, sin modal intermedio); si no hay nada vinculado, muestra un modal de detalle liviano (`ViajeFacturacionDetalleModal`/`ViajeLiquidacionDetalleModal`) que solo informa el estado. No agregar ahí acciones de mutación (marcar como cobrada, emitir, anular) — esas viven únicamente en las pantallas de Facturas/Liquidaciones.
- Para "ver" el PDF de un comprobante generado on-demand (CVLP y su Nota de Crédito/Débito de anulación, que no tienen URL persistida como sí tiene `Factura.comprobanteUrl`/`notaCreditoUrl`), el patrón es abrir una pestaña en blanco de forma **síncrona** en el click (`window.open('', '_blank')`) y recién después, cuando llega el blob, setear `location.href` — evita que el bloqueador de pop-ups del navegador corte la apertura por venir de un `await`. Ver `verPdf`/`verPdfAnulacion` en `LiquidacionesTenantPage.tsx` y su equivalente en `ViajeLiquidacionIndicador.tsx`.

---

## Controles incompatibles con el estado del tenant/registro: advertir, no ocultar

**Regla global para cualquier control cuyo valor puede volverse inválido según un módulo del tenant o un estado del registro que cambia con el tiempo.**

Cuando un control (checkbox, campo) es incompatible con cierto estado (ej. un módulo que el tenant no tenía al crear el registro y adquirió después), **no lo ocultes condicionalmente** — el registro puede haber quedado con ese control en un valor "inválido" antes del cambio de estado, y ocultarlo le quita al usuario la única forma de corregirlo desde la UI. En su lugar: dejalo siempre visible y editable, y mostrá una advertencia corta (`<p className="text-xs text-amber-800/90">`) explicando la incompatibilidad. El backend es siempre la fuente de verdad del bloqueo real (rechaza la operación inválida con un mensaje claro); el frontend solo informa, nunca decide ocultando.

Ejemplo real (histórico, la situación concreta ya no aplica pero el patrón sigue vigente): el campo "IVA incluido" del precio transportista (`ViajeCreatePage.tsx`/`ViajeEditModal.tsx`) tuvo una v1 tipo checkbox que la UI ocultaba para tenants con `integracion-arca`, lo que dejaba sin forma de destildarlo a un viaje viejo cuyo tenant adoptó ARCA después de crearlo — se corrigió mostrándolo siempre + una advertencia condicional. Esa v1 (exclusión mutua con Liquidación ARCA) después se rediseñó a un % que se suma en efectivo por encima del precio neto (ver `vialto-backend/CLAUDE.md`, sección "`precioTransportistaExterno` con % de IVA a sumar en efectivo"), así que hoy el campo ya no tiene ninguna incompatibilidad que advertir — pero el principio general ("advertir, no ocultar", nunca dejar un control sin forma de corregirse a sí mismo) sigue siendo la regla a aplicar la próxima vez que aparezca un caso así. Ese mismo caso también ilustra otro patrón reusable: **lock parcial** — el campo no se bloquea por todos los ejes fiscales del registro, solo por el que realmente lo vuelve inconsistente (no asumir que todo campo relacionado a un módulo opcional debe seguir el mismo lock que el resto de los campos fiscales del formulario).

---

## Campos de formulario: obligatorios y opcionales

**Regla global para todos los formularios actuales y futuros.**

- Los campos **obligatorios** muestran un asterisco rojo al final de la etiqueta: `<span className="text-red-500">*</span>`
- Los campos **opcionales** no llevan ninguna indicación. Nunca escribir "(opcional)", "— opcional" ni ninguna variante.

### Patrón correcto

```tsx
// Obligatorio
<span className={labelClass}>Nombre <span className="text-red-500">*</span></span>

// Opcional
<span className={labelClass}>Observaciones</span>
```

### Componentes que ya manejan esto automáticamente

- `CrudFieldLabel` (en `src/components/crud/CrudFields.tsx`): recibe prop `required` y agrega el asterisco rojo.
- `Field` en `MicCrtExportModal.tsx`: detecta si el string `label` termina en `*` (con espacio previo) y renderiza el asterisco en rojo.

---

## Validación de formularios: errores por campo

**Regla global para todos los formularios actuales y futuros.**

Cuando el usuario intenta enviar un formulario con campos inválidos:

- El borde del input afectado se marca en rojo (`border-red-400`).
- Debajo de ese input se muestra el mensaje de error con `<CrudFieldError>`.
- Los errores de validación (campos vacíos, formato incorrecto) son por campo.
- Los errores de API/servidor se muestran globalmente con `<CrudFormErrorAlert>`.

### Patrón correcto en páginas CRUD

```tsx
// Estado
const [error, setError] = useState<string | null>(null);         // error API
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

// En onSubmit
const errs: Record<string, string> = {};
if (!nombre.trim()) errs.nombre = 'Ingresá el nombre.';
if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
setFieldErrors({});
// …llamada API…
```

```tsx
// En JSX
<label className="grid gap-1.5">
  <CrudFieldLabel required>Nombre</CrudFieldLabel>
  <CrudInput
    value={nombre}
    error={fieldErrors.nombre}
    onChange={(e) => setNombre(e.target.value)}
  />
  <CrudFieldError message={fieldErrors.nombre} />
</label>
<CrudFormErrorAlert message={error} />
```

### Componentes disponibles

- `CrudFieldError` (`src/components/crud/CrudFieldError.tsx`): mensaje de error por campo. Usa `text-xs font-medium text-red-600`.
- `CrudInput` y `CrudSelect` (`src/components/crud/CrudFields.tsx`): reciben prop `error?: string` que agrega `border-red-400` automáticamente.
- `CrudFormErrorAlert` (`src/components/crud/CrudFormErrorAlert.tsx`): solo para errores de servidor/API.

### En modales (inputs nativos sin CrudInput)

Aplicar la clase `border-red-400` de forma condicional:

```tsx
<input
  className={`${I} ${fieldErrors.nombre ? 'border-red-400' : 'border-black/15'}`}
/>
<CrudFieldError message={fieldErrors.nombre} />
```

---

## Panel del tenant: pestañas por módulo en el dashboard

**Regla global para toda sección nueva del dashboard de tenant (`src/components/tenant/TenantOwnerDashboard.tsx`).**

Cuando el tenant tiene contratado más de un módulo con contenido propio en el dashboard (hoy: Financiero, Stock, Combustible), esas secciones **no se apilan una debajo de la otra**. Se organizan con una barra de pestañas de subrayado, ubicada debajo del selector de período, con el mismo estilo visual que usa `BaseDeDatosPage.tsx` para Clientes/Transportistas/Choferes/etc.

- Si el tenant solo tiene **un** módulo con sección de dashboard, no se muestra la barra de pestañas: esa sección se renderiza directo (sin tab nav de por medio).
- Si tiene **más de uno**, se arma `moduloTabs: { id, label, icon }[]` agregando una entrada por módulo, condicionada por su respectivo `canAccessX(modules)` de `lib/tenantModules.ts`.
- Desktop: `<nav>` con botones `border-t-2 border-t-vialto-fire bg-vialto-mist text-vialto-charcoal` para el activo, `border-transparent text-vialto-steel` para el resto (icono `lucide-react` + label, mismas clases que `BaseDeDatosPage.tsx`).
- Mobile: botón `selectorTriggerClass` + `<SelectorOpcionesSheet>` (ambos de `@/components/ui/SelectorOpcionesSheet`), igual que en Base de Datos.
- El contenido de cada módulo se gatea con `moduloActivo === 'x' && showX` (nunca solo `moduloActivo === 'x'`, para no romper el caso de un solo tab donde `moduloActivo` cae por default en el primero de la lista).

### Al agregar el dashboard de un módulo nuevo

1. Crear su sección propia en `src/components/<modulo>/<Modulo>DashboardSection.tsx` (fetch propio a su endpoint, pestañas internas si corresponde — ver Combustible/Financiero como referencia).
2. En `TenantOwnerDashboard.tsx`: agregar un ítem a `moduloTabs` (id, label, ícono de `lucide-react`) condicionado por su `canAccessX(modules)`.
3. Agregar el bloque `{moduloActivo === '<id>' && showX && <ModuloDashboardSection ... />}` al final del render, respetando el orden de `moduloTabs`.
4. No agregar heading `<h2>` propio de nivel superior para el módulo — el label ya vive en la pestaña; el `<h2>` interno de la sección (si lo tiene) queda para sus propias sub-pestañas.

---

## Importación masiva desde Excel (`components/importacion/ImportWizard.tsx`)

**Un solo componente para tenant-admin y superadmin.** `ImportWizard` no es un modal — es una página de ancho completo, hosteada por dos páginas finas que solo resuelven "qué tenant": `pages/ImportarDatosTenantPage.tsx` (tenant-admin, usa la org activa de Clerk) y `pages/SuperadminImportarPage.tsx` (superadmin, resuelve `:orgId` de la URL). La configuración de templates (mapeo de columnas + sugerencia IA) es exclusiva de superadmin y vive aparte, en `pages/SuperadminImportTemplatesPage.tsx` — no se mezcla con el wizard de import en sí. Si se necesita tocar el flujo de import, **no crear un modal nuevo ni duplicar lógica por rol** — extender `ImportWizard.tsx`/`useImportWizard.ts`, que ya son agnósticos de rol (reciben `tenantId`/`tenantModules` por props).

### Orquestación (`hooks/useImportWizard.ts`)

El wizard recorre los módulos en orden fijo de dependencia (`MODULOS_SECUENCIA`: `clientes → transportistas → choferes → vehiculos → viajes`), llamando preview/confirm **una vez por módulo** contra `/api/importaciones/preview` y `/confirm` (ver `vialto-backend/CLAUDE.md`, sección `importaciones`). Después de Viajes hay dos etapas opcionales (`post-liquidaciones`/`post-facturas`) si el tenant tiene `integracion-arca`/`facturacion`.

- **Regla de correctitud async (no fire-and-forget entre pasos)**: `avanzarModulo()`, `saltearModuloActual()`, `reintentarPreview()` y `confirmarModuloActual()` encadenan con `await` de punta a punta. Bug real corregido ago 2026: `confirmarModuloActual()` liberaba `loading` (`finally { setLoading(false) }`) **antes** de que el `setLoading(true)` del preview del módulo siguiente llegara a "pegar", mostrando un flash de pantalla en blanco entre pasos. Si se agrega un paso nuevo al wizard, seguir el mismo patrón (todo el camino de transición entre pasos es una sola cadena `await`, nunca una llamada suelta sin awaitear).
- **Exclusión de filas y normalización de ciudad son 100% client-side** (`lib/importacionViajesCiudades.ts`): el backend no valida `origen`/`destino` contra ningún catálogo — el wizard lo hace contra un catálogo externo antes de mostrar el preview de Viajes, y solo manda `ciudadesNormalizadas`/`filasExcluidas` al confirmar. Si se corrige o elige una ciudad después de que el preview ya trajo el diff "antes/después" (`PreviewViaje.cambios`, ver abajo), hay que **resincronizar** las entradas "Origen"/"Destino" de `cambios` con el valor final (`sincronizarCambioCiudad` en el mismo archivo) — si no, el modal de cambios muestra el texto crudo del Excel en vez de la ciudad corregida. Bug real corregido ago 2026.

### Selector de módulos previo al upload (cuando el tenant ya tiene datos)

Antes de mostrar el dropzone, `ImportWizard` consulta `GET /api/importaciones/tenant-tiene-datos?tenantId=...`. Si el tenant **no tiene nada** cargado (clientes/transportistas/choferes/vehículos en cero), arranca directo con la secuencia completa — es el caso de uso principal (alta de un tenant nuevo). Si **ya tiene algo**, se muestra `SelectorModulos` — una pantalla dedicada, no un dropdown ni checkboxes al costado — con un checkbox por módulo. Por defecto solo quedan tildados **Viajes** (siempre) y los módulos que todavía no tienen datos; dejarlos todos tildados equivale al recorrido completo de siempre. La selección alimenta directo el `modulosDisponibles` de `useImportWizard` — no hay un modo "elegir un módulo suelto" separado del wizard secuencial, solo se acorta la secuencia.

### Preview de Viajes: "Ver cambios" con diff antes/después

El modal "Detalle de filas" (trigger: botón "Ver cambios →", alineado a la derecha y con fondo `vialto-charcoal` para destacarse del resto de acciones) muestra, para la pestaña Viajes, la lista `ViajesCambiosList` en vez de una tabla plana:

- Badge verde **"Nuevo"** vs. ámbar **"Actualiza"** por fila (`PreviewViaje.nuevo`).
- Fila nueva → grilla compacta con los campos no vacíos.
- Fila que actualiza → una línea por campo que cambió: `Campo: valor anterior (tachado) → valor nuevo` (`PreviewViaje.cambios`, calculado server-side en `compararCamposViaje` — ver backend). Sin cambios reales → "Sin cambios."

Las pestañas Clientes/Transportistas de este mismo modal solo se muestran si esos módulos están en `wizard.secuencia` de la corrida actual — el preview de Viajes siempre trae los nombres que referencia (para marcar cuáles son nuevos), pero si el usuario no eligió importar esos módulos en el selector, no tiene sentido mostrarlos como si fueran parte de lo que se está por guardar.

Paginación de estas tablas/listas: **no** usar el componente `ListadoPagination` completo (su selector de page-size está limitado a `[10, 25, 50]`, no sirve para "5 en Viajes, 10 en el resto"). Usar el pager liviano de `lib/listadoPaginacion.ts` (`metaPaginacionCliente`/`slicePaginaCliente`/`paginasVisibles`), construido inline.

### Bloqueo de UI durante carga

Todo el contenido de un paso (excepto la fila de botones de acción) va envuelto en `<fieldset disabled={wizard.loading}>` — deshabilita nativamente todos los inputs/botones descendientes durante el preview/confirm, con `disabled:opacity-60` para feedback visual. No armar un overlay de loading aparte para esto.

---

## Navegación: breadcrumb global, no botones "Volver" por pantalla

**Regla global — ninguna pantalla interna arma su propio link/botón "← Volver".** La navegación hacia atrás la resuelve un breadcrumb único, montado una sola vez en `AppShell.tsx` (arriba del `<Outlet/>`, dentro de `<main>`), que muestra el trail completo de pantallas previas + la actual. Que una pantalla necesite "volver" no es motivo para agregar un link ahí — es motivo para agregarla al config central.

- **`src/lib/breadcrumbs.ts`**: tabla de rutas → trail. Cada entrada matchea un `pattern` (sintaxis de `react-router-dom`) contra `location.pathname` y arma el array de crumbs (`{ label, to? }`, el último sin `to` = pantalla actual). Lee `tenantId` de `location.search` para que los links intermedios preserven el contexto de superadmin sobre una empresa puntual (mismo criterio que ya usaban los `backTo` viejos: `?tab=<tab>&tenantId=<id>` hacia `/base-de-datos`, etc.). El "Inicio" del trail es "Panorama" para superadmin, "Inicio" para el resto — excepto stock-viewer, que no tiene acceso a `/` y usa `/stock/inventario` como su inicio real.
- **`src/components/shared/Breadcrumbs.tsx`**: presentacional, no se toca para agregar rutas nuevas — solo renderiza lo que devuelve `resolveBreadcrumbs`. No se muestra si el trail resuelto tiene 1 o menos crumbs (p. ej. el home).
- **Al agregar una ruta nueva en `App.tsx` que sea una pantalla real** (no un redirect legacy), sumar su entrada en `ENTRIES` de `breadcrumbs.ts` seleccionando como label el propio `<h1>`/título de esa pantalla, para que el crumb final coincida con lo que el usuario ve arriba.
- **Escape hatch — `useBreadcrumbOverride` (`src/hooks/useBreadcrumbOverride.tsx`)**: para las pocas pantallas cuyo trail depende de datos que no están en la URL (un fetch recién resuelto, o selección de tenant en estado local no sincronizado con `searchParams`) en vez de la ruta. Ejemplos reales: `MovimientoStockDetallePage.tsx` (el link/label del padre depende de `row.tipo`, que solo se conoce tras el fetch) y `DivisionesStockHistorialTenantPage.tsx` (el tenant elegido por el superadmin es estado local, no query param). Pasar `null` cuando no aplica override, para que se use el trail automático.
- **`CrudPageLayout.tsx`** (usado por las pantallas de alta/edición con patrón VER→modal→EDITAR) ya no acepta `backTo`/`backLabel` — el breadcrumb central los reemplazó. No reintroducir esas props.

---

## Checklist para nuevas funcionalidades frontend

- Definir si la vista es `tenant`, `superadmin` o ambas.
- Crear tipos en `src/types` antes de consumir endpoints.
- Reutilizar `lib/api.ts` y `friendlyError.ts`.
- Extraer componentes y hooks para evitar páginas extensas.
- Verificar estados de carga, error y vacío.
- Mantener textos y UX consistentes con el resto del producto.
- **Aplicar el patrón VER → modal read-only → EDITAR** en la columna de acciones de toda grilla nueva.
- **Campos obligatorios con asterisco rojo; campos opcionales sin ningún indicador.**
- **Si el módulo agrega una sección al dashboard del tenant**, sumarla a `moduloTabs` en `TenantOwnerDashboard.tsx` en vez de apilarla — ver "Panel del tenant: pestañas por módulo en el dashboard".
- **Si la pantalla muestra estado de un comprobante o viaje (Facturas/Liquidaciones/Viajes)**, los ejes independientes (cobro, ambiente de prueba) van en badges aditivos, nunca reemplazando al badge de ciclo de vida — ver "Badges de estado: ejes aditivos, nunca se reemplazan".
- **Si se toca el flujo de importación masiva**, extender `ImportWizard.tsx`/`useImportWizard.ts` (compartidos entre tenant-admin y superadmin) en vez de crear un modal o una copia por rol — ver "Importación masiva desde Excel".
- **Si un control puede volverse inválido según un módulo del tenant o el estado de un registro** (no según lo que el usuario está tipeando ahora), advertí en vez de ocultar — ver "Controles incompatibles con el estado del tenant/registro: advertir, no ocultar".

---

Última actualización: agosto 2026 (nueva pantalla `ConfiguracionNotificacionesTenantPage.tsx` en `/configuracion/notificaciones` — toggle on/off por tipo de notificación de email, contra `GET/POST /api/notificaciones/config[/toggle]` del backend; mismo patrón de guardado inmediato al tocar el switch que `CamposEmpresaPage.tsx`/`ConceptosConfigTenantPage.tsx`, sin patrón nuevo que documentar acá — ver `vialto-backend/CLAUDE.md`, sección "`notificaciones` — alertas por email vía Resend"; y, de una pasada anterior, `Viaje.precioTransportistaIvaIncluidoPct` — reemplaza al boolean v1, ya no hace falta el patrón "advertir, no ocultar" para este campo puntual pero la regla general sigue documentada, ver "Controles incompatibles..."; y, de una pasada anterior, wizard de importación masiva unificado en `ImportWizard.tsx` — páginas en vez de modal, selector de módulos, diff "Ver cambios" y demás patrones — ver "Importación masiva desde Excel"; y, de una pasada anterior a esa, el patrón de badges de estado aditivos para Facturas/Liquidaciones/Viajes — ver "Badges de estado: ejes aditivos, nunca se reemplazan")

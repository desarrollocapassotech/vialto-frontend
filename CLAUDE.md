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

```txt
src/
  components/
    ui/
    superadmin/
    AppShell.tsx
    MissingClerkConfig.tsx
  hooks/
    useTenantsList.ts
  lib/
    api.ts
    friendlyError.ts
    roleLabels.ts
    sentry.ts
  pages/
    HomePage.tsx
    DashboardPage.tsx
    ViajesPage.tsx
    ClientesPage.tsx
    ChoferesPage.tsx
    VehiculosPage.tsx
    *SuperadminPage.tsx
    *TenantPage.tsx
  types/
    api.ts
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

## Checklist para nuevas funcionalidades frontend

- Definir si la vista es `tenant`, `superadmin` o ambas.
- Crear tipos en `src/types` antes de consumir endpoints.
- Reutilizar `lib/api.ts` y `friendlyError.ts`.
- Extraer componentes y hooks para evitar páginas extensas.
- Verificar estados de carga, error y vacío.
- Mantener textos y UX consistentes con el resto del producto.
- **Aplicar el patrón VER → modal read-only → EDITAR** en la columna de acciones de toda grilla nueva.
- **Campos obligatorios con asterisco rojo; campos opcionales sin ningún indicador.**

---

Última actualización: junio 2026

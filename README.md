# Vialto Frontend

SPA de Vialto para operación logística multi-tenant.

Este proyecto implementa la capa de interfaz para empresas de transporte, con autenticación por Clerk, navegación por módulos y consumo de API del backend de Vialto.

## Stack

- React 19 + TypeScript
- Vite 6
- React Router
- Clerk (`@clerk/clerk-react`)
- Tailwind CSS v4
- Sentry (`@sentry/react`)

## Requisitos

- Node.js 20+
- npm 10+
- Backend de Vialto disponible (local o remoto)
- Proyecto de Clerk configurado

## Instalación

```bash
npm install
```

## Variables de entorno

Crear archivo `.env` en la raíz de `vialto-frontend` (podés partir de `.env.example`):

```env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Notas:

- Si `VITE_API_URL` no está definida y estás en desarrollo, el front usa `http://localhost:8080`.
- Si falta `VITE_CLERK_PUBLISHABLE_KEY`, se muestra la pantalla de configuración faltante.

## Scripts

- `npm run dev`: inicia entorno local con Vite.
- `npm run build`: compila TypeScript y genera build de producción.
- `npm run preview`: sirve el build localmente para validación.
- `npm run lint`: ejecuta ESLint.
- `npm run generate:favicon`: regenera favicon desde script interno.

## Estructura del proyecto

```txt
src/
  components/   # Layouts, UI reutilizable, componentes de shell/superadmin
  hooks/        # Hooks de dominio y acceso a datos compartidos
  lib/          # API client, utilidades, errores amigables, observabilidad
  pages/        # Pantallas por módulo y por contexto (tenant/superadmin)
  types/        # Tipos de datos alineados con respuestas del backend
```

## Convenciones de arquitectura (obligatorias)

- Priorizar modularización por responsabilidad.
- Priorizar reutilización antes de duplicar código.
- Evitar componentes o páginas extensas: dividir en piezas pequeñas.
- Toda request autenticada debe pasar por la capa centralizada de `src/lib/api.ts`.
- Mantener tipado explícito en `src/types`.
- Mantener mensajes de error amigables para usuario final.

Para lineamientos completos consultar `ARCHITECTURE.md`.

## Flujo recomendado para nuevas funcionalidades

1. Definir si aplica a `tenant`, `superadmin` o ambos.
2. Definir/actualizar tipos en `src/types`.
3. Implementar acceso a datos reutilizable (`hooks`/`lib`).
4. Construir UI con componentes reutilizables (`components`).
5. Integrar en página orquestadora (`XPage`) y variantes (`XTenantPage` / `XSuperadminPage`).
6. Validar estados de carga, error y vacío.

## Multi-tenant y seguridad

- El contexto de empresa se basa en la organización activa de Clerk.
- El frontend no decide seguridad de negocio: el backend valida tenant, permisos y módulos habilitados.
- El frontend debe reflejar correctamente los estados de autorización y acceso (`401` / `403`).

## Comandos rápidos

```bash
npm run dev
npm run lint
npm run build
```

---

Documentación técnica extendida: `ARCHITECTURE.md`.

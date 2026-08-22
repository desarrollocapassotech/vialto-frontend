import { matchPath } from "react-router-dom";

export type Crumb = { label: string; to?: string };

export type BreadcrumbRoleCtx = {
  superadmin: boolean;
  stockViewer: boolean;
  stockOperator: boolean;
};

type BuildCtx = BreadcrumbRoleCtx & { search: URLSearchParams };

type Entry = {
  pattern: string;
  build: (params: Record<string, string | undefined>, ctx: BuildCtx) => Crumb[];
};

/** Preserva `?tenantId=` (contexto de superadmin sobre una empresa puntual) al armar el link de un crumb padre. */
function withTenantId(search: URLSearchParams, path: string, extra?: Record<string, string>): string {
  const qs = new URLSearchParams();
  if (extra) for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  const tenantId = search.get("tenantId")?.trim();
  if (tenantId) qs.set("tenantId", tenantId);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

function homeCrumb(ctx: BreadcrumbRoleCtx): Crumb {
  // Un stock-viewer / stock-operator no tiene acceso a "/" (RequireNotStockOnlyRole
  // lo redirige), así que su "inicio" real es inventario / ingresos respectivamente.
  if (ctx.stockViewer) return { label: "Inicio", to: "/stock/inventario" };
  if (ctx.stockOperator) return { label: "Inicio", to: "/stock/ingresos" };
  return { label: ctx.superadmin ? "Panorama" : "Inicio", to: "/" };
}

function baseDeDatosCrumb(search: URLSearchParams, tab: string): Crumb {
  return { label: "Base de datos", to: withTenantId(search, "/base-de-datos", { tab }) };
}

/** Entradas "nuevo"/"editar" de una entidad del tab de Base de datos. */
function entidadEntries(tab: string, nuevoLabel: string, editarLabel: string): Entry[] {
  return [
    {
      pattern: `/${tab}/nuevo`,
      build: (_p, ctx) => [homeCrumb(ctx), baseDeDatosCrumb(ctx.search, tab), { label: nuevoLabel }],
    },
    {
      pattern: `/${tab}/:id/editar`,
      build: (_p, ctx) => [homeCrumb(ctx), baseDeDatosCrumb(ctx.search, tab), { label: editarLabel }],
    },
  ];
}

const ENTRIES: Entry[] = [
  // Viajes y flota
  { pattern: "/viajes", build: (_p, ctx) => [homeCrumb(ctx), { label: "Viajes" }] },
  {
    pattern: "/viajes/nuevo",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Viajes", to: withTenantId(ctx.search, "/viajes") },
      { label: "Crear viaje" },
    ],
  },

  // Facturación
  { pattern: "/facturacion", build: (_p, ctx) => [homeCrumb(ctx), { label: "Facturas" }] },
  { pattern: "/liquidaciones", build: (_p, ctx) => [homeCrumb(ctx), { label: "Liquidaciones" }] },
  {
    pattern: "/configuracion/arca",
    build: (_p, ctx) => [homeCrumb(ctx), { label: "Configuración ARCA / AFIP" }],
  },
  {
    pattern: "/configuracion/conceptos",
    build: (_p, ctx) => [homeCrumb(ctx), { label: "Configuración de conceptos" }],
  },
  {
    pattern: "/configuracion/notificaciones",
    build: (_p, ctx) => [homeCrumb(ctx), { label: "Notificaciones por email" }],
  },

  // Base de datos
  { pattern: "/base-de-datos", build: (_p, ctx) => [homeCrumb(ctx), { label: "Base de datos" }] },
  {
    pattern: "/importar",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Base de datos", to: "/base-de-datos" },
      { label: "Importar datos" },
    ],
  },
  ...entidadEntries("clientes", "Nuevo cliente", "Editar cliente"),
  ...entidadEntries("transportistas", "Nuevo transportista", "Editar transportista"),
  ...entidadEntries("choferes", "Nuevo chofer", "Editar chofer"),
  ...entidadEntries("destinatarios", "Nuevo destinatario", "Editar destinatario"),
  ...entidadEntries("vehiculos", "Nuevo vehículo", "Editar vehículo"),
  ...entidadEntries("direcciones-entrega", "Nueva dirección / ruta", "Editar dirección / ruta"),

  // Combustible
  { pattern: "/combustible", build: (_p, ctx) => [homeCrumb(ctx), { label: "Combustible" }] },

  // Stock
  { pattern: "/stock/inventario", build: (_p, ctx) => [homeCrumb(ctx), { label: "Inventario" }] },
  { pattern: "/stock/movimientos", build: (_p, ctx) => [homeCrumb(ctx), { label: "Movimientos" }] },
  {
    pattern: "/stock/movimientos/:id",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Movimientos", to: withTenantId(ctx.search, "/stock/movimientos") },
      { label: "Movimiento de stock" },
    ],
  },
  { pattern: "/stock/divisiones", build: (_p, ctx) => [homeCrumb(ctx), { label: "División de bultos" }] },
  {
    pattern: "/stock/divisiones/historial",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "División de bultos", to: withTenantId(ctx.search, "/stock/divisiones") },
      { label: "Historial de divisiones" },
    ],
  },
  { pattern: "/stock/ingresos", build: (_p, ctx) => [homeCrumb(ctx), { label: "Ingresos al depósito" }] },
  {
    pattern: "/stock/ingresos/historial",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Ingresos al depósito", to: withTenantId(ctx.search, "/stock/ingresos") },
      { label: "Historial de ingresos" },
    ],
  },
  { pattern: "/stock/egresos", build: (_p, ctx) => [homeCrumb(ctx), { label: "Egresos / despacho" }] },
  {
    pattern: "/stock/egresos/historial",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Egresos / despacho", to: withTenantId(ctx.search, "/stock/egresos") },
      { label: "Historial de egresos" },
    ],
  },

  // Superadmin — plataforma
  { pattern: "/superadmin/empresas", build: (_p, ctx) => [homeCrumb(ctx), { label: "Empresas" }] },
  {
    pattern: "/superadmin/empresas/nueva",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Empresas", to: "/superadmin/empresas" },
      { label: "Nueva empresa" },
    ],
  },
  {
    pattern: "/superadmin/empresas/:orgId/editar",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Empresas", to: "/superadmin/empresas" },
      { label: "Editar empresa" },
    ],
  },
  {
    pattern: "/superadmin/empresas/:orgId/importar",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Empresas", to: "/superadmin/empresas" },
      { label: "Importar datos" },
    ],
  },
  {
    pattern: "/superadmin/empresas/:orgId/importar/templates",
    build: (p, ctx) => [
      homeCrumb(ctx),
      { label: "Empresas", to: "/superadmin/empresas" },
      { label: "Importar datos", to: `/superadmin/empresas/${p.orgId}/importar` },
      { label: "Configurar templates" },
    ],
  },
  { pattern: "/superadmin/usuarios", build: (_p, ctx) => [homeCrumb(ctx), { label: "Usuarios" }] },
  {
    pattern: "/superadmin/usuarios/nuevo",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Usuarios", to: withTenantId(ctx.search, "/superadmin/usuarios") },
      { label: "Crear usuario" },
    ],
  },
  {
    pattern: "/superadmin/usuarios/:userId/editar",
    build: (_p, ctx) => [
      homeCrumb(ctx),
      { label: "Usuarios", to: withTenantId(ctx.search, "/superadmin/usuarios") },
      { label: "Editar usuario" },
    ],
  },
  { pattern: "/superadmin/arca", build: (_p, ctx) => [homeCrumb(ctx), { label: "ARCA / AFIP" }] },
  {
    pattern: "/superadmin/campos-empresa",
    build: (_p, ctx) => [homeCrumb(ctx), { label: "Configuración por empresa" }],
  },
  { pattern: "/superadmin/combustible", build: (_p, ctx) => [homeCrumb(ctx), { label: "Combustible" }] },
];

/** Calcula el trail de breadcrumb para la pantalla actual a partir de la ruta.
 * Devuelve `[]` cuando la pantalla no tiene un trail definido (p. ej. el inicio). */
export function resolveBreadcrumbs(
  pathname: string,
  search: URLSearchParams,
  roleCtx: BreadcrumbRoleCtx,
): Crumb[] {
  for (const entry of ENTRIES) {
    const match = matchPath({ path: entry.pattern, end: true }, pathname);
    if (match) {
      return entry.build(match.params as Record<string, string | undefined>, { ...roleCtx, search });
    }
  }
  return [];
}

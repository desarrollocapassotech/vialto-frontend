import {
  getVialtoTenantRole,
  isPlatformSuperadmin,
  type RoleContext,
  type VialtoTenantRole,
} from '@/lib/roleLabels';
import {
  canAccessCombustible,
  canAccessCuentaCorriente,
  canAccessEmisionLiquidoProductoArca,
  canAccessLiquidaciones,
  canAccessMantenimiento,
  canAccessModuloFacturacion,
  canAccessStock,
  canAccessViajes,
} from '@/lib/tenantModules';

/**
 * Matriz de permisos rol × módulo (nov 2026) — fuente única del frontend.
 *
 * Documento funcional: "Vialto — Matriz de roles y permisos" (validan el responsable
 * funcional y Flor para lo contable). Cada celda copia lo que ya autoriza el backend
 * (`@Roles(...)` de cada controller): el front nunca muestra algo que el servidor niega.
 * Si cambia un `@Roles` del backend, cambiar acá también (y en el documento).
 *
 * - `no`: no aparece en el menú ni se puede abrir.
 * - `consultar`: ver y exportar, sin crear/modificar/anular.
 * - `operar`: consultar + crear, modificar, anular.
 *
 * Un módulo solo se ve si además la empresa lo tiene contratado (`moduloContratado`).
 */
export type AccesoModulo = 'no' | 'consultar' | 'operar';

export type ModuloPermiso =
  | 'inicio'
  | 'viajes'
  | 'facturas'
  | 'liquidaciones'
  | 'cuentaCorriente'
  /** Inventario + Movimientos. */
  | 'stockConsulta'
  /** Ingresos + Egresos (con remito). */
  | 'stockIngresosEgresos'
  | 'stockDivisiones'
  | 'combustible'
  | 'mantenimiento'
  /** Clientes, proveedores, choferes, vehículos, productos, usuarios. */
  | 'baseDeDatos'
  /** ARCA, conceptos, notificaciones, importar Excel. */
  | 'configuracion';

const MATRIZ: Record<VialtoTenantRole, Record<ModuloPermiso, AccesoModulo>> = {
  admin: {
    inicio: 'operar',
    viajes: 'operar',
    facturas: 'operar',
    liquidaciones: 'operar',
    cuentaCorriente: 'operar',
    stockConsulta: 'consultar',
    stockIngresosEgresos: 'operar',
    stockDivisiones: 'operar',
    combustible: 'operar',
    mantenimiento: 'operar',
    baseDeDatos: 'operar',
    configuracion: 'operar',
  },
  member: {
    inicio: 'consultar',
    // Consulta + edición acotada: ver `puedeEditarViajes` (VTO-485: valorizado bloquea).
    viajes: 'consultar',
    facturas: 'consultar',
    liquidaciones: 'consultar',
    cuentaCorriente: 'consultar',
    stockConsulta: 'no',
    stockIngresosEgresos: 'operar',
    stockDivisiones: 'no',
    combustible: 'consultar',
    mantenimiento: 'consultar',
    baseDeDatos: 'no',
    configuracion: 'no',
  },
  stock_viewer: {
    inicio: 'no',
    viajes: 'no',
    facturas: 'no',
    liquidaciones: 'no',
    cuentaCorriente: 'no',
    stockConsulta: 'consultar',
    stockIngresosEgresos: 'no',
    stockDivisiones: 'no',
    combustible: 'no',
    mantenimiento: 'no',
    baseDeDatos: 'no',
    configuracion: 'no',
  },
  stock_operator: {
    inicio: 'no',
    viajes: 'no',
    facturas: 'no',
    liquidaciones: 'no',
    cuentaCorriente: 'no',
    stockConsulta: 'no',
    stockIngresosEgresos: 'operar',
    stockDivisiones: 'no',
    combustible: 'no',
    mantenimiento: 'no',
    baseDeDatos: 'no',
    configuracion: 'no',
  },
};

/**
 * Rol efectivo para la matriz. Sin rol resuelto se trata como Miembro, igual que el
 * backend (`resolveAuthRole`: `org:member` → member).
 */
function rolMatriz(ctx: RoleContext): VialtoTenantRole {
  return getVialtoTenantRole(ctx) ?? 'member';
}

/** Acceso del rol a un módulo, sin mirar si la empresa lo contrató. Superadmin: operar. */
export function accesoRol(ctx: RoleContext, modulo: ModuloPermiso): AccesoModulo {
  if (isPlatformSuperadmin(ctx.publicMetadata)) return 'operar';
  return MATRIZ[rolMatriz(ctx)][modulo];
}

export function puedeOperar(ctx: RoleContext, modulo: ModuloPermiso): boolean {
  return accesoRol(ctx, modulo) === 'operar';
}

/**
 * Editar un viaje existente: admin, o Miembro (el backend le bloquea los valorizados,
 * VTO-485). Crear, eliminar, pagos, gastos, documentos y MIC/CRT/PAUT: solo `operar`.
 */
export function puedeEditarViajes(ctx: RoleContext): boolean {
  return puedeOperar(ctx, 'viajes') || rolMatriz(ctx) === 'member';
}

/** Si la empresa tiene contratado lo que alimenta ese módulo. */
export function moduloContratado(modules: string[], modulo: ModuloPermiso): boolean {
  switch (modulo) {
    case 'viajes':
      return canAccessViajes(modules);
    case 'facturas':
      return canAccessModuloFacturacion(modules);
    case 'liquidaciones':
      return canAccessLiquidaciones(modules) || canAccessEmisionLiquidoProductoArca(modules);
    case 'cuentaCorriente':
      return canAccessCuentaCorriente(modules);
    case 'stockConsulta':
    case 'stockIngresosEgresos':
    case 'stockDivisiones':
      return canAccessStock(modules);
    case 'combustible':
      return canAccessCombustible(modules);
    case 'mantenimiento':
      return canAccessMantenimiento(modules);
    case 'inicio':
    case 'baseDeDatos':
    case 'configuracion':
      return true;
  }
}

/** El usuario ve el módulo: su rol lo permite y la empresa lo tiene contratado. */
export function puedeVerModulo(
  ctx: RoleContext,
  modules: string[],
  modulo: ModuloPermiso,
): boolean {
  return accesoRol(ctx, modulo) !== 'no' && moduloContratado(modules, modulo);
}

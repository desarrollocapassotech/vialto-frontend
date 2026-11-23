import { type RoleContext } from '@/lib/roleLabels';
import { puedeVerModulo, type ModuloPermiso } from '@/lib/permisosRol';
import type { Tenant } from '@/types/api';

/** `Tenant.dashboardHabilitado` — default true (tenants previos al flag lo siguen viendo). */
export function dashboardHabilitado(tenant: Tenant | null | undefined): boolean {
  return tenant?.dashboardHabilitado !== false;
}

/** Mismo orden que el menú lateral (`AppShell.tsx`). */
const RUTAS_MODULO: [ModuloPermiso, string][] = [
  ['viajes', '/viajes'],
  ['facturas', '/facturacion'],
  ['liquidaciones', '/liquidaciones'],
  ['cuentaCorriente', '/cuenta-corriente'],
  ['stockConsulta', '/stock/inventario'],
  ['stockIngresosEgresos', '/stock/ingresos'],
  ['combustible', '/combustible'],
  ['mantenimiento', '/mantenimiento'],
  ['baseDeDatos', '/base-de-datos'],
];

/**
 * Pantalla de inicio de un tenant sin dashboard: el primer módulo que el rol puede ver
 * (matriz de `lib/permisosRol.ts`) y la empresa tiene contratado, en el orden del menú.
 * `null` = no hay ningún módulo navegable para ese rol.
 */
export function primeraRutaModulo(modules: string[], roleCtx: RoleContext): string | null {
  return RUTAS_MODULO.find(([m]) => puedeVerModulo(roleCtx, modules, m))?.[1] ?? null;
}

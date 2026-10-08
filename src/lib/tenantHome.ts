import {
  canAccessCombustible,
  canAccessCuentaCorriente,
  canAccessEmisionFacturasArca,
  canAccessEmisionLiquidoProductoArca,
  canAccessFacturacion,
  canAccessLiquidaciones,
  canAccessMantenimiento,
  canAccessStock,
  canAccessViajes,
} from '@/lib/tenantModules';
import { isOrgMember, type RoleContext } from '@/lib/roleLabels';
import type { Tenant } from '@/types/api';

/** `Tenant.dashboardHabilitado` — default true (tenants previos al flag lo siguen viendo). */
export function dashboardHabilitado(tenant: Tenant | null | undefined): boolean {
  return tenant?.dashboardHabilitado !== false;
}

/**
 * Pantalla de inicio de un tenant sin dashboard: el primer módulo contratado,
 * en el mismo orden en que aparece en el menú lateral (`AppShell.tsx`) para
 * el rol del usuario. `null` = no hay ningún módulo navegable para ese rol.
 */
export function primeraRutaModulo(modules: string[], roleCtx: RoleContext): string | null {
  const candidatos: [boolean, string][] = isOrgMember(roleCtx)
    ? [
        [canAccessStock(modules), '/stock/ingresos'],
        [canAccessCombustible(modules), '/combustible'],
        [canAccessMantenimiento(modules), '/mantenimiento'],
      ]
    : [
        [canAccessViajes(modules), '/viajes'],
        [canAccessFacturacion(modules) || canAccessEmisionFacturasArca(modules), '/facturacion'],
        [
          canAccessLiquidaciones(modules) || canAccessEmisionLiquidoProductoArca(modules),
          '/liquidaciones',
        ],
        [canAccessCuentaCorriente(modules), '/cuenta-corriente'],
        [canAccessStock(modules), '/stock/inventario'],
        [canAccessCombustible(modules), '/combustible'],
        [canAccessMantenimiento(modules), '/mantenimiento'],
        [true, '/base-de-datos'],
      ];
  return candidatos.find(([ok]) => ok)?.[1] ?? null;
}

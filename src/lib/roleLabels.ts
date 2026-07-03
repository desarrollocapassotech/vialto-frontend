/** Rol de plataforma en metadata de Clerk (no exponer el nombre técnico en UI). */
export function isPlatformSuperadmin(
  publicMetadata: { vialtoRole?: unknown } | null | undefined,
): boolean {
  return publicMetadata?.vialtoRole === 'superadmin';
}

export type VialtoTenantRole = 'admin' | 'member' | 'stock_viewer';

export type RoleContext = {
  orgRole?: string | null;
  publicMetadata?: { vialtoRole?: unknown } | null;
};

/**
 * Rol efectivo del usuario en la empresa.
 * Fuente de verdad: `publicMetadata.vialtoRole` (admin | member | stock_viewer).
 * Fallback: rol de organización Clerk (`org:admin`, `org:member`).
 */
export function getVialtoTenantRole({
  orgRole,
  publicMetadata,
}: RoleContext): VialtoTenantRole | null {
  const vr = publicMetadata?.vialtoRole;
  if (vr === 'admin' || vr === 'member' || vr === 'stock_viewer') return vr;
  if (orgRole === 'org:admin') return 'admin';
  if (orgRole === 'org:stock_viewer') return 'stock_viewer';
  if (orgRole === 'org:member') return 'member';
  return null;
}

export function isStockViewer(ctx: RoleContext): boolean {
  return getVialtoTenantRole(ctx) === 'stock_viewer';
}

export function isOrgMember(ctx: RoleContext): boolean {
  return getVialtoTenantRole(ctx) === 'member';
}

export function isOrgAdmin(ctx: RoleContext): boolean {
  return getVialtoTenantRole(ctx) === 'admin';
}

/**
 * Misma capacidad de gestión en UI que un admin u operador de la organización.
 * El superadmin de plataforma suele no tener `org:admin` en la sesión activa de Clerk
 * (p. ej. vista embebida con `tenantId`), pero debe poder hacer todo lo que haría un admin.
 */
export function puedeGestionarComoAdminEmpresa(
  orgRole: string | null | undefined,
  publicMetadata: { vialtoRole?: unknown } | null | undefined,
): boolean {
  if (isPlatformSuperadmin(publicMetadata)) return true;
  return getVialtoTenantRole({ orgRole, publicMetadata }) === 'admin';
}

type RoleSource = {
  orgRole: string | null | undefined;
  /** Coincide con `public_metadata.vialtoRole` en Clerk (backend Vialto). */
  platformRole?: string | null;
  hasOrganization: boolean;
};

/**
 * Texto amigable para mostrar en la interfaz (sin prefijos técnicos).
 */
export function userRoleDisplay({
  orgRole,
  platformRole,
  hasOrganization,
}: RoleSource): string {
  if (platformRole === 'superadmin') {
    return 'Administrador de la plataforma';
  }

  if (!hasOrganization) {
    return 'Elegí una empresa para ver tu rol';
  }

  const tenantRole = getVialtoTenantRole({
    orgRole,
    publicMetadata: platformRole ? { vialtoRole: platformRole } : null,
  });

  switch (tenantRole) {
    case 'admin':
      return 'Administrador';
    case 'member':
      return 'Miembro';
    case 'stock_viewer':
      return 'Consulta de stock';
    default:
      return orgRole ? 'Rol pendiente de asignar' : 'Rol pendiente de asignar';
  }
}

/** Rol de plataforma en metadata de Clerk (no exponer el nombre técnico en UI). */
export function isPlatformSuperadmin(
  publicMetadata: { vialtoRole?: unknown } | null | undefined,
): boolean {
  return publicMetadata?.vialtoRole === 'superadmin';
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

  if (!orgRole) {
    return 'Rol pendiente de asignar';
  }

  switch (orgRole) {
    case 'org:admin':
      return 'Administrador';
    case 'org:supervisor':
      return 'Supervisor';
    case 'org:member':
      return 'Operador';
    default: {
      const raw = orgRole.replace(/^org:/, '').replace(/_/g, ' ');
      return raw
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }
}

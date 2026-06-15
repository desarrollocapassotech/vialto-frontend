import type { PlatformUser } from '@/types/api';

export type OrgUserRef = Pick<PlatformUser, 'userId' | 'firstName' | 'lastName' | 'email'>;

export function orgUserDisplayName(u: OrgUserRef): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (u.email?.trim()) return u.email.trim();
  return u.userId?.trim() ?? '—';
}

export function buildUserLabelMap(users: OrgUserRef[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    const id = u.userId?.trim();
    if (id) map.set(id, orgUserDisplayName(u));
  }
  return map;
}

/** Evita mostrar IDs crudos de Clerk (`user_…`) cuando no hay etiqueta resuelta. */
export function resolveClerkUserLabel(
  userId: string | undefined | null,
  labelMap?: ReadonlyMap<string, string>,
  explicitLabel?: string | null,
): string {
  if (explicitLabel?.trim()) return explicitLabel.trim();
  const id = userId?.trim();
  if (!id) return '—';
  const fromMap = labelMap?.get(id);
  if (fromMap) return fromMap;
  if (id.startsWith('user_')) return 'Usuario no disponible';
  return id;
}

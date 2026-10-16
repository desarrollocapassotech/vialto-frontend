/**
 * Texto para "Anulada por" (o cualquier "hecho por" con un userId de Clerk): el nombre que
 * resuelve el backend; si no se pudo resolver (usuario borrado, o datos copiados de otro
 * entorno con otro Clerk), un texto genérico. Nunca se muestra el `user_…` crudo.
 */
export function usuarioLabel(nombre: string | null | undefined, id: string | null | undefined): string | null {
  const n = nombre?.trim();
  if (n && !n.startsWith('user_')) return n;
  const crudo = id?.trim();
  if (!crudo) return null;
  // Valor viejo persistido como texto (no es un id de Clerk): se muestra tal cual.
  return crudo.startsWith('user_') ? 'Usuario no disponible' : crudo;
}

import { useMemo } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import {
  accesoRol,
  puedeEditarViajes,
  type AccesoModulo,
  type ModuloPermiso,
} from '@/lib/permisosRol';
import type { RoleContext } from '@/lib/roleLabels';

/**
 * Permisos del usuario logueado según la matriz única (`lib/permisosRol.ts`).
 * Mientras Clerk no cargó, nada se puede operar (no mostrar botones que después desaparecen).
 */
export function usePermisosRol() {
  const { orgRole, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  return useMemo(() => {
    const listo = isLoaded && userLoaded;
    const ctx: RoleContext = { orgRole, publicMetadata: user?.publicMetadata };
    const acceso = (m: ModuloPermiso): AccesoModulo => (listo ? accesoRol(ctx, m) : 'no');
    return {
      ctx,
      acceso,
      puedeOperar: (m: ModuloPermiso) => acceso(m) === 'operar',
      puedeEditarViajes: listo && puedeEditarViajes(ctx),
    };
  }, [isLoaded, userLoaded, orgRole, user?.publicMetadata]);
}

/** Atajo: ¿el usuario puede crear/modificar/anular en este módulo? */
export function usePuedeOperar(modulo: ModuloPermiso): boolean {
  return usePermisosRol().puedeOperar(modulo);
}

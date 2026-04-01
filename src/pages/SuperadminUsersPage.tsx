import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { PlatformUser } from '@/types/api';

function formatRole(role: string, platformRole?: string | null) {
  if (platformRole === 'superadmin') return 'Superadmin';
  if (role === 'org:admin') return 'Admin';
  if (role === 'org:supervisor') return 'Miembro';
  if (role === 'org:member') return 'Miembro';
  return role;
}

function formatDate(value: number | string) {
  try {
    const parsed =
      typeof value === 'number' ? new Date(value) : new Date(value);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed);
  } catch {
    return '—';
  }
}

export function SuperadminUsersPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroEmpresa = searchParams.get('tenantId')?.trim() ?? '';
  const [rows, setRows] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<PlatformUser[]>(
          `/api/platform/users?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'plataforma'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtroEmpresa, getToken, isLoaded, isSignedIn]);

  function onChangeTenant(nextTenantId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextTenantId) {
      next.set('tenantId', nextTenantId);
    } else {
      next.delete('tenantId');
    }
    setSearchParams(next, { replace: true });
  }

  const count = useMemo(() => rows?.length ?? 0, [rows]);

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
          Usuarios
        </h1>
        <p className="mt-2 text-vialto-steel max-w-3xl">
          Visualizá miembros de cada empresa para control de accesos y roles.
        </p>
        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={filtroEmpresa}
            onChange={onChangeTenant}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to={
              filtroEmpresa
                ? `/superadmin/usuarios/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
                : '#'
            }
            className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
              filtroEmpresa
                ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
                : 'bg-vialto-charcoal/50 pointer-events-none'
            }`}
            aria-disabled={!filtroEmpresa}
          >
            Crear usuario
          </Link>
        </div>

        {filtroEmpresa && (
          <p className="mt-4 text-sm text-vialto-steel">
            Usuarios encontrados: {rows === null ? '—' : count}
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Alta</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!filtroEmpresa && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                    Seleccioná una empresa para ver sus usuarios.
                  </td>
                </tr>
              )}
              {filtroEmpresa && rows === null && !error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                    Cargando…
                  </td>
                </tr>
              )}
              {filtroEmpresa && rows !== null && rows.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                    No hay usuarios en esta empresa.
                  </td>
                </tr>
              )}
              {filtroEmpresa &&
                rows?.map((u, idx) => (
                  <tr key={`${u.userId ?? u.email ?? `row-${idx}`}`} className="border-b border-black/5 hover:bg-vialto-mist/80">
                    <td className="px-4 py-3">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-vialto-steel">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">{formatRole(u.role, u.platformRole)}</td>
                    <td className="px-4 py-3 text-vialto-steel">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.userId ? (
                        <Link
                          to={`/superadmin/usuarios/${encodeURIComponent(u.userId)}/editar?tenantId=${encodeURIComponent(
                            filtroEmpresa,
                          )}`}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                        >
                          Editar
                        </Link>
                      ) : (
                        <span className="text-xs text-vialto-steel">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperadminOnly>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { UserViewModal } from '@/components/superadmin/UserViewModal';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
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
  const [rows, setRows] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<PlatformUser | null>(null);
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

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

        <ListadoDatos
          className="mt-8"
          columns={[
            {
              id: 'nombre',
              header: 'Nombre',
              primary: true,
              cell: (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
              tdClassName: listadoTablaTdClass,
            },
            {
              id: 'email',
              header: 'Email',
              cell: (u) => u.email ?? '—',
              tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
            },
            {
              id: 'rol',
              header: 'Rol',
              cell: (u) => formatRole(u.role, u.platformRole),
              tdClassName: listadoTablaTdClass,
            },
            {
              id: 'alta',
              header: 'Alta',
              cell: (u) => formatDate(u.createdAt),
              tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
            },
          ]}
          rows={!filtroEmpresa || error ? [] : rows}
          rowKey={(u) => u.userId ?? u.email ?? `${u.firstName}-${u.lastName}`}
          emptyMessage={
            !filtroEmpresa
              ? 'Seleccioná una empresa para ver sus usuarios.'
              : error
                ? 'No se pudieron cargar los usuarios.'
                : 'No hay usuarios en esta empresa.'
          }
          loadingMessage="Cargando…"
          renderActions={(u) =>
            u.userId ? (
              <button
                type="button"
                onClick={() => setViewingUser(u)}
                className={listadoTablaAccionClass}
              >
                Ver
              </button>
            ) : (
              <span className="text-xs text-vialto-steel">—</span>
            )
          }
        />
      </div>
      {viewingUser && (
        <UserViewModal
          user={viewingUser}
          tenantId={filtroEmpresa}
          onClose={() => setViewingUser(null)}
        />
      )}
    </SuperadminOnly>
  );
}

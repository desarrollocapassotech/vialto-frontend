import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { UserViewModal } from "@/components/superadmin/UserViewModal";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { PlatformUser, PaginatedMeta } from "@/types/api";

function formatRole(role: string, platformRole?: string | null) {
  if (platformRole === "superadmin") return "Superadmin";
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Miembro";
  if (role === "org:stock_viewer") return "Consulta de stock";
  return role;
}

function formatDate(value: number | string) {
  try {
    const parsed =
      typeof value === "number" ? new Date(value) : new Date(value);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  } catch {
    return "—";
  }
}

function getFullName(u: PlatformUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

export function SuperadminUsersPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

  const [rows, setRows] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<PlatformUser | null>(null);

  // --- ESTADOS DE PAGINACIÓN ---
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    LISTADO_PAGE_SIZE_OPTIONS[0] || 10,
  );
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEmail, setFiltroEmail] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroEmail("");
    setFiltroRol("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroEmail || !!filtroRol;

  // Extracción de opciones únicas para los selectores (sobre la página actual)
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || [])
            .map(getFullName)
            .filter((v): v is string => !!v && v !== "—"),
        ),
      ).sort(),
    [rows],
  );
  const opcionesEmail = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.email).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );
  const opcionesRol = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.role).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroNombre && getFullName(r) !== filtroNombre) return false;
      if (filtroEmail && r.email !== filtroEmail) return false;
      if (filtroRol && r.role !== filtroRol) return false;
      return true;
    });
  }, [rows, filtroNombre, filtroEmail, filtroRol]);

  // Reiniciar a la página 1 cuando se cambia de empresa
  useEffect(() => {
    setPage(1);
  }, [filtroEmpresa]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setMeta(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await apiJson<any>(
          `/api/platform/users?tenantId=${encodeURIComponent(
            filtroEmpresa,
          )}&page=${page}&limit=${pageSize}`,
          () => getToken(),
        );

        if (!cancelled) {
          let fetchedRows: PlatformUser[] = [];
          let fetchedMeta: PaginatedMeta | null = null;

          // Extracción segura y paginación en el frontend si es necesario
          if (Array.isArray(response)) {
            const totalItems = response.length;
            const calculatedTotalPages = Math.ceil(totalItems / pageSize) || 1;

            // Aseguramos no estar en una página fuera de rango
            const safePage =
              page > calculatedTotalPages ? calculatedTotalPages : page;

            // Recortamos el array
            const startIndex = (safePage - 1) * pageSize;
            const endIndex = startIndex + pageSize;

            fetchedRows = response.slice(startIndex, endIndex);
            fetchedMeta = {
              page: safePage,
              pageSize: pageSize,
              totalPages: calculatedTotalPages,
              total: totalItems,
              hasNext: safePage < calculatedTotalPages,
              hasPrev: safePage > 1,
            };
          } else if (response && response.data) {
            fetchedRows = response.data;
            fetchedMeta = response.meta || null;
          } else if (response && response.items) {
            fetchedRows = response.items;
            fetchedMeta = response.meta || null;
          }

          setRows(fetchedRows);
          setMeta(fetchedMeta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, "plataforma"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filtroEmpresa, getToken, isLoaded, isSignedIn, page, pageSize]);

  // Usamos meta.total para saber el conteo real de usuarios en el servidor
  const count = useMemo(
    () => meta?.total ?? (rows ? rows.length : 0),
    [meta, rows],
  );

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
            onChange={(id) => {
              limpiarFiltros();
              onChangeTenant(id);
            }}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {anyFiltroActivo && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              Limpiar filtros
            </button>
          )}
          <Link
            to={
              filtroEmpresa
                ? `/superadmin/usuarios/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
                : "#"
            }
            className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
              filtroEmpresa
                ? "bg-vialto-charcoal hover:bg-vialto-graphite"
                : "bg-vialto-charcoal/50 pointer-events-none"
            }`}
            aria-disabled={!filtroEmpresa}
          >
            Crear usuario
          </Link>
        </div>

        {filtroEmpresa && (
          <p className="mt-4 text-sm text-vialto-steel">
            Usuarios encontrados: {rows === null ? "—" : count}
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <ListadoDatos
          className={`mt-6 ${loading ? "opacity-50 pointer-events-none" : ""}`}
          tableColSpan={5}
          tableHead={
            <tr className={listadoTablaHeadRowClass}>
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Nombre"
                  filterActive={!!filtroNombre}
                  filterSignature={filtroNombre}
                >
                  <select
                    value={filtroNombre}
                    onChange={(e) => {
                      setFiltroNombre(e.target.value);
                      setPage(1);
                    }}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      filtroNombre ? "text-vialto-fire" : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por Nombre"
                  >
                    <option value="">Todos</option>
                    {opcionesNombre.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Email"
                  filterActive={!!filtroEmail}
                  filterSignature={filtroEmail}
                >
                  <select
                    value={filtroEmail}
                    onChange={(e) => {
                      setFiltroEmail(e.target.value);
                      setPage(1);
                    }}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      filtroEmail ? "text-vialto-fire" : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por Email"
                  >
                    <option value="">Todos</option>
                    {opcionesEmail.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Rol"
                  filterActive={!!filtroRol}
                  filterSignature={filtroRol}
                >
                  <select
                    value={filtroRol}
                    onChange={(e) => {
                      setFiltroRol(e.target.value);
                      setPage(1);
                    }}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      filtroRol ? "text-vialto-fire" : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por Rol"
                  >
                    <option value="">Todos</option>
                    {opcionesRol.map((o) => (
                      <option key={o} value={o}>
                        {formatRole(o)}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Alta
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Acciones
              </th>
            </tr>
          }
          columns={[
            {
              id: "nombre",
              header: "Nombre",
              primary: true,
              cell: (u) => getFullName(u),
              tdClassName: listadoTablaTdClass,
            },
            {
              id: "email",
              header: "Email",
              cell: (u) => u.email ?? "—",
              tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
            },
            {
              id: "rol",
              header: "Rol",
              cell: (u) => formatRole(u.role, u.platformRole),
              tdClassName: listadoTablaTdClass,
            },
            {
              id: "alta",
              header: "Alta",
              cell: (u) => formatDate(u.createdAt),
              tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
            },
          ]}
          rows={!filtroEmpresa || error ? [] : rowsFiltradas}
          rowKey={(u) => u.userId ?? u.email ?? `${u.firstName}-${u.lastName}`}
          emptyMessage={
            !filtroEmpresa
              ? "Seleccioná una empresa para ver sus usuarios."
              : error
                ? "No se pudieron cargar los usuarios."
                : anyFiltroActivo
                  ? "No hay usuarios que coincidan con los filtros aplicados."
                  : "No hay usuarios en esta empresa."
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

        {/* COMPONENTE DE PAGINACIÓN */}
        {meta && rows && rows.length > 0 && (
          <ListadoPagination
            meta={meta}
            pageSize={pageSize}
            loading={loading}
            totalLabel="usuarios"
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1); // Reiniciar a página 1 al cambiar tamaño
            }}
          />
        )}
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

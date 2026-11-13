import { useAuth } from "@clerk/clerk-react";
import { formatIdFiscal } from "@/lib/ciudades/paises";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { TransportistaViewModal } from "@/components/transportistas/TransportistaViewModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { pageSizeListadoValido } from "@/lib/listadoPaginacion";
import { Eye, Pencil, Power, RotateCcw } from "lucide-react";
import {
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useIdFiscalLabel } from "@/hooks/useIdFiscalLabel";
import { useTransportistaLabels } from "@/hooks/useTransportistaLabels";
import { etiquetaTipoProveedor, opcionesFiltroTipo } from "@/lib/proveedorTipo";
import { useCategoriasProveedor } from "@/hooks/useCategoriasProveedor";
import type { PaginatedMeta, Transportista } from "@/types/api";
import { LimpiarFiltrosButton } from "@/components/listado/LimpiarFiltrosButton";
import { ListadoFiltroBuscador } from "@/components/listado/ListadoFiltroBuscador";

type TransportistasPaginatedResponse = {
  items: Transportista[];
  meta: PaginatedMeta;
};

/** `transportista`, `taller`, `otro` (todos los otros) o `cat:<nombre>` (un tipo propio). */
type FiltroTipo = string;
type FiltroEstado = "todos" | "activos" | "inactivos";

/**
 * Base de datos → Proveedores (nov 2026): transportistas, talleres y otros proveedores.
 * El archivo conserva el nombre "Transportistas" (rutas `/transportistas/...`).
 */
export function TransportistasTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Transportista[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [viewingTransportista, setViewingTransportista] =
    useState<Transportista | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Transportista | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const { isVisible } = useFieldConfig("transportistas");
  const idFiscalVisible = isVisible("detalle_transportista", "idFiscal");
  const emailVisible = isVisible("detalle_transportista", "email");
  const telefonoVisible = isVisible("detalle_transportista", "telefono");
  const idFiscalLabel = useIdFiscalLabel();
  const labels = useTransportistaLabels();
  const categorias = useCategoriasProveedor();

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroIdFiscal, setFiltroIdFiscal] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroIdFiscal("");
    setFiltroTipo("todos");
    setFiltroEstado("todos");
    setPage(1);
  }

  const anyFiltroActivo =
    !!filtroNombre || !!filtroIdFiscal || filtroTipo !== "todos" || filtroEstado !== "todos";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeListadoValido(pageSize);
        const params = new URLSearchParams({
          page: String(pageApi),
          pageSize: String(pageSizeApi),
          tipo: filtroTipo.startsWith("cat:") ? "otro" : filtroTipo,
        });
        if (filtroTipo.startsWith("cat:")) params.set("categoria", filtroTipo.slice(4));
        if (filtroNombre.trim()) {
          params.set("nombre", filtroNombre.trim());
        }
        if (filtroIdFiscal.trim()) {
          params.set("idFiscal", filtroIdFiscal.trim());
        }
        if (filtroEstado !== "todos") {
          params.set("activo", filtroEstado === "activos" ? "true" : "false");
        }
        const data = await apiJson<TransportistasPaginatedResponse>(
          `/api/transportistas/paginated?${params.toString()}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setServerMeta(data.meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setServerMeta(null);
          setError(friendlyError(e, "transportistas"));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize, filtroNombre, filtroIdFiscal, filtroTipo, filtroEstado, recarga]);

  function irAPagina(nuevaPagina: number) {
    setListadoRefetching(true);
    setPage(Math.max(1, nuevaPagina));
  }

  function cambiarPageSize(nuevoSize: number) {
    setListadoRefetching(true);
    setPageSize(nuevoSize);
    setPage(1);
  }

  async function handleToggleActivo() {
    if (!confirmToggle) return;
    setError(null);
    setToggleBusy(true);
    try {
      await apiJson<Transportista>(
        `/api/transportistas/${encodeURIComponent(confirmToggle.id)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify({ activo: !confirmToggle.activo }) },
      );
      setConfirmToggle(null);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(friendlyError(e, "transportistas"));
      setConfirmToggle(null);
    } finally {
      setToggleBusy(false);
    }
  }

  const filtroSelectClass = (activo: boolean) =>
    `h-9 w-full border border-black/15 bg-white px-2 text-sm ${
      activo ? "text-vialto-fire" : "text-vialto-charcoal"
    }`;

  return (
    <div className="w-full">
      {/* Título a la izquierda; acciones a la derecha, en la misma línea. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
            Proveedores
          </h1>
        </div>
        {anyFiltroActivo && (
          <LimpiarFiltrosButton onClick={limpiarFiltros} soloDesktop />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/transportistas/nuevo"
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear proveedor
          </Link>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={4 + (idFiscalVisible ? 1 : 0) + (emailVisible ? 1 : 0) + (telefonoVisible ? 1 : 0)}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Nombre"
                filterActive={!!filtroNombre}
                filterSignature={filtroNombre}
                onClear={() => {
                  setFiltroNombre("");
                  setPage(1);
                }}
              >
                <ListadoFiltroBuscador
                  value={filtroNombre}
                  onApply={(val) => {
                    setFiltroNombre(val);
                    setPage(1);
                  }}
                  placeholder="Buscar…"
                  ariaLabel="Buscar por Nombre"
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Tipo"
                filterActive={filtroTipo !== "todos"}
                filterSignature={filtroTipo}
                onClear={() => {
                  setFiltroTipo("todos");
                  setPage(1);
                }}
              >
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value as FiltroTipo);
                    setPage(1);
                  }}
                  className={filtroSelectClass(filtroTipo !== "todos")}
                  aria-label="Filtrar por tipo de proveedor"
                >
                  <option value="todos">Todos</option>
                  {opcionesFiltroTipo(labels, categorias).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            {idFiscalVisible && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title={idFiscalLabel}
                  filterActive={!!filtroIdFiscal}
                  filterSignature={filtroIdFiscal}
                  onClear={() => {
                    setFiltroIdFiscal("");
                    setPage(1);
                  }}
                >
                  <ListadoFiltroBuscador
                    value={filtroIdFiscal}
                    onApply={(val) => {
                      setFiltroIdFiscal(val);
                      setPage(1);
                    }}
                    placeholder="Buscar…"
                    ariaLabel={`Buscar por ${idFiscalLabel}`}
                  />
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            {emailVisible && (
              <th scope="col" className={listadoTablaThClass}>
                Email
              </th>
            )}
            {telefonoVisible && (
              <th scope="col" className={listadoTablaThClass}>
                Teléfono
              </th>
            )}
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={filtroEstado !== "todos"}
                filterSignature={filtroEstado}
                onClear={() => {
                  setFiltroEstado("todos");
                  setPage(1);
                }}
              >
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value as FiltroEstado);
                    setPage(1);
                  }}
                  className={filtroSelectClass(filtroEstado !== "todos")}
                  aria-label="Filtrar por estado del proveedor"
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                </select>
              </ViajesListadoHeaderFiltro>
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
            cell: (t) => t.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "tipo",
            header: "Tipo",
            cell: (t: Transportista) => etiquetaTipoProveedor(t, labels),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          ...(idFiscalVisible ? [{
            id: "idFiscal",
            header: idFiscalLabel,
            cell: (t: Transportista) => (t.idFiscal ? formatIdFiscal(t.idFiscal, t.pais) : "—"),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          ...(emailVisible ? [{
            id: "email",
            header: "Email",
            cell: (t: Transportista) => t.email ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          ...(telefonoVisible ? [{
            id: "telefono",
            header: "Teléfono",
            cell: (t: Transportista) => t.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          {
            id: "estado",
            header: "Estado",
            cell: (t: Transportista) => (
              <span
                className={
                  t.activo
                    ? "text-xs uppercase tracking-wider text-emerald-800"
                    : "text-xs uppercase tracking-wider text-vialto-steel"
                }
              >
                {t.activo ? "Activo" : "Inactivo"}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={error ? [] : (rows ?? [])}
        rowKey={(t) => t.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los proveedores."
            : anyFiltroActivo
              ? "No hay proveedores que coincidan con los filtros aplicados."
              : "Todavía no hay proveedores cargados."
        }
        loadingMessage="Cargando…"
        rowActionsMaxIconos={3}
        rowActionsSubtitle={(t) => t.nombre}
        rowActions={(t) => [
          { id: "ver", label: "Ver proveedor", icon: Eye, onClick: () => setViewingTransportista(t) },
          {
            id: "editar",
            label: "Editar",
            icon: Pencil,
            onClick: () => navigate(`/transportistas/${encodeURIComponent(t.id)}/editar`),
          },
          t.activo
            ? { id: "desactivar", label: "Desactivar", icon: Power, danger: true, onClick: () => setConfirmToggle(t) }
            : { id: "reactivar", label: "Reactivar", icon: RotateCcw, onClick: () => setConfirmToggle(t) },
        ]}
      />

      {serverMeta && serverMeta.total > 0 && (
        <div className="mt-4">
          <ListadoPagination
            meta={serverMeta}
            pageSize={pageSize}
            loading={listadoRefetching}
            totalLabel="proveedores"
            onPageChange={irAPagina}
            onPageSizeChange={cambiarPageSize}
          />
        </div>
      )}

      {viewingTransportista && (
        <TransportistaViewModal
          transportista={viewingTransportista}
          onClose={() => setViewingTransportista(null)}
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar`}
        />
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.activo ? "Desactivar proveedor" : "Reactivar proveedor"}
        message={
          confirmToggle?.activo
            ? `¿Desactivar a "${confirmToggle?.nombre}"? Deja de aparecer para elegirlo en viajes, órdenes de trabajo y demás, pero conserva su historial y su cuenta corriente.`
            : `¿Reactivar a "${confirmToggle?.nombre}"?`
        }
        confirmLabel={confirmToggle?.activo ? "Desactivar" : "Reactivar"}
        tone={confirmToggle?.activo ? "danger" : "default"}
        busy={toggleBusy}
        onConfirm={handleToggleActivo}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}

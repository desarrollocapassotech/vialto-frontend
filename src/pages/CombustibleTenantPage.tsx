import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  pageTitleClass,
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from "@/lib/listadoTabla";
import { useMaestroData } from "@/hooks/useMaestroData";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import { CargaCombustibleCreateModal } from "@/components/combustible/CargaCombustibleCreateModal";
import {
  FORMA_PAGO_LABELS,
  fmtFormaPago,
  fmtTipoVehiculo,
} from "@/lib/combustibleLabels";
import { exportarCargasCombustible } from "@/lib/combustibleExcelExport";
import { exportarCargasCombustibleCsv } from "@/lib/combustibleCsvExport";
import type { CargaCombustible, PaginatedMeta } from "@/types/api";

type CombustibleListResponse = {
  cargas: CargaCombustible[];
  total: number;
  page: number;
  limit: number;
};

type FormatoExport = "xlsx" | "csv";

// Formatea los atributos del vehículo para armar una etiqueta única y descriptiva
function fmtVehiculoLabel(v: {
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}): string {
  const tipo = fmtTipoVehiculo(v.tipo);
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  const detalle = [tipo, marcaModelo].filter(Boolean).join(" · ");
  return detalle ? `${v.patente} — ${detalle}` : v.patente;
}

// Convierte marcas de tiempo ISO a formato legible local de Argentina
function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// Aplica formato de millares para números en pantalla
function fmtNum(n: number) {
  return n.toLocaleString("es-AR");
}

// Configuración de columnas base para la renderización de la grilla de datos
const COLUMNS: ListadoColumn<CargaCombustible>[] = [
  {
    id: "fecha",
    header: "Fecha",
    primary: true,
    cell: (r) => fmtFecha(r.fecha),
  },
  {
    id: "chofer",
    header: "Conductor",
    cell: (r) => r.chofer?.nombre ?? "—",
  },
  {
    id: "vehiculo",
    header: "Vehículo",
    cell: (r) => r.vehiculo?.patente ?? r.vehiculoId,
  },
  {
    id: "estacion",
    header: "Estación",
    cell: (r) => r.estacion,
    showInCard: false,
  },
  {
    id: "litros",
    header: "Litros",
    cell: (r) => `${fmtNum(r.litros)} L`,
  },
  {
    id: "precioPorLitro",
    header: "Precio/L",
    cell: (r) =>
      r.precioPorLitro != null ? `$${fmtNum(r.precioPorLitro)}` : "—",
  },
  {
    id: "importe",
    header: "Monto",
    cell: (r) => `$${fmtNum(r.importe)}`,
  },
  {
    id: "km",
    header: "Km",
    cell: (r) => fmtNum(r.km),
    showInCard: false,
  },
  {
    id: "formaPago",
    header: "Forma de pago",
    cell: (r) => fmtFormaPago(r.formaPago),
    showInCard: false,
  },
];

export function CombustibleTenantPage() {
  // ─── HOOKS GLOBALES E INICIALIZACIÓN ─────────────────────────────────────
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();
  const { showToast } = useToast(); // <-- Instancia del context de toasts

  // ─── ESTADOS DE LA TABLA Y PAGINACIÓN ────────────────────────────────────
  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // ─── ESTADOS PARA LOS FILTROS DE LA GRILLA ───────────────────────────────
  const [month, setMonth] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [estacion, setEstacion] = useState("");
  const [formaPago, setFormaPago] = useState("");

  // Control de apertura de modales de visualización y alta
  const [viewingCargaId, setViewingCargaId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ─── ESTADOS PARA EL DIÁLOGO DE ELIMINACIÓN ──────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<CargaCombustible | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function resetPage() {
    setPage(1);
  }

  // Restablece todos los criterios de filtrado aplicados a la vista
  function handleClearFilters() {
    setMonth("");
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setPage(1);
  }

  const hayFiltros = Boolean(
    month || vehiculoId || choferId || estacion || formaPago,
  );

  // Parámetros de filtro compartidos entre el listado y la exportación.
  function filtroParams(): URLSearchParams {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (vehiculoId) qs.set("vehiculoId", vehiculoId);
    if (choferId) qs.set("choferId", choferId);
    if (estacion) qs.set("estacion", estacion);
    if (formaPago) qs.set("formaPago", formaPago);
    return qs;
  }

  // ─── EFECTO SECUNDARIO: CARGA Y FILTRADO DE COMPROBANTES ────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setRows(null);

    void (async () => {
      try {
        const qs = filtroParams();
        qs.set("page", String(page));
        qs.set("limit", String(pageSize));

        const data = await apiJson<CombustibleListResponse>(
          `/api/combustible?${qs.toString()}`,
          () => getToken(),
        );

        if (!cancelled) {
          setRows(data.cargas);
          setTotal(data.total);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(friendlyError(e, "combustible"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    month,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    getToken,
  ]);

  // Cerrar el menú de exportación al hacer click afuera o presionar Escape.
  useEffect(() => {
    if (!exportMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [exportMenuOpen]);

  // Trae todas las cargas del filtro actual (sin límite de página).
  async function fetchTodasLasCargas(): Promise<CargaCombustible[]> {
    const qs = filtroParams();
    qs.set("page", "1");
    qs.set("limit", String(total));
    const data = await apiJson<CombustibleListResponse>(
      `/api/combustible?${qs.toString()}`,
      () => getToken(),
    );
    return data.cargas;
  }

  async function handleExport(formato: FormatoExport) {
    if (downloading || total === 0) return;
    setExportMenuOpen(false);
    setDownloading(true);
    try {
      const cargas = await fetchTodasLasCargas();
      if (formato === "xlsx") {
        await exportarCargasCombustible(cargas, { month: month || undefined });
      } else {
        exportarCargasCombustibleCsv(cargas, { month: month || undefined });
      }
      setError(null);
    } catch (e) {
      setError(friendlyError(e, "combustible"));
    } finally {
      setDownloading(false);
    }
  }

  // ─── ACCIÓN CRÍTICA: CONFIRMAR Y ELIMINAR REGISTRO ────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiJson<{ deleted: string }>(
        `/api/combustible/${deleteTarget.id}`,
        () => getToken(),
        { method: "DELETE" },
      );

      // --> TOAST INYECTADO: FEEDBACK DE ÉXITO AL BORRAR <--
      showToast("Carga de combustible eliminada correctamente", "success");

      const deletedId = deleteTarget.id;
      setRows((prev) => {
        const next = prev ? prev.filter((r) => r.id !== deletedId) : prev;
        if (next && next.length === 0 && page > 1) {
          setPage((p) => p - 1);
        }
        return next;
      });
      setTotal((t) => Math.max(0, t - 1));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(friendlyError(e, "combustible"));

      // --> TOAST INYECTADO: FEEDBACK DE ERROR AL BORRAR <--
      showToast("No se pudo eliminar la carga de combustible", "error");
    } finally {
      setDeleting(false);
    }
  }

  // Permite cerrar el diálogo de borrado presionando la tecla Escape
  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, deleting]);

  // Constantes calculadas para alimentar la barra de paginación
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const meta: PaginatedMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };

  const inputClass =
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none";

  const exportDisabled = rows === null || total === 0 || downloading;

  // Agrega de forma dinámica la acción de borrado al arreglo de columnas de la grilla
  const columns = useMemo<ListadoColumn<CargaCombustible>[]>(
    () => [
      ...COLUMNS,
      {
        id: "acciones",
        header: "Acciones",
        cell: (r) => (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(r);
            }}
            className="inline-flex h-8 items-center px-3 border border-red-200 bg-white text-xs uppercase tracking-wider text-red-600 hover:bg-red-50 transition-colors"
            aria-label={`Eliminar carga del ${fmtFecha(r.fecha)}`}
          >
            Eliminar
          </button>
        ),
      },
    ],
    [],
  );

  // Filtros renderizados exclusivamente para resoluciones móviles
  const mobileFilters = (
    <>
      <ListadoFiltroCampo label="Mes" active={Boolean(month)}>
        <input
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            resetPage();
          }}
          className={`${inputClass} ${month ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por mes"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Conductor" active={Boolean(choferId)}>
        <select
          value={choferId}
          onChange={(e) => {
            setChoferId(e.target.value);
            resetPage();
          }}
          className={`${inputClass} ${choferId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por conductor"
        >
          <option value="">Todos</option>
          {maestro.choferes.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.nombre}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Vehículo" active={Boolean(vehiculoId)}>
        <select
          value={vehiculoId}
          onChange={(e) => {
            setVehiculoId(e.target.value);
            resetPage();
          }}
          className={`${inputClass} ${vehiculoId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por vehículo"
        >
          <option value="">Todos</option>
          {maestro.vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {fmtVehiculoLabel(v)}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Estación" active={Boolean(estacion)}>
        <input
          type="text"
          value={estacion}
          onChange={(e) => {
            setEstacion(e.target.value);
            resetPage();
          }}
          placeholder="Buscar estación..."
          className={`${inputClass} ${estacion ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por estación"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Forma de pago" active={Boolean(formaPago)}>
        <select
          value={formaPago}
          onChange={(e) => {
            setFormaPago(e.target.value);
            resetPage();
          }}
          className={`${inputClass} ${formaPago ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por forma de pago"
        >
          <option value="">Todas</option>
          {Object.entries(FORMA_PAGO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>
    </>
  );

  // Cabecera interactiva con selectores embebidos para resoluciones de escritorio
  const tableHead = (
    <tr className="border-b border-black/10">
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Fecha"
          filterActive={Boolean(month)}
          filterSignature={month}
        >
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              resetPage();
            }}
            className={`${inputClass} min-w-[150px]`}
            aria-label="Filtrar por mes"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Conductor"
          filterActive={Boolean(choferId)}
          filterSignature={choferId}
        >
          <select
            value={choferId}
            onChange={(e) => {
              setChoferId(e.target.value);
              resetPage();
            }}
            className={`${inputClass} min-w-[160px]`}
            aria-label="Filtrar por conductor"
          >
            <option value="">Todos</option>
            {maestro.choferes.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.nombre}
              </option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Vehículo"
          filterActive={Boolean(vehiculoId)}
          filterSignature={vehiculoId}
        >
          <select
            value={vehiculoId}
            onChange={(e) => {
              setVehiculoId(e.target.value);
              resetPage();
            }}
            className={`${inputClass} min-w-[140px]`}
            aria-label="Filtrar por vehículo"
          >
            <option value="">Todos</option>
            {maestro.vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {fmtVehiculoLabel(v)}
              </option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Estación"
          filterActive={Boolean(estacion)}
          filterSignature={estacion}
        >
          <input
            type="text"
            value={estacion}
            onChange={(e) => {
              setEstacion(e.target.value);
              resetPage();
            }}
            placeholder="Buscar..."
            className={`${inputClass} min-w-[140px]`}
            aria-label="Filtrar por estación"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Litros
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Precio/L
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Monto
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Km
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Forma de pago"
          filterActive={Boolean(formaPago)}
          filterSignature={formaPago}
        >
          <select
            value={formaPago}
            onChange={(e) => {
              setFormaPago(e.target.value);
              resetPage();
            }}
            className={`${inputClass} min-w-[150px]`}
            aria-label="Filtrar por forma de pago"
          >
            <option value="">Todas</option>
            {Object.entries(FORMA_PAGO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Acciones
        </span>
      </th>
    </tr>
  );

  const cantFiltros = [month, vehiculoId, choferId, estacion, formaPago].filter(
    Boolean,
  ).length;

  // ─── RENDERIZADO GENERAL DE LA PÁGINA ─────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Combustible</h1>
        <div className="flex items-center gap-3">
          {/* Exportar: el admin elige entre Excel (.xlsx) o CSV (.csv) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={exportDisabled}
              className="inline-flex h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              aria-label="Exportar listado"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M12 11v6" />
                <path d="m9 14 3 3 3-3" />
              </svg>
              {downloading ? "Exportando…" : "Exportar"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[190px] border border-black/15 bg-white shadow-lg"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-vialto-charcoal hover:bg-vialto-mist/80 transition-colors"
                >
                  Excel (.xlsx)
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-vialto-charcoal hover:bg-vialto-mist/80 transition-colors border-t border-black/10"
                >
                  CSV (.csv)
                </button>
              </div>
            )}
          </div>

          {/* BOTÓN: Limpiar filtros alineado con los otros botones de acción */}
          {hayFiltros && (
            <div className="hidden min-h-10 items-center lg:flex">
              <button
                type="button"
                onClick={handleClearFilters}
                disabled={rows === null}
                className="inline-flex h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none"
                aria-label={`Limpiar filtros (${cantFiltros} activo${cantFiltros !== 1 ? "s" : ""})`}
              >
                Limpiar filtros
                <span
                  className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold tabular-nums leading-none text-white"
                  aria-hidden
                >
                  {cantFiltros}
                </span>
              </button>
            </div>
          )}

          {/* BOTÓN: Nueva Carga (Rama HEAD) */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-xs font-semibold uppercase tracking-wider hover:bg-black transition-colors"
          >
            Nueva carga
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ListadoDatos<CargaCombustible>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="Sin cargas registradas"
        filters={mobileFilters}
        activeFilterCount={
          [month, vehiculoId, choferId, estacion, formaPago].filter(Boolean)
            .length
        }
        onClearFilters={handleClearFilters}
        clearFiltersDisabled={!hayFiltros}
        filtersTitle="Filtrar cargas"
        tableHead={tableHead}
        actionsTdClassName={listadoTablaTdClass}
        renderActions={(c) => (
          <button
            type="button"
            onClick={() => setViewingCargaId(c.id)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {rows !== null && total > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={rows === null}
          totalLabel="cargas"
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}

      {/* COMPONENTE INTERFAZ DE DIÁLOGO: CONFIRMAR ELIMINACIÓN */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-eliminar-titulo"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md border border-black/15 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirmar-eliminar-titulo"
              className="text-lg font-semibold text-vialto-charcoal"
            >
              Eliminar carga
            </h2>
            <p className="mt-2 text-sm text-vialto-steel">
              ¿Seguro que querés eliminar la carga del{" "}
              <span className="font-medium text-vialto-charcoal">
                {fmtFecha(deleteTarget.fecha)}
              </span>
              {deleteTarget.vehiculo?.patente ? (
                <>
                  {" "}
                  del vehículo{" "}
                  <span className="font-medium text-vialto-charcoal">
                    {deleteTarget.vehiculo.patente}
                  </span>
                </>
              ) : null}
              ? Esta acción no se puede deshacer.
            </p>

            {deleteError && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center px-4 border border-red-600 bg-red-600 text-sm uppercase tracking-wider text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EL REGISTRO DE ALTAS */}
      {isCreateModalOpen && (
        <CargaCombustibleCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(nuevaCarga) => {
            setIsCreateModalOpen(false);

            const vehiculoCompleto = maestro.vehiculos.find(
              (v) => v.id === nuevaCarga.vehiculoId,
            );
            const choferCompleto = maestro.choferes.find(
              (c) => c.id === nuevaCarga.choferId,
            );

            const cargaPopulada: CargaCombustible = {
              ...nuevaCarga,
              vehiculo: vehiculoCompleto || null,
              chofer: choferCompleto || null,
            };

            setRows((prev) =>
              prev ? [cargaPopulada, ...prev] : [cargaPopulada],
            );
            setTotal((t) => t + 1);
          }}
        />
      )}

      {/* MODAL PARA LA VISTA DETALLADA DEL COMPROBANTE */}
      {viewingCargaId && (
        <CargaCombustibleViewModal
          cargaId={viewingCargaId}
          onClose={() => setViewingCargaId(null)}
        />
      )}
    </div>
  );
}

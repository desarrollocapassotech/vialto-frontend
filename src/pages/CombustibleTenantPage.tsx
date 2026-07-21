import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import { CargaCombustibleCreateModal } from "@/components/combustible/CargaCombustibleCreateModal";
import { SospechaBadge } from "@/components/combustible/SospechaBadge";
import { FORMA_PAGO_LABELS, fmtTipoVehiculo } from "@/lib/combustibleLabels";
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

// yyyy-mm-dd en huso horario local (no UTC, para que coincida con lo que el usuario ve/elige).
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function primerDiaMesActual(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function hoyIso(): string {
  return toIsoDate(new Date());
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
  },
  {
    id: "litros",
    header: "Litros",
    cell: (r) => `${fmtNum(r.litros)} L`,
  },
  {
    id: "importe",
    header: "Monto",
    cell: (r) => `$${fmtNum(r.importe)}`,
  },
];

export function CombustibleTenantPage() {
  // ─── HOOKS GLOBALES E INICIALIZACIÓN ─────────────────────────────────────
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();
  const { showToast } = useToast();

  // ─── ESTADOS DE LA TABLA Y PAGINACIÓN ────────────────────────────────────
  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Filtros iniciales que puede traer el link "Ver cargas" del dashboard
  // (por vehículo, chofer + período, o recarga manual). Solo se leen una vez, al montar.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialVehiculoId = searchParams.get("vehiculoId") ?? "";
  const initialChoferId = searchParams.get("choferId") ?? "";
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const initialEstacion = searchParams.get("estacion") ?? "";
  const initialFormaPago = searchParams.get("formaPago") ?? "";

  // ─── ESTADOS PARA LOS FILTROS DE LA GRILLA ───────────────────────────────
  const [desde, setDesde] = useState<string>(
    () => initialFrom || primerDiaMesActual(),
  );
  const [hasta, setHasta] = useState<string>(() => initialTo || hoyIso());
  const [desdeInput, setDesdeInput] = useState<string>(desde);
  const [hastaInput, setHastaInput] = useState<string>(hasta);
  const [vehiculoId, setVehiculoId] = useState(initialVehiculoId);
  const [choferId, setChoferId] = useState(initialChoferId);
  const [estacion, setEstacion] = useState(initialEstacion);
  const [formaPago, setFormaPago] = useState(initialFormaPago);
  const [estaciones, setEstaciones] = useState<string[]>([]);

  // Control de apertura de modales de visualización y alta
  const [viewingCargaId, setViewingCargaId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ─── ESTADOS PARA EL DIÁLOGO DE ELIMINACIÓN ──────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<CargaCombustible | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── EFECTO SECUNDARIO: SINCRONIZAR FILTROS CON LA URL ───────────────────
  useEffect(() => {
    const qs = new URLSearchParams();

    // Solo ensuciamos la URL con las fechas si el usuario sale del rango por defecto
    const esRangoPorDefecto =
      desde === primerDiaMesActual() && hasta === hoyIso();
    if (!esRangoPorDefecto) {
      if (desde) qs.set("from", desde);
      if (hasta) qs.set("to", hasta);
    }

    if (vehiculoId) qs.set("vehiculoId", vehiculoId);
    if (choferId) qs.set("choferId", choferId);
    if (estacion) qs.set("estacion", estacion);
    if (formaPago) qs.set("formaPago", formaPago);

    // Usamos replace: true para no crear un historial de navegación infinito
    setSearchParams(qs, { replace: true });
  }, [
    desde,
    hasta,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    setSearchParams,
  ]);

  function resetPage() {
    setPage(1);
  }

  // Aplica el rango de fechas ingresado en los inputs (botón "Filtrar").
  function aplicarFiltroFecha() {
    setDesde(desdeInput);
    setHasta(hastaInput);
    resetPage();
  }

  // Restablece todos los criterios de filtrado aplicados a la vista
  function handleClearFilters() {
    const d = primerDiaMesActual();
    const h = hoyIso();
    setDesde(d);
    setHasta(h);
    setDesdeInput(d);
    setHastaInput(h);
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setPage(1);
  }

  // El rango de fechas siempre tiene un valor (por defecto mes actual → hoy),
  // así que solo cuenta como "filtro activo" cuando el usuario lo cambió.
  const rangoFechaPorDefecto =
    desde === primerDiaMesActual() && hasta === hoyIso();

  const hayFiltros = Boolean(
    !rangoFechaPorDefecto || vehiculoId || choferId || estacion || formaPago,
  );

  // Parámetros de filtro compartidos entre el listado y la exportación.
  function filtroParams(): URLSearchParams {
    const qs = new URLSearchParams();
    if (desde) qs.set("from", desde);
    if (hasta) qs.set("to", hasta);
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
    desde,
    hasta,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    getToken,
  ]);

  // Estaciones distintas entre las cargas existentes, para el filtro
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<string[]>(
          "/api/combustible/estaciones",
          () => getToken(),
        );
        if (!cancelled) setEstaciones(data);
      } catch {
        // silencioso — el filtro queda con solo la opción "Todas"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

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
        await exportarCargasCombustible(cargas, { from: desde, to: hasta });
      } else {
        exportarCargasCombustibleCsv(cargas, { from: desde, to: hasta });
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

  // Opciones para los filtros con buscador (conductor, vehículo, estación)
  const choferOptions = useMemo(
    () => maestro.choferes.map((ch) => ({ value: ch.id, label: ch.nombre })),
    [maestro.choferes],
  );
  const vehiculoOptions = useMemo(
    () =>
      maestro.vehiculos.map((v) => ({
        value: v.id,
        label: fmtVehiculoLabel(v),
      })),
    [maestro.vehiculos],
  );
  const estacionOptions = useMemo(
    () => estaciones.map((e) => ({ value: e, label: e })),
    [estaciones],
  );

  // Agrega de forma dinámica la acción de borrado al arreglo de columnas de la grilla
  const columns = useMemo<ListadoColumn<CargaCombustible>[]>(
    () => [
      {
        id: "sospecha",
        header: "",
        cell: (r) =>
          r.sospechoso ? (
            <SospechaBadge
              motivo={r.motivoSospecha}
              onClick={() => setViewingCargaId(r.id)}
            />
          ) : null,
        showInCard: false,
        thClassName: "w-8 px-2 py-3",
        tdClassName: "w-8 px-2 py-3",
      },
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
      <ListadoFiltroCampo label="Fecha" active={!rangoFechaPorDefecto}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Desde
              <input
                type="date"
                value={desdeInput}
                onChange={(e) => setDesdeInput(e.target.value)}
                className={inputClass}
                aria-label="Filtrar desde fecha"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Hasta
              <input
                type="date"
                value={hastaInput}
                onChange={(e) => setHastaInput(e.target.value)}
                className={inputClass}
                aria-label="Filtrar hasta fecha"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={aplicarFiltroFecha}
            className="h-9 w-full border border-black/15 bg-vialto-charcoal text-xs uppercase tracking-wider text-white hover:bg-black transition-colors"
          >
            Filtrar
          </button>
        </div>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Conductor" active={Boolean(choferId)}>
        <SearchableSelect
          value={choferId}
          onChange={(v) => {
            setChoferId(v);
            resetPage();
          }}
          options={choferOptions}
          placeholder="Todos"
          searchPlaceholder="Buscar conductor…"
          triggerClassName={choferId ? "text-vialto-fire" : ""}
          ariaLabel="Filtrar por conductor"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Vehículo" active={Boolean(vehiculoId)}>
        <SearchableSelect
          value={vehiculoId}
          onChange={(v) => {
            setVehiculoId(v);
            resetPage();
          }}
          options={vehiculoOptions}
          placeholder="Todos"
          searchPlaceholder="Buscar vehículo…"
          triggerClassName={vehiculoId ? "text-vialto-fire" : ""}
          ariaLabel="Filtrar por vehículo"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Estación" active={Boolean(estacion)}>
        <SearchableSelect
          value={estacion}
          onChange={(v) => {
            setEstacion(v);
            resetPage();
          }}
          options={estacionOptions}
          placeholder="Todas"
          searchPlaceholder="Buscar estación…"
          triggerClassName={estacion ? "text-vialto-fire" : ""}
          ariaLabel="Filtrar por estación"
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
      <th className="w-8 px-2 py-3" aria-hidden />
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Fecha"
          filterActive={!rangoFechaPorDefecto}
          filterSignature={`${desde}|${hasta}`}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Desde
              <input
                type="date"
                value={desdeInput}
                onChange={(e) => setDesdeInput(e.target.value)}
                className={`${inputClass} min-w-[150px]`}
                aria-label="Filtrar desde fecha"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Hasta
              <input
                type="date"
                value={hastaInput}
                onChange={(e) => setHastaInput(e.target.value)}
                className={`${inputClass} min-w-[150px]`}
                aria-label="Filtrar hasta fecha"
              />
            </label>
            <button
              type="button"
              onClick={aplicarFiltroFecha}
              className="h-8 w-full border border-black/15 bg-vialto-charcoal text-xs uppercase tracking-wider text-white hover:bg-black transition-colors"
            >
              Filtrar
            </button>
          </div>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Conductor"
          filterActive={Boolean(choferId)}
          filterSignature={choferId}
        >
          <SearchableSelect
            value={choferId}
            onChange={(v) => {
              setChoferId(v);
              resetPage();
            }}
            options={choferOptions}
            placeholder="Todos"
            searchPlaceholder="Buscar conductor…"
            triggerClassName="min-w-[160px]"
            ariaLabel="Filtrar por conductor"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Vehículo"
          filterActive={Boolean(vehiculoId)}
          filterSignature={vehiculoId}
        >
          <SearchableSelect
            value={vehiculoId}
            onChange={(v) => {
              setVehiculoId(v);
              resetPage();
            }}
            options={vehiculoOptions}
            placeholder="Todos"
            searchPlaceholder="Buscar vehículo…"
            triggerClassName="min-w-[140px]"
            ariaLabel="Filtrar por vehículo"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Estación"
          filterActive={Boolean(estacion)}
          filterSignature={estacion}
        >
          <SearchableSelect
            value={estacion}
            onChange={(v) => {
              setEstacion(v);
              resetPage();
            }}
            options={estacionOptions}
            placeholder="Todas"
            searchPlaceholder="Buscar estación…"
            triggerClassName="min-w-[140px]"
            ariaLabel="Filtrar por estación"
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
          Monto
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Acciones
        </span>
      </th>
    </tr>
  );

  const cantFiltros = [
    !rangoFechaPorDefecto,
    Boolean(vehiculoId),
    Boolean(choferId),
    Boolean(estacion),
    Boolean(formaPago),
  ].filter(Boolean).length;

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

          {/* BOTÓN: Nueva Carga */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-xs font-semibold uppercase tracking-wider hover:bg-black transition-colors"
          >
            Nueva carga
          </button>
        </div>
      </div>

      <p className="text-xs text-vialto-steel">
        Mostrando cargas del {fmtFecha(desde)} al {fmtFecha(hasta)}
      </p>

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
        activeFilterCount={cantFiltros}
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

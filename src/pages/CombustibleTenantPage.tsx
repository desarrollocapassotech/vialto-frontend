import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { ChevronDown, Eye, Fuel, Trash2, UserRoundCog } from "lucide-react";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";
import { CargaCombustibleCreateModal } from "@/components/combustible/CargaCombustibleCreateModal";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import { AsignacionVehiculoSection } from "@/components/combustible/AsignacionVehiculoSection";
import { motivoSospechaLabel } from "@/components/combustible/SospechaBadge";
import { CombustiblesOrdenamientoMenu } from "@/components/combustible/CombustibleOrdenamientoMenu";
import {
  COMBUSTIBLE_SORT_DEFAULT,
  type CombustibleSortDir,
  type CombustibleSortField,
  appendCombustibleSortQuery,
  parseCombustibleSortField,
  tipoOrdenCombustible,
} from "@/lib/combustibleOrdenamiento";
import {
  TituloOrdenable,
  ViajesListadoHeaderFiltro,
  type OrdenColumna,
} from "@/components/viajes/ViajesListadoHeaderFiltro";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  listadoTablaAccionesTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { FORMA_PAGO_LABELS, fmtTipoVehiculo } from "@/lib/combustibleLabels";
import { exportarCargasCombustible } from "@/lib/combustibleExcelExport";
import { exportarCargasCombustibleCsv } from "@/lib/combustibleCsvExport";
import { isOrgMember } from "@/lib/roleLabels";
import type {
  CargaCombustible,
  Chofer,
  ConEmpresa,
  PaginatedMeta,
  Vehiculo,
} from "@/types/api";
import { LimpiarFiltrosButton } from "@/components/listado/LimpiarFiltrosButton";
import {
  FiltroCargasSospechosas,
  PERIODOS_SOSPECHOSAS,
  type ConteoSospechosas,
  type PeriodoSospechosas,
} from "@/components/combustible/FiltroCargasSospechosas";

type CombustibleTab = "cargas" | "asignaciones";

const TABS: { id: CombustibleTab; label: string; icon: typeof Fuel }[] = [
  { id: "cargas", label: "Cargas", icon: Fuel },
  { id: "asignaciones", label: "Asignación de vehículos", icon: UserRoundCog },
];

const TAB_OPCIONES: SelectorOpcion[] = TABS.map((t) => ({ id: t.id, label: t.label }));

type CombustibleListResponse = {
  cargas: CargaCombustible[];
  total: number;
  /** Cargas sospechosas por período con el resto de los filtros: contadores del filtro rápido. */
  sospechosas?: ConteoSospechosas;
  page: number;
  limit: number;
};

type FormatoExport = "xlsx" | "csv";

// ─── Helpers de formato ────────────────────────────────────────────────────
function normalizeString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

const fmtFecha = fmtDateUtc;

function fmtNum(n: number) {
  return n.toLocaleString("es-AR");
}

const BASE_COLUMNS: ListadoColumn<CargaCombustible>[] = [
  {
    id: "fecha",
    header: "Fecha",
    primary: true,
    cell: (r) => fmtFecha(r.fecha),
  },
  { id: "chofer", header: "Conductor", cell: (r) => r.chofer?.nombre ?? "—" },
  {
    id: "vehiculo",
    header: "Vehículo",
    cell: (r) => r.vehiculo?.patente ?? r.vehiculoId,
  },
  { id: "estacion", header: "Estación", cell: (r) => r.estacion },
  {
    id: "formaPago",
    header: "Pago",
    cell: (r) => {
      if (!r.formaPago) return "—";
      const normal = normalizeString(r.formaPago);
      return (
        FORMA_PAGO_LABELS[normal as keyof typeof FORMA_PAGO_LABELS] ||
        r.formaPago
      );
    },
  },
  { id: "litros", header: "Litros", cell: (r) => `${fmtNum(r.litros)} L` },
  { id: "importe", header: "Monto", cell: (r) => `$${fmtNum(r.importe)}` },
];

export function CombustibleTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
} = {}) {
  const { getToken, isLoaded, isSignedIn, orgId, orgRole } = useAuth();
  const { user } = useUser();
  const { showToast } = useToast();

  const activeTenantId = tenantId?.trim() || (orgId ?? "");

  const isReadOnly = useMemo(() => {
    return isOrgMember({ orgRole, publicMetadata: user?.publicMetadata });
  }, [orgRole, user?.publicMetadata]);

  const [tab, setTab] = useState<CombustibleTab>("cargas");
  const [tabSheetOpen, setTabSheetOpen] = useState(false);
  const tabActivaDef = TABS.find((t) => t.id === tab);
  const TabActivaIcon = tabActivaDef?.icon;
  const [limpiarFiltrosSlot, setLimpiarFiltrosSlot] =
    useState<HTMLDivElement | null>(null);

  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [conteoSospechosas, setConteoSospechosas] = useState<ConteoSospechosas | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialVehiculoId = searchParams.get("vehiculoId") ?? "";
  const initialChoferId = searchParams.get("choferId") ?? "";
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const initialEstacion = searchParams.get("estacion") ?? "";
  const initialFormaPago = searchParams.get("formaPago") ?? "";
  const initialSortBy = parseCombustibleSortField(searchParams.get("sortBy"));
  const initialSortDir: CombustibleSortDir =
    searchParams.get("sortDir") === "asc" || searchParams.get("sortDir") === "desc"
      ? (searchParams.get("sortDir") as CombustibleSortDir)
      : COMBUSTIBLE_SORT_DEFAULT.sortDir;

  const [vehiculos, setVehiculos] = useState<ConEmpresa<Vehiculo>[]>([]);
  const [choferes, setChoferes] = useState<ConEmpresa<Chofer>[]>([]);
  const [estaciones, setEstaciones] = useState<string[]>([]);

  const [desde, setDesde] = useState<string>(() => initialFrom || "");
  const [hasta, setHasta] = useState<string>(() => initialTo || "");
  const [vehiculoId, setVehiculoId] = useState(initialVehiculoId);
  const [choferId, setChoferId] = useState(initialChoferId);
  const [estacion, setEstacion] = useState(initialEstacion);
  const [formaPago, setFormaPago] = useState(initialFormaPago);
  // Filtro rápido "Cargas sospechosas" por período. Va aparte de los filtros por columna,
  // como los filtros rápidos de Viajes: "Limpiar filtros" no lo toca.
  const [periodoSospechosas, setPeriodoSospechosas] = useState<PeriodoSospechosas | "">(
    () =>
      PERIODOS_SOSPECHOSAS.find((p) => p.id === searchParams.get("sospechosas"))?.id ?? "",
  );
  const [sortBy, setSortBy] = useState<CombustibleSortField>(initialSortBy);
  const [sortDir, setSortDir] = useState<CombustibleSortDir>(initialSortDir);

  const [opcionesValidas, setOpcionesValidas] = useState<{
    choferIds: Set<string>;
    vehiculoIds: Set<string>;
    estaciones: Set<string>;
    formasPago: Set<string>;
  } | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CargaCombustible | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Efecto para vaciar filtros al cambiar de tenant en modo superadmin
  useEffect(() => {
    if (embeddedInSuperadmin && activeTenantId) {
      setPage(1);
      setDesde("");
      setHasta("");
      setVehiculoId("");
      setChoferId("");
      setEstacion("");
      setFormaPago("");
      setPeriodoSospechosas("");
      setRows(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, embeddedInSuperadmin]);

  useEffect(() => {
    setSearchParams(
      (prevParams) => {
        const qs = new URLSearchParams(prevParams);
        const esRangoPorDefecto = desde === "" && hasta === "";

        if (!esRangoPorDefecto) {
          if (desde) qs.set("from", desde);
          if (hasta) qs.set("to", hasta);
        } else {
          qs.delete("from");
          qs.delete("to");
        }
        if (vehiculoId) qs.set("vehiculoId", vehiculoId);
        else qs.delete("vehiculoId");
        if (choferId) qs.set("choferId", choferId);
        else qs.delete("choferId");
        if (estacion) qs.set("estacion", estacion);
        else qs.delete("estacion");
        if (formaPago) qs.set("formaPago", formaPago);
        else qs.delete("formaPago");
        if (periodoSospechosas) qs.set("sospechosas", periodoSospechosas);
        else qs.delete("sospechosas");
        appendCombustibleSortQuery(qs, sortBy, sortDir);
        return qs;
      },
      { replace: true },
    );
  }, [
    desde,
    hasta,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    periodoSospechosas,
    sortBy,
    sortDir,
    setSearchParams,
  ]);

  useEffect(() => {
    const id = searchParams.get("carga")?.trim();
    if (!id) return;
    setViewTargetId(id);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("carga");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  function resetPage() {
    setPage(1);
  }

  // Click en el título de la columna: 1er click A→Z, 2do Z→A (orden en el backend,
  // sobre todas las cargas). Comparte estado con "Ordenar por". La ✕ vuelve al orden
  // por defecto; no aparece si ya es ese (Fecha de carga, nueva a vieja).
  function ordenColumna(field: CombustibleSortField): OrdenColumna {
    const activo = sortBy === field;
    const esDefault =
      sortBy === COMBUSTIBLE_SORT_DEFAULT.sortBy &&
      sortDir === COMBUSTIBLE_SORT_DEFAULT.sortDir;
    return {
      dir: activo ? sortDir : null,
      tipo: tipoOrdenCombustible(field),
      disabled: rows === null,
      onClick: () => {
        setSortBy(field);
        setSortDir(activo && sortDir === "asc" ? "desc" : "asc");
        resetPage();
      },
      onClear: esDefault
        ? undefined
        : () => {
            setSortBy(COMBUSTIBLE_SORT_DEFAULT.sortBy);
            setSortDir(COMBUSTIBLE_SORT_DEFAULT.sortDir);
            resetPage();
          },
    };
  }

  function handleClearFilters() {
    setDesde("");
    setHasta("");
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setPage(1);
  }

  const rangoFechaPorDefecto = desde === "" && hasta === "";
  const hayFiltros = Boolean(
    !rangoFechaPorDefecto || vehiculoId || choferId || estacion || formaPago,
  );
  const cantFiltros = [
    !rangoFechaPorDefecto,
    Boolean(vehiculoId),
    Boolean(choferId),
    Boolean(estacion),
    Boolean(formaPago),
  ].filter(Boolean).length;

  function filtroParams(): URLSearchParams {
    const qs = new URLSearchParams();
    if (activeTenantId) qs.set("tenantId", activeTenantId);
    if (desde) qs.set("from", desde);
    if (hasta) qs.set("to", hasta);
    if (vehiculoId) qs.set("vehiculoId", vehiculoId);
    if (choferId) qs.set("choferId", choferId);
    if (estacion) qs.set("estacion", estacion);
    if (formaPago) qs.set("formaPago", formaPago);
    if (periodoSospechosas) qs.set("sospechoso", periodoSospechosas);
    appendCombustibleSortQuery(qs, sortBy, sortDir);
    return qs;
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !activeTenantId) {
      setVehiculos([]);
      setChoferes([]);
      setEstaciones([]);
      return;
    }
    let cancelled = false;
    const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;

    void (async () => {
      try {
        const [v, ch, est] = await Promise.all([
          apiJson<ConEmpresa<Vehiculo>[]>(
            `/api/platform/vehiculos${qsTenant}`,
            () => getToken(),
          ),
          apiJson<ConEmpresa<Chofer>[]>(
            `/api/platform/choferes${qsTenant}`,
            () => getToken(),
          ),
          apiJson<string[]>(
            `/api/platform/combustible/estaciones${qsTenant}`,
            () => getToken(),
          ),
        ]);
        if (!cancelled) {
          setVehiculos(Array.isArray(v) ? v : []);
          setChoferes(Array.isArray(ch) ? ch : []);
          setEstaciones(Array.isArray(est) ? est : []);
        }
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, activeTenantId, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!activeTenantId) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);

    void (async () => {
      try {
        const qs = filtroParams();
        qs.set("page", String(page));
        qs.set("limit", String(pageSize));

        const data = await apiJson<CombustibleListResponse>(
          `/api/platform/combustible?${qs.toString()}`,
          () => getToken(),
        );

        if (!cancelled) {
          setRows(data.cargas);
          setTotal(data.total);
          setConteoSospechosas(data.sospechosas);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(friendlyError(e, "plataforma"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    activeTenantId,
    page,
    pageSize,
    desde,
    hasta,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    periodoSospechosas,
    sortBy,
    sortDir,
    reloadKey,
    getToken,
  ]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !activeTenantId) return;
    let cancelled = false;

    void (async () => {
      try {
        const qs = filtroParams();
        qs.set("page", "1");
        qs.set("limit", "10000");

        const data = await apiJson<CombustibleListResponse>(
          `/api/platform/combustible?${qs.toString()}`,
          () => getToken(),
        );

        if (!cancelled) {
          setOpcionesValidas({
            choferIds: new Set(
              data.cargas.map((c) => c.choferId).filter(Boolean) as string[],
            ),
            vehiculoIds: new Set(
              data.cargas.map((c) => c.vehiculoId).filter(Boolean) as string[],
            ),
            estaciones: new Set(
              data.cargas.map((c) => c.estacion).filter(Boolean) as string[],
            ),
            formasPago: new Set(
              data.cargas
                .map((c) => (c.formaPago ? normalizeString(c.formaPago) : ""))
                .filter(Boolean) as string[],
            ),
          });
        }
      } catch (e) {
        if (!cancelled)
          console.warn("No se pudieron cargar los filtros dinámicos", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    activeTenantId,
    desde,
    hasta,
    vehiculoId,
    choferId,
    estacion,
    formaPago,
    periodoSospechosas,
    getToken,
  ]);

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

  async function fetchTodasLasCargas(): Promise<CargaCombustible[]> {
    const qs = filtroParams();
    qs.set("page", "1");
    qs.set("limit", String(total));
    const data = await apiJson<CombustibleListResponse>(
      `/api/platform/combustible?${qs.toString()}`,
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
      setError(friendlyError(e, "plataforma"));
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, deleting]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      await apiJson<{ deleted: string }>(
        `/api/platform/combustible/${deleteTarget.id}${qsTenant}`,
        () => getToken(),
        { method: "DELETE" },
      );

      showToast("Carga de combustible eliminada correctamente", "success");

      if (rows && rows.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setReloadKey((k) => k + 1);
      }
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(friendlyError(e, "plataforma"));
      showToast("No se pudo eliminar la carga de combustible", "error");
    } finally {
      setDeleting(false);
    }
  }

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
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:border-vialto-fire";
  const exportDisabled = rows === null || total === 0 || downloading;

  const choferOptions = useMemo(() => {
    let base = choferes;
    if (opcionesValidas) {
      base = base.filter(
        (ch) => opcionesValidas.choferIds.has(ch.id) || ch.id === choferId,
      );
    }
    return base.map((ch) => ({ value: ch.id, label: ch.nombre }));
  }, [choferes, opcionesValidas, choferId]);

  const vehiculoOptions = useMemo(() => {
    let base = vehiculos;
    if (opcionesValidas) {
      base = base.filter(
        (v) => opcionesValidas.vehiculoIds.has(v.id) || v.id === vehiculoId,
      );
    }
    return base.map((v) => ({ value: v.id, label: fmtVehiculoLabel(v) }));
  }, [vehiculos, opcionesValidas, vehiculoId]);

  const estacionOptions = useMemo(() => {
    let base = estaciones;
    if (opcionesValidas) {
      base = base.filter(
        (e) => opcionesValidas.estaciones.has(e) || e === estacion,
      );
    }
    return base.map((e) => ({ value: e, label: e }));
  }, [estaciones, opcionesValidas, estacion]);

  const columns = useMemo<ListadoColumn<CargaCombustible>[]>(
    () => [
      {
        id: "sospecha",
        header: "",
        cell: (r) =>
          r.sospechoso ? (
            <span
              title={motivoSospechaLabel(r.motivoSospecha)}
              className="text-vialto-fire cursor-help"
              aria-label={motivoSospechaLabel(r.motivoSospecha)}
            >
              ⚠
            </span>
          ) : null,
        showInCard: false,
        thClassName: "w-8 px-2 py-2.5",
        tdClassName: "w-8 px-2 py-2",
      },
      ...BASE_COLUMNS,
    ],
    [],
  );

  function accionesCarga(r: CargaCombustible): AccionOpcion[] {
    const options: AccionOpcion[] = [
      {
        id: "ver",
        label: "Ver carga",
        icon: Eye,
        onClick: () => setViewTargetId(r.id),
      },
    ];
    if (!isReadOnly) {
      options.push({
        id: "eliminar",
        label: "Eliminar",
        icon: Trash2,
        danger: true,
        onClick: () => {
          setDeleteError(null);
          setDeleteTarget(r);
        },
      });
    }
    return options;
  }

  return (
    <div className="w-full">
      {/* Título a la izquierda; acciones de "Cargas" a la derecha, en la misma línea. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {!embeddedInSuperadmin && (
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
            Combustible
          </h1>
        )}

        {/* Filtro rápido de cargas sospechosas: el embudo palpita si hay alguna este mes. */}
        {tab === "cargas" && activeTenantId && (
          <FiltroCargasSospechosas
            value={periodoSospechosas}
            conteos={conteoSospechosas}
            onChange={(v) => {
              setPeriodoSospechosas(v);
              resetPage();
            }}
          />
        )}
        {/* La pestaña Asignación de vehículos portalea acá su "Limpiar filtros". */}
        <div ref={setLimpiarFiltrosSlot} className="empty:hidden" />
        {tab === "cargas" && activeTenantId && hayFiltros && (
          <LimpiarFiltrosButton
            onClick={handleClearFilters}
            cantidad={cantFiltros}
            disabled={rows === null}
            soloDesktop
          />
        )}
        {tab === "cargas" && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-3">
              {activeTenantId && (
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
                      className="absolute left-0 z-20 mt-1 min-w-[190px] border border-black/15 bg-white shadow-lg"
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
              )}

            </div>

            <div className="flex items-center gap-3">
              {activeTenantId && (
                <div className="hidden lg:block">
                  <CombustiblesOrdenamientoMenu
                    sortBy={sortBy}
                    sortDir={sortDir}
                    disabled={rows === null || total === 0}
                    onChange={(b, d) => {
                      setSortBy(b);
                      setSortDir(d);
                      resetPage();
                    }}
                  />
                </div>
              )}

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  disabled={!activeTenantId}
                  className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
                    activeTenantId
                      ? "bg-vialto-charcoal hover:bg-vialto-graphite"
                      : "bg-vialto-charcoal/50 pointer-events-none"
                  }`}
                  aria-disabled={!activeTenantId}
                >
                  Nueva carga
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pestañas con el mismo estilo que Mantenimiento: subrayado en desktop, selector en mobile. */}
      <div className="mt-6 border-b border-black/15">
        <div className="pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setTabSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={tabSheetOpen}
            className={selectorTriggerClass}
          >
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Sección
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {TabActivaIcon && (
                <TabActivaIcon
                  className="h-4 w-4 shrink-0 text-vialto-steel"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                {tabActivaDef?.label}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-vialto-steel"
                strokeWidth={2}
                aria-hidden
              />
            </span>
          </button>
          <SelectorOpcionesSheet
            open={tabSheetOpen}
            onClose={() => setTabSheetOpen(false)}
            title="Elegir sección"
            options={TAB_OPCIONES}
            activeId={tab}
            onSelect={(id) => {
              setTab(id as CombustibleTab);
              setTabSheetOpen(false);
            }}
          />
        </div>

        <nav
          className="-mb-px hidden gap-1 overflow-x-auto lg:flex"
          aria-label="Secciones de combustible"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                tab === t.id
                  ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                  : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
              ].join(" ")}
            >
              <t.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "asignaciones" && (
        <AsignacionVehiculoSection
          tenantId={activeTenantId}
          choferes={choferes}
          vehiculos={vehiculos}
          isReadOnly={isReadOnly}
          limpiarFiltrosSlot={limpiarFiltrosSlot}
        />
      )}

      {tab === "cargas" && (
        <>
          {embeddedInSuperadmin && error && (
            <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <ListadoDatos<CargaCombustible>
            className="mt-6"
            tableColSpan={9}
            tableHead={
              <tr className={listadoTablaHeadRowClass}>
                <th scope="col" className="w-8 px-2 py-2.5 align-top"></th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    orden={ordenColumna("fecha_carga")}
                    title="Fecha"
                    filterActive={!rangoFechaPorDefecto}
                    filterSignature={`${desde}|${hasta}`}
                    onClear={() => {
                      setDesde("");
                      setHasta("");
                      resetPage();
                    }}
                  >
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Desde
                        <input
                          type="date"
                          value={desde}
                          onChange={(e) => {
                            setDesde(e.target.value);
                            resetPage();
                          }}
                          className={`${inputClass} min-w-[140px] ${
                            desde !== "" ? "text-vialto-fire" : ""
                          }`}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Hasta
                        <input
                          type="date"
                          value={hasta}
                          onChange={(e) => {
                            setHasta(e.target.value);
                            resetPage();
                          }}
                          className={`${inputClass} min-w-[140px] ${
                            hasta !== "" ? "text-vialto-fire" : ""
                          }`}
                        />
                      </label>
                    </div>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    orden={ordenColumna("chofer")}
                    title="Conductor"
                    filterActive={!!choferId}
                    filterSignature={choferId}
                    onClear={() => {
                      setChoferId("");
                      resetPage();
                    }}
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
                      triggerClassName={choferId ? "text-vialto-fire" : ""}
                      ariaLabel="Filtrar por conductor"
                    />
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    orden={ordenColumna("vehiculo")}
                    title="Vehículo"
                    filterActive={!!vehiculoId}
                    filterSignature={vehiculoId}
                    onClear={() => {
                      setVehiculoId("");
                      resetPage();
                    }}
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
                      triggerClassName={vehiculoId ? "text-vialto-fire" : ""}
                      ariaLabel="Filtrar por vehículo"
                    />
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    orden={ordenColumna("estacion")}
                    title="Estación"
                    filterActive={!!estacion}
                    filterSignature={estacion}
                    onClear={() => {
                      setEstacion("");
                      resetPage();
                    }}
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
                      triggerClassName={estacion ? "text-vialto-fire" : ""}
                      ariaLabel="Filtrar por estación"
                    />
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    orden={ordenColumna("forma_pago")}
                    title="Pago"
                    filterActive={!!formaPago}
                    filterSignature={formaPago}
                    onClear={() => {
                      setFormaPago("");
                      resetPage();
                    }}
                  >
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
                      <option value="cuenta_corriente">
                        {FORMA_PAGO_LABELS.cuenta_corriente}
                      </option>
                      <option value="efectivo">
                        {FORMA_PAGO_LABELS.efectivo}
                      </option>
                      <option value="tarjeta">
                        {FORMA_PAGO_LABELS.tarjeta}
                      </option>
                    </select>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={listadoTablaThClass}>
                  <TituloOrdenable title="Litros" orden={ordenColumna("litros")} />
                </th>
                <th scope="col" className={listadoTablaThClass}>
                  <TituloOrdenable title="Monto" orden={ordenColumna("importe")} />
                </th>
                <th scope="col" className={`${listadoTablaThClass} text-right`}>
                  Acciones
                </th>
              </tr>
            }
            columns={columns}
            rows={!activeTenantId || error ? [] : rows}
            rowKey={(r) => r.id}
            rowActions={accionesCarga}
            rowActionsDestacadas={["ver"]}
            rowActionsSubtitle={(r) => `Carga del ${fmtFecha(r.fecha)}`}
            emptyMessage={
              !activeTenantId
                ? embeddedInSuperadmin
                  ? "Seleccioná una empresa para ver las cargas."
                  : "Cargando datos de empresa..."
                : error
                  ? "No se pudieron cargar las cargas."
                  : "Sin cargas registradas para esta empresa."
            }
            loadingMessage="Cargando…"
            actionsTdClassName={`${listadoTablaAccionesTdClass} text-right`}
          />

          {activeTenantId && (!error || !embeddedInSuperadmin) && total > 0 && (
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

          {deleteTarget && !isReadOnly && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirmar-eliminar-titulo"
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

          {isCreateOpen && activeTenantId && !isReadOnly && (
            <CargaCombustibleCreateModal
              tenantId={activeTenantId}
              vehiculos={vehiculos}
              choferes={choferes}

              onClose={() => setIsCreateOpen(false)}
              onSuccess={() => {
                setIsCreateOpen(false);
                setPage(1);
                setReloadKey((k) => k + 1);
              }}
            />
          )}

          {viewTargetId && (
            <CargaCombustibleViewModal
              cargaId={viewTargetId}
              tenantId={activeTenantId}
              readOnly={isReadOnly}
              onClose={() => setViewTargetId(null)}
              onUpdate={() => setReloadKey((k) => k + 1)}
            />
          )}
        </>
      )}
    </div>
  );
}

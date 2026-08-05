import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { CargaCombustibleCreateModal } from "@/components/combustible/CargaCombustibleCreateModal";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { listadoTablaTdClass } from "@/lib/listadoTabla";
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

type CombustibleListResponse = {
  cargas: CargaCombustible[];
  total: number;
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

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function fmtNum(n: number) {
  return n.toLocaleString("es-AR");
}

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

  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
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

  const [vehiculos, setVehiculos] = useState<ConEmpresa<Vehiculo>[]>([]);
  const [choferes, setChoferes] = useState<ConEmpresa<Chofer>[]>([]);
  const [estaciones, setEstaciones] = useState<string[]>([]);

  const [desde, setDesde] = useState<string>(
    () => initialFrom || primerDiaMesActual(),
  );
  const [hasta, setHasta] = useState<string>(() => initialTo || hoyIso());
  const [vehiculoId, setVehiculoId] = useState(initialVehiculoId);
  const [choferId, setChoferId] = useState(initialChoferId);
  const [estacion, setEstacion] = useState(initialEstacion);
  const [formaPago, setFormaPago] = useState(initialFormaPago);

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
  const [cargasPorVehiculo, setCargasPorVehiculo] = useState<
    Record<string, { km: number; fecha: string }[]>
  >({});
  const [downloading, setDownloading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Efecto para vaciar filtros al cambiar de tenant en modo superadmin
  useEffect(() => {
    if (embeddedInSuperadmin && activeTenantId) {
      setPage(1);
      const d = primerDiaMesActual();
      const h = hoyIso();
      setDesde(d);
      setHasta(h);
      setVehiculoId("");
      setChoferId("");
      setEstacion("");
      setFormaPago("");
      setRows(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, embeddedInSuperadmin]);

  useEffect(() => {
    if (!isCreateOpen || !activeTenantId) return;
    let cancelled = false;

    void (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("tenantId", activeTenantId);
        qs.set("page", "1");
        qs.set("limit", "10000");

        const data = await apiJson<CombustibleListResponse>(
          `/api/platform/combustible?${qs.toString()}`,
          () => getToken(),
        );
        if (cancelled) return;

        const map: Record<string, { km: number; fecha: string }[]> = {};
        for (const c of data.cargas) {
          const vId = c.vehiculoId;
          if (!vId) continue;
          (map[vId] ??= []).push({ km: c.km, fecha: c.fecha });
        }
        for (const vId of Object.keys(map)) {
          map[vId].sort((a, b) => a.fecha.localeCompare(b.fecha));
        }
        setCargasPorVehiculo(map);
      } catch {
        // silencioso
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCreateOpen, activeTenantId, getToken]);

  useEffect(() => {
    setSearchParams(
      (prevParams) => {
        const qs = new URLSearchParams(prevParams);
        const esRangoPorDefecto =
          desde === primerDiaMesActual() && hasta === hoyIso();

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
    setSearchParams,
  ]);

  function resetPage() {
    setPage(1);
  }

  function handleClearFilters() {
    setDesde(primerDiaMesActual());
    setHasta(hoyIso());
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setPage(1);
  }

  const rangoFechaPorDefecto =
    desde === primerDiaMesActual() && hasta === hoyIso();
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
              title={r.motivoSospecha ?? "Carga marcada como sospechosa"}
              className="text-vialto-fire cursor-help"
              aria-label="Carga sospechosa"
            >
              ⚠
            </span>
          ) : null,
        showInCard: false,
        thClassName: "w-8 px-2 py-3",
        tdClassName: "w-8 px-2 py-3",
      },
      ...BASE_COLUMNS,
      {
        id: "acciones",
        header: "Acciones",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewTargetId(r.id)}
              className="inline-flex h-8 items-center px-3 border border-black/15 bg-white text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist/80 transition-colors"
              aria-label={`Ver detalle de carga del ${fmtFecha(r.fecha)}`}
            >
              Ver
            </button>
            {!isReadOnly && (
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
            )}
          </div>
        ),
      },
    ],
    [isReadOnly],
  );

  return (
    <div className="w-full">
      {!embeddedInSuperadmin && (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
            Combustible
          </h1>
        </>
      )}

      <div className="mt-4 flex justify-between items-center flex-wrap gap-4">
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

          {activeTenantId && hayFiltros && (
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
        </div>

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

      {embeddedInSuperadmin && error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {activeTenantId && (!error || !embeddedInSuperadmin) && (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  resetPage();
                }}
                className={`${inputClass} min-w-[150px] ${
                  desde !== primerDiaMesActual() ? "text-vialto-fire" : ""
                }`}
                aria-label="Filtrar desde fecha"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  resetPage();
                }}
                className={`${inputClass} min-w-[150px] ${
                  hasta !== hoyIso() ? "text-vialto-fire" : ""
                }`}
                aria-label="Filtrar hasta fecha"
              />
            </label>
          </div>

          <div className="min-w-[180px]">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-vialto-steel">
              Conductor
            </span>
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
          </div>

          <div className="min-w-[180px]">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-vialto-steel">
              Vehículo
            </span>
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
          </div>

          <div className="min-w-[180px]">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-vialto-steel">
              Estación
            </span>
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
          </div>

          <div className="min-w-[160px]">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-vialto-steel">
              Forma de pago
            </span>
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
              <option value="tarjeta">Tarjeta</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
        </div>
      )}

      {activeTenantId && (!error || !embeddedInSuperadmin) && (
        <p className="mt-4 text-xs text-vialto-steel">
          Mostrando cargas del {fmtFecha(desde)} al {fmtFecha(hasta)}
        </p>
      )}

      <ListadoDatos<CargaCombustible>
        className="mt-6"
        columns={columns}
        rows={!activeTenantId || error ? [] : rows}
        rowKey={(r) => r.id}
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
        actionsTdClassName={listadoTablaTdClass}
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

      {isCreateOpen && activeTenantId && !isReadOnly && (
        <CargaCombustibleCreateModal
          tenantId={activeTenantId}
          vehiculos={vehiculos}
          choferes={choferes}
          cargasPorVehiculo={cargasPorVehiculo}
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
    </div>
  );
}

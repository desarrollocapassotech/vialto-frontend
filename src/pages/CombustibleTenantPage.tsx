import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { CargaCombustibleCreateModal } from "@/components/combustible/CargaCombustibleCreateModal";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { listadoTablaTdClass } from "@/lib/listadoTabla";
import { FORMA_PAGO_LABELS, fmtTipoVehiculo } from "@/lib/combustibleLabels";
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

// ─── Helpers de formato (idénticos a la página por tenant) ──────────────────
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
    id: "formaPago",
    header: "Pago",
    cell: (r) =>
      r.formaPago
        ? FORMA_PAGO_LABELS[r.formaPago as keyof typeof FORMA_PAGO_LABELS] ||
          r.formaPago
        : "—",
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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

  // ─── Estado de la grilla (paginación server-side, igual que el endpoint) ──
  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ─── Datos maestros del tenant elegido (para filtros y alta) ──────────────
  const [vehiculos, setVehiculos] = useState<ConEmpresa<Vehiculo>[]>([]);
  const [choferes, setChoferes] = useState<ConEmpresa<Chofer>[]>([]);
  const [estaciones, setEstaciones] = useState<string[]>([]);

  // ─── Filtros aplicados vs. borrador de fechas ─────────────────────────────
  const [desde, setDesde] = useState<string>(primerDiaMesActual());
  const [hasta, setHasta] = useState<string>(hoyIso());
  const [desdeInput, setDesdeInput] = useState<string>(desde);
  const [hastaInput, setHastaInput] = useState<string>(hasta);
  const [vehiculoId, setVehiculoId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [estacion, setEstacion] = useState("");
  const [formaPago, setFormaPago] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CargaCombustible | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function resetPage() {
    setPage(1);
  }

  // Al cambiar de empresa: limpiar filtros y volver a la primera página.
  function handleChangeEmpresa(id: string) {
    setPage(1);
    setDesde(primerDiaMesActual());
    setHasta(hoyIso());
    setDesdeInput(primerDiaMesActual());
    setHastaInput(hoyIso());
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setRows(null);
    setError(null);
    onChangeTenant(id);
  }

  function aplicarFiltroFecha() {
    setDesde(desdeInput);
    setHasta(hastaInput);
    resetPage();
  }

  function filtroParams(): URLSearchParams {
    const qs = new URLSearchParams();
    qs.set("tenantId", filtroEmpresa);
    if (desde) qs.set("from", desde);
    if (hasta) qs.set("to", hasta);
    if (vehiculoId) qs.set("vehiculoId", vehiculoId);
    if (choferId) qs.set("choferId", choferId);
    if (estacion) qs.set("estacion", estacion);
    if (formaPago) qs.set("formaPago", formaPago);
    return qs;
  }

  // ─── Maestros del tenant (vehículos, conductores, estaciones) ─────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !filtroEmpresa) {
      setVehiculos([]);
      setChoferes([]);
      setEstaciones([]);
      return;
    }
    let cancelled = false;
    const enc = encodeURIComponent(filtroEmpresa);
    void (async () => {
      try {
        const [v, ch, est] = await Promise.all([
          apiJson<ConEmpresa<Vehiculo>[]>(
            `/api/platform/vehiculos?tenantId=${enc}`,
            () => getToken(),
          ),
          apiJson<ConEmpresa<Chofer>[]>(
            `/api/platform/choferes?tenantId=${enc}`,
            () => getToken(),
          ),
          apiJson<string[]>(
            `/api/platform/combustible/estaciones?tenantId=${enc}`,
            () => getToken(),
          ),
        ]);
        if (!cancelled) {
          setVehiculos(Array.isArray(v) ? v : []);
          setChoferes(Array.isArray(ch) ? ch : []);
          setEstaciones(Array.isArray(est) ? est : []);
        }
      } catch {
        // silencioso — los filtros quedan con solo la opción "Todas/Todos"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, filtroEmpresa, getToken]);

  // ─── Listado de cargas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoaded,
    isSignedIn,
    filtroEmpresa,
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

  // Cerrar el diálogo de borrado con Escape.
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
      await apiJson<{ deleted: string }>(
        `/api/platform/combustible/${deleteTarget.id}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      // Si borramos la última fila de una página > 1, retrocedemos una página.
      if (rows && rows.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setReloadKey((k) => k + 1);
      }
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(friendlyError(e, "plataforma"));
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

  const vehiculoOptions = useMemo(
    () => vehiculos.map((v) => ({ value: v.id, label: fmtVehiculoLabel(v) })),
    [vehiculos],
  );
  const choferOptions = useMemo(
    () => choferes.map((ch) => ({ value: ch.id, label: ch.nombre })),
    [choferes],
  );
  const estacionOptions = useMemo(
    () => estaciones.map((e) => ({ value: e, label: e })),
    [estaciones],
  );

  const columns = useMemo<ListadoColumn<CargaCombustible>[]>(
    () => [
      {
        id: "sospecha",
        header: "",
        // Indicador (no interactivo). El detalle de la carga se puede sumar
        // cuando adaptemos CargaCombustibleViewModal para aceptar tenantId.
        cell: (r) =>
          r.sospechoso ? (
            <span
              title={r.motivoSospecha ?? "Carga marcada como sospechosa"}
              className="text-vialto-fire"
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

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Combustible
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver y gestionar sus cargas de combustible. El
        listado lo filtra el servidor.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={handleChangeEmpresa}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          disabled={!filtroEmpresa}
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Nueva carga
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* ─── Barra de filtros (solo con empresa elegida) ─────────────────── */}
      {filtroEmpresa && !error && (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
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
              className="h-9 border border-black/15 bg-vialto-charcoal px-4 text-xs uppercase tracking-wider text-white hover:bg-black transition-colors"
            >
              Filtrar
            </button>
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
              {Object.entries(FORMA_PAGO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {filtroEmpresa && !error && (
        <p className="mt-4 text-xs text-vialto-steel">
          Mostrando cargas del {fmtFecha(desde)} al {fmtFecha(hasta)}
        </p>
      )}

      <ListadoDatos<CargaCombustible>
        className="mt-6"
        columns={columns}
        rows={!filtroEmpresa || error ? [] : rows}
        rowKey={(r) => r.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver las cargas."
            : error
              ? "No se pudieron cargar las cargas."
              : "Sin cargas registradas para esta empresa."
        }
        loadingMessage="Cargando…"
        actionsTdClassName={listadoTablaTdClass}
      />

      {filtroEmpresa && !error && total > 0 && (
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

      {/* ─── Diálogo de confirmación de borrado ──────────────────────────── */}
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

      {/* ─── Modal de alta (scopeado al tenant elegido) ──────────────────── */}
      {isCreateOpen && filtroEmpresa && (
        <CargaCombustibleCreateModal
          tenantId={filtroEmpresa}
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
    </div>
  );
}

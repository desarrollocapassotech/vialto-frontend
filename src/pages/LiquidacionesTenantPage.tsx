import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban,
  Download,
  Eye,
  FileText,
  Landmark,
  Receipt,
  Trash2,
} from "lucide-react";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { EmitirLiquidacionModal } from "@/components/liquidaciones/EmitirLiquidacionModal";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from "@/components/liquidaciones/LiquidacionViewModal";
import { LiquidacionEditModal } from "@/components/liquidaciones/LiquidacionEditModal";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { AccionesMenuTrigger } from "@/components/ui/AccionesMenuTrigger";
import {
  AccionesOpcionesSheet,
  type AccionOpcion,
} from "@/components/ui/AccionesOpcionesSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AnularLiquidacionModal } from "@/components/liquidaciones/AnularLiquidacionModal";
import { Spinner } from "@/components/ui/Spinner";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { TransportistaSearchSelect } from "@/components/forms/MaestroSearchSelects";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useToast } from "@/lib/toast";
import { apiFetch, apiJson } from "@/lib/api";
import { filenameFromContentDisposition } from "@/lib/downloadFilename";
import { friendlyError } from "@/lib/friendlyError";
import { getArcaErrorDetalle } from "@/lib/arcaErrorDetalle";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import {
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { useMaestroData } from "@/hooks/useMaestroData";
import { anulacionComprobanteLabel } from "@/lib/arcaCbteTipo";
import { canAccessIntegracionArca } from "@/lib/tenantModules";
import type { ArcaConfig, LiquidacionEstado } from "@/types/api";

const ESTADO_LABEL: Record<LiquidacionEstado, string> = {
  borrador: "BORRADOR",
  pendiente_cae: "ESPERANDO AFIP",
  autorizado: "LIQUIDADO",
  error: "ERROR DE AFIP",
  anulado: "ANULADO",
};

const ESTADO_CLASS: Record<LiquidacionEstado, string> = {
  borrador: "bg-gray-100 text-gray-700",
  pendiente_cae: "bg-amber-100 text-amber-800",
  autorizado: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
  anulado: "bg-gray-100 text-gray-500 line-through",
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function transportistaNombre(liq: LiquidacionConTransportista) {
  return liq.transportista?.nombre ?? liq.transportistaId;
}

function LiquidacionAccionesMenu({
  liq,
  hasArca,
  isBusy,
  isDownloading,
  actionErrorMsg,
  actionErrorDetalle,
  onVer,
  onEmitir,
  onPdf,
  onPdfNc,
  onAnular,
  onEliminar,
  onVerComprobante,
}: {
  liq: LiquidacionConTransportista;
  hasArca: boolean;
  isBusy: boolean;
  isDownloading: boolean;
  actionErrorMsg?: string;
  actionErrorDetalle?: string;
  onVer: () => void;
  onEmitir: () => void;
  onPdf: () => void;
  onPdfNc: () => void;
  onAnular: () => void;
  onEliminar: () => void;
  onVerComprobante: () => void;
}) {
  const [open, setOpen] = useState(false);

  const puedeEmitir =
    hasArca && (liq.estado === "borrador" || liq.estado === "error");
  const puedeEliminar =
    liq.estado === "borrador" ||
    liq.estado === "error" ||
    liq.estado === "pendiente_cae";
  const puedeAnular = hasArca && liq.estado === "autorizado";
  const tienePdf =
    hasArca && (liq.estado === "autorizado" || liq.estado === "anulado");
  const tienePdfNc =
    hasArca && liq.estado === "anulado" && Boolean(liq.anulacionCae);
  const tieneComprobanteAdjunto =
    !hasArca && Boolean(liq.comprobanteUrl?.trim());

  const options: AccionOpcion[] = [
    { id: "ver", label: "Ver", icon: Eye, onClick: onVer },
  ];
  if (puedeEmitir) {
    options.push({
      id: "emitir",
      label: isBusy ? "Emitiendo…" : "Emitir",
      icon: Receipt,
      onClick: onEmitir,
      disabled: isBusy,
    });
  }
  if (tienePdf) {
    options.push({
      id: "pdf",
      label: isDownloading ? "Descargando…" : "PDF",
      icon: Download,
      onClick: onPdf,
      disabled: isDownloading,
    });
  }
  if (tienePdfNc) {
    const comprobanteLabel = anulacionComprobanteLabel(liq.anulacionCbteTipo);
    options.push({
      id: "pdf-nc",
      label: isDownloading ? "Descargando…" : "PDF anulación",
      description: comprobanteLabel,
      icon: Download,
      onClick: onPdfNc,
      disabled: isDownloading,
    });
  }
  if (tieneComprobanteAdjunto) {
    options.push({
      id: "comprobante",
      label: "Ver comprobante",
      icon: FileText,
      onClick: onVerComprobante,
    });
  }
  if (puedeAnular) {
    options.push({
      id: "anular",
      label: isBusy ? "Anulando…" : "Anular",
      icon: Ban,
      onClick: onAnular,
      danger: true,
      disabled: isBusy,
    });
  }
  if (puedeEliminar) {
    options.push({
      id: "eliminar",
      label: isBusy ? "Eliminando…" : "Eliminar",
      icon: Trash2,
      onClick: onEliminar,
      danger: true,
      disabled: isBusy,
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AccionesMenuTrigger open={open} onClick={() => setOpen(true)} />
      <AccionesOpcionesSheet
        open={open}
        onClose={() => setOpen(false)}
        subtitle={transportistaNombre(liq)}
        options={options}
      />
      {actionErrorMsg && (
        <ArcaErrorMessage
          message={actionErrorMsg}
          detalle={actionErrorDetalle}
          align="right"
          className="text-xs"
        />
      )}
    </div>
  );
}

export function LiquidacionesTenantPage() {
  const { getToken, isLoaded, isSignedIn, sessionClaims, orgId } = useAuth();
  const { user } = useUser();
  const { showToast } = useToast();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const { tenant, transportistas, refreshTransportistas, refreshClientes } = useMaestroData();

  const isSuperAdmin = Boolean(
    user?.publicMetadata?.role === "superadmin" ||
    user?.unsafeMetadata?.role === "superadmin" ||
    JSON.stringify(sessionClaims || {})
      .toLowerCase()
      .includes("superadmin"),
  );

  const activeTenantId = isSuperAdmin ? filtroEmpresa : (orgId ?? "");
  const empresaModules = isSuperAdmin
    ? (tenants?.find((t) => t.clerkOrgId === activeTenantId)?.modules ?? [])
    : (tenant?.modules ?? []);
  const hasArca = canAccessIntegracionArca(empresaModules);

  const [rows, setRows] = useState<LiquidacionConTransportista[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [estadoFilter, setEstadoFilter] = useState<LiquidacionEstado | "todos">(
    "todos",
  );
  const [transportistaFilter, setTransportistaFilter] = useState("");
  const [periodoDesdeFilter, setPeriodoDesdeFilter] = useState("");
  const [periodoHastaFilter, setPeriodoHastaFilter] = useState("");

  function aplicarFiltroEstado(val: LiquidacionEstado | "todos") {
    setEstadoFilter(val);
    setPage(1);
  }
  function aplicarFiltroTransportista(val: string) {
    setTransportistaFilter(val);
    setPage(1);
  }
  function aplicarPeriodoDesdeFilter(val: string) {
    setPeriodoDesdeFilter(val);
    setPage(1);
  }
  function aplicarPeriodoHastaFilter(val: string) {
    setPeriodoHastaFilter(val);
    setPage(1);
  }
  function limpiarFiltros() {
    setEstadoFilter("todos");
    setTransportistaFilter("");
    setPeriodoDesdeFilter("");
    setPeriodoHastaFilter("");
    setPage(1);
  }

  const anyFiltroActivo =
    (hasArca && estadoFilter !== "todos") ||
    !!transportistaFilter ||
    !!periodoDesdeFilter ||
    !!periodoHastaFilter;

  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    id: string;
    msg: string;
    detalle?: string;
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [verLoadingId, setVerLoadingId] = useState<string | null>(null);
  const [pendingEmitir, setPendingEmitir] =
    useState<LiquidacionConTransportista | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [anularConfirm, setAnularConfirm] =
    useState<LiquidacionConTransportista | null>(null);
  const [eliminarConfirm, setEliminarConfirm] =
    useState<LiquidacionConTransportista | null>(null);
  const [anularTipo, setAnularTipo] = useState<"nota_credito" | "nota_debito">(
    "nota_credito",
  );
  const [previewComprobanteUrl, setPreviewComprobanteUrl] = useState<
    string | null
  >(null);
  const [detail, setDetail] = useState<
    | { mode: "view"; liq: LiquidacionConTransportista }
    | { mode: "edit"; liq: LiquidacionConTransportista }
    | null
  >(null);

  function canEditLiquidacion(liq: LiquidacionConTransportista) {
    if (!hasArca) return true;
    return (
      liq.estado === "borrador" ||
      liq.estado === "error" ||
      liq.estado === "pendiente_cae"
    );
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!activeTenantId) {
      setRows(null);
      setConfig(null);
      return;
    }

    let cancelled = false;
    const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;

    void (async () => {
      try {
        const data = await apiJson<LiquidacionConTransportista[]>(
          `/api/integracion-arca/liquidaciones${qsTenant}`,
          () => getToken(),
        );
        const cfg = hasArca
          ? await apiJson<ArcaConfig | null>(
              `/api/integracion-arca/config${qsTenant}`,
              () => getToken(),
            ).catch(() => null)
          : null;
        if (!cancelled) {
          setRows(data);
          setConfig(cfg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(friendlyError(err, "arca"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, activeTenantId, hasArca]);

  /** Deep-link `?liquidacion=<id>` (ej. desde el detalle de facturación/liquidación de un viaje). */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !activeTenantId) return;
    const id = searchParams.get("liquidacion")?.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const full = await apiJson<LiquidacionConTransportista>(
          `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(activeTenantId)}`,
          () => getToken(),
        );
        if (cancelled) return;
        setDetail({
          mode: "view",
          liq: { ...full, conceptosLineas: full.conceptosLineas ?? [] },
        });
      } catch {
        // Si no se pudo resolver (id inválido, sin permisos), no bloqueamos la pantalla.
      } finally {
        if (!cancelled) {
          setSearchParams(
            (p) => {
              const next = new URLSearchParams(p);
              next.delete("liquidacion");
              return next;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, activeTenantId, searchParams, setSearchParams, getToken]);

  function onEmitirSuccess(updated: LiquidacionConTransportista) {
    setRows(
      (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
    );
    setPendingEmitir(null);
    showToast(
      updated.cae
        ? `Comprobante emitido correctamente. CAE: ${updated.cae}`
        : "Comprobante emitido correctamente.",
    );
  }

  async function confirmEliminar() {
    const liq = eliminarConfirm;
    if (!liq || busyId) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}${qsTenant}`,
        () => getToken(),
        { method: "DELETE" },
      );
      setRows((prev) => prev?.filter((r) => r.id !== liq.id) ?? prev);
      setEliminarConfirm(null);
      setDetail((prev) =>
        prev?.mode === "view" && prev.liq.id === liq.id ? null : prev,
      );
      showToast("Liquidación eliminada.");
    } catch (err) {
      setActionError({
        id: liq.id,
        msg: friendlyError(err, "arca"),
        detalle: getArcaErrorDetalle(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmAnular(motivo: string) {
    const liq = anularConfirm;
    if (!liq || busyId) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/anular${qsTenant}`,
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify({ motivo, tipoAnulacion: anularTipo }),
        },
      );
      setRows(
        (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
      );
      setAnularConfirm(null);
      setDetail((prev) =>
        prev?.liq.id === updated.id
          ? { mode: "view", liq: { ...prev.liq, ...updated } }
          : prev,
      );
      showToast("Liquidación anulada.");
    } catch (err) {
      setActionError({
        id: liq.id,
        msg: friendlyError(err, "arca"),
        detalle: getArcaErrorDetalle(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function descargarPdf(liq: LiquidacionConTransportista) {
    setDownloading(liq.id);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      const res = await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf${qsTenant}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al generar el PDF");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `liquidacion-${liq.id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError({
        id: liq.id,
        msg: friendlyError(err, "arca"),
        detalle: getArcaErrorDetalle(err),
      });
    } finally {
      setDownloading(null);
    }
  }

  /** Abre el PDF en una pestaña nueva (a diferencia de descargarPdf/Nc, que fuerzan la descarga). */
  async function verPdfEnPestania(url: string, errorMsg: string, liqId: string) {
    const ventana = window.open("", "_blank");
    try {
      const res = await apiFetch(url, () => getToken());
      if (!res.ok) throw new Error(errorMsg);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (ventana) {
        ventana.location.href = blobUrl;
      } else {
        window.open(blobUrl, "_blank");
      }
    } catch (err) {
      ventana?.close();
      setActionError({
        id: liqId,
        msg: friendlyError(err, "arca"),
        detalle: getArcaErrorDetalle(err),
      });
    }
  }

  function verPdf(liq: LiquidacionConTransportista) {
    const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
    return verPdfEnPestania(
      `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf${qsTenant}`,
      "Error al generar el PDF",
      liq.id,
    );
  }

  function verPdfAnulacion(liq: LiquidacionConTransportista) {
    const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
    return verPdfEnPestania(
      `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf-anulacion${qsTenant}`,
      "Error al generar el PDF de la anulación",
      liq.id,
    );
  }

  async function descargarPdfNc(liq: LiquidacionConTransportista) {
    setDownloading(liq.id);
    try {
      const res = await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf-anulacion`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al generar el PDF de la anulación");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `anulacion-${liq.id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError({
        id: liq.id,
        msg: friendlyError(err, "arca"),
        detalle: getArcaErrorDetalle(err),
      });
    } finally {
      setDownloading(null);
    }
  }

  function accionesProps(liq: LiquidacionConTransportista) {
    return {
      liq,
      hasArca,
      isBusy: busyId === liq.id,
      isDownloading: downloading === liq.id,
      actionErrorMsg: actionError?.id === liq.id ? actionError.msg : undefined,
      actionErrorDetalle:
        actionError?.id === liq.id ? actionError.detalle : undefined,
      onVer: () => {
        setVerLoadingId(liq.id);
        void (async () => {
          try {
            const full = await apiJson<LiquidacionConTransportista>(
              `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
              () => getToken(),
            );
            setDetail({
              mode: "view",
              liq: {
                ...full,
                transportista: full.transportista ?? liq.transportista,
                conceptosLineas:
                  full.conceptosLineas ?? liq.conceptosLineas ?? [],
              },
            });
          } catch (err) {
            setActionError({
              id: liq.id,
              msg: friendlyError(err, "liquidaciones"),
            });
            setDetail({
              mode: "view",
              liq: {
                ...liq,
                conceptosLineas: liq.conceptosLineas ?? [],
              },
            });
          } finally {
            setVerLoadingId(null);
          }
        })();
      },
      onEmitir: () => setPendingEmitir(liq),
      onPdf: () => void descargarPdf(liq),
      onPdfNc: () => void descargarPdfNc(liq),
      onAnular: () => setAnularConfirm(liq),
      onEliminar: () => setEliminarConfirm(liq),
      onVerComprobante: () => {
        if (liq.comprobanteUrl) setPreviewComprobanteUrl(liq.comprobanteUrl);
      },
    };
  }

  const filteredRows = rows
    ? rows.filter((r) => {
        if (hasArca && estadoFilter !== "todos" && r.estado !== estadoFilter)
          return false;
        if (transportistaFilter && r.transportistaId !== transportistaFilter)
          return false;
        if (
          periodoDesdeFilter &&
          r.periodoHasta.slice(0, 10) < periodoDesdeFilter
        )
          return false;
        if (
          periodoHastaFilter &&
          r.periodoDesde.slice(0, 10) > periodoHastaFilter
        )
          return false;
        return true;
      })
    : null;

  const totalItems = filteredRows ? filteredRows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const meta = {
    total: totalItems,
    page,
    pageSize,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };

  const paginatedRows = filteredRows
    ? filteredRows.slice((page - 1) * pageSize, page * pageSize)
    : null;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Liquidaciones
      </h1>
      <p className="mt-1 text-sm text-vialto-steel">
        {isSuperAdmin
          ? "Elegí una empresa para ver y gestionar sus liquidaciones."
          : "Liquidaciones emitidas a transportistas."}
      </p>

      {isSuperAdmin && (
        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={filtroEmpresa}
            onChange={(id) => {
              setPage(1);
              setRows(null);
              setError(null);
              limpiarFiltros();
              onChangeTenant(id);
            }}
          />
        </div>
      )}

      {hasArca && activeTenantId && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            Emisión electrónica vía ARCA
          </div>
          <AmbienteTestBadge ambiente={config?.ambiente} />
        </div>
      )}

      <div className="mt-4">
        {isSuperAdmin && error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
            {error}
          </div>
        )}

        {activeTenantId && (!error || !isSuperAdmin) && (
          <div className="flex justify-end gap-2 mt-2">
            {anyFiltroActivo && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCrear(true)}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nueva liquidación
            </button>
          </div>
        )}
      </div>

      <ListadoDatos
        className="mt-6"
        tableColSpan={hasArca ? 7 : 6}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Transportista"
                filterActive={!!transportistaFilter}
                filterSignature={transportistaFilter}
              >
                <TransportistaSearchSelect
                  id="liquidaciones-col-filtro-transportista"
                  transportistas={transportistas}
                  value={transportistaFilter}
                  onChange={(id) => aplicarFiltroTransportista(id)}
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  aria-label="Filtrar listado por transportista"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    transportistaFilter
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Período"
                filterActive={
                  !!periodoDesdeFilter.trim() || !!periodoHastaFilter.trim()
                }
                filterSignature={`${periodoDesdeFilter}|${periodoHastaFilter}`}
              >
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Desde
                    <input
                      type="date"
                      value={periodoDesdeFilter}
                      onChange={(e) =>
                        aplicarPeriodoDesdeFilter(e.target.value)
                      }
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input
                      type="date"
                      value={periodoHastaFilter}
                      onChange={(e) =>
                        aplicarPeriodoHastaFilter(e.target.value)
                      }
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Bruto
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Comisión
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              A liquidar
            </th>
            {hasArca && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Estado"
                  filterActive={estadoFilter !== "todos"}
                  filterSignature={estadoFilter}
                >
                  <select
                    value={estadoFilter}
                    onChange={(e) =>
                      aplicarFiltroEstado(
                        e.target.value as LiquidacionEstado | "todos",
                      )
                    }
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      estadoFilter !== "todos"
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar listado por estado"
                  >
                    <option value="todos">Todos</option>
                    {Object.entries(ESTADO_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "transportista",
            header: "Transportista",
            primary: true,
            cell: (liq) => (
              <>
                <p className="font-medium">{transportistaNombre(liq)}</p>
                {liq.transportista?.idFiscal && (
                  <p className="text-xs text-vialto-steel">
                    {liq.transportista.idFiscal}
                  </p>
                )}
              </>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "periodo",
            header: "Período",
            cell: (liq) => (
              <div className="flex flex-col leading-tight">
                <span>{fmtDate(liq.periodoDesde)}</span>
                <span>{fmtDate(liq.periodoHasta)}</span>
              </div>
            ),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
          },
          {
            id: "bruto",
            header: "Bruto",
            cell: (liq) => fmtMoney(liq.bruto),
            thClassName: `${listadoTablaThClass} text-right`,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "comision",
            header: "Comisión",
            cell: (liq) => (
              <>
                {fmtMoney(liq.comision)}
                <span className="ml-1 text-xs">({liq.comisionPct}%)</span>
              </>
            ),
            thClassName: `${listadoTablaThClass} text-right`,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-vialto-steel`,
          },
          {
            id: "liquido",
            header: "A liquidar",
            cell: (liq) => fmtMoney(liq.liquido),
            thClassName: `${listadoTablaThClass} text-right`,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums font-medium`,
          },
          ...(hasArca
            ? [
                {
                  id: "estado",
                  header: "Estado",
                  cell: (liq: LiquidacionConTransportista) => (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}
                      >
                        {ESTADO_LABEL[liq.estado]}
                      </span>
                      <AmbienteTestBadge ambiente={liq.ambiente} />
                    </div>
                  ),
                  tdClassName: listadoTablaTdClass,
                },
              ]
            : []),
        ]}
        rows={!activeTenantId || error ? [] : paginatedRows}
        rowKey={(liq) => liq.id}
        emptyMessage={
          !activeTenantId
            ? isSuperAdmin
              ? "Seleccioná una empresa para ver las liquidaciones."
              : "Cargando datos de empresa..."
            : error
              ? "No se pudieron cargar las liquidaciones."
              : "Todavía no hay liquidaciones..."
        }
        loadingMessage="Cargando…"
        onRowClick={(liq) => accionesProps(liq).onVer()}
        renderActions={(liq) => (
          <LiquidacionAccionesMenu {...accionesProps(liq)} />
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => (
          <ListadoCard
            onClick={() => accionesProps(liq).onVer()}
            primary={transportistaNombre(liq)}
            fields={[
              {
                label: "Período",
                value: `${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`,
              },
              { label: "Bruto", value: fmtMoney(liq.bruto) },
              {
                label: "Comisión",
                value: (
                  <>
                    {fmtMoney(liq.comision)}
                    <span className="ml-1 text-xs">({liq.comisionPct}%)</span>
                  </>
                ),
              },
              { label: "A liquidar", value: fmtMoney(liq.liquido) },
              ...(hasArca
                ? [
                    {
                      label: "Estado",
                      value: (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}
                          >
                            {ESTADO_LABEL[liq.estado]}
                          </span>
                          <AmbienteTestBadge ambiente={liq.ambiente} />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            actions={<LiquidacionAccionesMenu {...accionesProps(liq)} />}
          />
        )}
      />

      {activeTenantId &&
        (!error || !isSuperAdmin) &&
        filteredRows &&
        filteredRows.length > 0 && (
          <ListadoPagination
            meta={meta}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        )}

      {pendingEmitir && hasArca && activeTenantId && (
        <EmitirLiquidacionModal
          liq={pendingEmitir}
          getToken={getToken}
          onSuccess={onEmitirSuccess}
          onClose={() => setPendingEmitir(null)}
          ivaPct={pendingEmitir.ivaPct ?? config?.ivaGastosAdmin}
          arcaConfig={config}
          tenantId={isSuperAdmin ? activeTenantId : undefined}
          onDataSaved={() => {
            void refreshTransportistas();
            void refreshClientes();
          }}
        />
      )}
      {showCrear && activeTenantId && (
        <CrearLiquidacionManualModal
          transportistas={transportistas}
          config={config}
          hasArca={hasArca}
          getToken={getToken}
          tenantId={isSuperAdmin ? activeTenantId : undefined}
          onDataSaved={() => {
            void refreshTransportistas();
            void refreshClientes();
          }}
          onSuccess={(liq) => {
            setRows((prev) =>
              prev
                ? [
                    {
                      ...liq,
                      transportista:
                        transportistas.find(
                          (t) => t.id === liq.transportistaId,
                        ) ?? null,
                    },
                    ...prev,
                  ]
                : [{ ...liq, transportista: null }],
            );
            setShowCrear(false);
          }}
          onClose={() => setShowCrear(false)}
        />
      )}

      <AnularLiquidacionModal
        open={anularConfirm != null}
        message={
          anularConfirm
            ? `¿Anulás la liquidación de ${transportistaNombre(anularConfirm)}? Se emite el comprobante de anulación en ARCA asociado al original y los viajes quedan disponibles para una nueva liquidación.`
            : ""
        }
        busy={busyId === anularConfirm?.id}
        error={
          anularConfirm && actionError?.id === anularConfirm.id
            ? actionError.msg
            : null
        }
        onCancel={() => {
          if (!busyId) setAnularConfirm(null);
        }}
        onConfirm={(motivo) => void confirmAnular(motivo)}
      >
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-vialto-steel">
          Comprobante de anulación
          <select
            value={anularTipo}
            onChange={(e) =>
              setAnularTipo(e.target.value as "nota_credito" | "nota_debito")
            }
            disabled={busyId === anularConfirm?.id}
            className="mt-0.5 border border-black/20 px-2 py-1.5 text-sm normal-case tracking-normal text-vialto-charcoal disabled:opacity-50"
          >
            <option value="nota_credito">Nota de Crédito (cód. 3/8)</option>
            <option value="nota_debito">Nota de Débito (cód. 2/7)</option>
          </select>
        </label>
      </AnularLiquidacionModal>

      <ConfirmDialog
        open={eliminarConfirm != null}
        title="Eliminar liquidación"
        message={
          eliminarConfirm
            ? `¿Eliminás la liquidación de ${transportistaNombre(eliminarConfirm)}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={busyId === eliminarConfirm?.id}
        onCancel={() => {
          if (!busyId) setEliminarConfirm(null);
        }}
        onConfirm={() => void confirmEliminar()}
      />

      {verLoadingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-5 py-4 shadow-lg">
            <Spinner className="h-5 w-5 text-vialto-fire" />
            <span className="text-sm text-vialto-charcoal">Abriendo…</span>
          </div>
        </div>
      )}

      {previewComprobanteUrl && (
        <AdjuntoPreviewModal
          url={previewComprobanteUrl}
          title="Comprobante"
          onClose={() => setPreviewComprobanteUrl(null)}
        />
      )}

      {detail?.mode === "view" && (
        <LiquidacionViewModal
          liq={detail.liq}
          ivaPct={detail.liq.ivaPct ?? config?.ivaGastosAdmin}
          canEdit={canEditLiquidacion(detail.liq)}
          hasArca={hasArca}
          getToken={getToken}
          onClose={() => setDetail(null)}
          onEditar={() => setDetail({ mode: "edit", liq: detail.liq })}
          onEmitir={() => {
            setPendingEmitir(detail.liq);
            setDetail(null);
          }}
          onVerComprobante={
            hasArca && detail.liq.cbteNro != null
              ? () => void verPdf(detail.liq)
              : !hasArca && detail.liq.comprobanteUrl?.trim()
                ? () => setPreviewComprobanteUrl(detail.liq.comprobanteUrl)
                : undefined
          }
          onVerAnulacion={
            detail.liq.estado === "anulado"
              ? () => void verPdfAnulacion(detail.liq)
              : undefined
          }
          onEliminar={
            detail.liq.estado === "borrador" ||
            detail.liq.estado === "error" ||
            detail.liq.estado === "pendiente_cae"
              ? () => setEliminarConfirm(detail.liq)
              : undefined
          }
          onAnular={
            hasArca && detail.liq.estado === "autorizado"
              ? () => setAnularConfirm(detail.liq)
              : undefined
          }
        />
      )}

      {detail?.mode === "edit" && activeTenantId && (
        <LiquidacionEditModal
          liq={detail.liq}
          hasArca={hasArca}
          getToken={getToken}
          tenantId={activeTenantId}
          onClose={() => setDetail({ mode: "view", liq: detail.liq })}
          onSaved={(updated) => {
            const withLineas = {
              ...updated,
              transportista: updated.transportista ?? detail.liq.transportista,
              conceptosLineas:
                updated.conceptosLineas ?? detail.liq.conceptosLineas ?? [],
            };
            setRows(
              (prev) =>
                prev?.map((r) => (r.id === withLineas.id ? withLineas : r)) ??
                prev,
            );
            setDetail({ mode: "view", liq: withLineas });
          }}
        />
      )}
    </div>
  );
}

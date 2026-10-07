import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban,
  Download,
  Eye,
  FileMinus,
  FileText,
  FlaskConical,
  Landmark,
  Receipt,
  RotateCw,
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
import { AccionesFila } from "@/components/ui/AccionesFila";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";

/** Orden de prioridad de las acciones que se muestran como ícono en la grilla. */
const LIQUIDACION_ACCIONES_DESTACADAS = [
  "reintentar",
  "emitir",
  "pdf",
  "anular",
  "marcar-pendiente-anulacion",
  "confirmar-anulacion-manual",
  "comprobante",
  "pdf-nc",
];
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AnularLiquidacionModal } from "@/components/liquidaciones/AnularLiquidacionModal";
import { ConfirmarAnulacionManualModal } from "@/components/liquidaciones/ConfirmarAnulacionManualModal";
import { Spinner } from "@/components/ui/Spinner";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { TransportistaSearchSelect } from "@/components/forms/MaestroSearchSelects";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useToast } from "@/lib/toast";
import { apiFetch, apiJson } from "@/lib/api";
import { filenameFromContentDisposition } from "@/lib/downloadFilename";
import { liquidacionContratoPdfUrl } from "@/lib/liquidacionContratoPdf";
import { friendlyError } from "@/lib/friendlyError";
import { getArcaErrorDetalle } from "@/lib/arcaErrorDetalle";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import { modalOverlayClass } from "@/lib/modalLayers";
import { listadoTablaHeadRowClass, listadoTablaTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { anulacionComprobanteLabel } from "@/lib/arcaCbteTipo";
import { canAccessEmisionLiquidoProductoArca } from "@/lib/tenantModules";
import {
  idSistemaHabilitado,
  idPropio1Habilitado,
  idPropio2Habilitado,
  idPropio2Label,
  labelIdentificacionPersonalizadaViajes,
} from "@/lib/viajesFlota";
import { ExcelExportModal } from "@/components/stock/ExcelExportModal";
import {
  LIQUIDACIONES_EXPORT_COLUMNS,
  generarLiquidacionesExcel,
} from "@/lib/liquidacionesExcelExport";
import {
  transportistasLiquidacionOpcionesDesdeViaje,
  viajePendienteComprobanteTransportista,
} from "@/lib/viajesComprobantes";
import type { ArcaConfig, LiquidacionEstado, Viaje } from "@/types/api";

const ESTADO_LABEL: Record<LiquidacionEstado, string> = {
  borrador: "BORRADOR",
  pendiente_cae: "ESPERANDO AFIP",
  autorizado: "LIQUIDADO",
  error: "ERROR DE AFIP",
  anulado: "ANULADO",
  pendiente_anulacion: "PENDIENTE DE ANULACIÓN",
};

const ESTADO_CLASS: Record<LiquidacionEstado, string> = {
  borrador: "bg-gray-100 text-gray-700",
  pendiente_cae: "bg-amber-100 text-amber-800",
  autorizado: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
  anulado: "bg-gray-100 text-gray-500 line-through",
  pendiente_anulacion: "bg-amber-100 text-amber-800",
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

/** "dd/mm" sin año, como las fechas de carga/descarga de la grilla de Viajes. Fecha sin hora: se lee del string, sin zona horaria. */
function fmtDateCorta(iso: string) {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function transportistaNombre(liq: LiquidacionConTransportista) {
  return liq.transportista?.nombre ?? liq.transportistaId;
}

function LiquidacionAccionesMenu({
  liq,
  hasArca,
  metodoAnulacion,
  isBusy,
  isDownloading,
  onVer,
  onEmitir,
  onPdf,
  onPdfNc,
  onAnular,
  onMarcarPendienteAnulacion,
  onConfirmarAnulacionManual,
  onEliminar,
  onVerComprobante,
  open: openProp,
  onOpenChange,
}: {
  liq: LiquidacionConTransportista;
  hasArca: boolean;
  metodoAnulacion: "nota_credito_debito" | "manual";
  isBusy: boolean;
  isDownloading: boolean;
  onVer: () => void;
  onEmitir: () => void;
  onPdf: () => void;
  onPdfNc: () => void;
  onAnular: () => void;
  onMarcarPendienteAnulacion: () => void;
  onConfirmarAnulacionManual: () => void;
  onEliminar: () => void;
  onVerComprobante: () => void;
  /** Si se pasa junto con `onOpenChange`, el abierto/cerrado pasa a ser controlado por el padre (ej. click en la fila de la tabla). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : internalOpen;
  const setOpen = controlado ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const puedeEmitir =
    hasArca && (liq.estado === "borrador" || liq.estado === "error");
  const puedeEliminar =
    liq.estado === "borrador" ||
    liq.estado === "error" ||
    liq.estado === "pendiente_cae";
  const puedeAnular =
    hasArca && liq.estado === "autorizado" && metodoAnulacion !== "manual";
  const puedeMarcarPendienteAnulacion =
    hasArca && liq.estado === "autorizado" && metodoAnulacion === "manual";
  const puedeConfirmarAnulacionManual =
    hasArca && liq.estado === "pendiente_anulacion";
  const tienePdf =
    hasArca &&
    (liq.estado === "autorizado" ||
      liq.estado === "anulado" ||
      liq.estado === "pendiente_anulacion");
  const tienePdfNc =
    hasArca && liq.estado === "anulado" && Boolean(liq.anulacionCae);
  const tieneComprobanteAdjunto =
    !hasArca && Boolean(liq.comprobanteUrl?.trim());

  const options: AccionOpcion[] = [
    { id: "ver", label: "Ver", icon: Eye, onClick: onVer },
  ];
  if (puedeEmitir) {
    const conError = liq.estado === "error";
    options.push({
      id: conError ? "reintentar" : "emitir",
      label: isBusy ? "Emitiendo…" : conError ? "Reintentar emisión" : "Emitir",
      icon: conError ? RotateCw : Receipt,
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
      icon: FileMinus,
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
  if (puedeMarcarPendienteAnulacion) {
    options.push({
      id: "marcar-pendiente-anulacion",
      label: isBusy ? "Procesando…" : "Marcar pendiente de anulación",
      icon: Ban,
      onClick: onMarcarPendienteAnulacion,
      danger: true,
      disabled: isBusy,
    });
  }
  if (puedeConfirmarAnulacionManual) {
    options.push({
      id: "confirmar-anulacion-manual",
      label: isBusy ? "Procesando…" : "Confirmar anulación",
      icon: Ban,
      onClick: onConfirmarAnulacionManual,
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

  // El error de una acción (emitir, anular, PDF) ya no se muestra debajo de los íconos
  // — agrandaba la fila —: lo muestra un modal a nivel de página (`actionError`).
  return (
    <AccionesFila
      options={options}
      destacadas={LIQUIDACION_ACCIONES_DESTACADAS}
      subtitle={transportistaNombre(liq)}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export function LiquidacionesTenantPage() {
  const { getToken, isLoaded, isSignedIn, sessionClaims, orgId } = useAuth();
  const { user } = useUser();
  const { showToast } = useToast();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const { tenant, transportistas, refreshTransportistas, refreshClientes } =
    useMaestroData();

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
  const hasArca = canAccessEmisionLiquidoProductoArca(empresaModules);
  const empresaTenant = isSuperAdmin
    ? tenants?.find((t) => t.clerkOrgId === activeTenantId)
    : tenant;
  const metodoAnulacion: "nota_credito_debito" | "manual" =
    empresaTenant?.liquidacionAnulacionMetodo === "manual"
      ? "manual"
      : "nota_credito_debito";

  const { isVisible: isLiqFieldVisible } = useFieldConfig("liquidaciones");
  // Columna "Período": se oculta si el superadmin desactivó las dos fechas
  // (desde/hasta) en el alta de liquidación de esta empresa.
  const mostrarPeriodo =
    isLiqFieldVisible("alta_liquidacion", "fechaDesde") ||
    isLiqFieldVisible("alta_liquidacion", "fechaHasta");

  const [rows, setRows] = useState<LiquidacionConTransportista[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [estadoFilter, setEstadoFilter] = useState<LiquidacionEstado | "todos">(
    "todos",
  );
  const [transportistaFilter, setTransportistaFilter] = useState("");
  const [periodoDesdeFilter, setPeriodoDesdeFilter] = useState("");
  const [periodoHastaFilter, setPeriodoHastaFilter] = useState("");

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

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
  /** Fila/card clickeada: abre el menú de acciones de esa liquidación en vez del modal de detalle. */
  const [accionesAbiertoLiqId, setAccionesAbiertoLiqId] = useState<string | null>(null);
  const [pendingEmitir, setPendingEmitir] =
    useState<LiquidacionConTransportista | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [viajesTodos, setViajesTodos] = useState<Viaje[]>([]);
  const [viajesTodosLoading, setViajesTodosLoading] = useState(false);
  const [anularConfirm, setAnularConfirm] =
    useState<LiquidacionConTransportista | null>(null);
  const [pendienteAnulacionConfirm, setPendienteAnulacionConfirm] =
    useState<LiquidacionConTransportista | null>(null);
  const [confirmarAnulacionManualTarget, setConfirmarAnulacionManualTarget] =
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

  async function ensureViajesTodosLoaded() {
    if (viajesTodos.length > 0 || viajesTodosLoading || !activeTenantId) return;
    setViajesTodosLoading(true);
    try {
      const url = isSuperAdmin
        ? `/api/platform/viajes?tenantId=${encodeURIComponent(activeTenantId)}`
        : "/api/viajes";
      const data = await apiJson<Viaje[]>(url, () => getToken());
      setViajesTodos(data);
    } catch {
      // best-effort: si falla, el select de "Nueva liquidación" muestra todos los transportistas
    } finally {
      setViajesTodosLoading(false);
    }
  }

  /**
   * Transportistas con al menos un viaje pendiente de liquidar, para el select de
   * "Nueva liquidación" (no aplica al filtro del listado, que debe seguir mostrando
   * todos los transportistas). Mientras los viajes todavía no se cargaron (o el
   * tenant no tiene ninguno), se muestra la lista completa para no dejar el select
   * vacío por un instante de carga.
   */
  const transportistasParaNuevaLiquidacion = useMemo(() => {
    if (viajesTodosLoading || viajesTodos.length === 0) return transportistas;
    const ids = new Set<string>();
    for (const v of viajesTodos) {
      if (v.etapa === "cancelado") continue;
      if (!viajePendienteComprobanteTransportista(v)) continue;
      for (const opt of transportistasLiquidacionOpcionesDesdeViaje(
        v,
        transportistas,
      )) {
        ids.add(opt.id);
      }
    }
    return transportistas.filter((t) => ids.has(t.id));
  }, [transportistas, viajesTodos, viajesTodosLoading]);

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

  /**
   * Deep-link `?liquidacion=<id>` (ej. desde el detalle de facturación/liquidación de un viaje).
   * Con `&emitir=1` (botones "Reintentar"/"Continuar liquidación" de Viajes) abre directo
   * la emisión si la liquidación sigue con error de ARCA o en borrador; si no, cae en la
   * vista normal.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !activeTenantId) return;
    const id = searchParams.get("liquidacion")?.trim();
    if (!id) return;
    const emitir = searchParams.get("emitir") === "1";
    let cancelled = false;
    void (async () => {
      try {
        const full = await apiJson<LiquidacionConTransportista>(
          `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(activeTenantId)}`,
          () => getToken(),
        );
        if (cancelled) return;
        const liq = { ...full, conceptosLineas: full.conceptosLineas ?? [] };
        // `error` (reintentar) o `borrador` (continuar). Viajes solo manda `emitir=1`
        // para tenants con ARCA, así que no depende de que los módulos ya hayan cargado.
        if (emitir && (liq.estado === "error" || liq.estado === "borrador")) {
          setPendingEmitir(liq);
        } else {
          setDetail({ mode: "view", liq });
        }
      } catch {
        // Si no se pudo resolver (id inválido, sin permisos), no bloqueamos la pantalla.
      } finally {
        if (!cancelled) {
          setSearchParams(
            (p) => {
              const next = new URLSearchParams(p);
              next.delete("liquidacion");
              next.delete("emitir");
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
  }, [
    isLoaded,
    isSignedIn,
    activeTenantId,
    searchParams,
    setSearchParams,
    getToken,
  ]);

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

  async function confirmMarcarPendienteAnulacion() {
    const liq = pendienteAnulacionConfirm;
    if (!liq || busyId) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/marcar-pendiente-anulacion${qsTenant}`,
        () => getToken(),
        { method: "POST" },
      );
      setRows(
        (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
      );
      setPendienteAnulacionConfirm(null);
      setDetail((prev) =>
        prev?.liq.id === updated.id
          ? { mode: "view", liq: { ...prev.liq, ...updated } }
          : prev,
      );
      showToast("Liquidación marcada como pendiente de anulación.");
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

  async function confirmConfirmarAnulacionManual(args: {
    motivo: string;
    comprobanteUrl: string;
  }) {
    const liq = confirmarAnulacionManualTarget;
    if (!liq || busyId) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const qsTenant = `?tenantId=${encodeURIComponent(activeTenantId)}`;
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/confirmar-anulacion-manual${qsTenant}`,
        () => getToken(),
        { method: "POST", body: JSON.stringify(args) },
      );
      setRows(
        (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
      );
      setConfirmarAnulacionManualTarget(null);
      // Acción terminal (mismo patrón que confirmEliminar): cerrar el detalle en vez de
      // dejarlo abierto — el usuario ya confirmó, la grilla y el toast confirman el cambio.
      setDetail((prev) =>
        prev?.mode === "view" && prev.liq.id === updated.id ? null : prev,
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
  async function verPdfEnPestania(
    url: string,
    errorMsg: string,
    liqId: string,
  ) {
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
      metodoAnulacion,
      isBusy: busyId === liq.id,
      isDownloading: downloading === liq.id,
      open: accionesAbiertoLiqId === liq.id,
      onOpenChange: (o: boolean) => setAccionesAbiertoLiqId(o ? liq.id : null),
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
      onMarcarPendienteAnulacion: () => setPendienteAnulacionConfirm(liq),
      onConfirmarAnulacionManual: () => setConfirmarAnulacionManualTarget(liq),
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

  async function handleExportarExcel(selectedIds: string[]) {
    if (!filteredRows || filteredRows.length === 0) {
      showToast("No hay datos para exportar", "error");
      return;
    }
    try {
      setExportandoExcel(true);
      const cols = LIQUIDACIONES_EXPORT_COLUMNS.filter((c) =>
        selectedIds.includes(c.id),
      );
      await generarLiquidacionesExcel(
        cols,
        filteredRows,
        "Liquidaciones_Exportadas",
      );
      showToast("Excel exportado exitosamente", "success");
    } catch (err) {
      showToast("Ocurrió un error al exportar el Excel", "error");
    } finally {
      setExportandoExcel(false);
      setExportModalOpen(false);
    }
  }

  const exportButton = activeTenantId && (!error || !isSuperAdmin) && (
    <button
      type="button"
      onClick={() => setExportModalOpen(true)}
      disabled={!filteredRows || filteredRows.length === 0 || exportandoExcel}
      className="inline-flex h-10 items-center gap-1.5 px-4 bg-white border border-black/15 text-sm uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none"
    >
      <Download className="h-4 w-4" aria-hidden />
      {exportandoExcel ? "Generando..." : "Exportar"}
    </button>
  );

  return (
    <div className="w-full">
      {/* Título + badges ARCA a la izquierda; acciones a la derecha, en la misma línea. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide text-vialto-charcoal">
          Liquidaciones
        </h1>

        {hasArca && activeTenantId && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
              <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              Emisión electrónica vía ARCA
            </div>
            <AmbienteTestBadge ambiente={config?.ambiente} />
          </div>
        )}

        {activeTenantId && (!error || !isSuperAdmin) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {exportButton}
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
              onClick={() => {
                setShowCrear(true);
                void ensureViajesTodosLoaded();
              }}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nueva liquidación
            </button>
          </div>
        )}
      </div>

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

      {isSuperAdmin && error && (
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={(hasArca ? 8 : 7) - (mostrarPeriodo ? 0 : 1)}
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
            {mostrarPeriodo && (
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
            )}
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Bruto
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Comisión
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              IVA
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
              <p
                className="font-medium"
                title={
                  liq.transportista?.idFiscal
                    ? `CUIT: ${liq.transportista.idFiscal}`
                    : undefined
                }
              >
                {transportistaNombre(liq)}
              </p>
            ),
            tdClassName: listadoTablaTdClass,
          },
          ...(mostrarPeriodo
            ? [
                {
                  id: "periodo",
                  header: "Período",
                  cell: (liq: LiquidacionConTransportista) => (
                    <div
                      className="tabular-nums"
                      title={`Desde: ${fmtDate(liq.periodoDesde)}\nHasta: ${fmtDate(liq.periodoHasta)}`}
                    >
                      <span>{fmtDateCorta(liq.periodoDesde)}</span>
                      <span className="mx-1 text-vialto-steel/75" aria-hidden>
                        →
                      </span>
                      <span>{fmtDateCorta(liq.periodoHasta)}</span>
                    </div>
                  ),
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                },
              ]
            : []),
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
            // La comisión siempre se resta del bruto: en rojo.
            cell: (liq) => (
              <span
                className="text-red-700"
                title={`Se resta: ${fmtMoney(liq.comision)}`}
              >
                {liq.comisionPct}%
              </span>
            ),
            thClassName: `${listadoTablaThClass} text-right`,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "iva",
            header: "IVA",
            // Mismo monto que la línea de IVA del detalle (LiquidacionMontosBreakdown).
            // Verde si se suma al líquido, rojo si se resta (IVA negativo).
            cell: (liq) => {
              const iva = Number(liq.gastosAdminIva) || 0;
              const pct = liq.ivaPct != null ? ` ${liq.ivaPct}%` : "";
              return (
                <span
                  className={iva < 0 ? "text-red-700" : "text-emerald-700"}
                  title={`IVA${pct} — ${iva < 0 ? "se resta" : "se suma"}`}
                >
                  {fmtMoney(Math.abs(iva))}
                </span>
              );
            },
            thClassName: `${listadoTablaThClass} text-right`,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
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
                  // Una sola línea, igual que Facturas: el ambiente de pruebas va
                  // como ícono con tooltip.
                  cell: (liq: LiquidacionConTransportista) => (
                    <div className="flex flex-nowrap items-center gap-1">
                      <span
                        className={`inline-block whitespace-nowrap px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}
                      >
                        {ESTADO_LABEL[liq.estado]}
                      </span>
                      {liq.ambiente === "homologacion" && (
                        <span
                          title="Emitida en ambiente de pruebas (homologación)"
                          aria-label="Emitida en ambiente de pruebas"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-amber-300 bg-amber-50 text-amber-800"
                        >
                          <FlaskConical className="h-3 w-3" strokeWidth={2} aria-hidden />
                        </span>
                      )}
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
        onRowClick={(liq) => setAccionesAbiertoLiqId(liq.id)}
        renderActions={(liq) => (
          <LiquidacionAccionesMenu {...accionesProps(liq)} />
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => (
          <ListadoCard
            onClick={() => setAccionesAbiertoLiqId(liq.id)}
            primary={transportistaNombre(liq)}
            fields={[
              ...(mostrarPeriodo
                ? [
                    {
                      label: "Período",
                      value: `${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`,
                    },
                  ]
                : []),
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

      {/* Error de una acción de la grilla (emitir, anular, PDF): modal con el detalle
          en vez de texto bajo los íconos, para que la fila no crezca. */}
      {actionError && (
        <div
          className={modalOverlayClass}
          role="presentation"
          onClick={() => setActionError(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="liq-accion-error-titulo"
            className="w-full max-w-md border border-black/10 bg-white p-5 shadow-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="liq-accion-error-titulo"
              className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal"
            >
              No se pudo completar la acción
            </h2>
            <ArcaErrorMessage
              message={actionError.msg}
              detalle={actionError.detalle}
              className="mt-3 text-sm"
            />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
          transportistas={transportistasParaNuevaLiquidacion}
          transportistasLoading={viajesTodosLoading}
          config={config}
          hasLiquidoProductoArca={hasArca}
          getToken={getToken}
          tenantId={isSuperAdmin ? activeTenantId : undefined}
          idSistemaHabilitado={idSistemaHabilitado(empresaTenant)}
          idPropio1Habilitado={idPropio1Habilitado(empresaTenant)}
          idPropio1Label={labelIdentificacionPersonalizadaViajes(empresaTenant)}
          idPropio2Habilitado={idPropio2Habilitado(empresaTenant)}
          idPropio2Label={idPropio2Label(empresaTenant)}
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
        open={pendienteAnulacionConfirm != null}
        title="Marcar pendiente de anulación"
        message={
          pendienteAnulacionConfirm
            ? `¿Marcás como pendiente de anulación la liquidación de ${transportistaNombre(pendienteAnulacionConfirm)}? No se emite nada a ARCA.`
            : ""
        }
        confirmLabel="Marcar pendiente"
        tone="danger"
        busy={busyId === pendienteAnulacionConfirm?.id}
        onCancel={() => {
          if (!busyId) setPendienteAnulacionConfirm(null);
        }}
        onConfirm={() => void confirmMarcarPendienteAnulacion()}
      />

      <ConfirmarAnulacionManualModal
        open={confirmarAnulacionManualTarget != null}
        busy={busyId === confirmarAnulacionManualTarget?.id}
        error={
          confirmarAnulacionManualTarget &&
          actionError?.id === confirmarAnulacionManualTarget.id
            ? actionError.msg
            : null
        }
        getToken={getToken}
        tenantId={isSuperAdmin ? activeTenantId : undefined}
        onCancel={() => {
          if (!busyId) setConfirmarAnulacionManualTarget(null);
        }}
        onConfirm={(args) => void confirmConfirmarAnulacionManual(args)}
      />

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
          metodoAnulacion={metodoAnulacion}
          getToken={getToken}
          idPropio2Habilitado={idPropio2Habilitado(empresaTenant)}
          idPropio2Label={idPropio2Label(empresaTenant)}
          contratoPdfUrl={liquidacionContratoPdfUrl(
            detail.liq.id,
            isSuperAdmin
              ? { platform: true, tenantId: activeTenantId }
              : undefined,
          )}
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
            detail.liq.estado === "anulado" &&
            detail.liq.anulacionMetodo !== "manual"
              ? () => void verPdfAnulacion(detail.liq)
              : undefined
          }
          onVerComprobanteAnulacionManual={
            detail.liq.estado === "anulado" &&
            detail.liq.anulacionMetodo === "manual" &&
            detail.liq.anulacionManualComprobanteUrl
              ? () =>
                  window.open(
                    detail.liq.anulacionManualComprobanteUrl as string,
                    "_blank",
                    "noopener,noreferrer",
                  )
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
            hasArca &&
            detail.liq.estado === "autorizado" &&
            metodoAnulacion !== "manual"
              ? () => setAnularConfirm(detail.liq)
              : undefined
          }
          onMarcarPendienteAnulacion={
            hasArca &&
            detail.liq.estado === "autorizado" &&
            metodoAnulacion === "manual"
              ? () => setPendienteAnulacionConfirm(detail.liq)
              : undefined
          }
          onConfirmarAnulacionManual={
            hasArca && detail.liq.estado === "pendiente_anulacion"
              ? () => setConfirmarAnulacionManualTarget(detail.liq)
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
          idSistemaHabilitado={idSistemaHabilitado(empresaTenant)}
          idPropio1Habilitado={idPropio1Habilitado(empresaTenant)}
          idPropio1Label={labelIdentificacionPersonalizadaViajes(empresaTenant)}
          idPropio2Habilitado={idPropio2Habilitado(empresaTenant)}
          idPropio2Label={idPropio2Label(empresaTenant)}
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

      {exportModalOpen && (
        <ExcelExportModal
          columns={LIQUIDACIONES_EXPORT_COLUMNS}
          rowCount={filteredRows?.length ?? 0}
          onExport={handleExportarExcel}
          onClose={() => !exportandoExcel && setExportModalOpen(false)}
        />
      )}
    </div>
  );
}

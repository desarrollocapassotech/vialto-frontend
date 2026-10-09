import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Receipt } from "lucide-react";
import { useHiddenFiscalFields } from "@/hooks/useHiddenFiscalFields";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { FacturaArcaPreviewPanel } from "@/components/facturacion/FacturaArcaPreviewPanel";
import { DatosFiscalesFaltantesModal } from "@/components/shared/DatosFiscalesFaltantesModal";
import { AvisoFaltantesEmision } from "@/components/shared/AvisoFaltantesEmision";
import { useZumbidoAviso } from "@/hooks/useZumbidoAviso";
import { useValidacionPadronRegistro } from "@/hooks/useValidacionPadronRegistro";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import { PadronValidacionEstado } from "@/components/shared/PadronValidacionEstado";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import {
  FacturaTotalesPreview,
  facturaPayloadFromDraft,
  filterFacturaTramosByViajeIds,
  validateFacturaDraftTramos,
  ViajesVinculadosEditor,
  type FacturaDraft,
} from "@/components/facturacion/FacturaEditModal";
import {
  FacturaTramosEditor,
  emptyFacturaTramoDraft,
} from "@/components/facturacion/FacturaTramosEditor";
import {
  computeFacturaTotales,
  defaultFacturaLineasFromDraft,
  toFacturaLineasPayload,
  validateFacturaLineasDraft,
  type FacturaLineaDraft,
} from "@/components/facturacion/FacturaLineasEditor";
import { ClienteSearchSelect } from "@/components/forms/MaestroSearchSelects";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError, apiFetch, apiJson } from "@/lib/api";
import {
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
} from "@/lib/arcaCbteTipo";
import {
  collectFacturaEmitMissingFields,
  formatFacturaEmitMissingMessage,
} from "@/lib/facturaEmitValidation";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { friendlyError } from "@/lib/friendlyError";
import { ArcaEmitErrorAlert } from "@/components/ui/ArcaErrorMessage";
import { isAfipInfrastructureError } from "@/lib/arcaFriendlyError";
import {
  MSG_ARCA_NO_FACTURA_USD,
  arcaBloqueaFacturarUsd,
} from "@/lib/arcaUsdRestriction";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { useToast } from "@/lib/toast";
import {
  clientesConViajesPendientesFactura,
  monedaUnicaDeViajes,
  textoImporteFacturaSeleccion,
} from "@/lib/viajesFlota";
import type { ArcaConfig, Cliente, Factura, Viaje } from "@/types/api";

const compactInputClass =
  "h-8 w-full border border-black/15 bg-white px-2 text-sm";

const compactLabelClass =
  "text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel";

const standardInputClass =
  "h-9 w-full border border-black/15 bg-white px-2 text-sm";

function useEscapeKey(active: boolean, disabled: boolean, onClose: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        e.preventDefault();
        onClose();
      }
    },
    [disabled, onClose],
  );
  useEffect(() => {
    if (!active) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, handler]);
}

function validateFacturaDraft(
  draft: FacturaDraft,
  viajes: Viaje[],
  hasArca: boolean,
): string | null {
  if (!draft.fechaEmision) return "Ingresá la fecha de emisión.";
  if (monedaUnicaDeViajes(draft.viajeIds, viajes) === null) {
    return "Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.";
  }
  if (
    hasArca &&
    draft.viajeIds.some((id) => {
      const v = viajes.find((x) => x.id === id);
      return v ? arcaBloqueaFacturarUsd(true, v.monedaMonto) : false;
    })
  ) {
    return MSG_ARCA_NO_FACTURA_USD;
  }
  return null;
}

function fmtPreviewDate(iso: string) {
  return fmtDateUtc(iso);
}

function fmtPreviewMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
}

function FacturaContraparteField({
  clienteId,
  clientes,
  onClienteChange,
  compact = false,
  loading = false,
}: {
  clienteId: string;
  clientes: Cliente[];
  onClienteChange: (id: string) => void;
  compact?: boolean;
  /** Deshabilita el select mientras los viajes todavía no cargaron — evita que se
   * pueda elegir un cliente de la lista sin filtrar (ver `allAvailableClientes`) que
   * un instante después queda excluido por no tener nada disponible para facturar. */
  loading?: boolean;
}) {
  const labelClass = compact
    ? compactLabelClass
    : "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";
  const inputClass = compact ? compactInputClass : standardInputClass;

  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>Cliente</label>
      <ClienteSearchSelect
        clientes={clientes}
        value={clienteId}
        onChange={onClienteChange}
        inputClassName={inputClass}
        allowEmptyValue
        emptyListChoiceLabel="— Sin cliente —"
        placeholderCerrado="— Sin cliente —"
        loading={loading}
        aria-label="Cliente"
      />
    </div>
  );
}

export type FacturaCreateModalProps = {
  open: boolean;
  draft: FacturaDraft;
  setDraft: Dispatch<SetStateAction<FacturaDraft>>;
  clientes: Cliente[];
  viajes: Viaje[];
  viajesNueva: Viaje[];
  viajesLoading: boolean;
  onClose: () => void;
  onSave?: () => void;
  saving?: boolean;
  error?: string | null;
  showComprobanteAdjunto?: boolean;
  hasArca?: boolean;
  tenantId?: string;
  /** true = el tenant muestra la columna dedicada "ID Sistema" (default true). */
  idSistemaHabilitado?: boolean;
  /** true = el tenant muestra la columna dedicada "ID Propio 1" (default true). */
  idPropio1Habilitado?: boolean;
  /** Label configurable de la columna "ID Propio 1". */
  idPropio1Label?: string;
  /** true = el tenant habilitó "ID Propio 2" — muestra una columna adicional al elegir viajes. */
  idPropio2Habilitado?: boolean;
  /** Label configurable de la columna "ID Propio 2". */
  idPropio2Label?: string;
  getToken?: () => Promise<string | null>;
  facturasCreateUrl?: string;
  onFacturaGuardada?: (factura: Factura) => void;
  onFacturaEmitida?: (factura: Factura) => void;
  onDataSaved?: () => void;
};

export function FacturaCreateModal({
  open,
  draft,
  setDraft,
  clientes,
  viajes,
  viajesNueva,
  viajesLoading,
  onClose,
  onSave,
  saving = false,
  error = null,
  showComprobanteAdjunto = false,
  hasArca = false,
  tenantId,
  idSistemaHabilitado = true,
  idPropio1Habilitado = true,
  idPropio1Label = "ID personalizado",
  idPropio2Habilitado = false,
  idPropio2Label = "ID Propio 2",
  getToken: getTokenProp,
  facturasCreateUrl,
  onFacturaGuardada,
  onFacturaEmitida,
  onDataSaved,
}: FacturaCreateModalProps) {
  const auth = useAuth();
  const getToken = getTokenProp ?? auth.getToken;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());
  const unifiedArca =
    hasArca && Boolean(getToken) && Boolean(facturasCreateUrl);

  const [submitAction, setSubmitAction] = useState<
    "borrador" | "emitir" | null
  >(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "autorizada">("form");
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);

  // Clientes con al menos un viaje disponible para vincular a esta factura nueva —
  // mientras los viajes no cargaron (o el tenant no tiene ninguno) no se filtra, para no
  // dejar el select vacío por un instante de carga (mismo criterio que
  // `clientesParaNuevaFactura` en FacturacionTenantPage.tsx). Sin este filtro acá, un
  // `clientes` prop ya filtrado por el caller quedaba pisado igual: este memo volvía a
  // sumar cualquier cliente referenciado por `viajes` sin chequear disponibilidad.
  const allAvailableClientes = useMemo(() => {
    const sinFiltrar = viajesLoading || viajes.length === 0;
    const facturables = sinFiltrar ? null : clientesConViajesPendientesFactura(viajes);
    const map = new Map<string, Cliente>();
    for (const c of clientes ?? []) {
      if (c && c.id && (!facturables || facturables.has(c.id))) map.set(c.id, c);
    }
    for (const v of viajes ?? []) {
      if (
        v.cliente &&
        v.cliente.id &&
        (!facturables || facturables.has(v.cliente.id)) &&
        !map.has(v.cliente.id)
      ) {
        map.set(v.cliente.id, v.cliente as Cliente);
      }
      for (const cv of v.clientesViaje ?? []) {
        if (
          cv.cliente &&
          cv.cliente.id &&
          (!facturables || facturables.has(cv.cliente.id)) &&
          !map.has(cv.cliente.id)
        ) {
          map.set(cv.cliente.id, cv.cliente as Cliente);
        }
      }
    }
    return Array.from(map.values());
  }, [clientes, viajes, viajesLoading]);

  const derivedViajes = useMemo(() => {
    return viajes.map((v) => {
      if (draft.clienteId && v.clientesViaje) {
        const vc = v.clientesViaje.find((x) => x.clienteId === draft.clienteId);
        if (vc) {
          return {
            ...v,
            monto: vc.monto,
            cantidadFactura: vc.cantidad,
            precioUnitarioFactura: vc.precioUnitario,
            monedaMonto: vc.monedaMonto,
            destinosViaje: vc.destinosCliente,
            origen: vc.origen,
            destino: vc.destino,
          };
        }
      }
      return v;
    });
  }, [viajes, draft.clienteId]);

  // `viajesNueva` (prop) ya viene filtrado por cliente/disponibilidad/ARCA-USD —
  // ver `viajesFiltradosParaFactura` (lib/viajesFlota.ts), que evalúa el tramo
  // correcto (principal o adicional) para `draft.clienteId`. Re-filtrar acá por
  // `v.facturacionEstado` (el estado de la CABECERA/cliente principal, no el del
  // tramo elegido) rompía un viaje multi-cliente ya facturado a un cliente pero no
  // al otro: el tramo pendiente del segundo cliente desaparecía igual del listado
  // ("no hay viajes disponibles") aunque el backend sí lo aceptaba — bug real
  // detectado en QA. Este memo solo remapea monto/destino al tramo del cliente
  // elegido; no vuelve a decidir disponibilidad.
  const derivedViajesNueva = useMemo(() => {
    if (!draft.clienteId) return [];
    return viajesNueva.map((v) => {
      if (draft.clienteId && v.clientesViaje) {
        const vc = v.clientesViaje.find((x) => x.clienteId === draft.clienteId);
        if (vc) {
          return {
            ...v,
            monto: vc.monto,
            cantidadFactura: vc.cantidad,
            precioUnitarioFactura: vc.precioUnitario,
            monedaMonto: vc.monedaMonto,
            destinosViaje: vc.destinosCliente,
            origen: vc.origen,
            destino: vc.destino,
          };
        }
      }
      return v;
    });
  }, [viajesNueva, draft.clienteId]);

  // Las líneas ahora son derivadas y estrictamente de solo lectura
  const lineas = useMemo(
    () => defaultFacturaLineasFromDraft(draft, derivedViajes),
    [draft, derivedViajes],
  );

  const [lineasIncomplete, setLineasIncomplete] = useState<number[]>([]);
  const [tramosIncomplete, setTramosIncomplete] = useState<number[]>([]);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);

  // No se restringe a los clientes de los viajes ya tildados: cambiar de cliente limpia
  // la selección de viajes (`onClienteChange`), así que siempre se ofrece el catálogo completo.
  // (Antes se filtraba por los clientes de los viajes tildados y el select quedaba solo
  // con el cliente actual.)
  const filteredClientes = useMemo(() => {
    const base = allAvailableClientes;

    if (draft.clienteId && !base.some((c) => c.id === draft.clienteId)) {
      const fallback =
        (clienteDetalle && clienteDetalle.id === draft.clienteId
          ? clienteDetalle
          : null) ?? allAvailableClientes.find((c) => c.id === draft.clienteId);
      if (fallback) return [...base, fallback];
    }

    return base;
  }, [allAvailableClientes, draft.clienteId, clienteDetalle]);

  // Si el cliente elegido queda sin ningún viaje disponible una vez que `viajes` ya
  // terminó de cargar (p. ej. se lo seleccionó durante la ventana de carga inicial, o el
  // draft quedó de una sesión anterior con datos que después se facturaron), se limpia la
  // selección en vez de dejarlo "pegado" por el fallback de `filteredClientes` — ese
  // fallback existe para no perder la selección mientras `clienteDetalle` todavía no
  // resolvió o mientras `viajes` sigue cargando, no para sostener indefinidamente un
  // cliente sin nada para facturar.
  useEffect(() => {
    if (viajesLoading || viajes.length === 0) return;
    if (!draft.clienteId) return;
    if (allAvailableClientes.some((c) => c.id === draft.clienteId)) return;
    setDraft((d) =>
      d.clienteId ? { ...d, clienteId: "", viajeIds: [] } : d,
    );
  }, [viajesLoading, viajes.length, allAvailableClientes, draft.clienteId, setDraft]);

  const [datosReady, setDatosReady] = useState(false);
  const [arcaConfigMissing, setArcaConfigMissing] = useState(false);
  const [facturaEmitida, setFacturaEmitida] = useState<Factura | null>(null);
  const [downloading, setDownloading] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const busy = saving || submitAction != null;
  const displayError = unifiedArca ? localError : localError || error;

  useEscapeKey(open, busy, onClose);

  const configUrl = platform
    ? `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId!)}`
    : "/api/integracion-arca/config";

  // Campo vacío = 0%. El valor por defecto se precarga en el campo al abrir (ver
  // `ivaPrecargadoRef`); si el usuario lo borra, se factura sin IVA.
  const ivaPctDefault =
    draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : 0;

  const bloqueadoUsd = useMemo(() => {
    if (!hasArca) return false;
    const moneda = monedaUnicaDeViajes(draft.viajeIds, viajes);
    return moneda != null && arcaBloqueaFacturarUsd(true, moneda);
  }, [hasArca, draft.viajeIds, viajes]);

  const missingEmitFields = useMemo(() => {
    if (!clienteDetalle) return [];
    return collectFacturaEmitMissingFields({
      emisor: arcaConfig,
      cliente: clienteDetalle,
    });
  }, [arcaConfig, clienteDetalle]);
  const missingEmitMessage = formatFacturaEmitMissingMessage(missingEmitFields);
  const datosEmitIncompletos = datosReady && missingEmitFields.length > 0;
  const sinConfigArca = datosReady && !arcaConfig;

  // Al elegir un cliente sin los datos fiscales que ARCA exige, se abre un modal para
  // completarlos — una sola vez por cliente; después se reabre desde el aviso del panel.
  const missingClienteFields = useMemo(
    () => missingEmitFields.filter((f) => f.startsWith("Cliente:")),
    [missingEmitFields],
  );
  const missingHiddenClienteFields = useHiddenFiscalFields(missingClienteFields);
  const [datosClienteModalOpen, setDatosClienteModalOpen] = useState(false);
  const datosClienteAvisadoRef = useRef<string | null>(null);

  // Al elegir el cliente se valida su CUIT contra el padrón de ARCA (opt-in por empresa,
  // mismo circuito que el transportista en "Nueva liquidación"): si ARCA informa otra
  // condición IVA / domicilio, el modal se abre con eso precargado y al guardar queda la
  // huella de validado (no se vuelve a consultar mientras esos datos no cambien).
  const { tenant: tenantEfectivo } = useTenantPaisFijo(tenantId);
  const validacionPadronHabilitada =
    unifiedArca && tenantEfectivo?.validacionCuitArcaHabilitada === true;
  const clienteElegidoId =
    clienteDetalle && clienteDetalle.id === draft.clienteId ? clienteDetalle.id : null;
  const padronCliente = useValidacionPadronRegistro({
    entidad: "clientes",
    id: open ? clienteElegidoId : null,
    habilitado: validacionPadronHabilitada,
    tenantId,
    getToken,
  });
  const padronClienteAviso =
    padronCliente.resultado?.resultado === "diferencias" ||
    padronCliente.resultado?.resultado === "rechazado"
      ? padronCliente.resultado
      : null;

  // Zumbido del aviso del pie al tocar "Emitir a ARCA" con datos faltantes.
  const zumbidoAviso = useZumbidoAviso();
  useEffect(() => {
    if (!open) {
      datosClienteAvisadoRef.current = null;
      setDatosClienteModalOpen(false);
      return;
    }
    if (!unifiedArca || !datosReady || !clienteElegidoId) return;
    // Se espera la respuesta de ARCA para abrir el modal ya precargado.
    if (padronCliente.pendiente) return;
    if (missingClienteFields.length === 0 && !padronClienteAviso) return;
    // La marca distingue el motivo: avisar de datos faltantes no consume el aviso de
    // "ARCA informa otros datos" que puede llegar después (ej. abriendo desde Viajes).
    const key = `${clienteElegidoId}:${padronClienteAviso ? "arca" : "faltan"}`;
    if (datosClienteAvisadoRef.current === key) return;
    datosClienteAvisadoRef.current = key;
    setDatosClienteModalOpen(true);
  }, [
    open,
    unifiedArca,
    datosReady,
    clienteElegidoId,
    missingClienteFields.length,
    padronCliente.pendiente,
    padronClienteAviso,
  ]);

  const [frozenLineas, setFrozenLineas] = useState<FacturaLineaDraft[] | null>(null);

  const totales = useMemo(
    () => computeFacturaTotales(frozenLineas ?? lineas, ivaPctDefault),
    [lineas, frozenLineas, ivaPctDefault],
  );

  const condicionIva = clienteDetalle?.condicionIva ?? null;
  const letra = facturaLetraFromCondicionIva(condicionIva);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setSubmitAction(null);
      setLocalError(null);
      setLineasIncomplete([]);
      setTramosIncomplete([]);
      setArcaConfigMissing(false);
      setFrozenLineas(null);
      setFacturaEmitida(null);
      setDatosReady(false);
      return;
    }

    if (draft.clienteId) {
      const known =
        allAvailableClientes.find((c) => c.id === draft.clienteId) ?? null;
      setClienteDetalle((prev) => (prev?.id === draft.clienteId ? prev : known));
    } else {
      setClienteDetalle(null);
    }

    if (!unifiedArca) {
      setDatosReady(true);
      return;
    }

    let cancelled = false;
    setDatosReady(false);

    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig | null>(configUrl, () =>
          getToken(),
        );
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        if (!cancelled) setArcaConfig(null);
      }

      if (draft.clienteId) {
        try {
          const url = platform
            ? `/api/platform/clientes/${encodeURIComponent(draft.clienteId)}?tenantId=${encodeURIComponent(tenantId!)}`
            : `/api/clientes/${encodeURIComponent(draft.clienteId)}`;
          const c = await apiJson<Cliente>(url, () => getToken());
          if (!cancelled) setClienteDetalle(c);
        } catch {
          /* se valida con lo disponible */
        }
      }

      if (!cancelled) setDatosReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    unifiedArca,
    configUrl,
    draft.clienteId,
    allAvailableClientes,
    getToken,
    platform,
    tenantId,
  ]);

  // IVA (%) precargado con el valor por defecto (el mismo que ya se usa para calcular,
  // `ivaPctDefault`), en vez de dejar el campo vacío con solo el placeholder. Se espera
  // a `datosReady` para que con ARCA ya esté la config del tenant (`ivaGastosAdmin`).
  // Una vez por apertura: si el usuario lo borra, no se vuelve a completar solo.
  const ivaPrecargadoRef = useRef(false);
  useEffect(() => {
    if (!open) {
      ivaPrecargadoRef.current = false;
      return;
    }
    if (!datosReady || ivaPrecargadoRef.current) return;
    ivaPrecargadoRef.current = true;
    const sugerido = String(arcaConfig?.ivaGastosAdmin ?? 21);
    setDraft((d) => (d.ivaPct.trim() === "" ? { ...d, ivaPct: sugerido } : d));
  }, [open, datosReady, arcaConfig, setDraft]);

  // Limpiar errores de línea cuando cambian las líneas derivadas
  useEffect(() => {
    setLineasIncomplete([]);
  }, [lineas]);

  if (!open) return null;

  function patch(p: Partial<FacturaDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function patchViajeIds(ids: string[]) {
    const tramos = filterFacturaTramosByViajeIds(draft.tramos, ids);
    const facturarPorTramo = ids.length === 0 ? false : draft.facturarPorTramo;
    patch({
      viajeIds: ids,
      facturarPorTramo,
      tramos: facturarPorTramo ? tramos : [],
    });
    setTramosIncomplete([]);
    setLocalError(null);
  }

  function handleToggleFacturarPorTramo(checked: boolean) {
    const ivaDefault =
      draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : ivaPctDefault;
    patch({
      facturarPorTramo: checked,
      tramos: checked
        ? draft.tramos.length > 0
          ? draft.tramos
          : [
              emptyFacturaTramoDraft(
                Number.isFinite(ivaDefault) ? ivaDefault : 21,
              ),
            ]
        : [],
    });
    setTramosIncomplete([]);
    setLocalError(null);
  }

  function notifyError(message: string) {
    setLocalError(message);
    showToast(message, "error");
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  async function resolveComprobanteUrl(): Promise<string | null | undefined> {
    if (!showComprobanteAdjunto) return undefined;
    if (draft.comprobanteFile) {
      return uploadComprobante(
        () => getToken(),
        draft.comprobanteFile,
        "facturacion",
      );
    }
    return draft.comprobanteUrl;
  }

  async function persistFactura(): Promise<Factura> {
    const comprobanteUrl = await resolveComprobanteUrl();
    return apiJson<Factura>(facturasCreateUrl!, () => getToken(), {
      method: "POST",
      body: JSON.stringify(facturaPayloadFromDraft(draft, comprobanteUrl)),
    });
  }

  async function handleUnifiedSubmit(action: "borrador" | "emitir") {
    if (busy) return;
    const validationError = validateFacturaDraft(draft, viajes, hasArca);
    if (validationError) {
      notifyError(validationError);
      return;
    }
    const tramosCheck = validateFacturaDraftTramos(draft);
    if (!tramosCheck.ok) {
      setTramosIncomplete(tramosCheck.indices);
      notifyError(tramosCheck.message);
      return;
    }

    if (action === "emitir") {
      if (bloqueadoUsd) {
        notifyError(MSG_ARCA_NO_FACTURA_USD);
        return;
      }
      if (!datosReady) {
        notifyError(
          "Cargando datos de emisión. Intentá de nuevo en un momento.",
        );
        return;
      }
      // Sin configuración ARCA no se bloquea: el tenant está en homologación y
      // el backend emite con datos de prueba (solo producción la necesita).
      if (datosEmitIncompletos) {
        notifyError(missingEmitMessage ?? "Faltan datos para emitir.");
        return;
      }
      const lineasCheck = validateFacturaLineasDraft(lineas);
      if (!lineasCheck.ok) {
        setLineasIncomplete(lineasCheck.indices);
        notifyError(lineasCheck.message);
        return;
      }
    }

    setLineasIncomplete([]);
    setTramosIncomplete([]);
    setLocalError(null);
    setSubmitAction(action);

    // Para saber en el catch si la factura se llegó a crear
    let facturaCreada: Factura | null = null;

    try {
      const factura = await persistFactura();
      facturaCreada = factura;

      if (action === "borrador") {
        showToast("Factura guardada como borrador.", "success");
        onFacturaGuardada?.(factura);
        onClose();
        return;
      }

      const emitUrl = platform
        ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/emitir?tenantId=${encodeURIComponent(tenantId!)}`
        : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/emitir`;

      const updated = await apiJson<Factura>(emitUrl, () => getToken(), {
        method: "POST",
        body: JSON.stringify({ lineas: toFacturaLineasPayload(lineas) }),
      });

      setFacturaEmitida(updated);
      setFrozenLineas(lineas);
      setStep("autorizada");
      onFacturaEmitida?.(updated);
      showToast("Factura emitida a ARCA.", "success");
    } catch (err) {
      // Se creó pero falló ARCA: refrescar y cerrar
      if (facturaCreada) {
        onFacturaGuardada?.(facturaCreada);
        showToast(
          "La factura quedó en borrador pero no se pudo emitir a ARCA. Podés reintentar desde el listado.",
          "error",
        );
        onClose();
        return;
      }

      const msg =
        action === "emitir" &&
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
          ? err.message
          : friendlyError(err, action === "emitir" ? "arca" : "facturacion");
      if (
        action === "emitir" &&
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
      ) {
        setArcaConfigMissing(true);
      } else {
        setArcaConfigMissing(false);
      }
      notifyError(msg);
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleManualSave() {
    if (busy) return;

    const tramosCheck = validateFacturaDraftTramos(draft);
    if (!tramosCheck.ok) {
      setTramosIncomplete(tramosCheck.indices);
      notifyError(tramosCheck.message);
      return;
    }
    setTramosIncomplete([]);
    setLocalError(null);

    if (onSave) {
      onSave();
      return;
    }

    if (!getToken || !facturasCreateUrl) {
      notifyError(
        "No se pudo guardar la factura: falta configuración del formulario.",
      );
      return;
    }

    setSubmitAction("borrador");
    try {
      const factura = await persistFactura();
      showToast("Factura guardada correctamente.", "success");
      onFacturaGuardada?.(factura);
      onClose();
    } catch (err) {
      notifyError(friendlyError(err, "facturacion"));
    } finally {
      setSubmitAction(null);
    }
  }

  async function descargarPdf() {
    if (!facturaEmitida) return;
    const pdfUrl = platform
      ? `/api/platform/arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf?tenantId=${encodeURIComponent(tenantId!)}`
      : `/api/integracion-arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf`;
    setDownloading(true);
    try {
      const res = await apiFetch(pdfUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${facturaEmitida.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLocalError(friendlyError(err, "arca"));
    } finally {
      setDownloading(false);
    }
  }

  /**
   * Abre el PDF de la factura emitida en una pestaña nueva — mismo patrón que
   * `verComprobante` de "Nueva liquidación": la pestaña se abre de forma síncrona en
   * el click (si no, el bloqueador de pop-ups la corta por venir después de un await)
   * y recién cuando llega el PDF se le asigna la URL.
   */
  async function verComprobante() {
    if (!facturaEmitida) return;
    const pdfUrl = platform
      ? `/api/platform/arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf?tenantId=${encodeURIComponent(tenantId!)}`
      : `/api/integracion-arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf`;
    const ventana = window.open("", "_blank");
    try {
      const res = await apiFetch(pdfUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blobUrl = URL.createObjectURL(await res.blob());
      if (ventana) ventana.location.href = blobUrl;
      else window.open(blobUrl, "_blank");
    } catch {
      ventana?.close();
      showToast("No se pudo cargar el PDF del comprobante", "error");
    }
  }

  const monedaInvalida =
    draft.viajeIds.length > 0 &&
    monedaUnicaDeViajes(draft.viajeIds, derivedViajes) === null;

  const compactIvaField = (
    <div className="flex flex-col gap-1">
      <label className={compactLabelClass}>
        {draft.facturarPorTramo ? "IVA (%) viajes sin tramo" : "IVA (%)"}
      </label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={draft.ivaPct}
        onChange={(e) => patch({ ivaPct: e.target.value })}
        placeholder="0"
        className={`${compactInputClass} sm:max-w-[8rem]`}
      />
    </div>
  );

  const compactFields = (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {!hasArca && (
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>Número (opcional)</label>
            <input
              type="text"
              value={draft.numero}
              onChange={(e) => patch({ numero: e.target.value })}
              placeholder="0001-00000001"
              className={compactInputClass}
            />
          </div>
        )}
        <FacturaContraparteField
          clienteId={draft.clienteId}
          clientes={filteredClientes}
          loading={viajesLoading}
          onClienteChange={(id) =>
            patch({
              clienteId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
          compact
        />
        {/* Con ARCA no hay campo Número: el IVA ocupa el lugar libre al lado del cliente. */}
        {hasArca && compactIvaField}
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>
              Fecha de emisión <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={draft.fechaEmision}
              onChange={(e) => patch({ fechaEmision: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>Fecha de vencimiento</label>
            <input
              type="date"
              value={draft.fechaVencimiento}
              onChange={(e) => patch({ fechaVencimiento: e.target.value })}
              className={compactInputClass}
            />
          </div>
        </div>
        {!hasArca && <div className="sm:col-span-2">{compactIvaField}</div>}
      </div>
      <div className="flex min-h-[14rem] flex-1 flex-col gap-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ViajesVinculadosEditor
            viajes={derivedViajes}
            disponibles={derivedViajesNueva}
            selected={draft.viajeIds}
            onChange={patchViajeIds}
            loading={viajesLoading}
            clienteId={draft.clienteId}
            viajesTablaFillHeight
            idSistemaHabilitado={idSistemaHabilitado}
            idPropio1Habilitado={idPropio1Habilitado}
            idPropio1Label={idPropio1Label}
            idPropio2Habilitado={idPropio2Habilitado}
            idPropio2Label={idPropio2Label}
          />
        </div>
      </div>
      {draft.viajeIds.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs text-vialto-charcoal">
          <input
            type="checkbox"
            checked={draft.facturarPorTramo}
            disabled={busy}
            onChange={(e) => handleToggleFacturarPorTramo(e.target.checked)}
            className="h-4 w-4 border-black/20"
          />
          Facturar por tramo
        </label>
      )}
      {draft.facturarPorTramo && draft.viajeIds.length > 0 && (
        <FacturaTramosEditor
          tramos={draft.tramos}
          onChange={(tramos) => {
            patch({ tramos });
            setTramosIncomplete([]);
            setLocalError(null);
          }}
          viajeIds={draft.viajeIds}
          viajes={derivedViajes}
          ivaPctDefault={ivaPctDefault}
          disabled={busy}
          incompleteIndices={tramosIncomplete}
        />
      )}
      <FacturaTotalesPreview draft={draft} viajes={derivedViajes} />
      {monedaInvalida && (
        <p className="shrink-0 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
          Los viajes seleccionados tienen distintas monedas. Una factura no
          puede contener viajes en distintas monedas. Generá una factura por
          moneda.
        </p>
      )}
    </div>
  );

  const standardFields = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Con ARCA el número lo asigna AFIP al emitir: no se carga a mano. */}
        {!hasArca && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
              Número (opcional)
            </label>
            <input
              type="text"
              value={draft.numero}
              onChange={(e) => patch({ numero: e.target.value })}
              placeholder="0001-00000001"
              className="h-9 border border-black/20 bg-white px-3 text-sm"
            />
          </div>
        )}
        <FacturaContraparteField
          clienteId={draft.clienteId}
          clientes={filteredClientes}
          loading={viajesLoading}
          onClienteChange={(id) =>
            patch({
              clienteId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Fecha de emisión <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={draft.fechaEmision}
            onChange={(e) => patch({ fechaEmision: e.target.value })}
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Fecha de vencimiento
          </label>
          <input
            type="date"
            value={draft.fechaVencimiento}
            onChange={(e) => patch({ fechaVencimiento: e.target.value })}
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            {draft.facturarPorTramo ? "IVA (%) viajes sin tramo" : "IVA (%)"}
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.ivaPct}
            onChange={(e) => patch({ ivaPct: e.target.value })}
            placeholder="0"
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="col-span-full flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
              Viajes vinculados{" "}
              {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
            </label>
            {draft.viajeIds.length > 0 && (
              <span className="text-sm font-medium tabular-nums text-vialto-charcoal">
                {textoImporteFacturaSeleccion(draft.viajeIds, derivedViajes)}
              </span>
            )}
          </div>
          <ViajesVinculadosEditor
            viajes={derivedViajes}
            disponibles={derivedViajesNueva}
            selected={draft.viajeIds}
            onChange={patchViajeIds}
            loading={viajesLoading}
            clienteId={draft.clienteId}
            idSistemaHabilitado={idSistemaHabilitado}
            idPropio1Habilitado={idPropio1Habilitado}
            idPropio1Label={idPropio1Label}
            idPropio2Habilitado={idPropio2Habilitado}
            idPropio2Label={idPropio2Label}
          />
        </div>
        {draft.viajeIds.length > 0 && (
          <div className="col-span-full">
            <label className="inline-flex items-center gap-2 text-sm text-vialto-charcoal">
              <input
                type="checkbox"
                checked={draft.facturarPorTramo}
                disabled={busy}
                onChange={(e) => handleToggleFacturarPorTramo(e.target.checked)}
                className="h-4 w-4 border-black/20"
              />
              Facturar por tramo
            </label>
          </div>
        )}
        {draft.facturarPorTramo && draft.viajeIds.length > 0 && (
          <div className="col-span-full">
            <FacturaTramosEditor
              tramos={draft.tramos}
              onChange={(tramos) => {
                patch({ tramos });
                setTramosIncomplete([]);
                setLocalError(null);
              }}
              viajeIds={draft.viajeIds}
              viajes={derivedViajes}
              ivaPctDefault={ivaPctDefault}
              disabled={busy}
              incompleteIndices={tramosIncomplete}
            />
          </div>
        )}
      </div>
      <FacturaTotalesPreview draft={draft} viajes={derivedViajes} />
      {monedaInvalida && (
        <p className="mt-3 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
          Los viajes seleccionados tienen distintas monedas. Una factura no
          puede contener viajes en distintas monedas. Generá una factura por
          moneda.
        </p>
      )}
      {showComprobanteAdjunto && (
        <div className="mt-4">
          <ComprobanteAdjuntoField
            file={draft.comprobanteFile}
            existingUrl={draft.comprobanteUrl}
            onFileChange={(file) =>
              patch(
                file
                  ? { comprobanteFile: file, comprobanteUrl: null }
                  : { comprobanteFile: null },
              )
            }
            onClearExisting={() =>
              patch({ comprobanteUrl: null, comprobanteFile: null })
            }
            disabled={busy}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-[110] flex justify-center sm:items-center sm:p-4 md:p-6",
          step === "autorizada" ? "items-center" : "items-stretch",
        ].join(" ")}
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Cerrar"
          disabled={busy}
          onClick={() => {
            if (!busy) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="factura-create-modal-title"
          className={[
            "relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-lg sm:border sm:border-black/15",
            step === "autorizada" ? "h-auto" : "h-full",
            step === "autorizada"
              ? "sm:h-auto"
              : unifiedArca
                ? "sm:h-[92vh]"
                : "sm:h-auto sm:max-h-[92vh]",
            step === "autorizada"
              ? "max-w-[min(34rem,calc(100vw-1rem))]"
              : "max-w-[min(110rem,calc(100vw-1rem))]",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {step === "form" && viajesLoading ? (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <Spinner className="h-8 w-8 text-vialto-charcoal" />
              <p className="text-sm font-medium text-vialto-charcoal">
                Cargando clientes…
              </p>
            </div>
          ) : null}
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="factura-create-modal-title"
                  className="text-base font-semibold text-vialto-charcoal"
                >
                  {step === "autorizada" ? (
                    "Factura emitida"
                  ) : (
                    <>
                      Nueva factura
                      {draft.letraComprobante === "a"
                        ? " A"
                        : draft.letraComprobante === "b"
                          ? " B"
                          : ""}
                    </>
                  )}
                </h2>
                {/* Mismo distintivo que "Nueva liquidación": ambiente de ARCA del tenant (o el de la factura ya emitida). */}
                {unifiedArca && (
                  <AmbienteTestBadge
                    ambiente={facturaEmitida?.ambiente ?? arcaConfig?.ambiente}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-vialto-steel">
                {step === "autorizada" ? (
                  "El comprobante fue autorizado por ARCA."
                ) : (
                  <>
                    {draft.letraComprobante
                      ? ` Tipo elegido: Factura ${draft.letraComprobante.toUpperCase()}.`
                      : ""}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div
            className={[
              "min-h-0 flex-1 overflow-hidden",
              step === "form" && unifiedArca
                ? "flex flex-col lg:min-h-0 lg:flex-row"
                : "overflow-y-auto",
            ].join(" ")}
          >
            {step === "form" ? (
              unifiedArca ? (
                <>
                  <div className="flex min-h-0 flex-col overflow-y-auto border-b border-black/10 px-4 py-4 sm:px-5 lg:w-[68%] lg:max-w-[68%] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                    {compactFields}
                  </div>
                  <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:w-[32%] lg:max-w-[32%] lg:shrink-0 lg:min-w-0">
                    <FacturaArcaPreviewPanel
                      arcaConfig={arcaConfig}
                      clienteDetalle={clienteDetalle}
                      fechaEmision={draft.fechaEmision}
                      lineas={lineas}
                      onLineasChange={() => {}} /* Bloqueado, las líneas son fijas */
                      ivaPctDefault={ivaPctDefault}
                      lineasIncomplete={lineasIncomplete}
                      lineasDisabled={
                        true
                      } /* Forzamos a deshabilitar edición interna */
                      bloqueadoUsd={bloqueadoUsd}
                      missingEmitFields={missingEmitFields}
                      sinConfigArca={sinConfigArca}
                      datosEmitIncompletos={datosEmitIncompletos}
                      platform={platform}
                      tenantId={tenantId}
                      getToken={getToken}
                      onClienteUpdated={(c) => {
                        setClienteDetalle(c);
                        onDataSaved?.();
                      }}
                      avisoFaltantesExterno
                      estadoReceptor={
                        clienteElegidoId ? (
                          <PadronValidacionEstado
                            habilitado={validacionPadronHabilitada}
                            pendiente={padronCliente.pendiente}
                            resultado={padronCliente.resultado}
                            consultado={padronCliente.consultado}
                            onRevisar={() => setDatosClienteModalOpen(true)}
                            onReintentar={() => void padronCliente.revalidar()}
                          />
                        ) : undefined
                      }
                      feedbackSlot={
                        <div ref={feedbackRef} className="space-y-2">
                          {displayError &&
                            (isAfipInfrastructureError(displayError) ? (
                              <ArcaEmitErrorAlert error={displayError} />
                            ) : (
                              <CrudFormErrorAlert message={displayError} />
                            ))}
                          {arcaConfigMissing && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(
                                  platform
                                    ? "/superadmin/arca"
                                    : "/configuracion/arca",
                                );
                              }}
                              className="w-full h-9 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                            >
                              {platform
                                ? "Ir a ARCA / AFIP (superadmin)"
                                : "Ir a configuración de ARCA"}
                            </button>
                          )}
                        </div>
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  {standardFields}
                  {displayError && (
                    <div className="mt-4">
                      {isAfipInfrastructureError(displayError) ? (
                        <ArcaEmitErrorAlert error={displayError} />
                      ) : (
                        <CrudFormErrorAlert message={displayError} />
                      )}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mx-auto max-w-lg space-y-5">
                  <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-800">
                      Comprobante autorizado por ARCA
                    </p>
                    {facturaEmitida?.cae && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        CAE: {facturaEmitida.cae}
                      </p>
                    )}
                    {facturaEmitida?.caeFechaVto && (
                      <p className="text-xs text-emerald-700">
                        Vto. CAE: {fmtPreviewDate(facturaEmitida.caeFechaVto)}
                      </p>
                    )}
                  </div>
                  <section className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Resumen
                    </p>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Tipo</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {facturaLetraLabel(letra)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Cliente</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {clienteDetalle?.nombre ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Neto</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {fmtPreviewMoney(totales.neto)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">IVA</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {fmtPreviewMoney(totales.iva)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {fmtPreviewMoney(totales.total)}
                      </span>
                    </div>
                  </section>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => void descargarPdf()}
                      className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                    >
                      {downloading ? "Generando…" : "Descargar PDF"}
                    </button>
                    {facturaEmitida && (
                      <button
                        type="button"
                        onClick={() => void verComprobante()}
                        className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                      >
                        Ver comprobante
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {step === "form" && (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
              {/* Faltantes para emitir: fijo en el pie, al lado de "Emitir a ARCA", para que se vea siempre. */}
              {unifiedArca && datosEmitIncompletos && (
                <AvisoFaltantesEmision
                  mensaje={
                    missingClienteFields.length === missingEmitFields.length
                      ? "Faltan datos del cliente para poder facturar."
                      : "Faltan datos para poder facturar."
                  }
                  hayOcultos={missingHiddenClienteFields.length > 0}
                  onCompletar={
                    clienteDetalle && missingClienteFields.length > 0
                      ? () => setDatosClienteModalOpen(true)
                      : undefined
                  }
                  zumbando={zumbidoAviso.zumbando}
                  onZumbidoEnd={zumbidoAviso.terminar}
                />
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
              >
                Cancelar
              </button>
              {unifiedArca ? (
                <>
                  <button
                    type="button"
                    disabled={busy || monedaInvalida}
                    onClick={() => void handleUnifiedSubmit("borrador")}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-60"
                  >
                    {submitAction === "borrador" && (
                      <Spinner className="h-3.5 w-3.5" />
                    )}
                    {submitAction === "borrador"
                      ? "Guardando…"
                      : "Guardar borrador"}
                  </button>
                  {/* Con datos faltantes no se usa `disabled` (no dispararía el click): se ve
                      deshabilitado y el click hace zumbar el aviso del pie. */}
                  <button
                    type="button"
                    disabled={busy || monedaInvalida || bloqueadoUsd}
                    aria-disabled={datosEmitIncompletos || undefined}
                    onClick={() => {
                      if (datosEmitIncompletos) {
                        zumbidoAviso.disparar();
                        return;
                      }
                      void handleUnifiedSubmit("emitir");
                    }}
                    className={`inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white disabled:opacity-60 ${
                      datosEmitIncompletos
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-vialto-graphite"
                    }`}
                  >
                    {submitAction === "emitir" ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Receipt
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    )}
                    {submitAction === "emitir"
                      ? "Emitiendo a ARCA…"
                      : !datosReady
                        ? "Cargando datos…"
                        : "Emitir a ARCA"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleManualSave()}
                  disabled={busy || monedaInvalida}
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
                >
                  {busy && <Spinner className="h-3.5 w-3.5" />}
                  {busy ? "Guardando…" : "Guardar"}
                </button>
              )}
            </footer>
          )}
        </div>
      </div>

      {clienteDetalle &&
        (missingClienteFields.length > 0 || padronClienteAviso) && (
          <DatosFiscalesFaltantesModal
            // Remonta al llegar la respuesta de ARCA para que el formulario tome lo precargado.
            key={`${clienteDetalle.id}-${padronClienteAviso?.resultado ?? "sin-arca"}`}
            open={datosClienteModalOpen && step === "form"}
            entidad="cliente"
            id={clienteDetalle.id}
            nombre={clienteDetalle.nombre}
            initial={{
              nombre: clienteDetalle.nombre ?? "",
              pais: clienteDetalle.pais ?? null,
              idFiscal: clienteDetalle.idFiscal ?? null,
              condicionIva:
                padronClienteAviso?.resultado === "diferencias" &&
                padronClienteAviso.diferencias.includes("condicionIva")
                  ? padronClienteAviso.padron.condicionIva
                  : (clienteDetalle.condicionIva ?? null),
              condicionTributaria: clienteDetalle.condicionTributaria ?? null,
              direccion:
                padronClienteAviso?.resultado === "diferencias" &&
                padronClienteAviso.diferencias.includes("domicilio")
                  ? padronClienteAviso.padron.domicilio
                  : (clienteDetalle.direccion ?? null),
            }}
            missingFields={missingClienteFields}
            padron={padronClienteAviso}
            accion="emitir una factura"
            tenantId={tenantId}
            getToken={getToken}
            onSaved={(c) => {
              setClienteDetalle(c as Cliente);
              onDataSaved?.();
              if (padronClienteAviso) {
                // Revisó y guardó contra lo de ARCA: se guarda la huella de validado.
                void padronCliente.confirmar();
              } else {
                // Completó datos que faltaban (ej. el CUIT): se valida ahora; si ARCA
                // coincide se guarda la huella, si no, el modal se reabre precargado.
                datosClienteAvisadoRef.current = null;
                void padronCliente.revalidar();
              }
            }}
            onClose={() => setDatosClienteModalOpen(false)}
          />
        )}
    </>
  );
}

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useUser } from "@clerk/clerk-react";
import { Spinner } from "@/components/ui/Spinner";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import { ClienteModal } from "@/components/viajes/ClienteModal";
import { TransportistaModal } from "@/components/viajes/TransportistaModal";
import { ChoferModal } from "@/components/viajes/ChoferModal";
import { PaisModal } from "@/components/viajes/PaisModal";
import { apiJson } from "@/lib/api";
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import { MonedaSelect } from "@/components/forms/MonedaSelect";
import { PaisUbicacionSelect } from "@/components/forms/PaisUbicacionSelect";
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from "@/components/viajes/ViajeOperacionTipoFieldset";
import { ViajeFechaHoraFields } from "@/components/viajes/ViajeFechaHoraFields";
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from "@/components/viajes/ViajeVehiculosLista";
import {
  OtrosGastosFieldset,
  emptyOtroGasto,
  otroGastoAutorFromClerk,
  type OtroGastoDraft,
} from "@/components/viajes/OtrosGastosFieldset";
import {
  PagosTransportistaFieldset,
  emptyPagoTransportista,
  type PagoTransportistaDraft,
} from "@/components/viajes/PagosTransportistaFieldset";
import { PagosTransportistaSummary } from "@/components/viajes/PagosTransportistaSummary";
import { ViajeLiquidacionIndicador } from "@/components/viajes/ViajeLiquidacionIndicador";
import {
  preserveAmountOnMonedaChange,
  maskCurrencyForMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import type { PaisCodigo } from "@/lib/ciudades";
import {
  etapaMuestraKmLitros,
  etapaViajeLabel,
  liquidacionPermiteVincular,
  VIAJE_ETAPAS_TODAS,
  tooltipEtapaViaje,
} from "@/lib/viajesIndicadores";
import { viajePermiteBotonFacturar } from "@/lib/viajesComprobantes";
import {
  numeroFacturaVisibleViaje,
  numeroVisibleViaje,
  viajeUsaNumeroInterno,
  labelIdentificacionPersonalizadaViajes,
} from "@/lib/viajesFlota";
import {
  viajeRequierePagosTransportista,
  validarPagosTransportistaDraftForm,
  engrosarConIva,
} from "@/lib/viajesTransportistaPagos";
import type {
  Chofer,
  Cliente,
  Pais,
  Producto,
  Tenant,
  Transportista,
  Vehiculo,
  Viaje,
} from "@/types/api";
import type { OpcionProducto } from "@/lib/productosViaje";
import { ViajeProductosLista } from "@/components/viajes/ViajeProductosLista";
import { ViajeDestinosLista } from "@/components/viajes/ViajeDestinosLista";
import { ViajeGananciaBrutaManualFieldset } from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import type { ViajeDestinoRowDraft } from "@/lib/viajesDestinos";
import { useFieldConfig } from "@/hooks/useFieldConfig";

export type ViajeInlineDraft = {
  numero: string;
  numeroIdentificacionPersonalizado: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo | null;
  choferId: string;
  transportistaId: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  choferExternoId: string;
  paisOrigen: PaisCodigo;
  origen: string;
  destinosRows: ViajeDestinoRowDraft[];
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  productoItems: import("@/lib/productosViaje").ViajeProductoItem[];
  detalleCarga: string;
  observaciones: string;
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  cantidadFactura: string;
  precioUnitarioFactura: string;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
  precioTransportistaIvaIncluidoPct: string;
  cantidadTransportista: string;
  precioUnitarioTransportista: string;
  otrosGastos: OtroGastoDraft[];
  pagosTransportista: PagoTransportistaDraft[];
  gananciaBrutaManual: string;
  monedaGananciaBrutaManual: ViajeMonedaCodigo;
  realizaFlete: boolean;
  transportistaEfectivoId: string;
};

export type ViajeEditModalProps = {
  open: boolean;
  draft: ViajeInlineDraft;
  setDraft: Dispatch<SetStateAction<ViajeInlineDraft | null>>;
  /** Viaje del listado (estado / factura en servidor) para opciones de estado */
  snapshotViaje: Viaje;
  opcionesProducto: OpcionProducto[];
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
  choferesPropios: Chofer[];
  vehiculosPropios: Vehiculo[];
  onModoChange: (m: ViajeOperacionModo) => void;
  ayudaFlota: { chofer?: string; vehiculo?: string };
  viajeEditHint: string | null;
  fechaCargaError: string | null;
  fechaDescargaError: string | null;
  destinosError?: string | null;
  onClearDestinosError?: () => void;
  transportistaEfectivoError?: string | null;
  onClearTransportistaEfectivoError?: () => void;
  onDraftFechasPatch: (
    p: Partial<
      Pick<
        ViajeInlineDraft,
        "fechaCarga" | "horaCarga" | "fechaDescarga" | "horaDescarga"
      >
    >,
  ) => void;
  onClose: () => void;
  onSave: () => void;
  /** Misma acción que «Facturar» en el menú de acciones del listado (navegación / modal de facturas). */
  onFacturar?: () => void;
  /** Motivo para deshabilitar Facturar (ej. ARCA + USD). */
  facturarBloqueoMotivo?: string | null;
  onEliminar?: () => void;
  saving: boolean;
  error: string | null;
  /** Enlace «nuevo vehículo» en flota propia (p. ej. con `?tenantId=` para superadmin). */
  crearVehiculoHref?: string;
  getToken?: () => Promise<string | null>;
  tenantId?: string;
  /** Tenant activo, usado para el label personalizable del ID de viaje. */
  tenant?: Pick<Tenant, "labelIdentificacionPersonalizadaViajes"> | null;
  /**
   * Abre el modal de registrar pago (`RegistrarPagoTransportistaModal`, mantenido
   * por la página que hostea este modal). Si no se pasa, el resumen de solo lectura
   * de pagos (viaje con liquidación vigente) no muestra el botón "+ Registrar pago".
   */
  onRegistrarPago?: () => void;
  onProductoCreado?: (p: Producto) => void;
  onClienteCreado?: (c: Cliente) => void;
  onTransportistaCreado?: (t: Transportista) => void;
  onChoferCreado?: (c: Chofer) => void;
  onVehiculoCreado?: (v: Vehiculo) => void;
};

const labelClass =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";
const inputClass =
  "h-9 border border-black/15 bg-white px-2 text-sm disabled:cursor-not-allowed disabled:bg-vialto-mist/40 disabled:text-vialto-steel/80";

export function ViajeEditModal({
  open,
  draft,
  setDraft,
  snapshotViaje,
  opcionesProducto,
  clientes,
  choferes,
  transportistas,
  vehiculos,
  choferesPropios,
  vehiculosPropios,
  onModoChange,
  ayudaFlota,
  viajeEditHint,
  fechaCargaError,
  fechaDescargaError,
  destinosError,
  onClearDestinosError,
  transportistaEfectivoError,
  onClearTransportistaEfectivoError,
  onDraftFechasPatch,
  onClose,
  onSave,
  onFacturar,
  facturarBloqueoMotivo = null,
  onEliminar,
  saving,
  error,
  crearVehiculoHref = "/vehiculos/nuevo",
  getToken,
  tenantId,
  tenant,
  onRegistrarPago,
  onProductoCreado,
  onClienteCreado,
  onTransportistaCreado,
  onChoferCreado,
  onVehiculoCreado,
}: ViajeEditModalProps) {
  type QuickCreate =
    | "cliente"
    | "transportista"
    | "chofer-ext"
    | "chofer-prop"
    | "pais";
  const { user } = useUser();
  const { isVisible } = useFieldConfig("viajes");
  const desgloseActivo = isVisible("edicion_viaje", "desgloseMontos");
  const ivaTransportistaVisible = isVisible(
    "edicion_viaje",
    "precioTransportistaIvaIncluidoPct",
  );
  const gastoAutor = useMemo(() => otroGastoAutorFromClerk(user), [user]);
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null);
  const [localClientes, setLocalClientes] = useState<Cliente[]>([]);
  const [localTransportistas, setLocalTransportistas] = useState<
    Transportista[]
  >([]);
  const [localChoferes, setLocalChoferes] = useState<Chofer[]>([]);
  const [localVehiculos] = useState<Vehiculo[]>([]);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [sessionPaises, setSessionPaises] = useState<Pais[]>([]);
  const [paisesLoading, setPaisesLoading] = useState(true);
  /** Índice del destino que disparó "+ Nuevo país". */
  const [paisQuickCreateDestinoIndex, setPaisQuickCreateDestinoIndex] =
    useState<number | null>(null);

  const todosClientes = useMemo(() => {
    const ids = new Set(clientes.map((c) => c.id));
    return [...clientes, ...localClientes.filter((c) => !ids.has(c.id))];
  }, [clientes, localClientes]);

  const todosTransportistas = useMemo(() => {
    const ids = new Set(transportistas.map((t) => t.id));
    return [
      ...transportistas,
      ...localTransportistas.filter((t) => !ids.has(t.id)),
    ];
  }, [transportistas, localTransportistas]);

  const todosChoferes = useMemo(() => {
    const ids = new Set(choferes.map((c) => c.id));
    return [...choferes, ...localChoferes.filter((c) => !ids.has(c.id))];
  }, [choferes, localChoferes]);

  const todosChoferesPropios = useMemo(() => {
    const ids = new Set(choferesPropios.map((c) => c.id));
    return [
      ...choferesPropios,
      ...localChoferes.filter(
        (c) => !ids.has(c.id) && !c.transportistaId?.trim(),
      ),
    ];
  }, [choferesPropios, localChoferes]);

  const todosVehiculos = useMemo(() => {
    const ids = new Set(vehiculos.map((v) => v.id));
    return [...vehiculos, ...localVehiculos.filter((v) => !ids.has(v.id))];
  }, [vehiculos, localVehiculos]);

  const todosPaises = useMemo(() => {
    const ids = new Set(paises.map((p) => p.id));
    const combinados = [
      ...paises,
      ...sessionPaises.filter((p) => !ids.has(p.id)),
    ];
    return combinados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [paises, sessionPaises]);

  const datosComercialesBloqueados = useMemo(() => {
    if (!snapshotViaje) return false;
    const facturado =
      snapshotViaje.facturacionEstado === "facturado" ||
      snapshotViaje.facturacionEstado === "cobrado";

    // Cast a any por si liquidacionEstado no está tipado estrictamente en Viaje aún
    const liquidado =
      (snapshotViaje as any).liquidacionEstado === "liquidado" ||
      (snapshotViaje as any).liquidacionEstado === "pagado";

    return facturado || liquidado;
  }, [snapshotViaje]);

  // true si el viaje tiene una liquidación vigente (no disponible para vincular
  // una nueva). Se usa para: (1) bloquear "% de IVA que suma el transportista" — mismo
  // criterio que el backend en viajes.service.ts, para que un viaje ya facturado al
  // cliente pero todavía sin liquidar no quede con el % atascado en cuanto se emite esa
  // factura (eje independiente de la liquidación) — una vez liquidado, el % queda fijo
  // porque el "pago en efectivo" ya acordado con el transportista se calculó con ese
  // valor; y (2) reemplazar el fieldset editable de pagos por un resumen de solo lectura
  // con los montos reales de la Liquidación — editarlos ahí fallaría igual al guardar
  // (pagosTransportista está en CAMPOS_FISCALES_VIAJE) (ver "precioTransportistaExterno
  // con % de IVA a sumar en efectivo" en vialto-backend/CLAUDE.md). El % no afecta el
  // cálculo de la Liquidación en sí (que siempre usa el precio neto tal cual), pero se
  // bloquea igual una vez liquidado para
  // no desincronizar el "pago en efectivo" ya acordado con el transportista.
  const liquidacionVigente = useMemo(() => {
    if (!snapshotViaje) return false;
    return !liquidacionPermiteVincular(
      (snapshotViaje as any).liquidacionEstado ?? null,
    );
  }, [snapshotViaje]);

  // Desglose transportista: pago bruto (cantidad × precio unitario, tal cual se carga —
  // siempre sin IVA), pago neto (bruto "engrosado" sumándole el % de IVA — cuánto se le
  // paga en efectivo al transportista) y el monto de IVA — usados en el resumen de
  // "Pago bruto a transporte / Pago neto / Monto IVA" más abajo.
  const desglosePagoBruto =
    (Number(draft.cantidadTransportista.replace(",", ".")) || 0) *
    (parseCurrencyForMoneda(
      draft.precioUnitarioTransportista,
      draft.monedaPrecioTransportistaExterno,
    ) || 0);
  const desglosePctIva =
    Number(draft.precioTransportistaIvaIncluidoPct.replace(",", ".")) || 0;
  const desglosePagoNeto = engrosarConIva(desglosePagoBruto, desglosePctIva);
  const desgloseMontoIva = desglosePagoNeto - desglosePagoBruto;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/paises?tenantId=${encodeURIComponent(tenantId)}`
          : "/api/paises";
        const data = await apiJson<Pais[]>(
          path,
          () => getToken?.() ?? Promise.resolve(null),
        );
        if (!cancelled) setPaises(data);
      } catch {
        if (!cancelled) setPaises([]);
      } finally {
        if (!cancelled) setPaisesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, getToken]);

  useEffect(() => {
    if (!open || !draft || !desgloseActivo) return;
    setDraft((p) => {
      if (!p) return p;
      let changed = false;
      const next = { ...p };
      if (
        snapshotViaje.cantidadFactura == null &&
        next.cantidadFactura === ""
      ) {
        next.cantidadFactura = "1";
        next.precioUnitarioFactura = next.monto;
        changed = true;
      }
      if (
        snapshotViaje.cantidadTransportista == null &&
        next.cantidadTransportista === ""
      ) {
        next.cantidadTransportista = "1";
        next.precioUnitarioTransportista = next.precioTransportistaExterno;
        changed = true;
      }
      return changed ? next : p;
    });
  }, [open, draft?.numero, desgloseActivo, snapshotViaje, setDraft]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const muestraBotonFacturar =
    typeof onFacturar === "function" &&
    viajePermiteBotonFacturar({
      ...snapshotViaje,
      etapa: draft.estado,
      transportistaId:
        draft.operacionModo === "externo"
          ? draft.transportistaId
          : snapshotViaje.transportistaId,
    });
  const facturarDeshabilitado =
    saving || !draft.clienteId.trim() || Boolean(facturarBloqueoMotivo);

  const muestraPagosTransportista = viajeRequierePagosTransportista({
    transportistaId:
      draft.operacionModo === "externo" ? draft.transportistaId : "",
  });

  const pagosSaldoContext = useMemo(() => {
    if (!muestraPagosTransportista) return null;
    return {
      transportistaId: draft.transportistaId,
      precioTransportistaExterno: draft.precioTransportistaExterno,
      monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
    };
  }, [
    muestraPagosTransportista,
    draft.transportistaId,
    draft.precioTransportistaExterno,
    draft.monedaPrecioTransportistaExterno,
  ]);

  const pagosSaldoError = useMemo(
    () =>
      pagosSaldoContext
        ? validarPagosTransportistaDraftForm({
            ...pagosSaldoContext,
            pagosTransportista: draft.pagosTransportista,
          })
        : null,
    [pagosSaldoContext, draft.pagosTransportista],
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Cerrar edición"
          disabled={saving}
          onClick={() => {
            if (!saving) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="viaje-edit-modal-title"
          className="relative flex h-full max-h-[100dvh] w-full max-w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2
                id="viaje-edit-modal-title"
                className="truncate text-base font-semibold text-vialto-charcoal"
              >
                Editar viaje {numeroVisibleViaje(draft)}
              </h2>
              <p className="mt-1 text-xs text-vialto-steel">
                {viajeUsaNumeroInterno(draft)
                  ? "Número interno generado automáticamente por el sistema. "
                  : ""}
                Modificá los datos del viaje. Los cambios se aplican al guardar.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {datosComercialesBloqueados && (
              <div className="mb-4 flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <strong className="font-semibold">
                  Campos comerciales bloqueados
                </strong>
                <p className="text-xs leading-relaxed">
                  Este viaje tiene un comprobante emitido (factura o
                  liquidación). Los campos de cliente, transportista y montos
                  están bloqueados para evitar discrepancias. Si necesitás
                  modificarlos, primero deberás anular el comprobante.
                </p>
              </div>
            )}

            <div className="mb-4 flex flex-col gap-1.5 rounded border-2 border-vialto-fire/60 bg-vialto-mist/50 p-3">
              <span className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.08em] text-vialto-charcoal">
                {labelIdentificacionPersonalizadaViajes(tenant)}
              </span>
              <input
                type="text"
                value={draft.numeroIdentificacionPersonalizado}
                onChange={(e) =>
                  setDraft((p) =>
                    p
                      ? {
                          ...p,
                          numeroIdentificacionPersonalizado: e.target.value,
                        }
                      : p,
                  )
                }
                placeholder="Ej: número de CTG"
                className="h-11 w-full border border-black/15 bg-white px-3 text-base font-medium text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/40"
              />
              <p className="text-xs text-vialto-steel">
                Si lo cargás, este número se usa para identificar el viaje en
                toda la app en vez del número interno del sistema.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                <span className={labelClass}>Etapa</span>
                <select
                  value={draft.estado}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, estado: e.target.value } : prev,
                    )
                  }
                  className={inputClass}
                >
                  {VIAJE_ETAPAS_TODAS.map((x) => (
                    <option key={x} value={x} title={tooltipEtapaViaje(x)}>
                      {etapaViajeLabel[x] ?? x}
                    </option>
                  ))}
                </select>
                {(snapshotViaje.facturacionEstado === "facturado" ||
                  snapshotViaje.facturacionEstado === "cobrado") && (
                  <span className="text-[10px] font-normal font-[family-name:var(--font-ui)] text-vialto-steel/75 tracking-wide">
                    Factura: {numeroFacturaVisibleViaje(snapshotViaje) || "—"}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                <span className={labelClass}>Origen</span>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                  <PaisUbicacionSelect
                    value={draft.paisOrigen}
                    onChange={(p) =>
                      setDraft((prev) =>
                        prev ? { ...prev, paisOrigen: p, origen: "" } : prev,
                      )
                    }
                    aria-label="País de origen"
                    className={`${inputClass} w-full sm:w-40`}
                  />
                  <CiudadCombobox
                    pais={draft.paisOrigen}
                    value={draft.origen}
                    onChange={(next) =>
                      setDraft((prev) =>
                        prev ? { ...prev, origen: next } : prev,
                      )
                    }
                    inputClassName={`${inputClass} w-full`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                <ViajeDestinosLista
                  groupId={`viaje-edit-${draft.numero || "e"}`}
                  rows={draft.destinosRows}
                  onChange={(destinosRows) => {
                    setDraft((prev) =>
                      prev ? { ...prev, destinosRows } : prev,
                    );
                    if (destinosRows[0]?.etiqueta.trim())
                      onClearDestinosError?.();
                  }}
                  inputClassName={inputClass}
                  paises={todosPaises}
                  paisesLoading={paisesLoading}
                  onNuevoPais={(index) => {
                    setPaisQuickCreateDestinoIndex(index);
                    setQuickCreate("pais");
                  }}
                />
                <CrudFieldError message={destinosError} />
              </div>

              <div className="flex flex-col gap-1">
                <span className={labelClass}>Cliente</span>
                <ClienteSearchSelect
                  clientes={todosClientes}
                  value={draft.clienteId}
                  onChange={(id) =>
                    setDraft((p) => (p ? { ...p, clienteId: id } : p))
                  }
                  inputClassName={inputClass}
                  aria-label="Cliente"
                  disabled={datosComercialesBloqueados || saving}
                  onNuevo={
                    getToken && !datosComercialesBloqueados
                      ? () => setQuickCreate("cliente")
                      : undefined
                  }
                />
              </div>

              {desgloseActivo ? (
                <>
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Cantidad</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={datosComercialesBloqueados}
                      value={draft.cantidadFactura}
                      onChange={(e) =>
                        setDraft((p) =>
                          p ? { ...p, cantidadFactura: e.target.value } : p,
                        )
                      }
                      placeholder="0.00"
                      className={`${inputClass} text-right tabular-nums`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Precio unitario</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={datosComercialesBloqueados}
                        value={draft.precioUnitarioFactura}
                        onChange={(e) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  precioUnitarioFactura: maskCurrencyForMoneda(
                                    e.target.value,
                                    p.monedaMonto,
                                  ),
                                }
                              : p,
                          )
                        }
                        placeholder="0.00"
                        className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                      />
                      <MonedaSelect
                        value={draft.monedaMonto}
                        disabled={datosComercialesBloqueados}
                        onChange={(m) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  monedaMonto: m,
                                  precioUnitarioFactura:
                                    preserveAmountOnMonedaChange(
                                      p.precioUnitarioFactura,
                                      p.monedaMonto,
                                      m,
                                    ),
                                }
                              : p,
                          )
                        }
                        aria-label="Moneda precio unitario"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Total a facturar</span>
                    <div
                      className={`flex items-center px-3 h-9 rounded-none border border-black/15 bg-vialto-mist/40 text-vialto-steel text-right tabular-nums min-w-0`}
                    >
                      <span className="w-full truncate text-sm">
                        {(
                          (Number(draft.cantidadFactura.replace(",", ".")) ||
                            0) *
                          (parseCurrencyForMoneda(
                            draft.precioUnitarioFactura,
                            draft.monedaMonto,
                          ) || 0)
                        ).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className={labelClass}>Monto a facturar</span>
                  <div className="flex min-w-0 gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={datosComercialesBloqueados}
                      value={draft.monto}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                monto: maskCurrencyForMoneda(
                                  e.target.value,
                                  p.monedaMonto,
                                ),
                              }
                            : p,
                        )
                      }
                      placeholder="0.00"
                      className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                    />
                    <MonedaSelect
                      value={draft.monedaMonto}
                      disabled={datosComercialesBloqueados}
                      onChange={(m: ViajeMonedaCodigo) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                monedaMonto: m,
                                monto: preserveAmountOnMonedaChange(
                                  p.monto,
                                  p.monedaMonto,
                                  m,
                                ),
                              }
                            : p,
                        )
                      }
                      aria-label="Moneda monto a facturar"
                    />
                  </div>
                </div>
              )}

              <ViajeOperacionTipoFieldset
                modo={draft.operacionModo}
                onModoChange={onModoChange}
                groupName={`viaje-edit-${draft.numero || "e"}`}
                externoContent={
                  <div className="grid gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>
                        Transportista externo
                      </span>
                      <TransportistaSearchSelect
                        transportistas={todosTransportistas}
                        value={draft.transportistaId}
                        onChange={(id) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  transportistaId: id,
                                  transportistaEfectivoId:
                                    p.transportistaEfectivoId === id
                                      ? ""
                                      : p.transportistaEfectivoId,
                                }
                              : p,
                          )
                        }
                        inputClassName={inputClass}
                        disabled={datosComercialesBloqueados || saving}
                        aria-label="Transportista externo"
                        onNuevo={
                          getToken && !datosComercialesBloqueados
                            ? () => setQuickCreate("transportista")
                            : undefined
                        }
                      />
                    </div>
                    {desgloseActivo ? (
                      <>
                        <div
                          className={`grid grid-cols-1 gap-3 ${ivaTransportistaVisible ? "sm:grid-cols-[0.6fr_1.4fr_1fr]" : "sm:grid-cols-[0.6fr_1.4fr]"}`}
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={labelClass}>Cantidad</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={datosComercialesBloqueados}
                              value={draft.cantidadTransportista}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        cantidadTransportista: e.target.value,
                                      }
                                    : p,
                                )
                              }
                              placeholder="0.00"
                              className={`${inputClass} text-right tabular-nums`}
                            />
                          </div>
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={labelClass}>Precio unitario</span>
                            <div className="flex min-w-0 gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={datosComercialesBloqueados}
                                value={draft.precioUnitarioTransportista}
                                onChange={(e) =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          precioUnitarioTransportista:
                                            maskCurrencyForMoneda(
                                              e.target.value,
                                              p.monedaPrecioTransportistaExterno,
                                            ),
                                        }
                                      : p,
                                  )
                                }
                                placeholder="0.00"
                                className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                              />
                              <MonedaSelect
                                value={draft.monedaPrecioTransportistaExterno}
                                disabled={datosComercialesBloqueados}
                                onChange={(m) =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          monedaPrecioTransportistaExterno: m,
                                          precioUnitarioTransportista:
                                            preserveAmountOnMonedaChange(
                                              p.precioUnitarioTransportista,
                                              p.monedaPrecioTransportistaExterno,
                                              m,
                                            ),
                                        }
                                      : p,
                                  )
                                }
                                aria-label="Moneda precio unitario transportista"
                              />
                            </div>
                          </div>
                          {ivaTransportistaVisible && (
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={labelClass}>% de IVA</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={liquidacionVigente}
                                value={draft.precioTransportistaIvaIncluidoPct}
                                onChange={(e) =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          precioTransportistaIvaIncluidoPct:
                                            e.target.value,
                                        }
                                      : p,
                                  )
                                }
                                placeholder="0"
                                className={`${inputClass} text-right tabular-nums`}
                              />
                              <p className="text-xs text-vialto-steel">
                                Dejalo en 0 si el transportista no suma IVA al cobrar.
                              </p>
                            </div>
                          )}
                        </div>
                        {ivaTransportistaVisible && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={labelClass}>Pago bruto</span>
                              <div
                                className={`flex items-center px-3 h-9 rounded-none border border-black/15 bg-vialto-mist/40 text-vialto-steel text-right tabular-nums min-w-0`}
                              >
                                <span className="w-full truncate text-sm">
                                  {desglosePagoBruto.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={labelClass}>Pago neto</span>
                              <div
                                className={`flex items-center px-3 h-9 rounded-none border border-black/15 bg-vialto-mist/40 text-vialto-steel text-right tabular-nums min-w-0`}
                              >
                                <span className="w-full truncate text-sm">
                                  {desglosePagoNeto.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={labelClass}>Monto IVA</span>
                              <div
                                className={`flex items-center px-3 h-9 rounded-none border border-black/15 bg-vialto-mist/40 text-vialto-steel text-right tabular-nums min-w-0`}
                              >
                                <span className="w-full truncate text-sm">
                                  {desgloseMontoIva.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className={labelClass}>Precio transporte</span>
                          <div className="flex min-w-0 gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={datosComercialesBloqueados}
                              value={draft.precioTransportistaExterno}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        precioTransportistaExterno:
                                          maskCurrencyForMoneda(
                                            e.target.value,
                                            p.monedaPrecioTransportistaExterno,
                                          ),
                                      }
                                    : p,
                                )
                              }
                              placeholder="0.00"
                              className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                            />
                            <MonedaSelect
                              value={draft.monedaPrecioTransportistaExterno}
                              disabled={datosComercialesBloqueados}
                              onChange={(m: ViajeMonedaCodigo) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        monedaPrecioTransportistaExterno: m,
                                        precioTransportistaExterno:
                                          preserveAmountOnMonedaChange(
                                            p.precioTransportistaExterno,
                                            p.monedaPrecioTransportistaExterno,
                                            m,
                                          ),
                                      }
                                    : p,
                                )
                              }
                              aria-label="Moneda precio transportista externo"
                            />
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className={labelClass}>
                            % de IVA
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={liquidacionVigente}
                            value={draft.precioTransportistaIvaIncluidoPct}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      precioTransportistaIvaIncluidoPct:
                                        e.target.value,
                                    }
                                  : p,
                              )
                            }
                            placeholder="0"
                            className={`${inputClass} text-right tabular-nums`}
                          />
                          <p className="text-xs text-vialto-steel">
                            Dejalo en 0 si el transportista no suma IVA al cobrar.
                          </p>
                        </div>
                      </div>
                    )}
                    {draft.transportistaId && (
                      <div className="flex flex-col gap-2 rounded border border-black/10 bg-vialto-mist/40 px-3 py-3">
                        <span className={labelClass}>
                          ¿El transportista seleccionado realiza el flete?
                        </span>
                        <div className="flex gap-5">
                          <label
                            className={`flex items-center gap-2 text-sm ${datosComercialesBloqueados ? "cursor-not-allowed text-vialto-steel/70" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              disabled={datosComercialesBloqueados}
                              name={`realiza-flete-edit-${draft.numero || "e"}`}
                              checked={draft.realizaFlete}
                              onChange={() => {
                                onClearTransportistaEfectivoError?.();
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        realizaFlete: true,
                                        transportistaEfectivoId: "",
                                      }
                                    : p,
                                );
                              }}
                              className="accent-vialto-charcoal disabled:opacity-60"
                            />
                            Sí
                          </label>
                          <label
                            className={`flex items-center gap-2 text-sm ${datosComercialesBloqueados ? "cursor-not-allowed text-vialto-steel/70" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              disabled={datosComercialesBloqueados}
                              name={`realiza-flete-edit-${draft.numero || "e"}`}
                              checked={!draft.realizaFlete}
                              onChange={() => {
                                onClearTransportistaEfectivoError?.();
                                setDraft((p) =>
                                  p ? { ...p, realizaFlete: false } : p,
                                );
                              }}
                              className="accent-vialto-charcoal disabled:opacity-60"
                            />
                            No
                          </label>
                        </div>
                        {!draft.realizaFlete && (
                          <div className="flex min-w-0 flex-col gap-1 mt-1">
                            <span className={labelClass}>
                              Transportista que realiza el flete{" "}
                              <span className="text-red-500">*</span>
                            </span>
                            <TransportistaSearchSelect
                              transportistas={todosTransportistas.filter(
                                (t) => t.id !== draft.transportistaId,
                              )}
                              value={draft.transportistaEfectivoId}
                              onChange={(id) => {
                                onClearTransportistaEfectivoError?.();
                                setDraft((p) =>
                                  p ? { ...p, transportistaEfectivoId: id } : p,
                                );
                              }}
                              disabled={datosComercialesBloqueados || saving}
                              inputClassName={`${inputClass}${
                                transportistaEfectivoError
                                  ? " border-red-400"
                                  : ""
                              }`}
                              aria-label="Transportista que realiza el flete"
                              onNuevo={
                                getToken && !datosComercialesBloqueados
                                  ? () => setQuickCreate("transportista")
                                  : undefined
                              }
                            />
                            {transportistaEfectivoError && (
                              <span className="text-xs text-red-600">
                                {transportistaEfectivoError}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid gap-3">
                      <div className="flex min-w-0 flex-col gap-1 max-w-md">
                        <span className={labelClass}>Chofer</span>
                        <ChoferSearchSelect
                          choferes={todosChoferes}
                          value={draft.choferExternoId}
                          onChange={(id) =>
                            setDraft((p) =>
                              p ? { ...p, choferExternoId: id } : p,
                            )
                          }
                          inputClassName={inputClass}
                          aria-label="Chofer transportista externo"
                          onNuevo={
                            getToken
                              ? () => setQuickCreate("chofer-ext")
                              : undefined
                          }
                        />
                      </div>
                      <ViajeVehiculosLista
                        groupId={`viaje-modal-ext-${draft.numero || "e"}`}
                        crearVehiculoHref={crearVehiculoHref}
                        rows={draft.vehiculosRows}
                        onChange={(rows) =>
                          setDraft((p) =>
                            p ? { ...p, vehiculosRows: rows } : p,
                          )
                        }
                        vehiculos={todosVehiculos}
                        alMenosUno={false}
                        getToken={getToken}
                        tenantId={tenantId}
                        onVehiculoCreado={onVehiculoCreado}
                        quickCreateStacked
                      />
                    </div>
                  </div>
                }
                propioContent={
                  <div className="grid gap-3">
                    <div className="flex min-w-0 flex-col gap-1 max-w-md">
                      <span className={labelClass}>Chofer (flota propia)</span>
                      <ChoferSearchSelect
                        choferes={todosChoferesPropios}
                        value={draft.choferId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, choferId: id } : p))
                        }
                        inputClassName={inputClass}
                        aria-label="Chofer flota propia"
                        onNuevo={
                          getToken
                            ? () => setQuickCreate("chofer-prop")
                            : undefined
                        }
                      />
                      {ayudaFlota.chofer && (
                        <p className="text-xs text-amber-800/90">
                          {ayudaFlota.chofer}
                        </p>
                      )}
                    </div>
                    <ViajeVehiculosLista
                      groupId={`viaje-modal-${draft.numero || "e"}`}
                      crearVehiculoHref={crearVehiculoHref}
                      rows={draft.vehiculosRows}
                      onChange={(rows) =>
                        setDraft((p) => (p ? { ...p, vehiculosRows: rows } : p))
                      }
                      vehiculos={vehiculosPropios}
                      getToken={getToken}
                      tenantId={tenantId}
                      onVehiculoCreado={onVehiculoCreado}
                      quickCreateStacked
                    />
                    {ayudaFlota.vehiculo && (
                      <p className="text-xs text-amber-800/90">
                        {ayudaFlota.vehiculo}
                      </p>
                    )}
                    {viajeEditHint && (
                      <p className="text-xs text-amber-800/90">
                        {viajeEditHint}
                      </p>
                    )}
                  </div>
                }
              />

              {isVisible("edicion_viaje", "gananciaBrutaManual") && (
                <ViajeGananciaBrutaManualFieldset
                  draft={draft}
                  onPatch={(p) =>
                    setDraft((prev) => (prev ? { ...prev, ...p } : prev))
                  }
                  labelClassName={labelClass}
                  inputClassName={inputClass}
                  disabled={datosComercialesBloqueados}
                />
              )}

              <ViajeFechaHoraFields
                fechaCarga={draft.fechaCarga}
                horaCarga={draft.horaCarga}
                fechaDescarga={draft.fechaDescarga}
                horaDescarga={draft.horaDescarga}
                onPatch={onDraftFechasPatch}
                labelClassName={labelClass}
                inputClassName={inputClass}
                errorFechaCarga={fechaCargaError}
                errorFechaDescarga={fechaDescargaError}
              />

              {etapaMuestraKmLitros(draft.estado) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                  {isVisible("edicion_viaje", "kmRecorridos") && (
                    <div className="flex flex-col gap-1">
                      <span className={labelClass}>Km recorridos</span>
                      <input
                        type="number"
                        value={draft.kmRecorridos}
                        onChange={(e) =>
                          setDraft((p) =>
                            p ? { ...p, kmRecorridos: e.target.value } : p,
                          )
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {isVisible("edicion_viaje", "litrosConsumidos") && (
                    <div className="flex flex-col gap-1">
                      <span className={labelClass}>Litros consumidos</span>
                      <input
                        type="number"
                        value={draft.litrosConsumidos}
                        onChange={(e) =>
                          setDraft((p) =>
                            p ? { ...p, litrosConsumidos: e.target.value } : p,
                          )
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}

              {isVisible("edicion_viaje", "productoItems") && (
                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                  <span className={labelClass}>Productos</span>
                  <ViajeProductosLista
                    groupId="viaje-edit"
                    value={draft.productoItems}
                    onChange={(items) =>
                      setDraft((p) => (p ? { ...p, productoItems: items } : p))
                    }
                    opciones={opcionesProducto}
                    triggerClassName={inputClass}
                    inputClassName={inputClass}
                    disabled={saving}
                    getToken={getToken}
                    onProductoCreado={onProductoCreado}
                  />
                </div>
              )}

              {isVisible("edicion_viaje", "detalleCarga") && (
                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                  <span className={labelClass}>Detalle adicional</span>
                  <textarea
                    value={draft.detalleCarga}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, detalleCarga: e.target.value } : p,
                      )
                    }
                    placeholder="Notas extra: bultos, temperatura, precinto, etc."
                    className="min-h-24 border border-black/15 bg-white px-2 py-2 text-sm"
                  />
                </div>
              )}

              {isVisible("edicion_viaje", "observaciones") && (
                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                  <span className={labelClass}>Observaciones</span>
                  <textarea
                    value={draft.observaciones}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, observaciones: e.target.value } : p,
                      )
                    }
                    placeholder="Notas adicionales"
                    className="min-h-24 border border-black/15 bg-white px-2 py-2 text-sm"
                  />
                </div>
              )}

              {isVisible("edicion_viaje", "otrosGastos") && (
                <div className="md:col-span-2 lg:col-span-3">
                  <OtrosGastosFieldset
                    rows={draft.otrosGastos}
                    onChange={(rows) =>
                      setDraft((p) => (p ? { ...p, otrosGastos: rows } : p))
                    }
                    tenantId={tenantId}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) =>
                        p
                          ? {
                              ...p,
                              otrosGastos: [
                                ...p.otrosGastos,
                                emptyOtroGasto(gastoAutor),
                              ],
                            }
                          : p,
                      )
                    }
                    className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
                  >
                    + Agregar gasto
                  </button>
                </div>
              )}

              {muestraPagosTransportista &&
                isVisible("edicion_viaje", "pagosTransportista") &&
                (liquidacionVigente && snapshotViaje ? (
                  // Viaje con liquidación vigente: el fieldset editable de abajo no
                  // sirve acá — pagosTransportista está en CAMPOS_FISCALES_VIAJE, así
                  // que guardar filas nuevas fallaría igual, y su "Acordado" ignora la
                  // comisión/IVA reales de la Liquidación (ver comentario de
                  // `liquidacionVigente` más arriba). Mostramos el resumen real +
                  // acceso directo a la Liquidación en vez del fieldset.
                  <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={labelClass}>Liquidación vinculada</span>
                      <ViajeLiquidacionIndicador
                        viaje={snapshotViaje}
                        tenantId={tenantId}
                      />
                    </div>
                    <PagosTransportistaSummary
                      viaje={snapshotViaje}
                      onRegistrarPago={onRegistrarPago}
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2 lg:col-span-3">
                    <PagosTransportistaFieldset
                      rows={draft.pagosTransportista}
                      onChange={(rows) =>
                        setDraft((p) =>
                          p ? { ...p, pagosTransportista: rows } : p,
                        )
                      }
                      saldoContext={pagosSaldoContext}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                pagosTransportista: [
                                  ...p.pagosTransportista,
                                  emptyPagoTransportista(
                                    p.monedaPrecioTransportistaExterno,
                                  ),
                                ],
                              }
                            : p,
                        )
                      }
                      className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      + Agregar pago al transportista
                    </button>
                  </div>
                ))}
            </div>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {muestraBotonFacturar ? (
                <button
                  type="button"
                  onClick={onFacturar}
                  disabled={facturarDeshabilitado}
                  title={
                    facturarBloqueoMotivo
                      ? facturarBloqueoMotivo
                      : !draft.clienteId.trim()
                        ? "Elegí un cliente para poder facturar este viaje"
                        : undefined
                  }
                  className="inline-flex h-10 items-center px-5 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Facturar
                </button>
              ) : null}
              {onEliminar ? (
                <button
                  type="button"
                  onClick={onEliminar}
                  disabled={saving}
                  className="inline-flex h-10 items-center px-4 text-xs uppercase tracking-wider border border-red-300 bg-white text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  Eliminar viaje
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !!pagosSaldoError}
                title={pagosSaldoError ?? undefined}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
              >
                {saving && <Spinner className="h-3.5 w-3.5" />}
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {quickCreate === "pais" && getToken && (
        <PaisModal
          stacked
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => {
            setQuickCreate(null);
            setPaisQuickCreateDestinoIndex(null);
          }}
          onSaved={(p) => {
            setSessionPaises((prev) => [...prev, p]);
            const codigo = p.codigo || p.id;
            const idx = paisQuickCreateDestinoIndex;
            if (idx !== null) {
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      destinosRows: prev.destinosRows.map((r, i) =>
                        i === idx ? { ...r, pais: codigo, etiqueta: "" } : r,
                      ),
                    }
                  : prev,
              );
            }
            setQuickCreate(null);
            setPaisQuickCreateDestinoIndex(null);
          }}
        />
      )}
      {quickCreate === "cliente" && getToken && (
        <ClienteModal
          stacked
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setQuickCreate(null)}
          onSaved={(c) => {
            setLocalClientes((prev) => [...prev, c]);
            onClienteCreado?.(c);
            setDraft((p) => (p ? { ...p, clienteId: c.id } : p));
            setQuickCreate(null);
          }}
        />
      )}
      {quickCreate === "transportista" && getToken && (
        <TransportistaModal
          stacked
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setQuickCreate(null)}
          onSaved={(t) => {
            setLocalTransportistas((prev) => [...prev, t]);
            onTransportistaCreado?.(t);
            setDraft((p) => (p ? { ...p, transportistaId: t.id } : p));
            setQuickCreate(null);
          }}
        />
      )}
      {(quickCreate === "chofer-ext" || quickCreate === "chofer-prop") &&
        getToken && (
          <ChoferModal
            stacked
            getToken={getToken}
            tenantId={tenantId}
            onClose={() => setQuickCreate(null)}
            onSaved={(c) => {
              setLocalChoferes((prev) => [...prev, c]);
              onChoferCreado?.(c);
              if (quickCreate === "chofer-ext") {
                setDraft((p) => (p ? { ...p, choferExternoId: c.id } : p));
              } else {
                setDraft((p) => (p ? { ...p, choferId: c.id } : p));
              }
              setQuickCreate(null);
            }}
          />
        )}
    </>
  );
}

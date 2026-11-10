import { DireccionesSugeridasProvider } from "@/hooks/useDireccionesSugeridas";
import { useTransportistaLabels } from "@/hooks/useTransportistaLabels";
import { labelTransporteViaje, transportistaEnFrase } from "@/lib/transportistaLabel";
import { resolverPaisFijoViaje } from "@/lib/paisFijoViaje";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useUser } from "@clerk/clerk-react";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
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
  etapaViajeLabel,
  liquidacionPermiteVincular,
  VIAJE_ETAPAS_TODAS,
  tooltipEtapaViaje,
} from "@/lib/viajesIndicadores";
import {
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
} from "@/lib/viajesComprobantes";
import {
  numeroFacturaVisibleViaje,
  numeroVisibleViaje,
  labelIdentificacionPersonalizadaViajes,
  idSistemaHabilitado,
  idPropio1Habilitado,
  idPropio2Habilitado,
  idPropio2Label,
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
import {
  textoRutaViaje,
  destinosConPaisFijo,
  type ViajeDestinoRowDraft,
} from "@/lib/viajesDestinos";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { useTipoFlotaVisible } from "@/hooks/useTipoFlotaVisible";
import {
  ViajeClientesFieldset,
  ClienteCard,
} from "@/components/viajes/ViajeClientesFieldset";
import {
  emptyClienteRow,
  conPaisFijo,
  faltantesClienteRow,
  faltantesPorFila,
  type ViajeClienteDraft,
} from "@/lib/viajesClientes";
import { conBordeError } from "@/lib/bordeError";
import { FaltaCampo } from "@/components/shared/FaltaCampo";

/** A qué campo aplicar el país recién creado desde "+ Nuevo país". */
type PaisQuickCreateTarget =
  | { kind: "origen" }
  | { kind: "destino"; index: number }
  | { kind: "origen-cliente"; clienteIndex: number }
  | { kind: "destino-cliente"; clienteIndex: number; destinoIndex: number };

export type ViajeInlineDraft = {
  numero: string;
  numeroIdentificacionPersonalizado: string;
  idPropio2: string;
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
  clientesRows: ViajeClienteDraft[];
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
  choferesExterno: Chofer[];
  vehiculosPropios: Vehiculo[];
  onModoChange: (m: ViajeOperacionModo) => void;
  ayudaFlota: { chofer?: string; vehiculo?: string };
  viajeEditHint: string | null;
  fechaCargaError: string | null;
  fechaDescargaError: string | null;
  destinosError?: string | null;
  onClearDestinosError?: () => void;
  clientesRowErrors?: Record<number, string>;
  onClearClientesRowErrors?: () => void;
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
  /** Misma acción que «Facturar» en el menú de acciones del listado (factura al cliente). */
  onFacturar?: () => void;
  /** Motivo para deshabilitar Facturar (ej. ARCA + USD). */
  facturarBloqueoMotivo?: string | null;
  /** Misma acción que «Liquidar» en el menú de acciones del listado (liquidación al transportista). */
  onLiquidar?: () => void;
  /** Motivo para deshabilitar Liquidar (ej. ARCA + USD). */
  liquidarBloqueoMotivo?: string | null;
  /** Solo si el viaje tiene una factura en borrador: lleva a emitirla en vez de crear otra. */
  onContinuarFactura?: () => void;
  /** Solo si el viaje tiene una liquidación en borrador. */
  onContinuarLiquidacion?: () => void;
  onEliminar?: () => void;
  saving: boolean;
  error: string | null;
  /** Enlace «nuevo vehículo» en flota propia (p. ej. con `?tenantId=` para superadmin). */
  crearVehiculoHref?: string;
  getToken?: () => Promise<string | null>;
  tenantId?: string;
  /** Tenant activo, usado para el label personalizable del ID de viaje y el país fijo de origen/destino. */
  tenant?: Pick<
    Tenant,
    | "labelIdentificacionPersonalizadaViajes"
    | "paisOrigenDestinoOculto"
    | "paisOrigenDestinoFijoId"
    | "paisOrigenDestinoFijoCodigo"
    | "paisOrigenDestinoFijoNombre"
    | "idSistemaHabilitado"
    | "idPropio1Habilitado"
    | "idPropio2Habilitado"
    | "idPropio2Label"
    | "recomendacionCiudadesHabilitada"
  > | null;
  /** Tenant con emision-liquido-producto-arca: habilita los campos ARCA en el detalle de la liquidación vinculada. */
  hasLiquidoProductoArca?: boolean;
  hasFacturasArca?: boolean;
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
  transportistas,
  vehiculos,
  choferesPropios,
  choferesExterno,
  vehiculosPropios,
  onModoChange,
  ayudaFlota,
  viajeEditHint,
  fechaCargaError,
  fechaDescargaError,
  destinosError,
  onClearDestinosError,
  clientesRowErrors,
  onClearClientesRowErrors,
  transportistaEfectivoError,
  onClearTransportistaEfectivoError,
  onDraftFechasPatch,
  onClose,
  onSave,
  onLiquidar,
  liquidarBloqueoMotivo = null,
  onContinuarFactura,
  onContinuarLiquidacion,
  onEliminar,
  saving,
  error,
  crearVehiculoHref = "/vehiculos/nuevo",
  getToken,
  tenantId,
  tenant,
  hasLiquidoProductoArca = false,
  hasFacturasArca = false,
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
  // Errores de validación de los campos (sus inputs quedan con borde rojo): el texto va al pie.
  const erroresPie = useMemo(
    () => ({
      fechaCarga: fechaCargaError,
      fechaDescarga: fechaDescargaError,
      destinos: destinosError,
      transportistaEfectivo: transportistaEfectivoError,
      ...Object.fromEntries(
        Object.entries(clientesRowErrors ?? {}).map(([i, msg]) => [
          `cliente${i}`,
          `Cliente ${Number(i) + 1}: ${msg}`,
        ]),
      ),
    }),
    [fechaCargaError, fechaDescargaError, destinosError, transportistaEfectivoError, clientesRowErrors],
  );
  const { isVisible } = useFieldConfig("viajes");
  // Nombre que la empresa le da al transportista (superadmin).
  const tl = useTransportistaLabels(tenantId || undefined);
  const lblTransporte = labelTransporteViaje(tl);
  const transpFrase = transportistaEnFrase(tl.singular);
  const { flotaPropiaVisible, transportistaExternoVisible } =
    useTipoFlotaVisible(tenantId || undefined);
  const desgloseActivo = isVisible("edicion_viaje", "desgloseMontos");

  // ── Obligatorios que faltan (mismo estándar que el alta de viaje) ──────
  // Se calculan siempre desde el draft; se marcan en rojo recién después de un
  // intento fallido (Guardar / + Agregar cliente) y se apagan al completarse.
  const [marcarFaltantes, setMarcarFaltantes] = useState(false);
  const [avisoFaltantes, setAvisoFaltantesEstado] = useState<string | null>(null);
  /** Aviso del pie que zumba en cada intento (vacía y vuelve a poner el mensaje). */
  function avisarFaltantes(msg = "Completá los campos marcados en rojo.") {
    setMarcarFaltantes(true);
    setAvisoFaltantesEstado(null);
    requestAnimationFrame(() => setAvisoFaltantesEstado(msg));
  }
  const opcionesFaltantes = { completo: true, desglose: desgloseActivo, principales: 0 };
  // Cliente principal: mismas reglas que la 1ª tarjeta del alta (cliente, origen,
  // destino y cobro), sobre los campos del draft del viaje.
  const faltaPrincipal = draft
    ? faltantesClienteRow(
        {
          clienteId: draft.clienteId,
          origen: draft.origen,
          destinosRows: draft.destinosRows,
          cantidadStr: draft.cantidadFactura,
          precioUnitarioStr: draft.precioUnitarioFactura,
          montoStr: draft.monto,
          moneda: draft.monedaMonto,
          productoItems: draft.productoItems,
        } as unknown as ViajeClienteDraft,
        opcionesFaltantes,
        true,
      )
    : [];
  // Clientes adicionales: solo el cliente es obligatorio (cantidad y tarifa, juntas).
  const faltaAdicionales = draft ? faltantesPorFila(draft.clientesRows, opcionesFaltantes) : {};
  const flotaPropia = draft?.operacionModo === "propio";
  const faltaChoferPropio =
    !!draft && flotaPropia && isVisible("edicion_viaje", "choferId") && !draft.choferId.trim();
  const faltaVehiculosPropios =
    !!draft &&
    flotaPropia &&
    isVisible("edicion_viaje", "vehiculosRows") &&
    !draft.vehiculosRows.some((r) => r.vehiculoId);
  const hayFaltantesClientes =
    faltaPrincipal.length > 0 || Object.keys(faltaAdicionales).length > 0;
  const hayFaltantes = hayFaltantesClientes || faltaChoferPropio || faltaVehiculosPropios;
  const marcaP = (c: string) => marcarFaltantes && faltaPrincipal.includes(c as never);
  const [abiertoPrincipal, setAbiertoPrincipal] = useState(false);
  useEffect(() => {
    // Ya no falta nada: se van el rojo y el aviso.
    if (marcarFaltantes && !hayFaltantes) {
      setMarcarFaltantes(false);
      setAvisoFaltantesEstado(null);
    }
  }, [marcarFaltantes, hayFaltantes]);
  useEffect(() => {
    // Las tarjetas arrancan colapsadas: la del principal se abre si tiene faltantes.
    if (marcarFaltantes && faltaPrincipal.length > 0) setAbiertoPrincipal(true);
  }, [marcarFaltantes, faltaPrincipal.length]);
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
  /** A qué campo aplicar el país recién creado desde "+ Nuevo país" (origen/destino, principal o de un cliente adicional). */
  const [paisQuickCreateTarget, setPaisQuickCreateTarget] =
    useState<PaisQuickCreateTarget>({ kind: "origen" });

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

  /** País fijo si el tenant tiene `paisOrigenDestinoOculto` — ver `Tenant.paisOrigenDestinoOculto`
   * en el backend. Si el país fijado fue borrado del catálogo, no aplica (fallback seguro: se
   * sigue mostrando el selector de país). */
  const paisFijo = useMemo(
    () => resolverPaisFijoViaje(tenant, todosPaises),
    [tenant, todosPaises],
  );
  /** `Tenant.recomendacionCiudadesHabilitada` (default true): false = ciudades en texto libre. */
  const sugerenciasCiudad = tenant?.recomendacionCiudadesHabilitada !== false;

  // El selector de país queda oculto en la UI cuando `paisFijo` está seteado (ver
  // `PaisUbicacionSelect`/`ViajeDestinosLista`/`ViajeClientesFieldset` más abajo) — acá se
  // garantiza que lo que se valida y se manda a la API sea siempre ese país, sin depender de
  // qué traía el draft (dato legacy, heurística de `inferirPaisDesdeUbicacion`, etc).
  useEffect(() => {
    if (!paisFijo) return;
    const codigo = paisFijo.codigo || paisFijo.id;
    setDraft((prev) => {
      if (!prev) return prev;
      const yaNormalizado =
        prev.paisOrigen === codigo &&
        prev.destinosRows.every((d) => d.pais === codigo) &&
        prev.clientesRows.every(
          (r) => r.paisOrigen === codigo && r.destinosRows.every((d) => d.pais === codigo),
        );
      if (yaNormalizado) return prev;
      return {
        ...prev,
        paisOrigen: codigo,
        destinosRows: destinosConPaisFijo(prev.destinosRows, codigo),
        clientesRows: conPaisFijo(prev.clientesRows, codigo),
      };
    });
    // Repite también cuando cambia el draft (ej. "+ Agregar cliente"/"+ Agregar destino"),
    // para que una fila nueva quede normalizada antes de poder guardarse — la guarda
    // `yaNormalizado` evita el loop (no vuelve a setear si ya está todo en el país fijo).
  }, [paisFijo, setDraft, draft]);

  const { datosClienteBloqueados, datosTransporteBloqueados } = useMemo(() => {
    if (!snapshotViaje) return { datosClienteBloqueados: false, datosTransporteBloqueados: false };
    const facturado =
      snapshotViaje.facturacionEstado === "facturado" ||
      snapshotViaje.facturacionEstado === "cobrado";

    // Cast a any por si liquidacionEstado no está tipado estrictamente en Viaje aún
    const liquidado =
      (snapshotViaje as any).liquidacionEstado === "liquidado" ||
      (snapshotViaje as any).liquidacionEstado === "pagado";

    const hasArca = Boolean(hasFacturasArca || hasLiquidoProductoArca);

    if (hasArca) {
      const bloqueado = facturado || liquidado;
      return { datosClienteBloqueados: bloqueado, datosTransporteBloqueados: bloqueado };
    }

    return {
      datosClienteBloqueados: facturado,
      datosTransporteBloqueados: liquidado,
    };
  }, [snapshotViaje, hasFacturasArca, hasLiquidoProductoArca]);

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

  // Pago bruto al transportista: con desglose = cantidad × precio unitario; sin desglose =
  // el "Precio transporte" cargado. Con % IVA visible, se engrosa a pago neto / monto IVA.
  const pagoBrutoTransportista = desgloseActivo
    ? (Number(draft.cantidadTransportista.replace(",", ".")) || 0) *
      (parseCurrencyForMoneda(
        draft.precioUnitarioTransportista,
        draft.monedaPrecioTransportistaExterno,
      ) || 0)
    : parseCurrencyForMoneda(
        draft.precioTransportistaExterno,
        draft.monedaPrecioTransportistaExterno,
      ) || 0;
  const pctIvaTransportista =
    Number(draft.precioTransportistaIvaIncluidoPct.replace(",", ".")) || 0;
  const pagoNetoTransportista = engrosarConIva(
    pagoBrutoTransportista,
    pctIvaTransportista,
  );
  const montoIvaTransportista = pagoNetoTransportista - pagoBrutoTransportista;

  const readonlyMoneyClass =
  // Importe calculado: se muestra como número (igual que el Total del alta), no como input.
  "flex h-9 items-center text-right text-base font-semibold tabular-nums text-vialto-charcoal min-w-0";
  function fmtReadonlyMoney(n: number) {
    return "$ " + n.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

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

  const descarte = useConfirmarDescarte(onClose, open);
  const { solicitarCierre } = descarte;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving && !quickCreate) {
        e.preventDefault();
        solicitarCierre();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, quickCreate, solicitarCierre]);

  if (!open) return null;

  const viajeComprobantes = {
    ...snapshotViaje,
    etapa: draft.estado,
    transportistaId:
      draft.operacionModo === "externo"
        ? draft.transportistaId
        : snapshotViaje.transportistaId,
  };
  const comprobantesHabilitados = draft.estado !== "cancelado";
  const muestraBotonLiquidar =
    typeof onLiquidar === "function" &&
    comprobantesHabilitados &&
    viajeRequiereComprobanteDual(viajeComprobantes) &&
    viajePendienteComprobanteTransportista(viajeComprobantes);
  const liquidarDeshabilitado = saving || Boolean(liquidarBloqueoMotivo);

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
    // Direcciones de entrega como sugerencias en Origen/Destino (ver CiudadCombobox).
    <DireccionesSugeridasProvider tenantId={tenantId || undefined}>
      <div
        className="fixed inset-0 z-[45] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
        role="presentation"
      >
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="viaje-edit-modal-title"
          className="relative flex h-full max-h-[100dvh] w-full max-w-[min(88rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
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
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={solicitarCierre}
              className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {(datosClienteBloqueados || datosTransporteBloqueados) && (
              <div className="mb-4 flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <strong className="font-semibold">
                  Campos comerciales bloqueados
                </strong>
                <p className="text-xs leading-relaxed">
                  {datosClienteBloqueados && datosTransporteBloqueados
                    ? "Este viaje tiene comprobantes emitidos (factura y liquidación). Los campos de cliente, transportista y montos están bloqueados para evitar discrepancias. Si necesitás modificarlos, primero deberás anular los comprobantes."
                    : datosClienteBloqueados
                      ? "Este viaje tiene una factura emitida. Los datos del cliente y los montos a cobrar están bloqueados para evitar discrepancias. Si necesitás modificarlos, primero deberás anular la factura."
                      : "Este viaje tiene una liquidación emitida. Los datos del transportista y los montos a pagar están bloqueados para evitar discrepancias. Si necesitás modificarlos, primero deberás anular la liquidación."}
                </p>
              </div>
            )}

            {/* ID propio (y el 2, si la empresa lo usa) y Etapa en la misma fila. */}
            <div
              className={`mb-4 grid gap-4 ${
                [idPropio1Habilitado(tenant), idPropio2Habilitado(tenant)].filter(Boolean).length === 2
                  ? "md:grid-cols-3"
                  : idPropio1Habilitado(tenant) || idPropio2Habilitado(tenant)
                    ? "md:grid-cols-2"
                    : ""
              }`}
            >
            {idPropio1Habilitado(tenant) && (
              // Un campo más del formulario (sin recuadro destacado ni texto de ayuda).
              <div className="flex min-w-0 flex-col gap-1">
                <span className={labelClass}>
                  {labelIdentificacionPersonalizadaViajes(tenant)}{" "}
                  {!idSistemaHabilitado(tenant) && (
                    <span className="text-red-500">*</span>
                  )}
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
                  className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                />
              </div>
            )}

            {idPropio2Habilitado(tenant) && (
              <div className="flex min-w-0 flex-col gap-1">
                <span className={labelClass}>{idPropio2Label(tenant)}</span>
                <input
                  type="text"
                  value={draft.idPropio2}
                  onChange={(e) =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            idPropio2: e.target.value,
                          }
                        : p,
                    )
                  }
                  placeholder="Opcional"
                  className={inputClass}
                />
              </div>
            )}

              <div className="flex min-w-0 flex-col gap-1">
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
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                <span className={labelClass}>Clientes del viaje</span>
                <ClienteCard
                  numero={1}
                  title={
                    todosClientes.find((c) => c.id === draft.clienteId)
                      ?.nombre || "Cliente principal"
                  }
                  summary={textoRutaViaje(
                    draft.origen,
                    draft.destinosRows.map((r) => r.etiqueta).filter(Boolean),
                  )}
                  // En la edición los clientes arrancan colapsados (se abre sola si le falta algo).
                  open={abiertoPrincipal}
                  onToggle={() => setAbiertoPrincipal((v) => !v)}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className={labelClass}>
                        Cliente <span className="text-red-500">*</span>
                      </span>
                      <ClienteSearchSelect
                        clientes={todosClientes}
                        value={draft.clienteId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, clienteId: id } : p))
                        }
                        inputClassName={conBordeError(inputClass, marcaP("cliente"))}
                        aria-label="Cliente"
                        disabled={datosClienteBloqueados || saving}
                        onNuevo={
                          getToken && !datosClienteBloqueados
                            ? () => setQuickCreate("cliente")
                            : undefined
                        }
                      />
                      <FaltaCampo show={marcaP("cliente")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={labelClass}>
                        Origen <span className="text-red-500">*</span>
                      </span>
                      <div className={`grid gap-2 sm:items-end ${paisFijo ? '' : 'sm:grid-cols-[auto_1fr]'}`}>
                        {!paisFijo && (
                          <PaisUbicacionSelect
                            value={draft.paisOrigen}
                            onChange={(p) =>
                              setDraft((prev) =>
                                prev
                                  ? { ...prev, paisOrigen: p, origen: "" }
                                  : prev,
                              )
                            }
                            aria-label="País de origen"
                            className={`${inputClass} w-full sm:w-40`}
                          />
                        )}
                        <CiudadCombobox
                          campo="origen"
                          pais={paisFijo ? (paisFijo.codigo || paisFijo.id) : draft.paisOrigen}
                          value={draft.origen}
                          onChange={(next) =>
                            setDraft((prev) =>
                              prev ? { ...prev, origen: next } : prev,
                            )
                          }
                          inputClassName={`${inputClass} w-full`}
                          error={marcaP("origen")}
                          sugerencias={sugerenciasCiudad}
                        />
                      </div>
                      <FaltaCampo show={marcaP("origen")} />
                    </div>
                    <div className="flex flex-col gap-1">
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
                          setPaisQuickCreateTarget({ kind: "destino", index });
                          setQuickCreate("pais");
                        }}
                        paisFijo={paisFijo}
                        sugerenciasCiudad={sugerenciasCiudad}
                        requerido
                        errorPrimerDestino={marcaP("destino")}
                      />
                    </div>
                    {isVisible("edicion_viaje", "productoItems") && (
                      <div className="flex flex-col gap-1">
                        <span className={labelClass}>Carga</span>
                        <ViajeProductosLista
                          groupId="viaje-edit"
                          value={draft.productoItems}
                          onChange={(items) =>
                            setDraft((p) =>
                              p ? { ...p, productoItems: items } : p,
                            )
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
                    {desgloseActivo ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <span className={labelClass}>
                            Cantidad <span className="text-red-500">*</span>
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={datosClienteBloqueados}
                            value={draft.cantidadFactura}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? { ...p, cantidadFactura: e.target.value }
                                  : p,
                              )
                            }
                            placeholder="0.00"
                            className={`${conBordeError(inputClass, marcaP("cantidad"))} text-right tabular-nums`}
                          />
                          <FaltaCampo show={marcaP("cantidad")} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className={labelClass}>
                            Tarifa <span className="text-red-500">*</span>
                          </span>
                          <div className="flex min-w-0 gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={datosClienteBloqueados}
                              value={draft.precioUnitarioFactura}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        precioUnitarioFactura:
                                          maskCurrencyForMoneda(
                                            e.target.value,
                                            p.monedaMonto,
                                          ),
                                      }
                                    : p,
                                )
                              }
                              placeholder="0.00"
                              className={`${conBordeError(inputClass, marcaP("tarifa"))} min-w-0 flex-1 text-right tabular-nums`}
                            />
                            <MonedaSelect
                              value={draft.monedaMonto}
                              disabled={datosClienteBloqueados}
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
                          <FaltaCampo show={marcaP("tarifa")} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className={labelClass}>Total</span>
                          <div
                            className={`flex items-center px-3 h-9 rounded-none border border-black/15 bg-vialto-mist/40 text-vialto-steel text-right tabular-nums min-w-0`}
                          >
                            <span className="w-full truncate">
                              {(
                                (Number(
                                  draft.cantidadFactura.replace(",", "."),
                                ) || 0) *
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
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className={labelClass}>
                          Monto a facturar <span className="text-red-500">*</span>
                        </span>
                        <div className="flex min-w-0 gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={datosTransporteBloqueados}
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
                            className={`${conBordeError(inputClass, marcaP("monto"))} min-w-0 flex-1 text-right tabular-nums`}
                          />
                          <MonedaSelect
                            value={draft.monedaMonto}
                            disabled={datosTransporteBloqueados}
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
                        <FaltaCampo show={marcaP("monto")} />
                      </div>
                    )}
                  </div>
                </ClienteCard>
                <ViajeClientesFieldset
                  numeroInicial={2}
                  inicialColapsados
                  camposFaltantes={marcarFaltantes ? faltaAdicionales : undefined}
                  ocultarTextoError
                  rows={draft.clientesRows}
                  onChange={(rows) => {
                    setDraft((p) => (p ? { ...p, clientesRows: rows } : p));
                    onClearClientesRowErrors?.();
                  }}
                  clientes={todosClientes}
                  rowErrors={clientesRowErrors}
                  desgloseActivo={desgloseActivo}
                  paises={todosPaises}
                  paisesLoading={paisesLoading}
                  onNuevoPaisOrigen={(clienteIndex) => {
                    setPaisQuickCreateTarget({
                      kind: "origen-cliente",
                      clienteIndex,
                    });
                    setQuickCreate("pais");
                  }}
                  onNuevoPaisDestino={(clienteIndex, destinoIndex) => {
                    setPaisQuickCreateTarget({
                      kind: "destino-cliente",
                      clienteIndex,
                      destinoIndex,
                    });
                    setQuickCreate("pais");
                  }}
                  opcionesProducto={opcionesProducto}
                  getToken={getToken}
                  onProductoCreado={onProductoCreado}
                  paisFijo={paisFijo}
                  sugerenciasCiudad={sugerenciasCiudad}
                />
                <button
                  type="button"
                  onClick={() => {
                    // Igual que el alta: no se suma otro cliente con obligatorios vacíos.
                    if (hayFaltantesClientes) {
                      avisarFaltantes(
                        "Completá los campos marcados en rojo antes de agregar otro cliente.",
                      );
                      return;
                    }
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            clientesRows: [
                              ...p.clientesRows,
                              emptyClienteRow(),
                            ],
                          }
                        : p,
                    );
                  }}
                  className="mt-1 self-start text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
                >
                  + Agregar cliente
                </button>
              </div>

              <ViajeOperacionTipoFieldset
                modo={draft.operacionModo}
                onModoChange={onModoChange}
                externoVisible={transportistaExternoVisible}
                labelExterno={lblTransporte}
                propioVisible={flotaPropiaVisible}
                groupName={`viaje-edit-${draft.numero || "e"}`}
                externoContent={
                  <div className="grid gap-3">
                    {/* Fletero, chofer y vehículos en la misma fila. */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:items-start">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>{lblTransporte}</span>
                      <TransportistaSearchSelect
                        transportistas={todosTransportistas}
                        value={draft.transportistaId}
                        placeholderCerrado={tl.propio ? `Elegí ${transpFrase}…` : "Elegí un transporte / porteador…"}
                        placeholderBuscar={tl.propio ? `Buscar ${transpFrase}…` : "Buscar transporte / porteador…"}
                        emptyListChoiceLabel={tl.propio ? `Elegí ${transpFrase}…` : "Elegí un transporte / porteador…"}
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
                        disabled={datosTransporteBloqueados || saving}
                        aria-label={lblTransporte}
                        onNuevo={
                          getToken && !datosTransporteBloqueados
                            ? () => setQuickCreate("transportista")
                            : undefined
                        }
                      />
                    </div>
                    {isVisible("edicion_viaje", "choferExternoId") && (
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className={labelClass}>Chofer</span>
                        <ChoferSearchSelect
                          choferes={choferesExterno}
                          value={draft.choferExternoId}
                          onChange={(id) =>
                            setDraft((p) =>
                              p ? { ...p, choferExternoId: id } : p,
                            )
                          }
                          inputClassName={inputClass}
                          aria-label="Chofer transporte / porteador"
                          onNuevo={
                            getToken
                              ? () => setQuickCreate("chofer-ext")
                              : undefined
                          }
                        />
                      </div>
                    )}
                    {isVisible("edicion_viaje", "vehiculosRows") && (
                      // Envuelto: la lista trae `md:col-span-*` para otros layouts.
                      <div className="min-w-0">
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
                    )}
                    </div>
                    {draft.transportistaId && (
                      <div className="flex flex-col gap-2 rounded border border-black/10 bg-vialto-mist/40 px-3 py-3">
                        <span className={labelClass}>
                          ¿El {transpFrase} seleccionado realiza el flete?
                        </span>
                        <div className="flex gap-5">
                          <label
                            className={`flex items-center gap-2 text-sm ${datosTransporteBloqueados ? "cursor-not-allowed text-vialto-steel/70" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              disabled={datosTransporteBloqueados}
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
                            className={`flex items-center gap-2 text-sm ${datosTransporteBloqueados ? "cursor-not-allowed text-vialto-steel/70" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              disabled={datosTransporteBloqueados}
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
                              {tl.singular} que realiza el flete{" "}
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
                              disabled={datosTransporteBloqueados || saving}
                              inputClassName={`${inputClass}${
                                transportistaEfectivoError
                                  ? " border-red-400"
                                  : ""
                              }`}
                              aria-label={`${tl.singular} que realiza el flete`}
                              onNuevo={
                                getToken && !datosTransporteBloqueados
                                  ? () => setQuickCreate("transportista")
                                  : undefined
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {desgloseActivo ? (
                      <>
                        {/* Cantidad | Precio + moneda | (% IVA) | Pago bruto en una fila. */}
                        <div
                          className={`grid grid-cols-1 gap-3 ${ivaTransportistaVisible ? "sm:grid-cols-[0.6fr_1.4fr_0.7fr_1fr]" : "sm:grid-cols-[0.6fr_1.4fr_1fr]"}`}
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={labelClass}>Cantidad</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={datosTransporteBloqueados}
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
                                disabled={datosTransporteBloqueados}
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
                                disabled={datosTransporteBloqueados}
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
                                Dejalo en 0 si el transportista no suma IVA al
                                cobrar.
                              </p>
                            </div>
                          )}
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={`${labelClass} text-right`}>Pago bruto</span>
                            <div className={readonlyMoneyClass}>
                              <span className="w-full truncate">
                                {fmtReadonlyMoney(pagoBrutoTransportista)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {ivaTransportistaVisible && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={`${labelClass} text-right`}>Pago neto</span>
                              <div className={readonlyMoneyClass}>
                                <span className="w-full truncate">
                                  {fmtReadonlyMoney(pagoNetoTransportista)}
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={`${labelClass} text-right`}>Monto IVA</span>
                              <div className={readonlyMoneyClass}>
                                <span className="w-full truncate">
                                  {fmtReadonlyMoney(montoIvaTransportista)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div
                          className={`grid grid-cols-1 gap-3 ${ivaTransportistaVisible ? "sm:grid-cols-2" : ""}`}
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={labelClass}>
                              Precio transporte
                            </span>
                            <div className="flex min-w-0 gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={datosTransporteBloqueados}
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
                                disabled={datosTransporteBloqueados}
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
                                aria-label="Moneda precio transporte / porteador"
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
                                Dejalo en 0 si el transportista no suma IVA al
                                cobrar.
                              </p>
                            </div>
                          )}
                        </div>
                        {ivaTransportistaVisible && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={`${labelClass} text-right`}>Pago bruto</span>
                              <div className={readonlyMoneyClass}>
                                <span className="w-full truncate">
                                  {fmtReadonlyMoney(pagoBrutoTransportista)}
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={`${labelClass} text-right`}>Pago neto</span>
                              <div className={readonlyMoneyClass}>
                                <span className="w-full truncate">
                                  {fmtReadonlyMoney(pagoNetoTransportista)}
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className={`${labelClass} text-right`}>Monto IVA</span>
                              <div className={readonlyMoneyClass}>
                                <span className="w-full truncate">
                                  {fmtReadonlyMoney(montoIvaTransportista)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                }
                // Con flota propia, chofer y vehículos van en la misma fila que las opciones.
                alLadoPropio={
                  isVisible("edicion_viaje", "choferId") ||
                  isVisible("edicion_viaje", "vehiculosRows") ? (
                    <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                      {isVisible("edicion_viaje", "choferId") && (
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className={labelClass}>
                            Chofer <span className="text-red-500">*</span>
                          </span>
                          <ChoferSearchSelect
                            choferes={todosChoferesPropios}
                            value={draft.choferId}
                            onChange={(id) =>
                              setDraft((p) => (p ? { ...p, choferId: id } : p))
                            }
                            inputClassName={conBordeError(inputClass, marcarFaltantes && faltaChoferPropio)}
                            aria-label="Chofer flota propia"
                            onNuevo={
                              getToken ? () => setQuickCreate("chofer-prop") : undefined
                            }
                          />
                          <FaltaCampo show={marcarFaltantes && faltaChoferPropio} />
                          {ayudaFlota.chofer && (
                            <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                          )}
                        </div>
                      )}
                      {isVisible("edicion_viaje", "vehiculosRows") && (
                        // Envuelto: la lista trae `md:col-span-*` para otros layouts.
                        <div className="min-w-0">
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
                            error={marcarFaltantes && faltaVehiculosPropios}
                          />
                          {ayudaFlota.vehiculo && (
                            <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : undefined
                }
                propioContent={
                  <div className="grid gap-3">
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
                  disabled={datosTransporteBloqueados}
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
                ocultarTextoError
              />

              {(isVisible("edicion_viaje", "kmRecorridos") ||
                isVisible("edicion_viaje", "litrosConsumidos")) && (
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
                        hasArca={hasLiquidoProductoArca}
                        onRegistrarPago={onRegistrarPago}
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
                      + Agregar pago al {transpFrase}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
            <ErrorPieModal error={avisoFaltantes ?? error} fieldErrors={erroresPie} />
            <div className="flex flex-wrap items-center gap-2">
              {/* Sin "Facturar" en la edición (a pedido): se factura desde el menú de
                  acciones de la grilla o desde el detalle del viaje. */}
              {muestraBotonLiquidar ? (
                <button
                  type="button"
                  onClick={onLiquidar}
                  disabled={liquidarDeshabilitado}
                  title={liquidarBloqueoMotivo ?? undefined}
                  className="inline-flex h-10 items-center px-5 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Liquidar
                </button>
              ) : null}
              {onContinuarFactura ? (
                <button
                  type="button"
                  onClick={onContinuarFactura}
                  disabled={saving}
                  title="El viaje tiene una factura en borrador sin emitir"
                  className="inline-flex h-10 items-center px-5 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar factura
                </button>
              ) : null}
              {onContinuarLiquidacion ? (
                <button
                  type="button"
                  onClick={onContinuarLiquidacion}
                  disabled={saving}
                  title="El viaje tiene una liquidación en borrador sin emitir"
                  className="inline-flex h-10 items-center px-5 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar liquidación
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
                onClick={solicitarCierre}
                disabled={saving}
                className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  // Igual que el alta: obligatorios vacíos en rojo + aviso, sin guardar.
                  if (hayFaltantes) {
                    avisarFaltantes();
                    return;
                  }
                  onSave();
                }}
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
      {descarte.dialogo}

      {quickCreate === "pais" && getToken && (
        <PaisModal
          stacked
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => {
            setQuickCreate(null);
            setPaisQuickCreateTarget({ kind: "origen" });
          }}
          onSaved={(p) => {
            setSessionPaises((prev) => [...prev, p]);
            descarte.marcarModificado();
            const codigo = p.codigo || p.id;
            const target = paisQuickCreateTarget;
            if (target.kind === "origen") {
              setDraft((prev) =>
                prev ? { ...prev, paisOrigen: codigo, origen: "" } : prev,
              );
            } else if (target.kind === "destino") {
              const idx = target.index;
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
            } else if (target.kind === "origen-cliente") {
              const ci = target.clienteIndex;
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      clientesRows: prev.clientesRows.map((r, i) =>
                        i === ci ? { ...r, paisOrigen: codigo, origen: "" } : r,
                      ),
                    }
                  : prev,
              );
            } else {
              const { clienteIndex, destinoIndex } = target;
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      clientesRows: prev.clientesRows.map((r, i) =>
                        i === clienteIndex
                          ? {
                              ...r,
                              destinosRows: r.destinosRows.map((d, j) =>
                                j === destinoIndex
                                  ? { ...d, pais: codigo, etiqueta: "" }
                                  : d,
                              ),
                            }
                          : r,
                      ),
                    }
                  : prev,
              );
            }
            setQuickCreate(null);
            setPaisQuickCreateTarget({ kind: "origen" });
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
            descarte.marcarModificado();
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
            descarte.marcarModificado();
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
              descarte.marcarModificado();
              if (quickCreate === "chofer-ext") {
                setDraft((p) => (p ? { ...p, choferExternoId: c.id } : p));
              } else {
                setDraft((p) => (p ? { ...p, choferId: c.id } : p));
              }
              setQuickCreate(null);
            }}
          />
        )}
    </DireccionesSugeridasProvider>
  );
}

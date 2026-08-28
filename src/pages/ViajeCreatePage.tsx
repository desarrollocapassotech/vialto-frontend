import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { Stepper } from "@/components/ui/Stepper";
import { useWizardStep } from "@/hooks/useWizardStep";
import { PaisModal } from "@/components/viajes/PaisModal";
import type { Pais } from "@/types/api";
import { type ViajeOperacionModo } from "@/components/viajes/ViajeOperacionTipoFieldset";
import { ViajeKmLitrosDialog } from "@/components/viajes/ViajeKmLitrosDialog";
import { type GananciaBrutaManualDraftSlice } from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import { draftRequiereGananciaBrutaManual } from "@/lib/viajesGananciaBruta";
import {
  otroGastoAutorFromClerk,
  otroGastoDraftToApi,
  type OtroGastoDraft,
} from "@/components/viajes/OtrosGastosFieldset";
import {
  pagosTransportistaDraftsToApi,
  type PagoTransportistaDraft,
} from "@/components/viajes/PagosTransportistaFieldset";
import {
  emptyClienteRow,
  clientesPayloadParaApi,
  validarClientesRows,
  type ViajeClienteDraft,
} from "@/lib/viajesClientes";
import { apiJson, ApiError } from "@/lib/api";
import {
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
  maskCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
import {
  choferesFlotaPropia,
  choferesParaTransportistaExterno,
  flotaPropiaVehiculosListaValida,
  mantenerIdSiEnLista,
  mergeMaestroPorId,
  mensajesAyudaFlotaPropia,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
  mensajeErrorTransportistaEfectivoExterno,
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import { type ViajeVehiculoRowDraft } from "@/components/viajes/ViajeVehiculosLista";
import { vehiculosPorTipo } from "@/lib/vehiculoTipos";
import { ClienteModal } from "@/components/viajes/ClienteModal";
import { TransportistaModal } from "@/components/viajes/TransportistaModal";
import { ChoferModal } from "@/components/viajes/ChoferModal";
import { esEtiquetaCiudadValida, type PaisCodigo } from "@/lib/ciudades";
import {
  destinosPayloadParaApi,
  validarDestinosRows,
} from "@/lib/viajesDestinos";
import {
  etapaMuestraKmLitros,
  draftKmLitrosVacios,
  parseKmLitrosOpcionales,
  VIAJE_ETAPAS_ALTA,
} from "@/lib/viajesIndicadores";
import {
  validarPagosTransportistaDraftForm,
  engrosarConIva,
} from "@/lib/viajesTransportistaPagos";
import { fechaHoraToIso } from "@/lib/viajeFechaHora";
import type {
  Chofer,
  Cliente,
  Producto,
  Transportista,
  Vehiculo,
} from "@/types/api";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { labelIdentificacionPersonalizadaViajes } from "@/lib/viajesFlota";
import { roundMoney2 } from "@/lib/facturaTotales";
import { type OpcionProducto } from "@/lib/productosViaje";
import { ViajeCreateResumenClientes } from "@/components/viajes/steps/ViajeCreateResumenClientes";
import { ViajeCreateStep1ClientesYCarga } from "@/components/viajes/steps/ViajeCreateStep1ClientesYCarga";
import { ViajeCreateStep2Operacion } from "@/components/viajes/steps/ViajeCreateStep2Operacion";
import { ViajeCreateStep3Cierre } from "@/components/viajes/steps/ViajeCreateStep3Cierre";

/** A qué cliente del viaje aplicar el país recién creado desde "+ Nuevo país". */
type PaisQuickCreateTarget =
  | { kind: "origen-cliente"; clienteIndex: number }
  | { kind: "destino-cliente"; clienteIndex: number; destinoIndex: number };

const VIAJE_CREATE_STEPS = [
  { label: "Clientes y destinos" },
  { label: "Operación" },
  { label: "Cierre" },
];

export function ViajeCreatePage() {
  // ─── HOOKS GLOBALES E INICIALIZACIÓN ─────────────────────────────────────
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const gastoAutor = useMemo(() => otroGastoAutorFromClerk(user), [user]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { isVisible } = useFieldConfig("viajes");
  const desgloseActivo = isVisible("alta_viaje", "desgloseMontos");
  const ivaTransportistaVisible = isVisible(
    "alta_viaje",
    "precioTransportistaIvaIncluidoPct",
  );
  const { showToast } = useToast();

  // ─── WIZARD ───────────────────────────────────────────────────────────────
  const { step, setStep, goNext } = useWizardStep(3);

  // ─── ESTADOS DEL FORMULARIO ──────────────────────────────────────────────
  const [localClientes, setLocalClientes] = useState<Cliente[]>([]);
  const [localChoferes, setLocalChoferes] = useState<Chofer[]>([]);
  const [localTransportistas, setLocalTransportistas] = useState<
    Transportista[]
  >([]);
  const [localVehiculos, setLocalVehiculos] = useState<Vehiculo[]>([]);

  // Los viajes se crean siempre en estado "pendiente" (sin selector en el alta); el cambio de etapa se hace desde edición.
  const estado: (typeof VIAJE_ETAPAS_ALTA)[number] = "pendiente";
  const [choferId, setChoferId] = useState("");
  const [transportistaId, setTransportistaId] = useState("");
  const [realizaFlete, setRealizaFlete] = useState(true);
  const [transportistaEfectivoId, setTransportistaEfectivoId] = useState("");
  const [transportistaEfectivoError, setTransportistaEfectivoError] = useState<
    string | null
  >(null);
  const [modoOperacion, setModoOperacion] =
    useState<ViajeOperacionModo>("externo");

  const [vehiculosRows, setVehiculosRows] = useState<ViajeVehiculoRowDraft[]>(
    [],
  );
  const [vehiculosExternosRows, setVehiculosExternosRows] = useState<
    ViajeVehiculoRowDraft[]
  >([]);
  const [choferExternoId, setChoferExternoId] = useState("");

  const [fechaCarga, setFechaCarga] = useState("");
  const [horaCarga, setHoraCarga] = useState("");
  const [fechaDescarga, setFechaDescarga] = useState("");
  const [horaDescarga, setHoraDescarga] = useState("");
  const [fechaCargaError, setFechaCargaError] = useState<string | null>(null);
  const [fechaDescargaError, setFechaDescargaError] = useState<string | null>(
    null,
  );

  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);

  const [detalleCarga, setDetalleCarga] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [numeroIdentificacionPersonalizado, setNumeroIdentificacionPersonalizado] =
    useState("");
  const [kmRecorridos, setKmRecorridos] = useState("");
  const [litrosConsumidos, setLitrosConsumidos] = useState("");

  const [precioTransportistaExterno, setPrecioTransportistaExterno] =
    useState("");
  const [monedaPrecioTransportista, setMonedaPrecioTransportista] =
    useState<ViajeMonedaCodigo>("ARS");
  const [cantidadTransportista, setCantidadTransportista] = useState("1");
  const [precioUnitarioTransportista, setPrecioUnitarioTransportista] = useState("");
  const [precioTransportistaIvaIncluidoPct, setPrecioTransportistaIvaIncluidoPct] =
    useState("");
  const [gananciaBrutaManual, setGananciaBrutaManual] = useState("");
  const [monedaGananciaBrutaManual, setMonedaGananciaBrutaManual] =
    useState<ViajeMonedaCodigo>("ARS");

  const [otrosGastos, setOtrosGastos] = useState<OtroGastoDraft[]>([]);
  const [pagosTransportista, setPagosTransportista] = useState<
    PagoTransportistaDraft[]
  >([]);

  /** Todos los clientes del viaje: la fila 0 no es removible (equivalente al ex "cliente principal"). */
  const [clientesRows, setClientesRows] = useState<ViajeClienteDraft[]>([
    emptyClienteRow(),
  ]);
  const [clientesRowErrors, setClientesRowErrors] = useState<
    Record<number, string>
  >({});

  // ─── ESTADOS PARA CREACIÓN RÁPIDA (MODALES) ─────────────────────────────
  type QuickCreate = "cliente" | "transportista" | "chofer-ext" | "chofer-prop" | "pais";
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null);
  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const [sessionTransportistas, setSessionTransportistas] = useState<
    Transportista[]
  >([]);
  const [sessionChoferes, setSessionChoferes] = useState<Chofer[]>([]);
  const [sessionVehiculos, setSessionVehiculos] = useState<Vehiculo[]>([]);
  /** Choferes creados en esta pantalla (overlay inmediato en selectores, como en edición). */
  const [localChoferesRapidos, setLocalChoferesRapidos] = useState<Chofer[]>(
    [],
  );
  /** A qué fila de `clientesRows` aplicar el cliente recién creado desde "+ Nuevo cliente". */
  const [clienteQuickCreateTarget, setClienteQuickCreateTarget] = useState(0);

  const [paises, setPaises] = useState<Pais[]>([]);
  const [sessionPaises, setSessionPaises] = useState<Pais[]>([]);
  const [paisesLoading, setPaisesLoading] = useState(true);
  const [paisQuickCreateTarget, setPaisQuickCreateTarget] =
    useState<PaisQuickCreateTarget>({ kind: "origen-cliente", clienteIndex: 0 });

  const paisesConSesion = useMemo(() => {
    const ids = new Set(paises.map((p) => p.id));
    const combinados = [...paises, ...sessionPaises.filter((p) => !ids.has(p.id))];
    return combinados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [paises, sessionPaises]);

  // ─── CÁLCULO DE MAESTROS COMBINADOS (BBDD + SESIÓN ACTUAL) ───────────────
  const clientes = useMemo(() => {
    const base = tenantId ? localClientes : maestro.clientes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [tenantId, localClientes, maestro.clientes, sessionClientes]);

  const choferes = useMemo(() => {
    const base = tenantId ? localChoferes : maestro.choferes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionChoferes.filter((c) => !ids.has(c.id))];
  }, [tenantId, localChoferes, maestro.choferes, sessionChoferes]);

  const todosChoferes = useMemo(() => {
    const ids = new Set(choferes.map((c) => c.id));
    return [...choferes, ...localChoferesRapidos.filter((c) => !ids.has(c.id))];
  }, [choferes, localChoferesRapidos]);

  const transportistas = useMemo(() => {
    const base = tenantId ? localTransportistas : maestro.transportistas;
    const ids = new Set(base.map((t) => t.id));
    return [...base, ...sessionTransportistas.filter((t) => !ids.has(t.id))];
  }, [
    tenantId,
    localTransportistas,
    maestro.transportistas,
    sessionTransportistas,
  ]);

  const vehiculos = useMemo(() => {
    const base = tenantId ? localVehiculos : maestro.vehiculos;
    const ids = new Set(base.map((v) => v.id));
    return [...base, ...sessionVehiculos.filter((v) => !ids.has(v.id))];
  }, [tenantId, localVehiculos, maestro.vehiculos, sessionVehiculos]);

  // ─── ESTADOS DE UI Y VALIDACIÓN ──────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [localLoadingRefs, setLocalLoadingRefs] = useState(true);
  const loadingRefs = tenantId ? localLoadingRefs : maestro.loading;
  const [refreshingFlota, setRefreshingFlota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitBusyRef = useRef(false);

  const choferIdRef = useRef("");
  const choferExternoIdRef = useRef("");

  function setChoferIdDraft(id: string) {
    choferIdRef.current = id;
    setChoferId(id);
  }

  function setChoferExternoIdDraft(id: string) {
    choferExternoIdRef.current = id;
    setChoferExternoId(id);
  }

  // Estado para el modal opcional de carga de Km y Litros
  const [kmLitrosModalOpen, setKmLitrosModalOpen] = useState(false);
  const [modalKm, setModalKm] = useState("");
  const [modalLitros, setModalLitros] = useState("");
  const [kmLitrosFieldError, setKmLitrosFieldError] = useState<string | null>(
    null,
  );

  // ─── EFECTOS DE CARGA INICIAL ────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const [clientesData, choferesData, transportistasData, vehiculosData] =
          await Promise.all([
            apiJson<Cliente[]>(
              `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`,
              () => getToken(),
            ),
            apiJson<Chofer[]>(
              `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`,
              () => getToken(),
            ),
            apiJson<Transportista[]>(
              `/api/platform/transportistas?tenantId=${encodeURIComponent(tenantId)}`,
              () => getToken(),
            ),
            apiJson<Vehiculo[]>(
              `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`,
              () => getToken(),
            ),
          ]);
        if (!cancelled) {
          setLocalClientes(clientesData);
          setLocalChoferes(choferesData);
          setLocalTransportistas(transportistasData);
          setLocalVehiculos(vehiculosData);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "viajes"));
      } finally {
        if (!cancelled) setLocalLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/paises?tenantId=${encodeURIComponent(tenantId)}`
          : "/api/paises";
        const data = await apiJson<Pais[]>(path, () => getToken());
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
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/stock/productos/paginated?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100&filtroActivo=activos`
          : "/api/stock/productos/paginated?page=1&pageSize=100&filtroActivo=activos";
        const d = await apiJson<{ items: Producto[] }>(path, () => getToken());
        if (!cancelled) setProductosCatalogo(d.items);
      } catch {
        if (!cancelled) setProductosCatalogo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  // ─── FUNCIONES DE REFRESCO DE MAESTROS ───────────────────────────────────
  async function refreshVehiculosMaestro() {
    if (refreshingFlota) return;
    setRefreshingFlota(true);
    setError(null);
    try {
      let vehiculosData: Vehiculo[];
      if (tenantId) {
        vehiculosData = await apiJson<Vehiculo[]>(
          `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        setLocalVehiculos(vehiculosData);
      } else {
        vehiculosData = await maestro.refreshVehiculos();
      }
      setVehiculosExternosRows((rows) =>
        rows.map((row) => {
          const candidatos = vehiculosPorTipo(vehiculosData, row.tipo);
          return {
            ...row,
            vehiculoId: mantenerIdSiEnLista(row.vehiculoId, candidatos),
          };
        }),
      );
    } catch (e) {
      setError(friendlyError(e, "viajes"));
    } finally {
      setRefreshingFlota(false);
    }
  }

  async function refreshFlotaVehiculos() {
    if (refreshingFlota) return;
    setRefreshingFlota(true);
    setError(null);
    try {
      let choferesData: Chofer[];
      let vehiculosData: Vehiculo[];
      if (tenantId) {
        [choferesData, vehiculosData] = await Promise.all([
          apiJson<Chofer[]>(
            `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`,
            () => getToken(),
          ),
          apiJson<Vehiculo[]>(
            `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`,
            () => getToken(),
          ),
        ]);
        setLocalChoferes(choferesData);
        setLocalVehiculos(vehiculosData);
      } else {
        [choferesData, vehiculosData] = await Promise.all([
          maestro.refreshChoferes(),
          maestro.refreshVehiculos(),
        ]);
      }
      const cp = choferesFlotaPropia(
        mergeMaestroPorId(choferesData, sessionChoferes),
      );
      const vp = vehiculosFlotaPropia(vehiculosData);
      setChoferId((prev) => mantenerIdSiEnLista(prev, cp));
      choferIdRef.current = mantenerIdSiEnLista(choferIdRef.current, cp);
      setVehiculosRows((rows) =>
        rows.map((row) => {
          const candidatos = vehiculosPorTipo(vp, row.tipo);
          return {
            ...row,
            vehiculoId: mantenerIdSiEnLista(row.vehiculoId, candidatos),
          };
        }),
      );
    } catch (e) {
      setError(friendlyError(e, "viajes"));
    } finally {
      setRefreshingFlota(false);
    }
  }

  // ─── DERIVACIONES DE FLOTA ───────────────────────────────────────────────
  const choferesPropios = useMemo(
    () => choferesFlotaPropia(todosChoferes),
    [todosChoferes],
  );
  const choferesExterno = useMemo(
    () => choferesParaTransportistaExterno(todosChoferes, transportistaId),
    [todosChoferes, transportistaId],
  );
  const vehiculosPropios = useMemo(
    () => vehiculosFlotaPropia(vehiculos),
    [vehiculos],
  );
  const ayudaFlota = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );

  useEffect(() => {
    if (modoOperacion !== "propio") return;
    setChoferId((prev) => {
      const next = mantenerIdSiEnLista(prev, choferesPropios);
      choferIdRef.current = next;
      return next;
    });
  }, [modoOperacion, choferesPropios]);

  useEffect(() => {
    if (modoOperacion !== "externo" || !transportistaId.trim()) return;
    setChoferExternoId((prev) => {
      const next = mantenerIdSiEnLista(prev, choferesExterno);
      choferExternoIdRef.current = next;
      return next;
    });
  }, [modoOperacion, transportistaId, choferesExterno]);

  function applyModoOperacion(m: ViajeOperacionModo) {
    setModoOperacion(m);
    if (m === "externo") {
      setChoferIdDraft("");
      setVehiculosRows([]);
      setVehiculosExternosRows([]);
    } else {
      setTransportistaId("");
      setRealizaFlete(true);
      setTransportistaEfectivoId("");
      setChoferExternoIdDraft("");
      setVehiculosExternosRows([]);
      setChoferIdDraft("");
      setVehiculosRows([{ tipo: "tractor", vehiculoId: "" }]);
      setPagosTransportista([]);
    }
  }

  function buildGananciaDraft(): GananciaBrutaManualDraftSlice {
    return {
      operacionModo: modoOperacion,
      monto: clientesRows[0]?.montoStr ?? "",
      monedaMonto: clientesRows[0]?.moneda ?? "ARS",
      precioTransportistaExterno,
      monedaPrecioTransportistaExterno: monedaPrecioTransportista,
      gananciaBrutaManual,
      monedaGananciaBrutaManual,
      otrosGastos,
    };
  }

  // ─── NAVEGACIÓN ENTRE PASOS ───────────────────────────────────────────────
  async function handleContinuar1() {
    const principal = clientesRows[0];
    let clienteRowErr = "";
    if (!principal?.clienteId.trim()) clienteRowErr = "Seleccioná un cliente.";
    else if (!principal?.origen.trim()) clienteRowErr = "Completá el origen.";
    else if (!principal?.destinosRows[0]?.etiqueta.trim())
      clienteRowErr = "Ingresá el destino 1.";
    if (clienteRowErr) {
      setError(clienteRowErr);
      return;
    }

    const clientesValidacion = await validarClientesRows(clientesRows);
    if (!clientesValidacion.ok) {
      setClientesRowErrors(clientesValidacion.rowErrors);
      setError(clientesValidacion.message);
      return;
    }
    setClientesRowErrors({});
    setError(null);
    goNext();
  }

  async function handleContinuar2() {
    const externo = modoOperacion === "externo";
    if (externo && !transportistaId.trim()) {
      setError("Seleccioná un transportista externo.");
      return;
    }
    setFieldErrors({});

    const teErr = mensajeErrorTransportistaEfectivoExterno({
      operacionModo: modoOperacion,
      transportistaId,
      realizaFlete,
      transportistaEfectivoId,
    });
    if (teErr) {
      setTransportistaEfectivoError(teErr);
      setError(teErr);
      return;
    }
    setTransportistaEfectivoError(null);

    const vids = externo
      ? vehiculoIdsDesdeRows(vehiculosExternosRows)
      : vehiculoIdsDesdeRows(vehiculosRows);
    if (!externo && vids.length === 0) {
      setError(
        "Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).",
      );
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(
        choferIdRef.current.trim(),
        vids,
        choferesPropios,
        vehiculosPropios,
      )
    ) {
      setError(
        "En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).",
      );
      return;
    }

    const gananciaDraft = buildGananciaDraft();
    if (draftRequiereGananciaBrutaManual(gananciaDraft)) {
      if (
        parseCurrencyForMoneda(gananciaBrutaManual, monedaGananciaBrutaManual) ==
        null
      ) {
        setError(
          "Ingresá la ganancia bruta manual: las monedas de facturación y del transportista son distintas.",
        );
        return;
      }
    }

    const precioTransportistaNum = desgloseActivo
      ? (Number(cantidadTransportista.replace(",", ".")) || 0) *
        (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) || 0)
      : parseCurrencyForMoneda(precioTransportistaExterno, monedaPrecioTransportista);
    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: transportistaId.trim(),
          precioTransportistaExterno: String(precioTransportistaNum || 0),
          monedaPrecioTransportistaExterno: monedaPrecioTransportista,
          pagosTransportista,
        })
      : null;
    if (pagoTransportistaError) {
      setError(pagoTransportistaError);
      return;
    }

    setError(null);
    goNext();
  }

  // ─── LÓGICA DE GUARDADO (SUBMIT) ──────────────────────────────────────────
  async function onSubmit(opts?: {
    kmLitrosFromModal?: boolean;
    km?: number;
    litros?: number;
  }) {
    if (submitBusyRef.current) return;
    submitBusyRef.current = true;
    setLoading(true);
    try {
      await onSubmitInner(opts);
    } finally {
      submitBusyRef.current = false;
      setLoading(false);
    }
  }

  async function onSubmitInner(opts?: {
    kmLitrosFromModal?: boolean;
    km?: number;
    litros?: number;
  }) {
    const externo = modoOperacion === "externo";
    const choferPropioId = choferIdRef.current.trim();
    const choferExternoSeleccionado = choferExternoIdRef.current.trim();
    const principal = clientesRows[0];

    // 1. Validaciones básicas del formulario
    let clienteRowErr = "";
    if (!principal?.clienteId.trim()) clienteRowErr = "Seleccioná un cliente.";
    else if (!principal?.origen.trim()) clienteRowErr = "Completá el origen.";
    else if (!principal?.destinosRows[0]?.etiqueta.trim())
      clienteRowErr = "Ingresá el destino 1.";
    if (clienteRowErr) {
      setError(clienteRowErr);
      setStep(1);
      return;
    }
    if (externo && !transportistaId.trim()) {
      setError("Seleccioná un transportista externo.");
      setStep(2);
      return;
    }
    setFieldErrors({});

    const clientesValidacion = await validarClientesRows(clientesRows);
    if (!clientesValidacion.ok) {
      setClientesRowErrors(clientesValidacion.rowErrors);
      setError(clientesValidacion.message);
      setStep(1);
      return;
    }
    setClientesRowErrors({});
    setFieldErrors({});
    setError(null);

    // 2. Validación de transportista efectivo (si no realiza el flete)
    const teErr = mensajeErrorTransportistaEfectivoExterno({
      operacionModo: modoOperacion,
      transportistaId,
      realizaFlete,
      transportistaEfectivoId,
    });
    if (teErr) {
      setTransportistaEfectivoError(teErr);
      setError(teErr);
      setStep(2);
      return;
    }
    setTransportistaEfectivoError(null);

    // 3. Validación de vehículos seleccionados
    const vids = externo
      ? vehiculoIdsDesdeRows(vehiculosExternosRows)
      : vehiculoIdsDesdeRows(vehiculosRows);
    if (!externo && vids.length === 0) {
      setError(
        "Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).",
      );
      setStep(2);
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(
        choferPropioId,
        vids,
        choferesPropios,
        vehiculosPropios,
      )
    ) {
      setError(
        "En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).",
      );
      setStep(2);
      return;
    }

    // 4. Validación de la ubicación de origen y destinos
    const okOrigen = await esEtiquetaCiudadValida(principal.paisOrigen, principal.origen);
    if (!okOrigen) {
      setError("El origen debe elegirse de la lista de ciudades (no se admite texto libre).");
      setStep(1);
      return;
    }
    const destinosVal = await validarDestinosRows(principal.destinosRows);
    if (!destinosVal.ok) {
      setError(destinosVal.message);
      setStep(1);
      return;
    }

    // 5. Validaciones de Fechas de Carga y Descarga
    const fcError = !fechaCarga.trim() ? "Ingresá la fecha de carga." : null;
    const fdError = !fechaDescarga.trim()
      ? "Ingresá la fecha de descarga."
      : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(fdError);
    if (fcError || fdError) {
      setStep(3);
      return;
    }
    if (fechaDescarga < fechaCarga) {
      setFechaDescargaError(
        "La fecha de descarga no puede ser anterior a la de carga.",
      );
      setStep(3);
      return;
    }

    // 6. Validación de Montos y Pagos
    const montoNum = desgloseActivo
      ? roundMoney2(
          (Number(principal.cantidadStr.replace(",", ".")) || 0) *
            (parseCurrencyForMoneda(principal.precioUnitarioStr, principal.moneda) || 0),
        )
      : parseCurrencyForMoneda(principal.montoStr, principal.moneda);
    if (montoNum == null || montoNum < 0.01) {
      setError("Cargá el monto de este cliente.");
      setStep(1);
      return;
    }
    const gananciaDraft = buildGananciaDraft();
    let gananciaBrutaManualPayload: {
      gananciaBrutaManual: number | null;
      monedaGananciaBrutaManual: string | null;
    } = { gananciaBrutaManual: null, monedaGananciaBrutaManual: null };
    if (draftRequiereGananciaBrutaManual(gananciaDraft)) {
      const manual = parseCurrencyForMoneda(gananciaBrutaManual, monedaGananciaBrutaManual);
      if (manual == null) {
        setError(
          "Ingresá la ganancia bruta manual: las monedas de facturación y del transportista son distintas.",
        );
        setStep(2);
        return;
      }
      gananciaBrutaManualPayload = {
        gananciaBrutaManual: manual,
        monedaGananciaBrutaManual,
      };
    }
    const precioTransportistaNum = desgloseActivo
      ? (Number(cantidadTransportista.replace(",", ".")) || 0) *
        (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) || 0)
      : parseCurrencyForMoneda(precioTransportistaExterno, monedaPrecioTransportista);
    const pagosTransportistaApi =
      pagosTransportistaDraftsToApi(pagosTransportista);
    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: transportistaId.trim(),
          precioTransportistaExterno: String(precioTransportistaNum || 0),
          monedaPrecioTransportistaExterno: monedaPrecioTransportista,
          pagosTransportista,
        })
      : null;
    if (pagoTransportistaError) {
      setError(pagoTransportistaError);
      setStep(2);
      return;
    }

    // 7. Chequeo para mostrar Modal de Km/Litros si corresponde al estado
    if (
      !opts?.kmLitrosFromModal &&
      etapaMuestraKmLitros(estado) &&
      draftKmLitrosVacios(kmRecorridos, litrosConsumidos)
    ) {
      setModalKm(kmRecorridos);
      setModalLitros(litrosConsumidos);
      setKmLitrosFieldError(null);
      setKmLitrosModalOpen(true);
      return;
    }
    const kmNum = opts?.kmLitrosFromModal
      ? opts.km
      : kmRecorridos.trim()
        ? Number(kmRecorridos.replace(",", "."))
        : undefined;
    const litNum = opts?.kmLitrosFromModal
      ? opts.litros
      : litrosConsumidos.trim()
        ? Number(litrosConsumidos.replace(",", "."))
        : undefined;

    // 8. EJECUCIÓN DE LA API (POST)
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes?tenantId=${encodeURIComponent(tenantId)}`
        : "/api/viajes";
      await apiJson(path, () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          etapa: estado,
          clienteId: principal.clienteId.trim(),
          ...(externo
            ? {
                transportistaId: transportistaId.trim(),
                contratanteRealizaFlete: realizaFlete,
                transportistaEfectivoId: realizaFlete
                  ? null
                  : transportistaEfectivoId.trim() || null,
                choferId: choferExternoSeleccionado || null,
                vehiculoIds: vids,
              }
            : {
                transportistaId: null,
                transportistaEfectivoId: null,
                choferId: choferPropioId,
                vehiculoIds: vids,
              }),
          origen: principal.origen.trim(),
          ...destinosPayloadParaApi(destinosVal.destinos),
          fechaCarga: fechaHoraToIso(fechaCarga, horaCarga),
          fechaDescarga: fechaHoraToIso(fechaDescarga, horaDescarga),
          productoItems: principal.productoItems.filter((x) => x.productoId.trim()),
          detalleCarga: detalleCarga.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          numeroIdentificacionPersonalizado:
            numeroIdentificacionPersonalizado.trim() || undefined,
          kmRecorridos:
            kmNum !== undefined && Number.isFinite(kmNum) ? kmNum : undefined,
          litrosConsumidos:
            litNum !== undefined && Number.isFinite(litNum)
              ? litNum
              : undefined,
          monto: desgloseActivo ? undefined : montoNum,
          monedaMonto: principal.moneda,
          precioTransportistaExterno: desgloseActivo ? undefined : precioTransportistaNum,
          monedaPrecioTransportistaExterno: monedaPrecioTransportista,
          precioTransportistaIvaIncluidoPct:
            externo && precioTransportistaIvaIncluidoPct.trim()
              ? Number(precioTransportistaIvaIncluidoPct.replace(",", "."))
              : undefined,
          cantidadFactura: desgloseActivo && principal.cantidadStr.trim() ? Number(principal.cantidadStr.replace(",", ".")) : undefined,
          precioUnitarioFactura: desgloseActivo ? parseCurrencyForMoneda(principal.precioUnitarioStr, principal.moneda) : undefined,
          cantidadTransportista: desgloseActivo && externo && cantidadTransportista.trim() ? Number(cantidadTransportista.replace(",", ".")) : undefined,
          precioUnitarioTransportista: desgloseActivo && externo ? parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) : undefined,
          ...gananciaBrutaManualPayload,
          otrosGastos: otrosGastos.map(otroGastoDraftToApi).filter(Boolean),
          pagosTransportista: externo ? pagosTransportistaApi : [],
          clientes: clientesPayloadParaApi(clientesRows.slice(1)),
        }),
      });

      showToast("Viaje creado exitosamente", "success");

      navigate(
        `/viajes${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        {
          replace: true,
          state: {
            ...(tenantId ? { tenantId } : {}),
            sessionMaestro: {
              clientes: sessionClientes,
              choferes: mergeMaestroPorId(
                sessionChoferes,
                localChoferesRapidos,
              ),
              transportistas: sessionTransportistas,
              vehiculos: sessionVehiculos,
            },
          } satisfies { tenantId?: string; sessionMaestro: MaestroListasViaje },
        },
      );
    } catch (e) {
      setError(friendlyError(e, "viajes"));

      if (e instanceof ApiError && e.status === 400) {
        const body = e.body as { fieldErrors?: Record<string, string> } | undefined;
        if (body?.fieldErrors) {
          const { monto, cantidadFactura, precioUnitarioFactura, ...resto } =
            body.fieldErrors;
          const principalMsg = monto || cantidadFactura || precioUnitarioFactura;
          if (principalMsg) {
            setError(principalMsg);
            setStep(1);
          } else if (
            ["precioTransportistaExterno", "cantidadTransportista", "precioUnitarioTransportista", "gananciaBrutaManual"].some(
              (k) => k in resto,
            )
          ) {
            setStep(2);
          }
          setFieldErrors(resto);
        }
      }

      showToast("No se pudo crear el viaje", "error");
    }
  }

  function confirmKmLitrosModalCreate() {
    const p = parseKmLitrosOpcionales(modalKm, modalLitros);
    if (!p.ok) {
      setKmLitrosFieldError(p.message);
      return;
    }
    setKmLitrosModalOpen(false);
    setKmLitrosFieldError(null);
    if (p.km !== undefined) setKmRecorridos(String(p.km));
    if (p.litros !== undefined) setLitrosConsumidos(String(p.litros));
    void onSubmit({ kmLitrosFromModal: true, km: p.km, litros: p.litros });
  }

  // Desglose transportista: pago bruto (cantidad × precio unitario), pago neto (bruto
  // "engrosado" sumándole el % de IVA) y el monto de IVA.
  const desglosePagoBruto =
    (Number(cantidadTransportista.replace(",", ".")) || 0) *
    (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) || 0);
  const desglosePctIva =
    Number(precioTransportistaIvaIncluidoPct.replace(",", ".")) || 0;
  const desglosePagoNeto = engrosarConIva(desglosePagoBruto, desglosePctIva);
  const desgloseMontoIva = desglosePagoNeto - desglosePagoBruto;

  function handleMonedaPrecioTransportistaChange(m: ViajeMonedaCodigo) {
    if (!desgloseActivo) {
      setPrecioTransportistaExterno((prev) =>
        preserveAmountOnMonedaChange(prev, monedaPrecioTransportista, m),
      );
    }
    setMonedaPrecioTransportista(m);
  }

  function handleRealizaFleteChange(v: boolean) {
    setTransportistaEfectivoError(null);
    setRealizaFlete(v);
    if (v) setTransportistaEfectivoId("");
  }

  const opcionesProducto = productosCatalogo.map<OpcionProducto>((p) => ({
    id: p.id,
    nombre: p.nombre,
    activo: p.activo,
  }));

  const mostrarGananciaBrutaManual = isVisible("alta_viaje", "gananciaBrutaManual");
  const mostrarPagosTransportista =
    modoOperacion === "externo" && isVisible("alta_viaje", "pagosTransportista");

  // ─── RENDERIZADO ──────────────────────────────────────────────────────────
  return (
    <>
      <CrudPageLayout title="Crear viaje" contentClassName="w-full min-w-0">
        {loadingRefs ? (
          <p className="mt-6 text-vialto-steel">Cargando referencias…</p>
        ) : (
          <form
            autoComplete="off"
            className="mt-6 max-w-2xl mx-auto space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="flex justify-center">
              <Stepper steps={VIAJE_CREATE_STEPS} currentStep={step} />
            </div>

            {step > 1 && (
              <div className="mb-6">
                <ViajeCreateResumenClientes clientesRows={clientesRows} clientes={clientes} />
              </div>
            )}

            <div className="bg-white rounded-lg border border-black/10 p-6">
            {step === 1 && (
              <ViajeCreateStep1ClientesYCarga
                clientesRows={clientesRows}
                onClientesRowsChange={(rows) => {
                  setClientesRows(rows);
                  setClientesRowErrors({});
                  setError(null);
                }}
                clientesRowErrors={clientesRowErrors}
                clientes={clientes}
                desgloseActivo={desgloseActivo}
                mostrarProductos={isVisible("alta_viaje", "productoItems")}
                paises={paisesConSesion}
                paisesLoading={paisesLoading}
                onNuevoPaisOrigen={(clienteIndex) => {
                  setPaisQuickCreateTarget({ kind: "origen-cliente", clienteIndex });
                  setQuickCreate("pais");
                }}
                onNuevoPaisDestino={(clienteIndex, destinoIndex) => {
                  setPaisQuickCreateTarget({ kind: "destino-cliente", clienteIndex, destinoIndex });
                  setQuickCreate("pais");
                }}
                onNuevoCliente={(clienteIndex) => {
                  setClienteQuickCreateTarget(clienteIndex);
                  setQuickCreate("cliente");
                }}
                opcionesProducto={opcionesProducto}
                getToken={getToken}
                onProductoCreado={(p) => setProductosCatalogo((prev) => [...prev, p])}
                error={error}
                onContinuar={() => void handleContinuar1()}
              />
            )}

            {step === 2 && (
              <ViajeCreateStep2Operacion
                modoOperacion={modoOperacion}
                onModoChange={applyModoOperacion}
                transportistaId={transportistaId}
                onTransportistaIdChange={(id) => {
                  setTransportistaId(id);
                  setRealizaFlete(true);
                  setTransportistaEfectivoId("");
                  setChoferExternoIdDraft("");
                  if (id) setError(null);
                }}
                transportistas={transportistas}
                fieldErrorTransportistaId={fieldErrors.transportistaId}
                onNuevoTransportista={() => setQuickCreate("transportista")}
                desgloseActivo={desgloseActivo}
                ivaTransportistaVisible={ivaTransportistaVisible}
                cantidadTransportista={cantidadTransportista}
                onCantidadTransportistaChange={setCantidadTransportista}
                precioUnitarioTransportista={precioUnitarioTransportista}
                onPrecioUnitarioTransportistaChange={(v) =>
                  setPrecioUnitarioTransportista(maskCurrencyForMoneda(v, monedaPrecioTransportista))
                }
                monedaPrecioTransportista={monedaPrecioTransportista}
                onMonedaPrecioTransportistaChange={handleMonedaPrecioTransportistaChange}
                precioTransportistaIvaIncluidoPct={precioTransportistaIvaIncluidoPct}
                onPrecioTransportistaIvaIncluidoPctChange={setPrecioTransportistaIvaIncluidoPct}
                desglosePagoBruto={desglosePagoBruto}
                desglosePagoNeto={desglosePagoNeto}
                desgloseMontoIva={desgloseMontoIva}
                precioTransportistaExterno={precioTransportistaExterno}
                onPrecioTransportistaExternoChange={(v) =>
                  setPrecioTransportistaExterno(maskCurrencyForMoneda(v, monedaPrecioTransportista))
                }
                realizaFlete={realizaFlete}
                onRealizaFleteChange={handleRealizaFleteChange}
                transportistaEfectivoId={transportistaEfectivoId}
                onTransportistaEfectivoIdChange={(id) => {
                  setTransportistaEfectivoError(null);
                  setTransportistaEfectivoId(id);
                  setError(null);
                }}
                transportistaEfectivoError={transportistaEfectivoError}
                choferExternoId={choferExternoId}
                onChoferExternoIdChange={setChoferExternoIdDraft}
                choferesExterno={choferesExterno}
                onNuevoChoferExterno={() => setQuickCreate("chofer-ext")}
                vehiculosExternosRows={vehiculosExternosRows}
                onVehiculosExternosRowsChange={(rows) => {
                  setVehiculosExternosRows(rows);
                  setError(null);
                }}
                choferId={choferId}
                onChoferIdChange={setChoferIdDraft}
                choferesPropios={choferesPropios}
                onNuevoChoferPropio={() => setQuickCreate("chofer-prop")}
                ayudaFlotaChofer={ayudaFlota.chofer}
                vehiculosRows={vehiculosRows}
                onVehiculosRowsChange={(rows) => {
                  setVehiculosRows(rows);
                  setError(null);
                }}
                vehiculosPropios={vehiculosPropios}
                ayudaFlotaVehiculo={ayudaFlota.vehiculo}
                vehiculos={vehiculos}
                onRefreshVehiculosPropios={() => void refreshFlotaVehiculos()}
                onRefreshVehiculosExternos={() => void refreshVehiculosMaestro()}
                refreshingFlota={refreshingFlota}
                getToken={getToken}
                tenantId={tenantId}
                onVehiculoCreado={(v) => setSessionVehiculos((prev) => [...prev, v])}
                mostrarGananciaBrutaManual={mostrarGananciaBrutaManual}
                gananciaDraft={buildGananciaDraft()}
                onGananciaBrutaManualPatch={(p) => {
                  if (p.gananciaBrutaManual !== undefined)
                    setGananciaBrutaManual(p.gananciaBrutaManual);
                  if (p.monedaGananciaBrutaManual !== undefined) {
                    setMonedaGananciaBrutaManual(p.monedaGananciaBrutaManual);
                  }
                  setError(null);
                }}
                mostrarPagosTransportista={mostrarPagosTransportista}
                pagosTransportista={pagosTransportista}
                onPagosTransportistaChange={(rows) => {
                  setPagosTransportista(rows);
                  setError(null);
                }}
                error={error}
                onVolver={() => setStep(1)}
                onContinuar={() => void handleContinuar2()}
              />
            )}

            {step === 3 && (
              <ViajeCreateStep3Cierre
                labelIdentificacion={labelIdentificacionPersonalizadaViajes(maestro.tenant)}
                numeroIdentificacionPersonalizado={numeroIdentificacionPersonalizado}
                onNumeroIdentificacionChange={setNumeroIdentificacionPersonalizado}
                fechaCarga={fechaCarga}
                horaCarga={horaCarga}
                fechaDescarga={fechaDescarga}
                horaDescarga={horaDescarga}
                onFechasPatch={(p) => {
                  if (p.fechaCarga !== undefined) {
                    setFechaCarga(p.fechaCarga);
                    if (p.fechaCarga) setFechaCargaError(null);
                  }
                  if (p.horaCarga !== undefined) setHoraCarga(p.horaCarga);
                  if (p.fechaDescarga !== undefined) {
                    setFechaDescarga(p.fechaDescarga);
                    if (p.fechaDescarga) setFechaDescargaError(null);
                  }
                  if (p.horaDescarga !== undefined) setHoraDescarga(p.horaDescarga);
                }}
                fechaCargaError={fechaCargaError}
                fechaDescargaError={fechaDescargaError}
                mostrarKmLitros={etapaMuestraKmLitros(estado)}
                mostrarKm={isVisible("alta_viaje", "kmRecorridos")}
                mostrarLitros={isVisible("alta_viaje", "litrosConsumidos")}
                kmRecorridos={kmRecorridos}
                onKmRecorridosChange={setKmRecorridos}
                litrosConsumidos={litrosConsumidos}
                onLitrosConsumidosChange={setLitrosConsumidos}
                mostrarDetalleCarga={isVisible("alta_viaje", "detalleCarga")}
                detalleCarga={detalleCarga}
                onDetalleCargaChange={setDetalleCarga}
                mostrarObservaciones={isVisible("alta_viaje", "observaciones")}
                observaciones={observaciones}
                onObservacionesChange={setObservaciones}
                mostrarOtrosGastos={isVisible("alta_viaje", "otrosGastos")}
                otrosGastos={otrosGastos}
                onOtrosGastosChange={setOtrosGastos}
                gastoAutor={gastoAutor}
                tenantId={tenantId || undefined}
                error={error}
                loading={loading}
                onVolver={() => setStep(2)}
              />
            )}
            </div>
          </form>
        )}
        <ViajeKmLitrosDialog
          open={kmLitrosModalOpen}
          title="Km y litros del viaje"
          km={modalKm}
          litros={modalLitros}
          error={kmLitrosFieldError}
          busy={loading}
          onKmChange={setModalKm}
          onLitrosChange={setModalLitros}
          onConfirm={confirmKmLitrosModalCreate}
          onCancel={() => {
            setKmLitrosModalOpen(false);
            setKmLitrosFieldError(null);
          }}
        />
      </CrudPageLayout>

      {/* MODALES DE CREACIÓN RÁPIDA */}
      {quickCreate === "pais" && (
        <PaisModal
          getToken={getToken}
          tenantId={tenantId || undefined}
          onClose={() => {
            setQuickCreate(null);
            setPaisQuickCreateTarget({ kind: "origen-cliente", clienteIndex: 0 });
          }}
          onSaved={(p: Pais) => {
            setSessionPaises((prev) => [...prev, p]);
            const codigo = (p.codigo || p.id) as PaisCodigo;
            const target = paisQuickCreateTarget;
            if (target.kind === "origen-cliente") {
              const ci = target.clienteIndex;
              setClientesRows((rows) =>
                rows.map((r, i) =>
                  i === ci ? { ...r, paisOrigen: codigo, origen: "" } : r,
                ),
              );
            } else {
              const { clienteIndex, destinoIndex } = target;
              setClientesRows((rows) =>
                rows.map((r, i) =>
                  i === clienteIndex
                    ? {
                        ...r,
                        destinosRows: r.destinosRows.map((d, j) =>
                          j === destinoIndex ? { ...d, pais: codigo, etiqueta: "" } : d,
                        ),
                      }
                    : r,
                ),
              );
            }
            setQuickCreate(null);
            setPaisQuickCreateTarget({ kind: "origen-cliente", clienteIndex: 0 });
          }}
        />
      )}
      {quickCreate === "cliente" && (
        <ClienteModal
          getToken={getToken}
          tenantId={tenantId || undefined}
          onClose={() => setQuickCreate(null)}
          onSaved={(c) => {
            setSessionClientes((prev) => [...prev, c]);
            const ci = clienteQuickCreateTarget;
            setClientesRows((rows) =>
              rows.map((r, i) => (i === ci ? { ...r, clienteId: c.id } : r)),
            );
            setQuickCreate(null);
          }}
        />
      )}
      {quickCreate === "transportista" && (
        <TransportistaModal
          getToken={getToken}
          tenantId={tenantId || undefined}
          onClose={() => setQuickCreate(null)}
          onSaved={(t) => {
            setSessionTransportistas((prev) => [...prev, t]);
            setTransportistaId(t.id);
            setQuickCreate(null);
          }}
        />
      )}
      {(quickCreate === "chofer-ext" || quickCreate === "chofer-prop") && (
        <ChoferModal
          getToken={getToken}
          tenantId={tenantId || undefined}
          transportistaId={
            quickCreate === "chofer-ext" ? transportistaId : undefined
          }
          onClose={() => setQuickCreate(null)}
          onSaved={(c) => {
            setSessionChoferes((prev) => [...prev, c]);
            setLocalChoferesRapidos((prev) => [...prev, c]);
            if (tenantId) {
              setLocalChoferes((prev) => mergeMaestroPorId(prev, [c]));
            }
            if (quickCreate === "chofer-ext") {
              setChoferExternoIdDraft(c.id);
            } else {
              setChoferIdDraft(c.id);
            }
            setQuickCreate(null);
          }}
        />
      )}
    </>
  );
}

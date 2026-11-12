import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { Stepper } from "@/components/ui/Stepper";
import { useWizardStep } from "@/hooks/useWizardStep";
import { PaisModal } from "@/components/viajes/PaisModal";
import type { Pais, Tenant } from "@/types/api";
import { type ViajeOperacionModo } from "@/components/viajes/ViajeOperacionTipoFieldset";
import { ViajeKmLitrosDialog } from "@/components/viajes/ViajeKmLitrosDialog";
import { type GananciaBrutaManualDraftSlice } from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import { draftRequiereGananciaBrutaManual } from "@/lib/viajesGananciaBruta";
import {
  otroGastoAutorFromClerk,
  otroGastoDraftToApi,
  otrosGastosIncompletos,
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
  clientesRowsIncompletos,
  faltantesPorFila,
  conPaisFijo,
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
import { useTipoFlotaVisible } from "@/hooks/useTipoFlotaVisible";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import { ProductoLabelsProvider } from "@/hooks/useProductoLabels";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { resolverPaisFijoViaje } from "@/lib/paisFijoViaje";
import { DireccionesSugeridasProvider } from "@/hooks/useDireccionesSugeridas";
import {
  labelIdentificacionPersonalizadaViajes,
  idSistemaHabilitado,
  idPropio1Habilitado,
  idPropio2Habilitado,
  idPropio2Label,
  labelCantidadViajes,
} from "@/lib/viajesFlota";
import { roundMoney2 } from "@/lib/facturaTotales";
import { opcionDesdeProducto, type OpcionProducto } from "@/lib/productosViaje";
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
  const {
    flotaPropiaVisible,
    transportistaExternoVisible,
    defaultCreacion: defaultFlotaCreacion,
    tenantCargado: tenantFlotaCargado,
  } = useTipoFlotaVisible(tenantId || undefined);
  // Tenant efectivo (propio u override de superadmin), para el label de "Producto".
  const { tenant: tenantEfectivo } = useTenantPaisFijo(tenantId || undefined);
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
  const [idPropio2, setIdPropio2] = useState("");
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

  // Solo se usa en modo superadmin (`tenantId` presente): `useMaestroData()` resuelve el
  // tenant logueado, no el elegido — ver `tenantConfig` más abajo.
  const [tenantConfigPlatform, setTenantConfigPlatform] = useState<Tenant | null>(null);
  const [tenantConfigPlatformListo, setTenantConfigPlatformListo] = useState(false);
  useEffect(() => {
    if (!tenantId || !isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) setTenantConfigPlatform(data);
      } catch {
        if (!cancelled) setTenantConfigPlatform(null);
      } finally {
        if (!cancelled) setTenantConfigPlatformListo(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  const tenantConfig = tenantId ? tenantConfigPlatform : maestro.tenant;
  // El formulario espera la config de la empresa: sin ella no se sabe si el país va
  // fijo, y el selector aparecería un momento para después desaparecer.
  const { loading: tenantPropioLoading } = useCurrentTenant();
  const tenantConfigListo = tenantId ? tenantConfigPlatformListo : !tenantPropioLoading;
  /** País fijo si el tenant tiene `paisOrigenDestinoOculto` (ver `resolverPaisFijoViaje`). */
  const paisFijo = useMemo(
    () => resolverPaisFijoViaje(tenantConfig, paisesConSesion),
    [tenantConfig, paisesConSesion],
  );
  /** `Tenant.recomendacionCiudadesHabilitada` (default true): false = ciudades en texto libre. */
  const sugerenciasCiudad = tenantConfig?.recomendacionCiudadesHabilitada !== false;

  // El selector de país queda oculto en la UI cuando `paisFijo` está seteado (ver
  // `ViajeClientesFieldset`/`ViajeDestinosLista`) — acá se garantiza que lo que se valida
  // y se manda a la API sea siempre ese país, sin depender de qué traían las filas.
  useEffect(() => {
    if (!paisFijo) return;
    const codigo = paisFijo.codigo || paisFijo.id;
    setClientesRows((prev) => {
      const yaNormalizado = prev.every(
        (r) =>
          r.paisOrigen === codigo && r.destinosRows.every((d) => d.pais === codigo),
      );
      return yaNormalizado ? prev : conPaisFijo(prev, codigo);
    });
    // Repite también cuando cambian las filas (ej. "+ Agregar cliente"/"+ Agregar destino"),
    // para que una fila nueva quede normalizada antes de poder enviarse — la guarda
    // `yaNormalizado` evita el loop (no vuelve a setear si ya está todo en el país fijo).
  }, [paisFijo, clientesRows]);

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
  const loadingRefs =
    (tenantId ? localLoadingRefs : maestro.loading) || !tenantConfigListo;
  const [error, setErrorEstado] = useState<string | null>(null);
  // Se vacía y se vuelve a poner en el próximo frame para que el aviso del pie
  // (`ErrorPieModal`) zumbe en cada intento, aunque el mensaje sea el mismo.
  const setError = useCallback((msg: string | null) => {
    setErrorEstado(null);
    if (msg) requestAnimationFrame(() => setErrorEstado(msg));
  }, []);
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

  // ─── DERIVACIONES DE FLOTA ───────────────────────────────────────────────
  const choferesPropios = useMemo(
    () => choferesFlotaPropia(todosChoferes),
    [todosChoferes],
  );
  const choferesExterno = useMemo(() => {
    const tid = !realizaFlete && transportistaEfectivoId.trim()
      ? transportistaEfectivoId
      : transportistaId;
    return choferesParaTransportistaExterno(todosChoferes, tid);
  }, [todosChoferes, transportistaId, transportistaEfectivoId, realizaFlete]);
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

  // Empresa solo de flota propia: el alta arranca en "externo" por defecto,
  // así que en cuanto carga la config se pasa a flota propia.
  useEffect(() => {
    if (!transportistaExternoVisible && modoOperacion === "externo") {
      applyModoOperacion("propio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportistaExternoVisible, modoOperacion]);

  // Flota mixta con default de creación configurado (Tenant.tipoFlotaDefault):
  // se aplica una sola vez, cuando carga el tenant, para no pisar lo que elija el usuario.
  const defaultFlotaAplicado = useRef(false);
  useEffect(() => {
    if (defaultFlotaAplicado.current || !tenantFlotaCargado) return;
    defaultFlotaAplicado.current = true;
    if (defaultFlotaCreacion === "propia" && modoOperacion !== "propio") {
      applyModoOperacion("propio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFlotaCargado, defaultFlotaCreacion]);

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
  // Alta: todas las tarjetas de cliente completas (ver `validarClientesRows`, modo `completo`).
  const opcionesValidacionClientes = {
    completo: true,
    desglose: desgloseActivo,
  };
  // Después de un intento fallido (Continuar / Agregar cliente / Crear), los campos
  // que faltan se marcan en rojo. Se calcula en vivo: al completar un campo deja de
  // estar marcado sin esperar al próximo click.
  const [marcarFaltantes, setMarcarFaltantes] = useState(false);
  const camposFaltantesClientes = marcarFaltantes
    ? faltantesPorFila(clientesRows, opcionesValidacionClientes)
    : {};
  const hayFaltantesClientes = Object.keys(camposFaltantesClientes).length > 0;

  /** Marca en rojo los obligatorios que faltan (en vivo) + aviso corto en el pie. */
  function avisarFaltantes(msg = "Completá los campos marcados en rojo.") {
    setMarcarFaltantes(true);
    setError(msg);
  }

  /** "+ Agregar cliente": solo si las tarjetas que ya están se completaron. */
  function puedeAgregarCliente(): boolean {
    const incompletos = clientesRowsIncompletos(clientesRows, opcionesValidacionClientes);
    if (!incompletos) {
      setError(null);
      return true;
    }
    avisarFaltantes("Completá los campos marcados en rojo antes de agregar otro cliente.");
    return false;
  }

  /** Campos faltantes en las tarjetas: los marca en rojo + aviso corto. true = faltan. */
  function marcarSiFaltanDatosClientes(): boolean {
    if (!clientesRowsIncompletos(clientesRows, opcionesValidacionClientes)) return false;
    avisarFaltantes();
    return true;
  }

  async function handleContinuar1() {
    if (marcarSiFaltanDatosClientes()) return;
    const clientesValidacion = await validarClientesRows(
      clientesRows,
      sugerenciasCiudad,
      opcionesValidacionClientes,
    );
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
    if (hayFaltantesOperacion()) {
      avisarFaltantes();
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

    const vehiculosRowsVisible = isVisible("alta_viaje", "vehiculosRows");
    const choferPropioVisible = isVisible("alta_viaje", "choferId");

    const vids = externo || !vehiculosRowsVisible
      ? vehiculoIdsDesdeRows(vehiculosExternosRows)
      : vehiculoIdsDesdeRows(vehiculosRows);

    if (!externo && vehiculosRowsVisible && vids.length === 0) {
      setError(
        "Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).",
      );
      return;
    }

    if (!externo) {
      // Si el chofer no es visible, pasamos un string que saltea su chequeo de existencia.
      // Si vehículos no es visible, le pasamos vids vacíos y puenteamos la regla de flotaPropiaVehiculosListaValida.
      if (choferPropioVisible && vehiculosRowsVisible) {
        if (!flotaPropiaVehiculosListaValida(choferIdRef.current.trim(), vids, choferesPropios, vehiculosPropios)) {
          setError("En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).");
          return;
        }
      } else if (choferPropioVisible && !vehiculosRowsVisible) {
        const c = String(choferIdRef.current.trim());
        if (!c || !choferesPropios.some((x) => x.id === c)) {
          setError("En flota propia, elegí chofer de la lista.");
          return;
        }
      } else if (!choferPropioVisible && vehiculosRowsVisible) {
        const vp = vehiculosFlotaPropia(vehiculosPropios);
        const permitidos = new Set(vp.map((x) => x.id));
        if (vids.length === 0 || !vids.every((id) => permitidos.has(id))) {
          setError("En flota propia, elegí vehículos de la lista.");
          return;
        }
      }
    }

    const gananciaDraft = buildGananciaDraft();
    const principalMonto = desgloseActivo
      ? (Number(clientesRows[0]?.cantidadStr.replace(",", ".")) || 0) *
        (parseCurrencyForMoneda(clientesRows[0]?.precioUnitarioStr, clientesRows[0]?.moneda) || 0)
      : parseCurrencyForMoneda(clientesRows[0]?.montoStr, clientesRows[0]?.moneda);
    const precioTransp = desgloseActivo
      ? (Number(cantidadTransportista.replace(",", ".")) || 0) *
        (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) || 0)
      : parseCurrencyForMoneda(precioTransportistaExterno, monedaPrecioTransportista);

    if (
      principalMonto != null &&
      principalMonto > 0 &&
      precioTransp != null &&
      precioTransp > 0 &&
      draftRequiereGananciaBrutaManual(gananciaDraft)
    ) {
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

    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: transportistaId.trim(),
          precioTransportistaExterno: String(
            (pagoNetoTransportista ?? pagoBrutoTransportista ?? 0)
          ),
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

    // 1. Obligatorios de los 3 pasos: se marcan en rojo y se vuelve al paso que falta.
    setFieldErrors({});
    if (marcarSiFaltanDatosClientes()) {
      setStep(1);
      return;
    }
    if (hayFaltantesOperacion()) {
      avisarFaltantes();
      setStep(2);
      return;
    }
    if (hayFaltantesCierre()) {
      avisarFaltantes();
      setStep(3);
      return;
    }
    const clientesValidacion = await validarClientesRows(
      clientesRows,
      sugerenciasCiudad,
      opcionesValidacionClientes,
    );
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
    if (!sugerenciasCiudad && !principal.origen.trim()) {
      setError("Ingresá el origen.");
      setStep(1);
      return;
    }
    if (sugerenciasCiudad) {
      const okOrigen = await esEtiquetaCiudadValida(principal.paisOrigen, principal.origen);
      if (!okOrigen) {
        setError("El origen debe elegirse de la lista de ciudades (no se admite texto libre).");
        setStep(1);
        return;
      }
    }
    const destinosVal = await validarDestinosRows(principal.destinosRows, sugerenciasCiudad);
    if (!destinosVal.ok) {
      setError(destinosVal.message);
      setStep(1);
      return;
    }

    // 5. Validaciones de Fechas de Carga y Descarga
    const fcError = !fechaCarga.trim() ? "Ingresá la fecha de carga." : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(null);
    if (fcError) {
      setStep(3);
      return;
    }
    if (fechaDescarga.trim() && fechaDescarga < fechaCarga) {
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
    const montoValido = montoNum != null && montoNum >= 0.01;

    const precioTransportistaNum = desgloseActivo
      ? (Number(cantidadTransportista.replace(",", ".")) || 0) *
        (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) || 0)
      : parseCurrencyForMoneda(precioTransportistaExterno, monedaPrecioTransportista);
    const precioTransportistaValido =
      precioTransportistaNum != null && precioTransportistaNum >= 0.01;

    const gananciaDraft = buildGananciaDraft();
    let gananciaBrutaManualPayload: {
      gananciaBrutaManual: number | null;
      monedaGananciaBrutaManual: string | null;
    } = { gananciaBrutaManual: null, monedaGananciaBrutaManual: null };
    if (
      montoValido &&
      precioTransportistaValido &&
      draftRequiereGananciaBrutaManual(gananciaDraft)
    ) {
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
    const pagosTransportistaApi =
      pagosTransportistaDraftsToApi(pagosTransportista);
    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: transportistaId.trim(),
          precioTransportistaExterno: String(
            (pagoNetoTransportista ?? pagoBrutoTransportista ?? 0)
          ),
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

    if (!idSistemaHabilitado(maestro.tenant) && !numeroIdentificacionPersonalizado.trim()) {
      setError(
        `${labelIdentificacionPersonalizadaViajes(maestro.tenant)} es obligatorio: tu empresa tiene deshabilitado el ID Sistema.`,
      );
      return;
    }

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
          idPropio2: idPropio2.trim() || undefined,
          kmRecorridos:
            kmNum !== undefined && Number.isFinite(kmNum) ? kmNum : undefined,
          litrosConsumidos:
            litNum !== undefined && Number.isFinite(litNum)
              ? litNum
              : undefined,
          monto: desgloseActivo ? undefined : (montoValido ? montoNum : undefined),
          monedaMonto: principal.moneda,
          precioTransportistaExterno: desgloseActivo ? undefined : (precioTransportistaValido ? precioTransportistaNum : undefined),
          monedaPrecioTransportistaExterno: monedaPrecioTransportista,
          precioTransportistaIvaIncluidoPct:
            externo && precioTransportistaIvaIncluidoPct.trim()
              ? Number(precioTransportistaIvaIncluidoPct.replace(",", "."))
              : undefined,
          cantidadFactura: desgloseActivo && principal.cantidadStr.trim() ? Number(principal.cantidadStr.replace(",", ".")) : undefined,
          precioUnitarioFactura: desgloseActivo && principal.precioUnitarioStr.trim() ? (parseCurrencyForMoneda(principal.precioUnitarioStr, principal.moneda) ?? undefined) : undefined,
          cantidadTransportista: desgloseActivo && externo && cantidadTransportista.trim() ? Number(cantidadTransportista.replace(",", ".")) : undefined,
          precioUnitarioTransportista: desgloseActivo && externo && precioUnitarioTransportista.trim() ? (parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) ?? undefined) : undefined,
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

  // Pago bruto al transportista: con desglose = cantidad × precio unitario; sin desglose =
  // el "Precio transporte" cargado. Con % IVA visible, se engrosa a pago neto / monto IVA.
  const pagoBrutoTransportista: number | null = desgloseActivo
    ? (cantidadTransportista.trim() && precioUnitarioTransportista.trim()
        ? (Number(cantidadTransportista.replace(",", ".")) || 0) *
          (parseCurrencyForMoneda(
            precioUnitarioTransportista,
            monedaPrecioTransportista,
          ) || 0)
        : null)
    : (precioTransportistaExterno.trim()
        ? (parseCurrencyForMoneda(
            precioTransportistaExterno,
            monedaPrecioTransportista,
          ) ?? null)
        : null);
  const pctIvaTransportista =
    Number(precioTransportistaIvaIncluidoPct.replace(",", ".")) || 0;
  const pagoNetoTransportista =
    pagoBrutoTransportista != null
      ? engrosarConIva(pagoBrutoTransportista, pctIvaTransportista)
      : null;
  const montoIvaTransportista =
    pagoNetoTransportista != null && pagoBrutoTransportista != null
      ? pagoNetoTransportista - pagoBrutoTransportista
      : null;

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

  const opcionesProducto = productosCatalogo.map<OpcionProducto>((p) =>
    opcionDesdeProducto(p),
  );

  const mostrarGananciaBrutaManual = isVisible("alta_viaje", "gananciaBrutaManual");
  const mostrarPagosTransportista =
    modoOperacion === "externo" && isVisible("alta_viaje", "pagosTransportista");

  // ─── OBLIGATORIOS QUE FALTAN (pasos 2 y 3) ────────────────────────────────
  // Se calculan siempre a partir de lo cargado; solo se muestran en rojo después de
  // un intento fallido (`marcarFaltantes`), y dejan de estarlo al completarse.
  const opExterno = modoOperacion === "externo";
  const faltantesOp = {
    transportista: opExterno && !transportistaId.trim(),
    cantidadTransportista:
      opExterno &&
      desgloseActivo &&
      cantidadTransportista.trim() !== "" &&
      !(Number(cantidadTransportista.replace(",", ".")) >= 0),
    precioUnitarioTransportista:
      opExterno &&
      desgloseActivo &&
      precioUnitarioTransportista.trim() !== "" &&
      !((parseCurrencyForMoneda(precioUnitarioTransportista, monedaPrecioTransportista) ?? -1) >= 0),
    precioTransportista:
      opExterno &&
      !desgloseActivo &&
      precioTransportistaExterno.trim() !== "" &&
      !((parseCurrencyForMoneda(precioTransportistaExterno, monedaPrecioTransportista) ?? -1) >= 0),
    chofer: !opExterno && isVisible("alta_viaje", "choferId") && !choferId.trim(),
    vehiculos:
      !opExterno &&
      isVisible("alta_viaje", "vehiculosRows") &&
      vehiculoIdsDesdeRows(vehiculosRows).length === 0,
    gananciaManual:
      draftRequiereGananciaBrutaManual(buildGananciaDraft()) &&
      parseCurrencyForMoneda(gananciaBrutaManual, monedaGananciaBrutaManual) == null,
  };
  const faltantesCierre = {
    fechaCarga: !fechaCarga.trim(),
    idPropio1:
      idPropio1Habilitado(maestro.tenant) &&
      !idSistemaHabilitado(maestro.tenant) &&
      !numeroIdentificacionPersonalizado.trim(),
    gastos: isVisible("alta_viaje", "otrosGastos") && otrosGastosIncompletos(otrosGastos),
  };
  function hayFaltantesOperacion() {
    return Object.values(faltantesOp).some(Boolean);
  }
  function hayFaltantesCierre() {
    return Object.values(faltantesCierre).some(Boolean);
  }
  const marcaOp = (k: keyof typeof faltantesOp) => marcarFaltantes && faltantesOp[k];
  const marcaCierre = (k: keyof typeof faltantesCierre) => marcarFaltantes && faltantesCierre[k];
  const FALTA = "Falta completar";

  // Ya no falta nada en el paso que se ve: se va el rojo y también el aviso del pie.
  const hayAlgunFaltante =
    step === 1
      ? hayFaltantesClientes
      : step === 2
        ? hayFaltantesOperacion()
        : hayFaltantesCierre();
  useEffect(() => {
    if (marcarFaltantes && !hayAlgunFaltante) {
      setMarcarFaltantes(false);
      setError(null);
    }
  }, [marcarFaltantes, hayAlgunFaltante, setError]);

  // ─── RENDERIZADO ──────────────────────────────────────────────────────────
  return (
    <ProductoLabelsProvider tenant={tenantEfectivo}>
      {/* Direcciones de entrega como sugerencias en Origen/Destino (ver CiudadCombobox). */}
      <DireccionesSugeridasProvider tenantId={tenantId || undefined}>
      <CrudPageLayout
        title="Crear viaje"
        contentClassName="w-full min-w-0"
        headerCenter={
          loadingRefs ? undefined : (
            <Stepper steps={VIAJE_CREATE_STEPS} currentStep={step} />
          )
        }
      >
        {loadingRefs ? (
          <p className="mt-6 text-vialto-steel">Cargando referencias…</p>
        ) : (
          <form
            autoComplete="off"
            // Sin validación nativa del navegador (globo "Completá este campo"): los
            // obligatorios se marcan con el estándar del sistema (rojo + "Falta completar").
            noValidate
            className="mt-4 max-w-5xl mx-auto space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {step > 1 && (
              <div className="mb-6">
                <ViajeCreateResumenClientes clientesRows={clientesRows} clientes={clientes} />
              </div>
            )}

            <div className="bg-white rounded-lg border border-black/10 p-6">
            {step === 1 && (
              <ViajeCreateStep1ClientesYCarga
                labelCantidad={labelCantidadViajes(tenantEfectivo)}
                puedeAgregarCliente={puedeAgregarCliente}
                camposFaltantes={camposFaltantesClientes}
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
                paisFijo={paisFijo}
                sugerenciasCiudad={sugerenciasCiudad}
                error={error}
                onContinuar={() => void handleContinuar1()}
              />
            )}

            {step === 2 && (
              <ViajeCreateStep2Operacion
                modoOperacion={modoOperacion}
                onModoChange={applyModoOperacion}
                externoVisible={transportistaExternoVisible}
                propioVisible={flotaPropiaVisible}
                transportistaId={transportistaId}
                onTransportistaIdChange={(id) => {
                  setTransportistaId(id);
                  setRealizaFlete(true);
                  setTransportistaEfectivoId("");
                  setChoferExternoIdDraft("");
                  if (id) setError(null);
                }}
                transportistas={transportistas}
                fieldErrorTransportistaId={fieldErrors.transportistaId ?? (marcaOp("transportista") ? FALTA : undefined)}
                onNuevoTransportista={() => setQuickCreate("transportista")}
                desgloseActivo={desgloseActivo}
                ivaTransportistaVisible={ivaTransportistaVisible}
                cantidadTransportista={cantidadTransportista}
                onCantidadTransportistaChange={setCantidadTransportista}
                fieldErrorCantidadTransportista={fieldErrors.cantidadTransportista ?? (marcaOp("cantidadTransportista") ? FALTA : undefined)}
                precioUnitarioTransportista={precioUnitarioTransportista}
                onPrecioUnitarioTransportistaChange={(v) =>
                  setPrecioUnitarioTransportista(maskCurrencyForMoneda(v, monedaPrecioTransportista))
                }
                fieldErrorPrecioUnitarioTransportista={fieldErrors.precioUnitarioTransportista ?? (marcaOp("precioUnitarioTransportista") ? FALTA : undefined)}
                monedaPrecioTransportista={monedaPrecioTransportista}
                onMonedaPrecioTransportistaChange={handleMonedaPrecioTransportistaChange}
                precioTransportistaIvaIncluidoPct={precioTransportistaIvaIncluidoPct}
                onPrecioTransportistaIvaIncluidoPctChange={setPrecioTransportistaIvaIncluidoPct}
                desglosePagoBruto={pagoBrutoTransportista}
                desglosePagoNeto={pagoNetoTransportista}
                desgloseMontoIva={montoIvaTransportista}
                precioTransportistaExterno={precioTransportistaExterno}
                onPrecioTransportistaExternoChange={(v) =>
                  setPrecioTransportistaExterno(maskCurrencyForMoneda(v, monedaPrecioTransportista))
                }
                fieldErrorPrecioTransportistaExterno={fieldErrors.precioTransportistaExterno ?? (marcaOp("precioTransportista") ? FALTA : undefined)}
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
                mostrarChoferExterno={isVisible("alta_viaje", "choferExternoId")}
                mostrarVehiculosExternos={isVisible("alta_viaje", "vehiculosRows")}
                mostrarChoferPropio={isVisible("alta_viaje", "choferId")}
                mostrarVehiculosPropios={isVisible("alta_viaje", "vehiculosRows")}
                vehiculosRows={vehiculosRows}
                onVehiculosRowsChange={(rows) => {
                  setVehiculosRows(rows);
                  setError(null);
                }}
                vehiculosPropios={vehiculosPropios}
                ayudaFlotaVehiculo={ayudaFlota.vehiculo}
                vehiculos={vehiculos}
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
                faltaChofer={marcaOp("chofer")}
                faltaVehiculos={marcaOp("vehiculos")}
                faltaGananciaManual={marcaOp("gananciaManual")}
                error={error}
                onVolver={() => setStep(1)}
                onContinuar={() => void handleContinuar2()}
              />
            )}

            {step === 3 && (
              <ViajeCreateStep3Cierre
                mostrarIdPropio1={idPropio1Habilitado(maestro.tenant)}
                idPropio1Requerido={!idSistemaHabilitado(maestro.tenant)}
                labelIdentificacion={labelIdentificacionPersonalizadaViajes(maestro.tenant)}
                numeroIdentificacionPersonalizado={numeroIdentificacionPersonalizado}
                onNumeroIdentificacionChange={setNumeroIdentificacionPersonalizado}
                mostrarIdPropio2={idPropio2Habilitado(maestro.tenant)}
                labelIdPropio2={idPropio2Label(maestro.tenant)}
                idPropio2={idPropio2}
                onIdPropio2Change={setIdPropio2}
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
                fechaCargaError={fechaCargaError ?? (marcaCierre("fechaCarga") ? FALTA : null)}
                faltaIdPropio1={marcaCierre("idPropio1")}
                faltaGastos={marcaCierre("gastos")}
                fechaDescargaError={fechaDescargaError}
                mostrarKmLitros={
                  isVisible("alta_viaje", "kmRecorridos") ||
                  isVisible("alta_viaje", "litrosConsumidos")
                }
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
      </DireccionesSugeridasProvider>
    </ProductoLabelsProvider>
  );
}

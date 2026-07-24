import { useAuth } from "@clerk/clerk-react";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useViajeEditor } from "@/hooks/useViajeEditor";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import { PaisUbicacionSelect } from "@/components/forms/PaisUbicacionSelect";
import { FacturarOpcionModal } from "@/components/viajes/FacturarOpcionModal";
import { AgregarGastoModal } from "@/components/viajes/AgregarGastoModal";
import { RegistrarPagoTransportistaModal } from "@/components/viajes/RegistrarPagoTransportistaModal";
import { ExportarViajeModal } from "@/components/viajes/ExportarViajeModal";
import { EmitirCvlpModal } from "@/components/viajes/EmitirCvlpModal";
import { TipoFacturaClienteModal } from "@/components/viajes/TipoFacturaClienteModal";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import type { FacturaLetra } from "@/lib/arcaCbteTipo";
import { apiJson } from "@/lib/api";
import { useToast } from "@/lib/toast"; // <-- IMPORTACIÓN DEL TOAST
import { friendlyError } from "@/lib/friendlyError";
import {
  mergeMaestroPorId,
  nombreClienteListadoViaje,
  nombreTransportistaExternoListadoViaje,
  nombreTransportistaEfectivoListadoViaje,
  numeroFacturaVisibleViaje,
  textoMontoFacturarListado,
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import {
  ViajeGananciaBrutaCelda,
  ViajeGananciaBrutaColumnHeader,
} from "@/components/viajes/ViajeGananciaBruta";
import { ViajeOrigenDestinoLinea } from "@/components/viajes/ViajeOrigenDestinoLinea";
import { ViajeEditModal } from "@/components/viajes/ViajeEditModal";
import {
  gananciaBrutaManualEnPatchParcial,
  gananciaBrutaMetaDesdeViaje,
} from "@/lib/viajesGananciaBruta";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeAccionesMenu } from "@/components/viajes/ViajeAccionesMenu";
import { ViajesResumenFiltros } from "@/components/viajes/ViajesResumenFiltros";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { otroGastoDraftFromApi } from "@/components/viajes/OtrosGastosFieldset";
import { pagoTransportistaDraftFromApi } from "@/components/viajes/PagosTransportistaFieldset";
import { type PaisCodigo } from "@/lib/ciudades";
import { formatIsoFechaHoraListadoEsAr } from "@/lib/viajeFechaHora";
import {
  viajePermiteBotonFacturar,
  viajePendienteComprobanteCliente,
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
} from "@/lib/viajesComprobantes";
import {
  estadoViajeBadgeClass,
  estadoViajeBadgeClassDefault,
  estadoViajeLabel,
  estadosDisponiblesParaViaje,
  tooltipEstadoViaje,
  viajeEstadoEsFacturadoOCobrado,
  VIAJE_ESTADOS_TODOS,
} from "@/lib/viajesEstados";
import {
  contarViajesPagoTransportistaDesdeApi,
  esFiltroPagoTransportistaValido,
  listarViajesOrdenadosClienteDesdeApi,
  listarViajesPorPagoTransportistaDesdeApi,
  pageSizeApiValido,
  viajeListadoRequiereOrdenCliente,
  VIAJE_PAGO_TRANSPORTISTA_QUERY,
  type ViajePagoTransportistaFiltro,
} from "@/lib/viajesFiltroPagoTransportista";
import {
  listadoTablaBodyRowClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import {
  canAccessFacturacion,
  canAccessIntegracionArca,
} from "@/lib/tenantModules";
import {
  MSG_ARCA_NO_FACTURA_USD,
  MSG_ARCA_NO_LIQUIDA_USD,
  arcaBloqueaFacturarUsd,
  arcaBloqueaLiquidarUsd,
  motivoBloqueoAccionFacturarArcaUsd,
} from "@/lib/arcaUsdRestriction";
import { FacturarSelectorModal } from "@/components/viajes/FacturarSelectorModal";
import type {
  Chofer,
  Cliente,
  Factura,
  Liquidacion,
  PaginatedMeta,
  Producto,
  Transportista,
  Vehiculo,
  Viaje,
} from "@/types/api";
import {
  VIAJE_SORT_DEFAULT,
  appendViajeSortQuery,
  sortViajesListado,
  type ViajeSortDir,
  type ViajeSortField,
} from "@/lib/viajesOrdenamiento";
import { ViajesOrdenamientoMenu } from "@/components/viajes/ViajesOrdenamientoMenu";
import { selectorTabClass } from "@/components/ui/SelectorOpcionesSheet";

type ViajesPaginatedResponse = {
  items: Viaje[];
  meta: PaginatedMeta;
};

export function ViajesTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
} = {}) {
  // ─── HOOKS GLOBALES E INICIALIZACIÓN ─────────────────────────────────────
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const { tenant: currentTenant } = useCurrentTenant();
  const { showToast } = useToast(); // <-- Inicialización del hook para notificaciones

  // Variables de configuración de entorno (superadmin vs usuario normal)
  const platform = Boolean(tenantId?.trim());
  const hasLiquidacionesArca =
    !platform && canAccessIntegracionArca(currentTenant?.modules ?? []);
  const hasFacturacionSinArca =
    !platform &&
    !hasLiquidacionesArca &&
    canAccessFacturacion(currentTenant?.modules ?? []);
  const tid = tenantId?.trim() ?? "";

  // Maestros de datos (dependiendo de si es vista superadmin o normal)
  const [clientesP, setClientesP] = useState<Cliente[]>([]);
  const [choferesP, setChoferesP] = useState<Chofer[]>([]);
  const [transportistasP, setTransportistasP] = useState<Transportista[]>([]);
  const [vehiculosP, setVehiculosP] = useState<Vehiculo[]>([]);
  const clientes = platform ? clientesP : maestro.clientes;
  const choferes = platform ? choferesP : maestro.choferes;
  const transportistas = platform ? transportistasP : maestro.transportistas;
  const vehiculos = platform ? vehiculosP : maestro.vehiculos;

  // ─── CONSTRUCCIÓN DE RUTAS DE API ────────────────────────────────────────
  function viajeApiUrl(id: string) {
    if (!platform) return `/api/viajes/${encodeURIComponent(id)}`;
    return `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tid)}`;
  }

  function facturasPorClienteUrl(clienteId: string) {
    if (!platform) {
      return `/api/facturacion/facturas?clienteId=${encodeURIComponent(clienteId)}`;
    }
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}&clienteId=${encodeURIComponent(clienteId)}`;
  }

  function facturaPatchUrl(facturaId: string) {
    if (!platform)
      return `/api/facturacion/facturas/${encodeURIComponent(facturaId)}`;
    return `/api/platform/facturas/${encodeURIComponent(facturaId)}?tenantId=${encodeURIComponent(tid)}`;
  }

  const facturacionNavExtras = () => (platform ? { tenantId: tid } : {});

  // ─── ESTADOS GLOBALES DE LA VISTA ─────────────────────────────────────────
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Fila donde el usuario abrió el selector de estado con un clic en el badge. */
  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const [exportarViaje, setExportarViaje] = useState<Viaje | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [abriendoEditorViaje, setAbriendoEditorViaje] = useState(false);
  const [viajeDeleteConfirm, setViajeDeleteConfirm] = useState<Viaje | null>(
    null,
  );
  const [deletingViajeId, setDeletingViajeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<ViajeSortField>(
    VIAJE_SORT_DEFAULT.sortBy,
  );
  const [sortDir, setSortDir] = useState<ViajeSortDir>(
    VIAJE_SORT_DEFAULT.sortDir,
  );

  /** Orden aplicado al fetch (evita carrera entre setState y listadoQueryVersion). */
  const ordenamientoAplicadoRef = useRef({
    sortBy: VIAJE_SORT_DEFAULT.sortBy,
    sortDir: VIAJE_SORT_DEFAULT.sortDir,
  });

  const initialEstadoFromUrl = searchParams.get("estado")?.trim() ?? "";
  const initialPagoTransportistaFromUrl = (() => {
    const p = searchParams.get(VIAJE_PAGO_TRANSPORTISTA_QUERY)?.trim() ?? "";
    return esFiltroPagoTransportistaValido(p) ? p : "";
  })();

  /** Filtros de listado (ref para el fetch; la versión fuerza refetch). */
  const filtrosAplicadosRef = useRef({
    clienteId: "",
    transportistaId: "",
    estado: initialEstadoFromUrl,
    pagoTransportista:
      initialPagoTransportistaFromUrl as ViajePagoTransportistaFiltro,
    tipoFecha: "" as "" | "carga" | "descarga",
    fechaDesde: "",
    fechaHasta: "",
    tipoUbicacion: "" as "" | "origen" | "destino",
    /** Etiqueta completa de ciudad (misma que guarda el viaje al elegir del combobox). */
    ubicacion: "",
    periodo: "todos" as "todos" | "desde_hoy" | "anteriores",
  });

  // ─── ESTADOS DE LOS FILTROS DE COLUMNAS ────────────────────────────────────
  /** Cliente seleccionado en filtro de columna (checks y facturación masiva). */
  const [clienteIdFiltroActivo, setClienteIdFiltroActivo] = useState("");
  const [transportistaIdFiltroActivo, setTransportistaIdFiltroActivo] =
    useState("");
  const [estadoFiltro, setEstadoFiltro] = useState(initialEstadoFromUrl);
  const [pagoTransportistaFiltro, setPagoTransportistaFiltro] =
    useState<ViajePagoTransportistaFiltro>(initialPagoTransportistaFromUrl);
  const [tipoFechaFiltro, setTipoFechaFiltro] = useState<
    "" | "carga" | "descarga"
  >("");
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState("");
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState("");
  const [tipoUbicacionFiltro, setTipoUbicacionFiltro] = useState<
    "" | "origen" | "destino"
  >("");
  const [paisUbicacionFiltro, setPaisUbicacionFiltro] =
    useState<PaisCodigo>("AR");
  const [ubicacionFiltro, setUbicacionFiltro] = useState("");
  const [periodoFiltro, setPeriodoFiltro] = useState<
    "todos" | "desde_hoy" | "anteriores"
  >("todos");
  const [listadoQueryVersion, setListadoQueryVersion] = useState(0);

  /** Mientras se vuelve a pedir el listado (filtros, página, etc.). */
  const [listadoRefetching, setListadoRefetching] = useState(false);

  /** Selección para facturar varios viajes juntos (solo con filtro por cliente). */
  const [idsFacturarSeleccion, setIdsFacturarSeleccion] = useState<string[]>(
    [],
  );

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  /** Modal de elección al facturar: nueva factura o agregar a una existente del cliente. */
  const [facturarOpcionState, setFacturarOpcionState] = useState<{
    viaje: Viaje;
    facturas: Factura[];
    letra?: FacturaLetra;
  } | null>(null);
  const [facturarOpcionBusy, setFacturarOpcionBusy] = useState(false);

  // Modales de acciones secundarias
  const [agregarGastoViaje, setAgregarGastoViaje] = useState<Viaje | null>(
    null,
  );
  const [registrarPagoViaje, setRegistrarPagoViaje] = useState<Viaje | null>(
    null,
  );
  const [emitirCvlpViaje, setEmitirCvlpViaje] = useState<Viaje | null>(null);
  const [selectorViaje, setSelectorViaje] = useState<Viaje | null>(null);
  const [tipoFacturaViaje, setTipoFacturaViaje] = useState<Viaje | null>(null);
  const [crearLiqViaje, setCrearLiqViaje] = useState<Viaje | null>(null);

  /** Conteos globales para los chips de acceso rápido en la UI. */
  const [resumen, setResumen] = useState<{
    sinFacturar: number;
    sinCobrar: number;
    sinPagar: number;
    pagados: number;
  } | null>(null);

  /** IDs de viajes que ya tienen al menos una factura asociada (derivado de rows, sin request extra). */
  const viajesConFactura = useMemo(
    () => new Set((rows ?? []).filter((v) => v.facturaId).map((v) => v.id)),
    [rows],
  );

  async function fetchProductosCatalogoParaEditor(): Promise<Producto[]> {
    const url = platform
      ? `/api/platform/stock/productos/paginated?tenantId=${encodeURIComponent(tid)}&page=1&pageSize=100&filtroActivo=activos`
      : "/api/stock/productos/paginated?page=1&pageSize=100&filtroActivo=activos";
    const d = await apiJson<{ items: Producto[] }>(url, () => getToken());
    return d.items;
  }

  async function fetchMaestroListasFresh(): Promise<MaestroListasViaje> {
    if (platform) {
      const q = `tenantId=${encodeURIComponent(tid)}`;
      const [c, ch, tr, vh] = await Promise.all([
        apiJson<Cliente[]>(`/api/platform/clientes?${q}`, () => getToken()),
        apiJson<Chofer[]>(`/api/platform/choferes?${q}`, () => getToken()),
        apiJson<Transportista[]>(`/api/platform/transportistas?${q}`, () =>
          getToken(),
        ),
        apiJson<Vehiculo[]>(`/api/platform/vehiculos?${q}`, () => getToken()),
      ]);
      setClientesP(c);
      setChoferesP(ch);
      setTransportistasP(tr);
      setVehiculosP(vh);
      return { clientes: c, choferes: ch, transportistas: tr, vehiculos: vh };
    }
    const [c, ch, tr, vh] = await Promise.all([
      maestro.refreshClientes(),
      maestro.refreshChoferes(),
      maestro.refreshTransportistas(),
      maestro.refreshVehiculos(),
    ]);
    return { clientes: c, choferes: ch, transportistas: tr, vehiculos: vh };
  }

  const viajeEditor = useViajeEditor({
    getToken,
    apiUrlParaViaje: viajeApiUrl,
    clientes,
    choferes,
    transportistas,
    vehiculos,
    refreshMaestroListas: fetchMaestroListasFresh,
    onEntityCreated: (key, item) => {
      if (!platform) return;
      const mergeOne = <T extends { id: string }>(prev: T[]) =>
        mergeMaestroPorId(prev, [item as unknown as T]);
      if (key === "clientes") setClientesP((prev) => mergeOne(prev));
      if (key === "choferes") setChoferesP((prev) => mergeOne(prev));
      if (key === "transportistas") setTransportistasP((prev) => mergeOne(prev));
      if (key === "vehiculos") setVehiculosP((prev) => mergeOne(prev));
    },
    onViajeRefetched: (viaje) => {
      setRows((prev) => (prev ? prev.map((r) => (r.id === viaje.id ? viaje : r)) : prev));
    },
    onViajeSaved: (viaje) => {
      setRows((prev) => (prev ? prev.map((r) => (r.id === viaje.id ? viaje : r)) : prev));
    },
    fetchProductosCatalogo: fetchProductosCatalogoParaEditor,
  });

  /** Entidades creadas en «Crear viaje» que deben seguir disponibles al volver al listado. */
  useEffect(() => {
    const incoming = (
      location.state as { sessionMaestro?: MaestroListasViaje } | null
    )?.sessionMaestro;
    if (!incoming) return;
    viajeEditor.seedSessionMaestro(incoming);
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.state, navigate]);

  /** Envoltorio: además de delegar al hook, resetea el selector rápido de estado de la fila. */
  function beginEditViaje(v: Viaje, origen: "listado" | "remoto" = "listado") {
    setEstadoQuickId(null);
    return viajeEditor.beginEditViaje(v, origen);
  }

  function cancelEdit() {
    setEstadoQuickId(null);
    viajeEditor.cancelEdit();
  }

  // Variables booleanas para facilitar la legibilidad de la grilla
  const ordenResaltaFechaCarga = sortBy === "fecha_carga";
  const ordenResaltaFechaDescarga = sortBy === "fecha_descarga";

  // Efecto que trae los datos de los maestros si operamos bajo modo superadmin
  useEffect(() => {
    if (!platform || !tid || !isLoaded || !isSignedIn) {
      setClientesP([]);
      setChoferesP([]);
      setTransportistasP([]);
      setVehiculosP([]);
      return;
    }
    let cancelled = false;
    const q = `tenantId=${encodeURIComponent(tid)}`;
    void (async () => {
      try {
        const [c, ch, tr, vh] = await Promise.all([
          apiJson<Cliente[]>(`/api/platform/clientes?${q}`, () => getToken()),
          apiJson<Chofer[]>(`/api/platform/choferes?${q}`, () => getToken()),
          apiJson<Transportista[]>(`/api/platform/transportistas?${q}`, () =>
            getToken(),
          ),
          apiJson<Vehiculo[]>(`/api/platform/vehiculos?${q}`, () => getToken()),
        ]);
        if (!cancelled) {
          setClientesP(c);
          setChoferesP(ch);
          setTransportistasP(tr);
          setVehiculosP(vh);
        }
      } catch {
        if (!cancelled) {
          setClientesP([]);
          setChoferesP([]);
          setTransportistasP([]);
          setVehiculosP([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, tid, isLoaded, isSignedIn, getToken]);

  // Actualiza los badges contadores del inicio ("Sin facturar", "Sin cobrar", etc.)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (platform && !tid) return;
    let cancelled = false;
    (async () => {
      const base = platform
        ? `/api/platform/viajes/paginated?tenantId=${encodeURIComponent(tid)}&`
        : "/api/viajes/paginated?";
      const [estadoSF, estadoSC, pagoSP, pagoPag] = await Promise.allSettled([
        apiJson<ViajesPaginatedResponse>(
          `${base}estado=finalizado_sin_facturar&page=1&pageSize=1`,
          () => getToken(),
        ),
        apiJson<ViajesPaginatedResponse>(
          `${base}estado=facturado_sin_cobrar&page=1&pageSize=1`,
          () => getToken(),
        ),
        contarViajesPagoTransportistaDesdeApi(
          `${base}pagoTransportista=sin_pagar&`,
          "sin_pagar",
          () => getToken(),
        ),
        contarViajesPagoTransportistaDesdeApi(
          `${base}pagoTransportista=pagado&`,
          "pagado",
          () => getToken(),
        ),
      ]);
      if (cancelled) return;
      setResumen({
        sinFacturar:
          estadoSF.status === "fulfilled" ? estadoSF.value.meta.total : 0,
        sinCobrar:
          estadoSC.status === "fulfilled" ? estadoSC.value.meta.total : 0,
        sinPagar: pagoSP.status === "fulfilled" ? pagoSP.value : 0,
        pagados: pagoPag.status === "fulfilled" ? pagoPag.value : 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, platform, tid]);

  // Carga del listado principal y aplicación de los queries de búsqueda / filtrado / orden
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (platform && !tid) return;
    let cancelled = false;
    (async () => {
      try {
        const filtros = new URLSearchParams();
        const {
          clienteId: cid,
          transportistaId: transpFiltro,
          estado: estF,
          pagoTransportista: pagoTranspF,
          tipoFecha: tf,
          fechaDesde: fd,
          fechaHasta: fh,
          tipoUbicacion: tu,
          ubicacion: ut,
          periodo: per,
        } = filtrosAplicadosRef.current;

        // Asignación manual de parámetros para armar la URL del request
        if (cid) filtros.set("clienteId", cid);
        if (transpFiltro) filtros.set("transportistaId", transpFiltro);
        if (estF.trim()) filtros.set("estado", estF.trim());
        if (pagoTranspF === "sin_pagar" || pagoTranspF === "pagado") {
          filtros.set("pagoTransportista", pagoTranspF);
        }
        if ((tf === "carga" || tf === "descarga") && (fd.trim() || fh.trim())) {
          filtros.set("tipoFecha", tf);
          if (fd.trim()) filtros.set("fechaDesde", fd.trim());
          if (fh.trim()) filtros.set("fechaHasta", fh.trim());
        }
        const utTrim = ut.trim();
        if ((tu === "origen" || tu === "destino") && utTrim) {
          filtros.set("tipoUbicacion", tu);
          filtros.set("ubicacion", utTrim);
        }
        if (per === "desde_hoy" || per === "anteriores") {
          filtros.set("periodo", per);
        }

        appendViajeSortQuery(
          filtros,
          ordenamientoAplicadoRef.current.sortBy,
          ordenamientoAplicadoRef.current.sortDir,
        );
        const filtrosQs = filtros.toString();
        const listBase = platform
          ? `/api/platform/viajes/paginated?tenantId=${encodeURIComponent(tid)}${filtrosQs ? `&${filtrosQs}&` : "&"}`
          : `/api/viajes/paginated${filtrosQs ? `?${filtrosQs}&` : "?"}`;

        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeApiValido(pageSize);

        const pagoFiltroActivo =
          pagoTranspF === "sin_pagar" || pagoTranspF === "pagado"
            ? pagoTranspF
            : null;

        let items: Viaje[];
        let meta: PaginatedMeta;

        const sortFetch = ordenamientoAplicadoRef.current;

        // Existen diferentes estrategias de fetch según si ordenamos por pago, cliente o campos genéricos
        if (pagoFiltroActivo) {
          const pagoData = await listarViajesPorPagoTransportistaDesdeApi(
            listBase,
            pagoFiltroActivo,
            pageApi,
            pageSizeApi,
            sortFetch.sortBy,
            sortFetch.sortDir,
            () => getTokenRef.current(),
          );
          items = pagoData.items;
          meta = pagoData.meta;
        } else if (
          viajeListadoRequiereOrdenCliente(sortFetch.sortBy, sortFetch.sortDir)
        ) {
          const ordenData = await listarViajesOrdenadosClienteDesdeApi(
            listBase,
            pageApi,
            pageSizeApi,
            sortFetch.sortBy,
            sortFetch.sortDir,
            () => getTokenRef.current(),
          );
          items = ordenData.items;
          meta = ordenData.meta;
        } else {
          const data = await apiJson<ViajesPaginatedResponse>(
            `${listBase}page=${pageApi}&pageSize=${pageSizeApi}`,
            () => getTokenRef.current(),
          );
          items = sortViajesListado(
            data.items,
            sortFetch.sortBy,
            sortFetch.sortDir,
          );
          meta = data.meta;
        }

        if (!cancelled) {
          setRows(items);
          setMeta(meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, platform ? "plataforma" : "viajes"));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    sortBy,
    sortDir,
    listadoQueryVersion,
    platform,
    tid,
  ]);

  // ─── HANDLERS DE APLICACIÓN DE FILTROS ─────────────────────────────────────
  function aplicarOrdenamiento(
    nuevoSortBy: ViajeSortField,
    nuevoSortDir: ViajeSortDir,
  ) {
    ordenamientoAplicadoRef.current = {
      sortBy: nuevoSortBy,
      sortDir: nuevoSortDir,
    };
    setListadoRefetching(true);
    setSortBy(nuevoSortBy);
    setSortDir(nuevoSortDir);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroColumnaCliente(clienteId: string) {
    const cid = clienteId.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      clienteId: cid,
    };
    setListadoRefetching(true);
    setClienteIdFiltroActivo(cid);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroColumnaTransportista(transportistaId: string) {
    const tid = transportistaId.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      transportistaId: tid,
    };
    setListadoRefetching(true);
    setTransportistaIdFiltroActivo(tid);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroEstado(val: string) {
    const e = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      estado: e,
      ...(e ? { pagoTransportista: "" as ViajePagoTransportistaFiltro } : {}),
    };
    setEstadoFiltro(e);
    if (e) setPagoTransportistaFiltro("");
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroPagoTransportista(val: ViajePagoTransportistaFiltro) {
    const p = val.trim() as ViajePagoTransportistaFiltro;
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      pagoTransportista: p,
      ...(p ? { estado: "" } : {}),
    };
    setPagoTransportistaFiltro(p);
    if (p) setEstadoFiltro("");
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function alinearOrdenConFiltroFecha(
    tf: "" | "carga" | "descarga",
    fd: string,
    fh: string,
  ) {
    if ((tf === "carga" || tf === "descarga") && (fd.trim() || fh.trim())) {
      const sortByFecha = tf === "carga" ? "fecha_carga" : "fecha_descarga";
      ordenamientoAplicadoRef.current = {
        sortBy: sortByFecha,
        sortDir: "asc",
      };
      setSortBy(sortByFecha);
      setSortDir("asc");
    }
  }

  function aplicarTipoFechaFiltro(val: "" | "carga" | "descarga") {
    if (!val) {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoFecha: "",
        fechaDesde: "",
        fechaHasta: "",
      };
      setTipoFechaFiltro("");
      setFechaDesdeFiltro("");
      setFechaHastaFiltro("");
    } else {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoFecha: val,
      };
      setTipoFechaFiltro(val);
      alinearOrdenConFiltroFecha(
        val,
        filtrosAplicadosRef.current.fechaDesde,
        filtrosAplicadosRef.current.fechaHasta,
      );
    }
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFechaDesdeFiltro(val: string) {
    const s = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      fechaDesde: s,
    };
    setFechaDesdeFiltro(s);
    alinearOrdenConFiltroFecha(
      filtrosAplicadosRef.current.tipoFecha,
      s,
      filtrosAplicadosRef.current.fechaHasta,
    );
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFechaHastaFiltro(val: string) {
    const s = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      fechaHasta: s,
    };
    setFechaHastaFiltro(s);
    alinearOrdenConFiltroFecha(
      filtrosAplicadosRef.current.tipoFecha,
      filtrosAplicadosRef.current.fechaDesde,
      s,
    );
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarTipoUbicacionFiltro(val: "" | "origen" | "destino") {
    const habiaCiudadEnFiltro =
      filtrosAplicadosRef.current.ubicacion.trim() !== "";

    if (!val) {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoUbicacion: "",
        ubicacion: "",
      };
      setTipoUbicacionFiltro("");
      setUbicacionFiltro("");
      setPaisUbicacionFiltro("AR");
    } else {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoUbicacion: val,
        ubicacion: "",
      };
      setTipoUbicacionFiltro(val);
      setUbicacionFiltro("");
    }

    /** Solo se pide de nuevo el listado si había ciudad aplicada (se quitó o se cambió origen/destino). */
    if (habiaCiudadEnFiltro) {
      setListadoRefetching(true);
      setPage(1);
      setListadoQueryVersion((v) => v + 1);
    }
  }

  function aplicarPaisUbicacionFiltro(p: PaisCodigo) {
    const habiaCiudadEnFiltro =
      filtrosAplicadosRef.current.ubicacion.trim() !== "";
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      ubicacion: "",
    };
    setUbicacionFiltro("");
    setPaisUbicacionFiltro(p);
    if (habiaCiudadEnFiltro) {
      setListadoRefetching(true);
      setPage(1);
      setListadoQueryVersion((v) => v + 1);
    }
  }

  function aplicarUbicacionCiudadSeleccion(val: string) {
    const s = val.trim().slice(0, 200);
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      ubicacion: s,
    };
    setUbicacionFiltro(s);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarPeriodoFiltro(val: "todos" | "desde_hoy" | "anteriores") {
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      periodo: val,
    };
    setPeriodoFiltro(val);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function limpiarFiltrosColumnas() {
    filtrosAplicadosRef.current = {
      clienteId: "",
      transportistaId: "",
      estado: "",
      pagoTransportista: "",
      tipoFecha: "",
      fechaDesde: "",
      fechaHasta: "",
      tipoUbicacion: "",
      ubicacion: "",
      periodo: "todos",
    };
    setListadoRefetching(true);
    setClienteIdFiltroActivo("");
    setTransportistaIdFiltroActivo("");
    setEstadoFiltro("");
    setPagoTransportistaFiltro("");
    setTipoFechaFiltro("");
    setFechaDesdeFiltro("");
    setFechaHastaFiltro("");
    setTipoUbicacionFiltro("");
    setPaisUbicacionFiltro("AR");
    setUbicacionFiltro("");
    setPeriodoFiltro("todos");
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  const hayFiltrosColumnasActivos =
    !!clienteIdFiltroActivo.trim() ||
    !!transportistaIdFiltroActivo.trim() ||
    !!estadoFiltro.trim() ||
    !!pagoTransportistaFiltro.trim() ||
    !!fechaDesdeFiltro.trim() ||
    !!fechaHastaFiltro.trim() ||
    !!ubicacionFiltro.trim() ||
    periodoFiltro !== "todos";

  /** Una unidad por columna de filtro con criterio aplicado (máx. 5). */
  const cantidadFiltrosColumnasActivos = useMemo(() => {
    let n = 0;
    if (clienteIdFiltroActivo.trim()) n += 1;
    if (transportistaIdFiltroActivo.trim()) n += 1;
    if (estadoFiltro.trim()) n += 1;
    if (pagoTransportistaFiltro.trim()) n += 1;
    if (ubicacionFiltro.trim()) n += 1;
    if (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim()) n += 1;
    if (periodoFiltro !== "todos") n += 1;
    return n;
  }, [
    clienteIdFiltroActivo,
    transportistaIdFiltroActivo,
    estadoFiltro,
    pagoTransportistaFiltro,
    ubicacionFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    periodoFiltro,
  ]);

  // Si cambia el cliente en el filtro, limpiamos la selección para facturar
  useEffect(() => {
    setIdsFacturarSeleccion([]);
  }, [clienteIdFiltroActivo]);

  function esElegibleFacturarLote(v: Viaje): boolean {
    if (!viajePermiteBotonFacturar(v) || viajesConFactura.has(v.id)) return false;
    if (arcaBloqueaFacturarUsd(hasLiquidacionesArca, v.monedaMonto)) return false;
    return true;
  }

  function toggleFacturarLote(id: string) {
    setIdsFacturarSeleccion((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSeleccionarTodosEnPagina() {
    const elegibles = (rows ?? [])
      .filter(esElegibleFacturarLote)
      .map((v) => v.id);
    if (elegibles.length === 0) return;
    const todosMarcados = elegibles.every((id) =>
      idsFacturarSeleccion.includes(id),
    );
    if (todosMarcados) {
      const setE = new Set(elegibles);
      setIdsFacturarSeleccion((prev) => prev.filter((id) => !setE.has(id)));
    } else {
      setIdsFacturarSeleccion((prev) => [...new Set([...prev, ...elegibles])]);
    }
  }

  // ─── RUTEO Y REDIRECCIÓN AL FACTURAR ───────────────────────────────────────
  function facturarSeleccionMultiple() {
    const ids = idsFacturarSeleccion;
    const cid = clienteIdFiltroActivo.trim();
    if (ids.length === 0 || !cid) return;
    if (hasLiquidacionesArca) {
      const seleccion = (rows ?? []).filter((v) => ids.includes(v.id));
      const conUsd = seleccion.some((v) =>
        arcaBloqueaFacturarUsd(true, v.monedaMonto),
      );
      if (conUsd) {
        showToast(MSG_ARCA_NO_FACTURA_USD, "error");
        return;
      }
    }
    navigate("/facturacion", {
      state: {
        ...facturacionNavExtras(),
        newFacturaDraft: {
          clienteId: cid,
          viajeIds: ids,
        },
      },
    });
  }

  function requestDeleteViaje(v: Viaje) {
    setError(null);
    setViajeDeleteConfirm(v);
  }

  // ─── ELIMINACIÓN DEFINITIVA ────────────────────────────────────────────────
  async function confirmDeleteViaje() {
    const v = viajeDeleteConfirm;
    if (!v || deletingViajeId) return;
    setDeletingViajeId(v.id);
    try {
      await apiJson(viajeApiUrl(v.id), () => getToken(), { method: "DELETE" });

      // --> TOAST INYECTADO: ÉXITO AL ELIMINAR <--
      showToast("Viaje eliminado correctamente", "success");

      setRows((prev) => (prev ? prev.filter((r) => r.id !== v.id) : prev));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
      setIdsFacturarSeleccion((ids) => ids.filter((id) => id !== v.id));
      if (viajeEditor.editingId === v.id) cancelEdit();
      if (viewingViaje?.id === v.id) setViewingViaje(null);
      if (exportarViaje?.id === v.id) setExportarViaje(null);
      if (agregarGastoViaje?.id === v.id) setAgregarGastoViaje(null);
      if (registrarPagoViaje?.id === v.id) setRegistrarPagoViaje(null);
      if (emitirCvlpViaje?.id === v.id) setEmitirCvlpViaje(null);
      if (selectorViaje?.id === v.id) setSelectorViaje(null);
      if (tipoFacturaViaje?.id === v.id) setTipoFacturaViaje(null);
      if (facturarOpcionState?.viaje.id === v.id) setFacturarOpcionState(null);
      setViajeDeleteConfirm(null);
    } catch (e) {
      setError(friendlyError(e, platform ? "plataforma" : "viajes"));

      // --> TOAST INYECTADO: ERROR AL ELIMINAR <--
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeletingViajeId(null);
    }
  }

  /** Limpiar ?estado= de la URL una vez aplicado al filtro inicial. */
  useEffect(() => {
    if (
      !searchParams.has("estado") &&
      !searchParams.has(VIAJE_PAGO_TRANSPORTISTA_QUERY)
    )
      return;
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("estado");
        n.delete(VIAJE_PAGO_TRANSPORTISTA_QUERY);
        return n;
      },
      { replace: true },
    );
  }, []);

  /** Abrir editor desde enlace (p. ej. panel de alertas): `?viaje=id` */
  useEffect(() => {
    const id = searchParams.get("viaje")?.trim();
    if (!id || !isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        let v: Viaje | null = rows?.find((r) => r.id === id) ?? null;
        if (!v) {
          v = await apiJson<Viaje>(viajeApiUrl(id), () => getToken());
        }
        if (cancelled || !v) return;
        void beginEditViaje(v, "remoto");
      } catch {
        /* viaje inexistente o sin permiso */
      } finally {
        if (!cancelled) {
          setSearchParams(
            (p) => {
              const next = new URLSearchParams(p);
              next.delete("viaje");
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
  }, [searchParams, isLoaded, isSignedIn, rows, getToken, setSearchParams]);

  // ─── CAMBIO RÁPIDO DE ESTADO (SELECT DESDE LA GRILLA) ─────────────────────
  async function patchEstadoDesdeListado(v: Viaje, nuevoEstado: string) {
    if (nuevoEstado === v.estado) {
      setEstadoQuickId(null);
      return;
    }
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(
        viajeApiUrl(v.id),
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify({
            estado: nuevoEstado,
            ...gananciaBrutaManualEnPatchParcial(v),
          }),
        },
      );
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === v.id ? updated : r)) : prev,
      );
      setEstadoQuickId(null);

      // --> TOAST INYECTADO: ÉXITO AL ACTUALIZAR EL ESTADO <--
      showToast("Estado actualizado correctamente", "success");
    } catch (e) {
      setError(friendlyError(e, "viajes"));

      // --> TOAST INYECTADO: ERROR AL ACTUALIZAR EL ESTADO <--
      showToast("No se pudo actualizar el estado", "error");
    } finally {
      setSavingEstadoId(null);
    }
  }

  function openFacturarFlow(v: Viaje) {
    if (viajeRequiereComprobanteDual(v)) {
      // Dual: primero elegir contraparte; luego el tipo de comprobante (A/B o CVLP 60/61).
      if (hasLiquidacionesArca || hasFacturacionSinArca) {
        setSelectorViaje(v);
        return;
      }
    }
    if (arcaBloqueaFacturarUsd(hasLiquidacionesArca, v.monedaMonto)) {
      showToast(MSG_ARCA_NO_FACTURA_USD, "error");
      return;
    }
    setTipoFacturaViaje(v);
  }

  async function navigateToFacturacion(v: Viaje, letra?: FacturaLetra) {
    try {
      const facturasCliente = await apiJson<Factura[]>(
        facturasPorClienteUrl(v.clienteId ?? ""),
        () => getToken(),
      );
      const yaVinculada = facturasCliente.find((f) =>
        f.viajeIds.includes(v.id),
      );
      if (yaVinculada) {
        navigate("/facturacion", {
          state: { ...facturacionNavExtras(), expandFacturaId: yaVinculada.id },
        });
        return;
      }
      if (facturasCliente.length > 0) {
        setFacturarOpcionState({ viaje: v, facturas: facturasCliente, letra });
        return;
      }
    } catch {
      // si falla la consulta, igualmente navegamos
    }
    navigate("/facturacion", {
      state: {
        ...facturacionNavExtras(),
        newFacturaDraft: {
          clienteId: v.clienteId ?? "",
          viajeIds: [v.id],
          letraComprobante: letra,
        },
      },
    });
  }

  // ─── OPERACIÓN AL CONFIRMAR AÑADIR A FACTURA EXISTENTE O NUEVA ────────────
  async function handleFacturarOpcionConfirm(
    opcion: "nueva" | { facturaId: string },
  ) {
    if (!facturarOpcionState) return;
    const { viaje, facturas, letra } = facturarOpcionState;
    if (opcion === "nueva") {
      setFacturarOpcionState(null);
      navigate("/facturacion", {
        state: {
          ...facturacionNavExtras(),
          newFacturaDraft: {
            clienteId: viaje.clienteId ?? "",
            viajeIds: [viaje.id],
            letraComprobante: letra,
          },
        },
      });
      return;
    }

    // Proceso de agregar a una factura preexistente
    const facturaTarget = facturas.find((f) => f.id === opcion.facturaId);
    if (!facturaTarget) return;
    setFacturarOpcionBusy(true);
    try {
      await apiJson(facturaPatchUrl(opcion.facturaId), () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({
          viajeIds: [...facturaTarget.viajeIds, viaje.id],
        }),
      });
      setFacturarOpcionState(null);

      // --> TOAST INYECTADO: ÉXITO AL ASOCIAR A LA FACTURA <--
      showToast("Viaje agregado a la factura exitosamente", "success");

      navigate("/facturacion", {
        state: { ...facturacionNavExtras(), expandFacturaId: opcion.facturaId },
      });
    } catch (e) {
      setError(friendlyError(e, "facturacion"));

      // --> TOAST INYECTADO: ERROR AL ASOCIAR A LA FACTURA <--
      showToast("No se pudo agregar el viaje a la factura", "error");
    } finally {
      setFacturarOpcionBusy(false);
    }
  }


  const mostrarColumnaFacturarLote = clienteIdFiltroActivo.trim() !== "";
  /** Cliente + transp. externo + estado + recorrido + fechas + monto + ganancia bruta [+ acciones]. */
  const tableColSpanBase = 8;
  const tableColSpan = mostrarColumnaFacturarLote
    ? tableColSpanBase + 1
    : tableColSpanBase;
  const mostrarCargandoListado = !error && (rows === null || listadoRefetching);
  const elegiblesEnPagina = (rows ?? []).filter(esElegibleFacturarLote);
  const todosElegiblesMarcados =
    elegiblesEnPagina.length > 0 &&
    elegiblesEnPagina.every((v) => idsFacturarSeleccion.includes(v.id));

  // ─── RENDER DE LA BARRA DE FILTROS ─────────────────────────────────────────
  const viajesListadoFiltros = (
    <>
      <ListadoFiltroCampo label="Período" active={periodoFiltro !== "todos"}>
        <select
          value={periodoFiltro}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "todos" || v === "desde_hoy" || v === "anteriores") {
              aplicarPeriodoFiltro(v);
            }
          }}
          disabled={listadoRefetching}
          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            periodoFiltro !== "todos"
              ? "text-vialto-fire"
              : "text-vialto-charcoal"
          }`}
          aria-label="Filtrar por período respecto a hoy"
        >
          <option value="todos">Todos los viajes</option>
          <option value="desde_hoy">Desde hoy en adelante</option>
          <option value="anteriores">Solo anteriores a hoy</option>
        </select>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Cliente"
        active={!!clienteIdFiltroActivo.trim()}
      >
        <ClienteSearchSelect
          id="viajes-filtro-cliente"
          clientes={clientes}
          value={clienteIdFiltroActivo}
          onChange={(id) => aplicarFiltroColumnaCliente(id)}
          allowEmptyValue
          emptyListChoiceLabel="Todos"
          placeholderCerrado="Todos"
          disabled={listadoRefetching}
          aria-label="Filtrar listado por cliente"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            clienteIdFiltroActivo.trim()
              ? "text-vialto-fire"
              : "text-vialto-charcoal"
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Transporte"
        active={!!transportistaIdFiltroActivo.trim()}
      >
        <TransportistaSearchSelect
          id="viajes-filtro-transporte"
          transportistas={transportistas}
          value={transportistaIdFiltroActivo}
          onChange={(id) => aplicarFiltroColumnaTransportista(id)}
          placeholderCerrado="Todos"
          emptyListChoiceLabel="Todos"
          disabled={listadoRefetching}
          aria-label="Filtrar listado por transporte"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            transportistaIdFiltroActivo.trim()
              ? "text-vialto-fire"
              : "text-vialto-charcoal"
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Estado" active={!!estadoFiltro.trim()}>
        <select
          value={estadoFiltro}
          onChange={(e) => aplicarFiltroEstado(e.target.value)}
          disabled={listadoRefetching}
          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            estadoFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
          }`}
          aria-label="Filtrar listado por estado"
        >
          <option value="">Todos</option>
          {VIAJE_ESTADOS_TODOS.map((est) => (
            <option key={est} value={est} title={tooltipEstadoViaje(est)}>
              {estadoViajeLabel[est] ?? est}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Origen — Destino"
        active={!!ubicacionFiltro.trim()}
      >
        <div className="flex flex-col gap-2">
          <select
            value={tipoUbicacionFiltro}
            onChange={(e) => {
              const v = e.target.value;
              aplicarTipoUbicacionFiltro(
                v === "origen" || v === "destino" ? v : "",
              );
            }}
            disabled={listadoRefetching}
            className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
              tipoUbicacionFiltro && ubicacionFiltro.trim()
                ? "text-vialto-fire"
                : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por ciudad en origen o en destino"
          >
            <option value="">Sin filtro por ubicación</option>
            <option value="origen">Origen</option>
            <option value="destino">Destino</option>
          </select>
          {tipoUbicacionFiltro ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                País
              </span>
              <PaisUbicacionSelect
                value={paisUbicacionFiltro}
                onChange={(p) => aplicarPaisUbicacionFiltro(p)}
                className="h-8 w-full border border-black/15 bg-white px-2 text-xs text-vialto-charcoal"
                aria-label="País para buscar la ciudad del filtro"
              />
              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                Ciudad
              </span>
              <CiudadCombobox
                pais={paisUbicacionFiltro}
                value={ubicacionFiltro}
                onChange={(next) => aplicarUbicacionCiudadSeleccion(next)}
                inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                  ubicacionFiltro.trim()
                    ? "text-vialto-fire"
                    : "text-vialto-charcoal"
                }`}
                disableBrowserAutocomplete
                aria-label={
                  tipoUbicacionFiltro === "origen"
                    ? "Ciudad de origen (elegir de la lista)"
                    : "Ciudad de destino (elegir de la lista)"
                }
              />
            </div>
          ) : null}
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Carga — Descarga"
        active={!!fechaDesdeFiltro.trim() || !!fechaHastaFiltro.trim()}
      >
        <div className="flex flex-col gap-2">
          <select
            value={tipoFechaFiltro}
            onChange={(e) => {
              const v = e.target.value;
              aplicarTipoFechaFiltro(
                v === "carga" || v === "descarga" ? v : "",
              );
            }}
            disabled={listadoRefetching}
            className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
              tipoFechaFiltro &&
              (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim())
                ? "text-vialto-fire"
                : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por fecha de carga o de descarga"
          >
            <option value="">Sin filtro por fecha</option>
            <option value="carga">Fecha de carga</option>
            <option value="descarga">Fecha de descarga</option>
          </select>
          {tipoFechaFiltro ? (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                Desde
                <input
                  type="date"
                  value={fechaDesdeFiltro}
                  onChange={(e) => aplicarFechaDesdeFiltro(e.target.value)}
                  disabled={listadoRefetching}
                  className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                Hasta
                <input
                  type="date"
                  value={fechaHastaFiltro}
                  onChange={(e) => aplicarFechaHastaFiltro(e.target.value)}
                  disabled={listadoRefetching}
                  className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                />
              </label>
            </div>
          ) : null}
        </div>
      </ListadoFiltroCampo>
    </>
  );

  return (
    <div className="w-full">
      {!embeddedInSuperadmin && (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide text-vialto-charcoal">
            Viajes
          </h1>
        </>
      )}

      {resumen && (
        <div className="mt-3">
          <ViajesResumenFiltros
            resumen={resumen}
            estadoFiltro={estadoFiltro}
            pagoTransportistaFiltro={pagoTransportistaFiltro}
            onFiltroEstado={aplicarFiltroEstado}
            onFiltroPago={aplicarFiltroPagoTransportista}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 lg:flex lg:gap-2">
        {(
          [
            { val: "todos", label: "Todos" },
            { val: "desde_hoy", label: "Desde hoy" },
            { val: "anteriores", label: "Anteriores" },
          ] as const
        ).map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => aplicarPeriodoFiltro(val)}
            className={selectorTabClass(periodoFiltro === val)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="hidden min-h-10 items-center lg:flex">
          {hayFiltrosColumnasActivos && (
            <button
              type="button"
              onClick={limpiarFiltrosColumnas}
              disabled={listadoRefetching}
              className="inline-flex h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none"
              aria-label={`Limpiar filtros (${cantidadFiltrosColumnasActivos} columna${cantidadFiltrosColumnasActivos !== 1 ? "s" : ""} filtrada${cantidadFiltrosColumnasActivos !== 1 ? "s" : ""})`}
            >
              Limpiar filtros
              <span
                className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold tabular-nums leading-none text-white"
                aria-hidden
              >
                {cantidadFiltrosColumnasActivos}
              </span>
            </button>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <ViajesOrdenamientoMenu
            sortBy={sortBy}
            sortDir={sortDir}
            disabled={listadoRefetching}
            onChange={aplicarOrdenamiento}
          />
          <Link
            to={
              platform
                ? `/viajes/nuevo?tenantId=${encodeURIComponent(tid)}`
                : "/viajes/nuevo"
            }
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear viaje
          </Link>
        </div>
      </div>

      {error && !viajeEditor.editingId && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      )}

      {mostrarColumnaFacturarLote && idsFacturarSeleccion.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-black/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-vialto-steel">
            <span className="font-medium text-vialto-charcoal">
              {idsFacturarSeleccion.length}
            </span>{" "}
            viaje{idsFacturarSeleccion.length !== 1 ? "s" : ""} seleccionado
            {idsFacturarSeleccion.length !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={facturarSeleccionMultiple}
            className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Facturar
          </button>
        </div>
      )}

      {/* GRILLA DE VIAJES PRINCIPAL */}
      <ListadoDatos
        className="mt-8"
        columns={[]}
        rows={mostrarCargandoListado ? null : (rows ?? [])}
        rowKey={(v) => v.id}
        emptyMessage="Todavía no hay viajes cargados."
        loadingMessage="Cargando…"
        tableColSpan={tableColSpan}
        filters={viajesListadoFiltros}
        activeFilterCount={cantidadFiltrosColumnasActivos}
        onClearFilters={limpiarFiltrosColumnas}
        clearFiltersDisabled={listadoRefetching}
        filtersTitle="Filtrar viajes"
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            {mostrarColumnaFacturarLote && (
              <th className="px-2 py-3 w-10 text-center align-middle">
                <span className="sr-only">
                  Seleccionar para facturación conjunta
                </span>
                {elegiblesEnPagina.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={todosElegiblesMarcados}
                    onChange={toggleSeleccionarTodosEnPagina}
                    className="accent-vialto-charcoal"
                    title="Marcar o desmarcar todos los viajes facturables en esta página"
                    aria-label="Marcar o desmarcar todos los viajes facturables en esta página"
                  />
                ) : null}
              </th>
            )}
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Cliente"
                filterActive={!!clienteIdFiltroActivo.trim()}
                filterSignature={clienteIdFiltroActivo}
              >
                <ClienteSearchSelect
                  id="viajes-col-filtro-cliente"
                  clientes={clientes}
                  value={clienteIdFiltroActivo}
                  onChange={(id) => aplicarFiltroColumnaCliente(id)}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  disabled={listadoRefetching}
                  aria-label="Filtrar listado por cliente"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    clienteIdFiltroActivo.trim()
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Transporte"
                filterActive={!!transportistaIdFiltroActivo.trim()}
                filterSignature={transportistaIdFiltroActivo}
              >
                <TransportistaSearchSelect
                  id="viajes-col-filtro-transporte"
                  transportistas={transportistas}
                  value={transportistaIdFiltroActivo}
                  onChange={(id) => aplicarFiltroColumnaTransportista(id)}
                  placeholderCerrado="Todos"
                  emptyListChoiceLabel="Todos"
                  disabled={listadoRefetching}
                  aria-label="Filtrar listado por transporte"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    transportistaIdFiltroActivo.trim()
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={!!estadoFiltro.trim()}
                filterSignature={estadoFiltro}
              >
                <select
                  value={estadoFiltro}
                  onChange={(e) => aplicarFiltroEstado(e.target.value)}
                  disabled={listadoRefetching}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    estadoFiltro.trim()
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar listado por estado"
                >
                  <option value="">Todos</option>
                  {VIAJE_ESTADOS_TODOS.map((est) => (
                    <option
                      key={est}
                      value={est}
                      title={tooltipEstadoViaje(est)}
                    >
                      {estadoViajeLabel[est] ?? est}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Origen — Destino"
                filterActive={!!ubicacionFiltro.trim()}
                filterSignature={`${tipoUbicacionFiltro}|${paisUbicacionFiltro}|${ubicacionFiltro}`}
              >
                <div className="flex flex-col gap-2">
                  <select
                    value={tipoUbicacionFiltro}
                    onChange={(e) => {
                      const v = e.target.value;
                      aplicarTipoUbicacionFiltro(
                        v === "origen" || v === "destino" ? v : "",
                      );
                    }}
                    disabled={listadoRefetching}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      tipoUbicacionFiltro && ubicacionFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por ciudad en origen o en destino"
                  >
                    <option value="">Sin filtro por ubicación</option>
                    <option value="origen">Origen</option>
                    <option value="destino">Destino</option>
                  </select>
                  {tipoUbicacionFiltro ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                        País
                      </span>
                      <PaisUbicacionSelect
                        value={paisUbicacionFiltro}
                        onChange={(p) => aplicarPaisUbicacionFiltro(p)}
                        className="h-8 w-full border border-black/15 bg-white px-2 text-xs text-vialto-charcoal"
                        aria-label="País para buscar la ciudad del filtro"
                      />
                      <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                        Ciudad
                      </span>
                      <CiudadCombobox
                        pais={paisUbicacionFiltro}
                        value={ubicacionFiltro}
                        onChange={(next) =>
                          aplicarUbicacionCiudadSeleccion(next)
                        }
                        inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                          ubicacionFiltro.trim()
                            ? "text-vialto-fire"
                            : "text-vialto-charcoal"
                        }`}
                        disableBrowserAutocomplete
                        aria-label={
                          tipoUbicacionFiltro === "origen"
                            ? "Ciudad de origen (elegir de la lista)"
                            : "Ciudad de destino (elegir de la lista)"
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Carga — Descarga"
                filterActive={
                  !!fechaDesdeFiltro.trim() || !!fechaHastaFiltro.trim()
                }
                filterSignature={`${tipoFechaFiltro}|${fechaDesdeFiltro}|${fechaHastaFiltro}`}
              >
                <div className="flex flex-col gap-2">
                  <select
                    value={tipoFechaFiltro}
                    onChange={(e) => {
                      const v = e.target.value;
                      aplicarTipoFechaFiltro(
                        v === "carga" || v === "descarga" ? v : "",
                      );
                    }}
                    disabled={listadoRefetching}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      tipoFechaFiltro &&
                      (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim())
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por fecha de carga o de descarga"
                  >
                    <option value="">Sin filtro por fecha</option>
                    <option value="carga">Fecha de carga</option>
                    <option value="descarga">Fecha de descarga</option>
                  </select>
                  {tipoFechaFiltro ? (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                      <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Desde
                        <input
                          type="date"
                          value={fechaDesdeFiltro}
                          onChange={(e) =>
                            aplicarFechaDesdeFiltro(e.target.value)
                          }
                          disabled={listadoRefetching}
                          className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                        />
                      </label>
                      <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Hasta
                        <input
                          type="date"
                          value={fechaHastaFiltro}
                          onChange={(e) =>
                            aplicarFechaHastaFiltro(e.target.value)
                          }
                          disabled={listadoRefetching}
                          className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Monto a facturar
            </th>
            <ViajeGananciaBrutaColumnHeader />
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        renderTableRow={(v) => {
          const nombreCliente = nombreClienteListadoViaje(v, clientes);
          const nombreTransp = nombreTransportistaExternoListadoViaje(
            v,
            transportistas,
          );
          const nombreTranspEfectivo = nombreTransportistaEfectivoListadoViaje(
            v,
            transportistas,
          );
          return (
            <tr key={v.id} className={listadoTablaBodyRowClass}>
              {mostrarColumnaFacturarLote && (
                <td className="px-2 py-3 align-middle text-center">
                  {esElegibleFacturarLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsFacturarSeleccion.includes(v.id)}
                      onChange={() => toggleFacturarLote(v.id)}
                      className="accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${v.numero} en facturación conjunta`}
                    />
                  ) : null}
                </td>
              )}
              <td className="px-4 py-3 max-w-[12rem] text-vialto-charcoal">
                <span
                  className="block truncate font-medium"
                  title={nombreCliente}
                >
                  {nombreCliente}
                </span>
              </td>
              <td className="px-4 py-3 max-w-[12rem] text-vialto-steel">
                <span className="block truncate" title={nombreTransp}>
                  {nombreTransp}
                </span>
                {nombreTranspEfectivo && (
                  <span
                    className="block truncate text-[11px] text-vialto-steel/70"
                    title={`Ejecuta: ${nombreTranspEfectivo}`}
                  >
                    Ejecuta: {nombreTranspEfectivo}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-0.5 items-start">
                  {estadoQuickId === v.id ? (
                    <select
                      autoFocus
                      value={v.estado}
                      disabled={savingEstadoId === v.id}
                      onChange={(e) =>
                        void patchEstadoDesdeListado(v, e.target.value)
                      }
                      onBlur={() => setEstadoQuickId(null)}
                      className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                      aria-label="Cambiar estado del viaje"
                    >
                      {estadosDisponiblesParaViaje(v, viajesConFactura).map(
                        (x) => (
                          <option
                            key={x}
                            value={x}
                            title={tooltipEstadoViaje(x)}
                          >
                            {estadoViajeLabel[x] ?? x}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <button
                      type="button"
                      title={tooltipEstadoViaje(v.estado)}
                      aria-label={`Estado ${estadoViajeLabel[v.estado] ?? v.estado}. Abrir selector para cambiar.`}
                      disabled={savingEstadoId === v.id}
                      onClick={() => {
                        if (savingEstadoId) return;
                        setEstadoQuickId(v.id);
                      }}
                      className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                        estadoViajeBadgeClass[v.estado] ??
                        estadoViajeBadgeClassDefault
                      }`}
                    >
                      {savingEstadoId === v.id
                        ? "…"
                        : (estadoViajeLabel[v.estado] ?? "Sin clasificar")}
                    </button>
                  )}
                  {viajeEstadoEsFacturadoOCobrado(v.estado) && (
                    <span className="text-[10px] font-normal font-[family-name:var(--font-ui)] text-vialto-steel/75 tracking-wide">
                      Factura: {numeroFacturaVisibleViaje(v) || "—"}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 align-top text-vialto-steel min-w-[11rem] max-w-sm">
                <ViajeOrigenDestinoLinea
                  origen={v.origen}
                  destino={v.destino}
                  destinosViaje={v.destinosViaje}
                />
              </td>
              <td className="px-4 py-3 text-vialto-steel tabular-nums align-top">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`block ${ordenResaltaFechaCarga ? "font-medium text-vialto-charcoal" : ""}`}
                    title={v.fechaCarga ?? undefined}
                  >
                    {formatIsoFechaHoraListadoEsAr(v.fechaCarga)}
                  </span>
                  <span
                    className={`block text-xs ${
                      ordenResaltaFechaDescarga
                        ? "font-medium text-vialto-charcoal"
                        : "text-vialto-steel/90"
                    }`}
                    title={v.fechaDescarga ?? undefined}
                  >
                    {formatIsoFechaHoraListadoEsAr(v.fechaDescarga)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {textoMontoFacturarListado(v)}
              </td>
              <ViajeGananciaBrutaCelda viaje={v} />
              <td className="px-4 py-3 text-right">
                <ViajeAccionesMenu
                  viaje={v}
                  hasArca={hasLiquidacionesArca}
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => openFacturarFlow(v)}
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId
                      ? () =>
                          navigate(
                            platform
                              ? "/facturacion"
                              : `/facturacion?factura=${v.facturaId}`,
                            platform
                              ? {
                                  state: {
                                    ...facturacionNavExtras(),
                                    viewFacturaId: v.facturaId,
                                  },
                                }
                              : undefined,
                          )
                      : undefined
                  }
                  onEliminar={() => requestDeleteViaje(v)}
                />
              </td>
            </tr>
          );
        }}
        renderMobileCard={(v) => {
          const nombreCliente = nombreClienteListadoViaje(v, clientes);
          const nombreTransp = nombreTransportistaExternoListadoViaje(
            v,
            transportistas,
          );
          const nombreTranspEfectivo = nombreTransportistaEfectivoListadoViaje(
            v,
            transportistas,
          );
          const metaGanancia = gananciaBrutaMetaDesdeViaje(v);
          const transporteValue = (
            <>
              <span className="block truncate" title={nombreTransp}>
                {nombreTransp}
              </span>
              {nombreTranspEfectivo && (
                <span
                  className="block truncate text-[11px] text-vialto-steel/70"
                  title={`Ejecuta: ${nombreTranspEfectivo}`}
                >
                  Ejecuta: {nombreTranspEfectivo}
                </span>
              )}
            </>
          );
          const estadoValue = (
            <div className="flex flex-col gap-0.5 items-start">
              {estadoQuickId === v.id ? (
                <select
                  autoFocus
                  value={v.estado}
                  disabled={savingEstadoId === v.id}
                  onChange={(e) =>
                    void patchEstadoDesdeListado(v, e.target.value)
                  }
                  onBlur={() => setEstadoQuickId(null)}
                  className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                  aria-label="Cambiar estado del viaje"
                >
                  {estadosDisponiblesParaViaje(v, viajesConFactura).map((x) => (
                    <option key={x} value={x} title={tooltipEstadoViaje(x)}>
                      {estadoViajeLabel[x] ?? x}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  title={tooltipEstadoViaje(v.estado)}
                  aria-label={`Estado ${estadoViajeLabel[v.estado] ?? v.estado}. Abrir selector para cambiar.`}
                  disabled={savingEstadoId === v.id}
                  onClick={() => {
                    if (savingEstadoId) return;
                    setEstadoQuickId(v.id);
                  }}
                  className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                    estadoViajeBadgeClass[v.estado] ??
                    estadoViajeBadgeClassDefault
                  }`}
                >
                  {savingEstadoId === v.id
                    ? "…"
                    : (estadoViajeLabel[v.estado] ?? "Sin clasificar")}
                </button>
              )}
              {viajeEstadoEsFacturadoOCobrado(v.estado) && (
                <span className="text-[10px] font-normal font-[family-name:var(--font-ui)] text-vialto-steel/75 tracking-wide">
                  Factura: {numeroFacturaVisibleViaje(v) || "—"}
                </span>
              )}
            </div>
          );
          const gananciaValue = (
            <>
              {metaGanancia.lineasBalance &&
              metaGanancia.lineasBalance.length > 1 ? (
                <span className="flex flex-col items-start gap-0.5 leading-tight">
                  {metaGanancia.lineasBalance.map((l) => (
                    <span key={l.moneda} className="tabular-nums">
                      {l.formatted}
                    </span>
                  ))}
                </span>
              ) : (
                metaGanancia.display
              )}
              {metaGanancia.reason && (
                <span className="block text-[10px] text-vialto-steel/70 tabular-nums">
                  {metaGanancia.reason}
                </span>
              )}
            </>
          );
          return (
            <ListadoCard
              primary={
                <div className="flex items-start gap-2">
                  {mostrarColumnaFacturarLote && esElegibleFacturarLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsFacturarSeleccion.includes(v.id)}
                      onChange={() => toggleFacturarLote(v.id)}
                      className="mt-1 accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${v.numero} en facturación conjunta`}
                    />
                  ) : null}
                  <span
                    className="min-w-0 truncate font-medium"
                    title={nombreCliente}
                  >
                    {nombreCliente}
                  </span>
                </div>
              }
              fields={[
                { label: "Transporte", value: transporteValue },
                { label: "Estado", value: estadoValue },
                {
                  label: "Origen — Destino",
                  value: (
                    <ViajeOrigenDestinoLinea
                      origen={v.origen}
                      destino={v.destino}
                      destinosViaje={v.destinosViaje}
                    />
                  ),
                },
                {
                  label: "Carga — Descarga",
                  value: (
                    <div className="flex flex-col gap-0.5 tabular-nums">
                      <span
                        className={
                          ordenResaltaFechaCarga
                            ? "font-medium text-vialto-charcoal"
                            : undefined
                        }
                        title={v.fechaCarga ?? undefined}
                      >
                        {formatIsoFechaHoraListadoEsAr(v.fechaCarga)}
                      </span>
                      <span
                        className={
                          ordenResaltaFechaDescarga
                            ? "text-xs font-medium text-vialto-charcoal"
                            : "text-xs text-vialto-steel/90"
                        }
                        title={v.fechaDescarga ?? undefined}
                      >
                        {formatIsoFechaHoraListadoEsAr(v.fechaDescarga)}
                      </span>
                    </div>
                  ),
                },
                { label: "Monto", value: textoMontoFacturarListado(v) },
                { label: "Ganancia bruta", value: gananciaValue },
              ]}
              actions={
                <ViajeAccionesMenu
                  viaje={v}
                  hasArca={hasLiquidacionesArca}
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => openFacturarFlow(v)}
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId
                      ? () =>
                          navigate(
                            platform
                              ? "/facturacion"
                              : `/facturacion?factura=${v.facturaId}`,
                            platform
                              ? {
                                  state: {
                                    ...facturacionNavExtras(),
                                    viewFacturaId: v.facturaId,
                                  },
                                }
                              : undefined,
                          )
                      : undefined
                  }
                  onEliminar={() => requestDeleteViaje(v)}
                />
              }
            />
          );
        }}
      />

      {meta && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          onPageChange={(newPage) => {
            setListadoRefetching(true);
            setPage(newPage);
            setListadoQueryVersion((v) => v + 1); //
          }}
          onPageSizeChange={(newPageSize) => {
            setListadoRefetching(true);
            setPageSize(newPageSize);
            setPage(1);
            setListadoQueryVersion((v) => v + 1); //
          }}
        />
      )}

      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          tenantId={platform ? tid : undefined}
          editando={abriendoEditorViaje}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const v = viewingViaje;
            void (async () => {
              setAbriendoEditorViaje(true);
              try {
                await beginEditViaje(v);
                setViewingViaje(null);
              } finally {
                setAbriendoEditorViaje(false);
              }
            })();
          }}
        />
      )}

      {/* Editor Modal Inferior para Editar Viajes en Listado */}
      {viajeEditor.editingId && viajeEditor.draft && viajeEditor.viajeSnapshot && (
        <ViajeEditModal
          open
          draft={viajeEditor.draft}
          setDraft={viajeEditor.setDraft}
          snapshotViaje={viajeEditor.viajeSnapshot}
          opcionesProducto={viajeEditor.opcionesProducto}
          clientes={viajeEditor.edicionMaestro?.clientes ?? clientes}
          choferes={viajeEditor.edicionMaestro?.choferes ?? choferes}
          transportistas={viajeEditor.edicionMaestro?.transportistas ?? transportistas}
          vehiculos={viajeEditor.edicionMaestro?.vehiculos ?? vehiculos}
          choferesPropios={viajeEditor.choferesPropios}
          vehiculosPropios={viajeEditor.vehiculosPropios}
          viajesConFactura={viajesConFactura}
          onModoChange={viajeEditor.applyDraftModo}
          ayudaFlota={viajeEditor.ayudaFlota}
          viajeEditHint={viajeEditor.viajeEditHint}
          fechaCargaError={viajeEditor.fechaCargaError}
          fechaDescargaError={viajeEditor.fechaDescargaError}
          destinosError={viajeEditor.destinosError}
          onClearDestinosError={viajeEditor.onClearDestinosError}
          transportistaEfectivoError={viajeEditor.transportistaEfectivoError}
          onClearTransportistaEfectivoError={
            viajeEditor.onClearTransportistaEfectivoError
          }
          onDraftFechasPatch={viajeEditor.onDraftFechasPatch}
          onClose={cancelEdit}
          onSave={() => void viajeEditor.saveInline()}
          onFacturar={() => {
            const draft = viajeEditor.draft!;
            const snapshot = viajeEditor.viajeSnapshot!;
            const v = {
              ...snapshot,
              clienteId: draft.clienteId.trim() || snapshot.clienteId,
              monedaMonto: draft.monedaMonto,
              monedaPrecioTransportistaExterno:
                draft.monedaPrecioTransportistaExterno,
              transportistaId:
                draft.operacionModo === "externo"
                  ? draft.transportistaId
                  : snapshot.transportistaId,
            };
            openFacturarFlow(v);
          }}
          facturarBloqueoMotivo={motivoBloqueoAccionFacturarArcaUsd(
            hasLiquidacionesArca,
            {
              ...viajeEditor.viajeSnapshot,
              estado: viajeEditor.draft.estado,
              clienteId:
                viajeEditor.draft.clienteId.trim() ||
                viajeEditor.viajeSnapshot.clienteId,
              monedaMonto: viajeEditor.draft.monedaMonto,
              monedaPrecioTransportistaExterno:
                viajeEditor.draft.monedaPrecioTransportistaExterno,
              transportistaId:
                viajeEditor.draft.operacionModo === "externo"
                  ? viajeEditor.draft.transportistaId
                  : viajeEditor.viajeSnapshot.transportistaId,
            },
          )}
          onEliminar={() => requestDeleteViaje(viajeEditor.viajeSnapshot!)}
          saving={viajeEditor.saving}
          error={viajeEditor.error}
          crearVehiculoHref={
            platform
              ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(tid)}`
              : undefined
          }
          getToken={getToken}
          tenantId={platform ? tid : undefined}
          onProductoCreado={viajeEditor.onProductoCreado}
          onClienteCreado={(c) => viajeEditor.upsertMaestroEdicion("clientes", c)}
          onTransportistaCreado={(t) =>
            viajeEditor.upsertMaestroEdicion("transportistas", t)
          }
          onChoferCreado={(c) => viajeEditor.upsertMaestroEdicion("choferes", c)}
          onVehiculoCreado={(v) => viajeEditor.upsertMaestroEdicion("vehiculos", v)}
        />
      )}

      {/* Modal de selección "Crear nueva factura vs Agregar a la actual" */}
      <FacturarOpcionModal
        open={facturarOpcionState != null}
        facturas={facturarOpcionState?.facturas ?? []}
        busy={facturarOpcionBusy}
        onNuevaFactura={() => void handleFacturarOpcionConfirm("nueva")}
        onAgregarAExistente={(facturaId) =>
          void handleFacturarOpcionConfirm({ facturaId })
        }
        onClose={() => setFacturarOpcionState(null)}
      />

      <AgregarGastoModal
        open={agregarGastoViaje != null}
        viaje={agregarGastoViaje}
        tenantId={platform ? tid : undefined}
        onSuccess={(updated) => {
          setRows((prev) =>
            prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev,
          );
          if (viajeEditor.editingId === updated.id) {
            viajeEditor.setDraft((d) =>
              d
                ? {
                    ...d,
                    otrosGastos: (updated.otrosGastos ?? []).map(
                      otroGastoDraftFromApi,
                    ),
                  }
                : d,
            );
          }
          setAgregarGastoViaje(null);
        }}
        onClose={() => setAgregarGastoViaje(null)}
      />

      <RegistrarPagoTransportistaModal
        open={registrarPagoViaje != null}
        viaje={registrarPagoViaje}
        tenantId={platform ? tid : undefined}
        onSuccess={(updated) => {
          setRows((prev) =>
            prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev,
          );
          if (viajeEditor.editingId === updated.id) {
            viajeEditor.setDraft((d) =>
              d
                ? {
                    ...d,
                    pagosTransportista: (updated.pagosTransportista ?? []).map(
                      pagoTransportistaDraftFromApi,
                    ),
                  }
                : d,
            );
          }
          setRegistrarPagoViaje(null);
        }}
        onClose={() => setRegistrarPagoViaje(null)}
      />

      {exportarViaje && (
        <ExportarViajeModal
          viaje={exportarViaje}
          onClose={() => setExportarViaje(null)}
          tenantId={platform ? tid : undefined}
        />
      )}

      {emitirCvlpViaje && (
        <EmitirCvlpModal
          viaje={emitirCvlpViaje}
          onClose={() => setEmitirCvlpViaje(null)}
          onEmitido={(_liq: Liquidacion) => {
            setListadoQueryVersion((v) => v + 1);
          }}
        />
      )}

      {selectorViaje && (
        <FacturarSelectorModal
          onClose={() => setSelectorViaje(null)}
          clienteCompletado={!viajePendienteComprobanteCliente(selectorViaje)}
          transportistaCompletado={
            !viajePendienteComprobanteTransportista(selectorViaje)
          }
          clienteBloqueadoMotivo={
            arcaBloqueaFacturarUsd(
              hasLiquidacionesArca,
              selectorViaje.monedaMonto,
            )
              ? MSG_ARCA_NO_FACTURA_USD
              : null
          }
          transportistaBloqueadoMotivo={
            arcaBloqueaLiquidarUsd(
              hasLiquidacionesArca,
              selectorViaje.monedaPrecioTransportistaExterno,
            )
              ? MSG_ARCA_NO_LIQUIDA_USD
              : null
          }
          subtituloCliente={
            hasLiquidacionesArca
              ? "Elegí Factura A o B según IVA del cliente"
              : "Registro manual"
          }
          subtituloTransportista={
            hasLiquidacionesArca
              ? "CVLP tipo 60/61 según IVA del transportista"
              : "Registro manual"
          }
          onFacturarCliente={() => {
            if (
              arcaBloqueaFacturarUsd(
                hasLiquidacionesArca,
                selectorViaje.monedaMonto,
              )
            ) {
              showToast(MSG_ARCA_NO_FACTURA_USD, "error");
              return;
            }
            setTipoFacturaViaje(selectorViaje);
            setSelectorViaje(null);
          }}
          onLiquidacion={() => {
            if (
              arcaBloqueaLiquidarUsd(
                hasLiquidacionesArca,
                selectorViaje.monedaPrecioTransportistaExterno,
              )
            ) {
              showToast(MSG_ARCA_NO_LIQUIDA_USD, "error");
              return;
            }
            if (hasLiquidacionesArca) {
              setEmitirCvlpViaje(selectorViaje);
            } else {
              setCrearLiqViaje(selectorViaje);
            }
            setSelectorViaje(null);
          }}
        />
      )}

      {tipoFacturaViaje && (
        <TipoFacturaClienteModal
          viaje={tipoFacturaViaje}
          onClose={() => setTipoFacturaViaje(null)}
          onConfirm={(letra) => {
            const v = tipoFacturaViaje;
            setTipoFacturaViaje(null);
            void navigateToFacturacion(v, letra);
          }}
        />
      )}

      {crearLiqViaje && (
        <CrearLiquidacionManualModal
          viajeInicial={crearLiqViaje}
          transportistas={maestro.transportistas}
          getToken={getToken}
          onSuccess={() => {
            setCrearLiqViaje(null);
            setListadoQueryVersion((v) => v + 1);
          }}
          onClose={() => setCrearLiqViaje(null)}
        />
      )}

      <ConfirmDialog
        open={viajeDeleteConfirm != null}
        title="Eliminar viaje"
        message={
          viajeDeleteConfirm
            ? `¿Seguro que querés eliminar el viaje ${viajeDeleteConfirm.numero}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={
          !!deletingViajeId &&
          viajeDeleteConfirm != null &&
          deletingViajeId === viajeDeleteConfirm.id
        }
        onCancel={() => {
          if (!deletingViajeId) setViajeDeleteConfirm(null);
        }}
        onConfirm={() => void confirmDeleteViaje()}
      />
    </div>
  );
}

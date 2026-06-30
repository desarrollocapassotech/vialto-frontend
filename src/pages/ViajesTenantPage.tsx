import { useAuth } from "@clerk/clerk-react";
import { useMaestroData } from "@/hooks/useMaestroData";
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
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import { PaisUbicacionSelect } from "@/components/forms/PaisUbicacionSelect";
import type { ViajeOperacionModo } from "@/components/viajes/ViajeOperacionTipoFieldset";
import { FacturarOpcionModal } from "@/components/viajes/FacturarOpcionModal";
import { AgregarGastoModal } from "@/components/viajes/AgregarGastoModal";
import { RegistrarPagoTransportistaModal } from "@/components/viajes/RegistrarPagoTransportistaModal";
import { ExportarViajeModal } from "@/components/viajes/ExportarViajeModal";
import { EmitirCvlpModal } from "@/components/viajes/EmitirCvlpModal";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import { apiJson } from "@/lib/api";
import {
  formatNumberForMoneda,
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
} from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
import {
  choferesFlotaPropia,
  flotaPropiaVehiculosListaValida,
  entidadesMaestroStubsDesdeViaje,
  maestroListasParaEdicionViaje,
  mantenerIdSiEnLista,
  mergeMaestroPorId,
  mensajesAyudaFlotaPropia,
  normalizarIdEnLista,
  nombreClienteListadoViaje,
  nombreTransportistaExternoListadoViaje,
  nombreTransportistaEfectivoListadoViaje,
  numeroFacturaVisibleViaje,
  textoMontoFacturarListado,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
  mensajeErrorTransportistaEfectivoExterno,
  transportistaEfectivoIdDesdeViaje,
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import {
  ViajeGananciaBrutaCelda,
  ViajeGananciaBrutaColumnHeader,
} from "@/components/viajes/ViajeGananciaBruta";
import { ViajeOrigenDestinoLinea } from "@/components/viajes/ViajeOrigenDestinoLinea";
import {
  ViajeEditModal,
  type ViajeInlineDraft,
} from "@/components/viajes/ViajeEditModal";
import { gananciaBrutaManualPayloadFromDraft } from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import {
  draftRequiereGananciaBrutaManual,
  gananciaBrutaManualEnPatchParcial,
  gananciaBrutaMetaDesdeViaje,
} from "@/lib/viajesGananciaBruta";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeAccionesMenu } from "@/components/viajes/ViajeAccionesMenu";
import { ViajesResumenFiltros } from "@/components/viajes/ViajesResumenFiltros";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  otroGastoDraftFromApi,
  otroGastoDraftToApi,
} from "@/components/viajes/OtrosGastosFieldset";
import {
  pagoTransportistaDraftFromApi,
  pagosTransportistaDraftsToApi,
} from "@/components/viajes/PagosTransportistaFieldset";
import {
  esEtiquetaCiudadValida,
  inferirPaisDesdeUbicacion,
  type PaisCodigo,
} from "@/lib/ciudades";
import {
  fechaHoraToIso,
  formatIsoFechaHoraListadoEsAr,
  isoToFechaHora,
} from "@/lib/viajeFechaHora";
import {
  estadoViajeBadgeClass,
  estadoViajeBadgeClassDefault,
  estadoViajeLabel,
  tooltipEstadoViaje,
  viajeEstadoEsFacturadoOCobrado,
  viajeEstadoPermiteBotonFacturar,
  estadosDisponiblesParaViaje,
  VIAJE_ESTADOS_TODOS,
} from "@/lib/viajesEstados";
import {
  contarViajesPagoTransportistaDesdeApi,
  esFiltroPagoTransportistaValido,
  filtrarViajesPorPagoTransportista,
  metaPaginacionAjustada,
  pageSizeApiValido,
  VIAJE_PAGO_TRANSPORTISTA_QUERY,
  type ViajePagoTransportistaFiltro,
} from "@/lib/viajesFiltroPagoTransportista";
import { validarPagosTransportistaDraftForm } from "@/lib/viajesTransportistaPagos";
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
  productoItemsDesdeViaje,
  mergeOpcionesProducto,
} from "@/lib/productosViaje";
import {
  destinosPayloadParaApi,
  destinosRowsDesdeViaje,
  etiquetasDestinosDesdeViaje,
  validarDestinosRows,
  viajeConDestinosEnRespuesta,
} from "@/lib/viajesDestinos";
import {
  VIAJE_SORT_DEFAULT,
  appendViajeSortQuery,
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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const { tenant: currentTenant } = useCurrentTenant();
  const platform = Boolean(tenantId?.trim());
  const hasLiquidacionesArca =
    !platform && canAccessIntegracionArca(currentTenant?.modules ?? []);
  const hasFacturacionSinArca =
    !platform &&
    !hasLiquidacionesArca &&
    canAccessFacturacion(currentTenant?.modules ?? []);
  const tid = tenantId?.trim() ?? "";
  const [clientesP, setClientesP] = useState<Cliente[]>([]);
  const [choferesP, setChoferesP] = useState<Chofer[]>([]);
  const [transportistasP, setTransportistasP] = useState<Transportista[]>([]);
  const [vehiculosP, setVehiculosP] = useState<Vehiculo[]>([]);
  const clientes = platform ? clientesP : maestro.clientes;
  const choferes = platform ? choferesP : maestro.choferes;
  const transportistas = platform ? transportistasP : maestro.transportistas;
  const vehiculos = platform ? vehiculosP : maestro.vehiculos;

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
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fechaCargaError, setFechaCargaError] = useState<string | null>(null);
  const [destinosError, setDestinosError] = useState<string | null>(null);
  const [transportistaEfectivoError, setTransportistaEfectivoError] = useState<
    string | null
  >(null);
  const [fechaDescargaError, setFechaDescargaError] = useState<string | null>(
    null,
  );
  /** Fila donde el usuario abrió el selector de estado con un clic en el badge. */
  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const [exportarViaje, setExportarViaje] = useState<Viaje | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
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
  } | null>(null);
  const [facturarOpcionBusy, setFacturarOpcionBusy] = useState(false);
  /** Viaje sobre el que se está abriendo el modal de agregar gasto. */
  const [agregarGastoViaje, setAgregarGastoViaje] = useState<Viaje | null>(
    null,
  );
  /** Viaje sobre el que se está abriendo el modal de registrar pago al transportista. */
  const [registrarPagoViaje, setRegistrarPagoViaje] = useState<Viaje | null>(
    null,
  );
  /** Viaje para el que se quiere emitir un CVLP. */
  const [emitirCvlpViaje, setEmitirCvlpViaje] = useState<Viaje | null>(null);
  /** Viaje para el selector manual factura/liquidación (tenants sin integracion-arca). */
  const [selectorViaje, setSelectorViaje] = useState<Viaje | null>(null);
  /** Viaje para el modal de creación manual de liquidación. */
  const [crearLiqViaje, setCrearLiqViaje] = useState<Viaje | null>(null);
  /** Conteos globales para los chips de acceso rápido. */
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
  /** Viaje abierto desde URL u otra pantalla: no tiene por qué estar en la página actual del listado. */
  const [viajeSnapshotRemoto, setViajeSnapshotRemoto] = useState<Viaje | null>(
    null,
  );
  const viajeEdicionSnapshot = useMemo(
    () =>
      editingId
        ? (rows?.find((r) => r.id === editingId) ??
          (viajeSnapshotRemoto?.id === editingId ? viajeSnapshotRemoto : null))
        : null,
    [editingId, rows, viajeSnapshotRemoto],
  );
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const opcionesProductoModal = useMemo(
    () => mergeOpcionesProducto(productosCatalogo, viajeEdicionSnapshot),
    [productosCatalogo, viajeEdicionSnapshot],
  );
  /** Aviso al editar un viaje en flota propia si chofer/vehículo del maestro no era compatible. */
  const [viajeEditHint, setViajeEditHint] = useState<string | null>(null);
  /** Maestros fusionados (catálogo + sesión + relaciones del viaje) mientras el modal de edición está abierto. */
  const [edicionMaestro, setEdicionMaestro] =
    useState<MaestroListasViaje | null>(null);
  const [sessionMaestro, setSessionMaestro] = useState<MaestroListasViaje>({
    clientes: [],
    choferes: [],
    transportistas: [],
    vehiculos: [],
  });

  /** Entidades creadas en «Crear viaje» que deben seguir disponibles al volver al listado. */
  useEffect(() => {
    const incoming = (
      location.state as { sessionMaestro?: MaestroListasViaje } | null
    )?.sessionMaestro;
    if (!incoming) return;
    setSessionMaestro((prev) => ({
      clientes: mergeMaestroPorId(prev.clientes, incoming.clientes),
      choferes: mergeMaestroPorId(prev.choferes, incoming.choferes),
      transportistas: mergeMaestroPorId(
        prev.transportistas,
        incoming.transportistas,
      ),
      vehiculos: mergeMaestroPorId(prev.vehiculos, incoming.vehiculos),
    }));
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state, navigate]);

  const choferesPropios = useMemo(
    () => choferesFlotaPropia(edicionMaestro?.choferes ?? choferes),
    [edicionMaestro?.choferes, choferes],
  );
  const vehiculosPropios = useMemo(
    () => vehiculosFlotaPropia(edicionMaestro?.vehiculos ?? vehiculos),
    [edicionMaestro?.vehiculos, vehiculos],
  );
  const ayudaFlotaListado = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );
  const ordenResaltaFechaCarga = sortBy === "fecha_carga";
  const ordenResaltaFechaDescarga = sortBy === "fecha_descarga";

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const url = platform
          ? `/api/platform/stock/productos/paginated?tenantId=${encodeURIComponent(tid)}&page=1&pageSize=100&filtroActivo=activos`
          : "/api/stock/productos/paginated?page=1&pageSize=100&filtroActivo=activos";
        const d = await apiJson<{ items: Producto[] }>(url, () => getToken());
        if (!cancelled) setProductosCatalogo(d.items);
      } catch {
        if (!cancelled) setProductosCatalogo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, platform, tid]);

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
        appendViajeSortQuery(filtros, sortBy, sortDir);
        const filtrosQs = filtros.toString();
        const listBase = platform
          ? `/api/platform/viajes/paginated?tenantId=${encodeURIComponent(tid)}${filtrosQs ? `&${filtrosQs}` : "&"}`
          : `/api/viajes/paginated${filtrosQs ? `?${filtrosQs}&` : "?"}`;
        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeApiValido(pageSize);

        const pagoFiltroActivo =
          pagoTranspF === "sin_pagar" || pagoTranspF === "pagado"
            ? pagoTranspF
            : null;

        //Se filtra el lote grande de viajes para obtener los viajes pagados
        const reqPage = pagoFiltroActivo ? 1 : pageApi;
        const reqPageSize = pagoFiltroActivo ? 100 : pageSizeApi;

        const data = await apiJson<ViajesPaginatedResponse>(
          `${listBase}page=${reqPage}&pageSize=${reqPageSize}`,
          () => getTokenRef.current(),
        );

        let items = data.items;
        let meta = data.meta;

        if (pagoFiltroActivo) {
          // Filtro local del lote grande
          const itemsFiltrados = filtrarViajesPorPagoTransportista(
            data.items,
            pagoFiltroActivo,
          );
          const totalReal = itemsFiltrados.length;

          // Cáculo de inicio y fin para la página actual
          const startIndex = (pageApi - 1) * pageSizeApi;
          items = itemsFiltrados.slice(startIndex, startIndex + pageSizeApi);

          // Ajuste de metadatos de la paginación con el total real
          meta = metaPaginacionAjustada(totalReal, pageApi, pageSizeApi);

          // Actualizacion del resumen en la primer página
          if (pageApi === 1 && !cancelled) {
            setResumen((prev) =>
              prev
                ? {
                    ...prev,
                    sinPagar:
                      pagoFiltroActivo === "sin_pagar"
                        ? totalReal
                        : prev.sinPagar,
                    pagados:
                      pagoFiltroActivo === "pagado" ? totalReal : prev.pagados,
                  }
                : prev,
            );
          }
          meta = metaPaginacionAjustada(totalReal, pageApi, pageSizeApi);
          if (!cancelled) {
            setResumen((prev) =>
              prev
                ? {
                    ...prev,
                    sinPagar:
                      pagoFiltroActivo === "sin_pagar"
                        ? totalReal
                        : prev.sinPagar,
                    pagados:
                      pagoFiltroActivo === "pagado" ? totalReal : prev.pagados,
                  }
                : prev,
            );
          }
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

  function aplicarOrdenamiento(
    nuevoSortBy: ViajeSortField,
    nuevoSortDir: ViajeSortDir,
  ) {
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
      setSortBy(tf === "carga" ? "fecha_carga" : "fecha_descarga");
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

  /** Solo se llama desde `CiudadCombobox` al elegir una ciudad de la lista (o vaciar). */
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

  useEffect(() => {
    setIdsFacturarSeleccion([]);
  }, [clienteIdFiltroActivo]);

  function esElegibleFacturarLote(v: Viaje): boolean {
    return (
      viajeEstadoPermiteBotonFacturar(v.estado) && !viajesConFactura.has(v.id)
    );
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

  function facturarSeleccionMultiple() {
    const ids = idsFacturarSeleccion;
    const cid = clienteIdFiltroActivo.trim();
    if (ids.length === 0 || !cid) return;
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

  useEffect(() => {
    if (!editingId || !draft || draft.operacionModo !== "propio") return;
    setDraft((p) => {
      if (!p || p.operacionModo !== "propio") return p;
      const cid = normalizarIdEnLista(p.choferId, choferesPropios);
      if (cid === p.choferId) return p;
      return { ...p, choferId: cid };
    });
  }, [editingId, draft?.operacionModo, choferesPropios]);

  useEffect(() => {
    if (draft?.operacionModo === "externo") setViajeEditHint(null);
  }, [draft?.operacionModo]);

  function upsertMaestroEdicion<K extends keyof MaestroListasViaje>(
    key: K,
    item: MaestroListasViaje[K][number],
  ) {
    const mergeOne = <T extends { id: string }>(prev: T[]) =>
      mergeMaestroPorId(prev, [item as unknown as T]);
    setSessionMaestro(
      (prev) =>
        ({
          ...prev,
          [key]: mergeOne(prev[key] as { id: string }[]),
        }) as MaestroListasViaje,
    );
    setEdicionMaestro((prev) =>
      prev
        ? ({
            ...prev,
            [key]: mergeOne(prev[key] as { id: string }[]),
          } as MaestroListasViaje)
        : prev,
    );
    if (platform) {
      if (key === "clientes") setClientesP((prev) => mergeOne(prev));
      if (key === "choferes") setChoferesP((prev) => mergeOne(prev));
      if (key === "transportistas")
        setTransportistasP((prev) => mergeOne(prev));
      if (key === "vehiculos") setVehiculosP((prev) => mergeOne(prev));
    }
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

  /** Carga el viaje desde la API antes de abrir el editor (evita datos viejos en el listado). */
  async function beginEditViaje(
    v: Viaje,
    origen: "listado" | "remoto" = "listado",
  ) {
    let viaje = v;
    if (origen === "listado") {
      try {
        viaje = await apiJson<Viaje>(viajeApiUrl(v.id), () => getToken());
        setRows((prev) =>
          prev ? prev.map((r) => (r.id === viaje.id ? viaje : r)) : prev,
        );
      } catch {
        /* usar fila del listado */
      }
    }
    try {
      const fresh = await fetchMaestroListasFresh();
      const conSesion: MaestroListasViaje = {
        clientes: mergeMaestroPorId(fresh.clientes, sessionMaestro.clientes),
        choferes: mergeMaestroPorId(fresh.choferes, sessionMaestro.choferes),
        transportistas: mergeMaestroPorId(
          fresh.transportistas,
          sessionMaestro.transportistas,
        ),
        vehiculos: mergeMaestroPorId(fresh.vehiculos, sessionMaestro.vehiculos),
      };
      const merged = maestroListasParaEdicionViaje(viaje, conSesion);
      setEdicionMaestro(merged);
      startEdit(viaje, origen, merged);
    } catch {
      const conSesion: MaestroListasViaje = {
        clientes: mergeMaestroPorId(clientes, sessionMaestro.clientes),
        choferes: mergeMaestroPorId(choferes, sessionMaestro.choferes),
        transportistas: mergeMaestroPorId(
          transportistas,
          sessionMaestro.transportistas,
        ),
        vehiculos: mergeMaestroPorId(vehiculos, sessionMaestro.vehiculos),
      };
      const merged = maestroListasParaEdicionViaje(viaje, conSesion);
      setEdicionMaestro(merged);
      startEdit(viaje, origen, merged);
    }
  }

  function startEdit(
    v: Viaje,
    origen: "listado" | "remoto" = "listado",
    listas: MaestroListasViaje = {
      clientes,
      choferes,
      transportistas,
      vehiculos,
    },
  ) {
    if (origen === "listado") setViajeSnapshotRemoto(null);
    else setViajeSnapshotRemoto(v);
    setEstadoQuickId(null);
    setError(null);
    setDestinosError(null);
    setEditingId(v.id);
    const esExterno = !!(v.transportistaId ?? "").trim();
    const chRow = listas.choferes.find((c) => c.id === v.choferId);
    const choferesPropiosEdit = choferesFlotaPropia(listas.choferes);
    const vehiculosPropiosEdit = vehiculosFlotaPropia(listas.vehiculos);
    const partes: string[] = [];
    if (!esExterno && v.choferId && chRow?.transportistaId) {
      partes.push(
        "El chofer asociado a este viaje figura con transportista externo en su ficha; elegí uno de flota propia o actualizá el chofer.",
      );
    }
    if (!esExterno && v.vehiculosViaje?.length) {
      for (const vv of v.vehiculosViaje) {
        const vr = listas.vehiculos.find((x) => x.id === vv.vehiculoId);
        if (vr?.transportistaId) {
          partes.push(
            "Algún vehículo del viaje figura con transportista externo en su ficha; elegí flota propia o actualizá el maestro.",
          );
          break;
        }
      }
    }
    setViajeEditHint(partes.length ? partes.join(" ") : null);
    const partesFc = isoToFechaHora(v.fechaCarga);
    const partesFd = isoToFechaHora(v.fechaDescarga);
    setDraft({
      numero: v.numero ?? "",
      estado: v.estado ?? "pendiente",
      operacionModo: esExterno ? "externo" : "propio",
      choferId: mantenerIdSiEnLista(v.choferId, choferesPropiosEdit),
      choferExternoId: esExterno
        ? mantenerIdSiEnLista(v.choferId, listas.choferes)
        : "",
      transportistaId: mantenerIdSiEnLista(
        v.transportistaId,
        listas.transportistas,
      ),
      vehiculosRows:
        v.vehiculosViaje && v.vehiculosViaje.length > 0
          ? [...v.vehiculosViaje]
              .sort((a, b) => a.orden - b.orden)
              .map((x) => ({
                tipo: (x.vehiculo?.tipo ?? "tractor").toLowerCase(),
                vehiculoId: esExterno
                  ? String(x.vehiculoId ?? "").trim()
                  : normalizarIdEnLista(x.vehiculoId, vehiculosPropiosEdit),
              }))
          : !esExterno
            ? [{ tipo: "tractor", vehiculoId: "" }]
            : [],
      clienteId:
        mantenerIdSiEnLista(v.clienteId, listas.clientes) || v.clienteId || "",
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ""),
      origen: v.origen ?? "",
      destinosRows: destinosRowsDesdeViaje(v),
      fechaCarga: partesFc.fecha,
      horaCarga: partesFc.hora,
      fechaDescarga: partesFd.fecha,
      horaDescarga: partesFd.hora,
      productoItems: productoItemsDesdeViaje(v),
      detalleCarga: v.detalleCarga ?? "",
      observaciones: v.observaciones ?? "",
      monto: formatNumberForMoneda(
        v.monto,
        normalizeViajeMoneda(v.monedaMonto),
      ),
      monedaMonto: normalizeViajeMoneda(v.monedaMonto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : "",
      litrosConsumidos:
        v.litrosConsumidos != null ? String(v.litrosConsumidos) : "",
      precioTransportistaExterno: formatNumberForMoneda(
        v.precioTransportistaExterno,
        normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
      ),
      monedaPrecioTransportistaExterno: normalizeViajeMoneda(
        v.monedaPrecioTransportistaExterno,
      ),
      gananciaBrutaManual: formatNumberForMoneda(
        v.gananciaBrutaManual,
        normalizeViajeMoneda(v.monedaGananciaBrutaManual ?? v.monedaMonto),
      ),
      monedaGananciaBrutaManual: normalizeViajeMoneda(
        v.monedaGananciaBrutaManual ?? v.monedaMonto,
      ),
      otrosGastos: (v.otrosGastos ?? []).map(otroGastoDraftFromApi),
      pagosTransportista: (v.pagosTransportista ?? []).map(
        pagoTransportistaDraftFromApi,
      ),
      realizaFlete: !transportistaEfectivoIdDesdeViaje(v),
      transportistaEfectivoId: mantenerIdSiEnLista(
        transportistaEfectivoIdDesdeViaje(v),
        listas.transportistas,
      ),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEdicionMaestro(null);
    setViajeSnapshotRemoto(null);
    setEstadoQuickId(null);
    setViajeEditHint(null);
    setFechaCargaError(null);
    setFechaDescargaError(null);
    setDestinosError(null);
    setTransportistaEfectivoError(null);
  }

  function requestDeleteViaje(v: Viaje) {
    setError(null);
    setViajeDeleteConfirm(v);
  }

  async function confirmDeleteViaje() {
    const v = viajeDeleteConfirm;
    if (!v || deletingViajeId) return;
    setDeletingViajeId(v.id);
    try {
      await apiJson(viajeApiUrl(v.id), () => getToken(), { method: "DELETE" });
      setRows((prev) => (prev ? prev.filter((r) => r.id !== v.id) : prev));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
      setIdsFacturarSeleccion((ids) => ids.filter((id) => id !== v.id));
      if (editingId === v.id) cancelEdit();
      if (viewingViaje?.id === v.id) setViewingViaje(null);
      if (exportarViaje?.id === v.id) setExportarViaje(null);
      if (agregarGastoViaje?.id === v.id) setAgregarGastoViaje(null);
      if (registrarPagoViaje?.id === v.id) setRegistrarPagoViaje(null);
      if (emitirCvlpViaje?.id === v.id) setEmitirCvlpViaje(null);
      if (facturarOpcionState?.viaje.id === v.id) setFacturarOpcionState(null);
      setViajeDeleteConfirm(null);
    } catch (e) {
      setError(friendlyError(e, platform ? "plataforma" : "viajes"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrir una vez por valor de `viaje` en URL
  }, [searchParams, isLoaded, isSignedIn, rows, getToken, setSearchParams]);

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
    } catch (e) {
      setError(friendlyError(e, "viajes"));
    } finally {
      setSavingEstadoId(null);
    }
  }

  async function navigateToFacturacion(v: Viaje) {
    try {
      const facturasCliente = await apiJson<Factura[]>(
        facturasPorClienteUrl(v.clienteId ?? ""),
        () => getToken(),
      );
      // Si el viaje ya está vinculado a una factura, ir directamente a ella
      const yaVinculada = facturasCliente.find((f) =>
        f.viajeIds.includes(v.id),
      );
      if (yaVinculada) {
        navigate("/facturacion", {
          state: { ...facturacionNavExtras(), expandFacturaId: yaVinculada.id },
        });
        return;
      }
      // Si el cliente tiene otras facturas, mostrar el modal de elección
      if (facturasCliente.length > 0) {
        setFacturarOpcionState({ viaje: v, facturas: facturasCliente });
        return;
      }
    } catch {
      // si falla la consulta, igualmente navegamos para no bloquear al usuario
    }
    navigate("/facturacion", {
      state: {
        ...facturacionNavExtras(),
        newFacturaDraft: {
          clienteId: v.clienteId ?? "",
          viajeIds: [v.id],
        },
      },
    });
  }

  async function handleFacturarOpcionConfirm(
    opcion: "nueva" | { facturaId: string },
  ) {
    if (!facturarOpcionState) return;
    const { viaje, facturas } = facturarOpcionState;
    if (opcion === "nueva") {
      setFacturarOpcionState(null);
      navigate("/facturacion", {
        state: {
          ...facturacionNavExtras(),
          newFacturaDraft: {
            clienteId: viaje.clienteId ?? "",
            viajeIds: [viaje.id],
          },
        },
      });
      return;
    }
    // Agregar a factura existente
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
      navigate("/facturacion", {
        state: { ...facturacionNavExtras(), expandFacturaId: opcion.facturaId },
      });
    } catch (e) {
      setError(friendlyError(e, "facturacion"));
    } finally {
      setFacturarOpcionBusy(false);
    }
  }

  function applyDraftModo(m: ViajeOperacionModo) {
    setDraft((p) =>
      p
        ? {
            ...p,
            operacionModo: m,
            ...(m === "externo"
              ? { choferId: "", vehiculosRows: [] }
              : {
                  transportistaId: "",
                  realizaFlete: true,
                  transportistaEfectivoId: "",
                  choferExternoId: "",
                  pagosTransportista: [],
                  choferId: normalizarIdEnLista(p.choferId, choferesPropios),
                  vehiculosRows:
                    p.vehiculosRows.length > 0
                      ? p.vehiculosRows
                      : [{ tipo: "tractor", vehiculoId: "" }],
                }),
          }
        : p,
    );
  }

  async function saveInline(viajeId: string) {
    if (!draft) return;
    if (!draft.numero.trim()) {
      setError("Ingresá el número de viaje.");
      return;
    }
    if (!draft.destinosRows[0]?.etiqueta.trim()) {
      setDestinosError("Ingresá el destino 1.");
      return;
    }
    const externo = draft.operacionModo === "externo";
    if (externo && !draft.transportistaId.trim()) {
      setError("Seleccioná un transportista externo.");
      return;
    }
    const teErr = mensajeErrorTransportistaEfectivoExterno(draft);
    if (teErr) {
      setTransportistaEfectivoError(teErr);
      setError(teErr);
      return;
    }
    setTransportistaEfectivoError(null);
    const vids = vehiculoIdsDesdeRows(draft.vehiculosRows);
    if (!externo && vids.length === 0) {
      setError(
        "Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).",
      );
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(
        draft.choferId,
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
    const o = draft.origen.trim();
    if (o) {
      const okO = await esEtiquetaCiudadValida(draft.paisOrigen, o);
      if (!okO) {
        setError(
          "El origen debe elegirse de la lista de ciudades (no se admite texto libre).",
        );
        return;
      }
    }
    const destinosVal = await validarDestinosRows(draft.destinosRows);
    if (!destinosVal.ok) {
      setDestinosError(destinosVal.message);
      return;
    }
    setDestinosError(null);
    const fcError = !draft.fechaCarga.trim()
      ? "Ingresá la fecha de carga."
      : null;
    const fdError = !draft.fechaDescarga.trim()
      ? "Ingresá la fecha de descarga."
      : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(fdError);
    if (fcError || fdError) return;
    if (draft.fechaDescarga < draft.fechaCarga) {
      setFechaDescargaError(
        "La fecha de descarga no puede ser anterior a la de carga.",
      );
      return;
    }
    if (draftRequiereGananciaBrutaManual(draft)) {
      const manualPayload = gananciaBrutaManualPayloadFromDraft(draft);
      if (manualPayload.gananciaBrutaManual == null) {
        setError(
          "Ingresá la ganancia bruta manual: las monedas de facturación y del transportista son distintas.",
        );
        return;
      }
    }
    const precioTransportistaNum = parseCurrencyForMoneda(
      draft.precioTransportistaExterno,
      draft.monedaPrecioTransportistaExterno,
    );
    const pagosTransportistaApi = pagosTransportistaDraftsToApi(draft.pagosTransportista);
    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: draft.transportistaId.trim(),
          precioTransportistaExterno: draft.precioTransportistaExterno,
          monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
          pagosTransportista: draft.pagosTransportista,
        })
      : null;
    if (pagoTransportistaError) {
      setError(pagoTransportistaError);
      return;
    }

    const kmResolved = draft.kmRecorridos.trim()
      ? Number(draft.kmRecorridos.replace(",", "."))
      : undefined;
    const litResolved = draft.litrosConsumidos.trim()
      ? Number(draft.litrosConsumidos.replace(",", "."))
      : undefined;
    setSavingId(viajeId);
    setError(null);
    try {
      const destinosBody = destinosPayloadParaApi(destinosVal.destinos);
      const updated = await apiJson<Viaje>(
        viajeApiUrl(viajeId),
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify({
            numero: draft.numero.trim(),
            estado: draft.estado,
            clienteId: draft.clienteId || undefined,
            ...(externo
              ? {
                  transportistaId: draft.transportistaId.trim(),
                  contratanteRealizaFlete: draft.realizaFlete,
                  transportistaEfectivoId: draft.realizaFlete
                    ? null
                    : draft.transportistaEfectivoId.trim() || null,
                  choferId: draft.choferExternoId.trim() || null,
                  vehiculoIds: vids,
                }
              : {
                  transportistaId: null,
                  transportistaEfectivoId: null,
                  choferId: draft.choferId.trim(),
                  vehiculoIds: vids,
                }),
            origen: draft.origen.trim() || undefined,
            ...destinosBody,
            fechaCarga: fechaHoraToIso(draft.fechaCarga, draft.horaCarga),
            fechaDescarga: fechaHoraToIso(
              draft.fechaDescarga,
              draft.horaDescarga,
            ),
            productoItems: draft.productoItems.filter((x) =>
              x.productoId.trim(),
            ),
            detalleCarga: draft.detalleCarga.trim() || undefined,
            observaciones: draft.observaciones.trim() || undefined,
            monto: parseCurrencyForMoneda(draft.monto, draft.monedaMonto),
            monedaMonto: draft.monedaMonto,
            kmRecorridos: kmResolved,
            litrosConsumidos: litResolved,
            precioTransportistaExterno: precioTransportistaNum,
            monedaPrecioTransportistaExterno:
              draft.monedaPrecioTransportistaExterno,
            ...gananciaBrutaManualPayloadFromDraft(draft),
            otrosGastos: draft.otrosGastos
              .map(otroGastoDraftToApi)
              .filter(Boolean),
            pagosTransportista: externo ? pagosTransportistaApi : [],
          }),
        },
      );
      let viajeGuardado = viajeConDestinosEnRespuesta(
        updated,
        destinosVal.destinos,
      );
      if (
        etiquetasDestinosDesdeViaje(viajeGuardado).length <
        destinosVal.destinos.length
      ) {
        try {
          viajeGuardado = await apiJson<Viaje>(viajeApiUrl(viajeId), () =>
            getToken(),
          );
        } catch {
          /* mantener respuesta del PATCH */
        }
        viajeGuardado = viajeConDestinosEnRespuesta(
          viajeGuardado,
          destinosVal.destinos,
        );
      }
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === viajeId ? viajeGuardado : r)) : prev,
      );
      const stubs = entidadesMaestroStubsDesdeViaje(updated);
      setSessionMaestro((prev) => ({
        clientes: mergeMaestroPorId(prev.clientes, stubs.clientes),
        choferes: mergeMaestroPorId(prev.choferes, stubs.choferes),
        transportistas: mergeMaestroPorId(
          prev.transportistas,
          stubs.transportistas,
        ),
        vehiculos: mergeMaestroPorId(prev.vehiculos, stubs.vehiculos),
      }));
      cancelEdit();
    } catch (e) {
      setError(friendlyError(e, "viajes"));
    } finally {
      setSavingId(null);
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

      {error && !editingId && (
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
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => void navigateToFacturacion(v)}
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
                  onEmitirCvlp={
                    hasLiquidacionesArca && v.transportistaId
                      ? () => setEmitirCvlpViaje(v)
                      : hasFacturacionSinArca && v.transportistaId
                        ? () => setSelectorViaje(v)
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
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => void navigateToFacturacion(v)}
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
                  onEmitirCvlp={
                    hasLiquidacionesArca && v.transportistaId
                      ? () => setEmitirCvlpViaje(v)
                      : hasFacturacionSinArca && v.transportistaId
                        ? () => setSelectorViaje(v)
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
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-vialto-steel">
              Página {meta.page} de {meta.totalPages} · {meta.total} registros
            </p>
            <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
              Mostrar
              <select
                value={pageSize}
                disabled={listadoRefetching}
                onChange={(e) => {
                  setListadoRefetching(true);
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 border border-black/20 bg-white px-2 text-xs disabled:opacity-50"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={!meta.hasPrev || listadoRefetching}
              onClick={() => {
                setListadoRefetching(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext || listadoRefetching}
              onClick={() => {
                setListadoRefetching(true);
                setPage((p) => p + 1);
              }}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          tenantId={platform ? tid : undefined}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const v = viewingViaje;
            setViewingViaje(null);
            void beginEditViaje(v);
          }}
        />
      )}

      {editingId && draft && viajeEdicionSnapshot && (
        <ViajeEditModal
          open
          draft={draft}
          setDraft={setDraft}
          snapshotViaje={viajeEdicionSnapshot}
          opcionesProducto={opcionesProductoModal}
          clientes={edicionMaestro?.clientes ?? clientes}
          choferes={edicionMaestro?.choferes ?? choferes}
          transportistas={edicionMaestro?.transportistas ?? transportistas}
          vehiculos={edicionMaestro?.vehiculos ?? vehiculos}
          choferesPropios={choferesPropios}
          vehiculosPropios={vehiculosPropios}
          viajesConFactura={viajesConFactura}
          onModoChange={applyDraftModo}
          ayudaFlota={
            edicionMaestro
              ? mensajesAyudaFlotaPropia(
                  edicionMaestro.choferes,
                  edicionMaestro.vehiculos,
                )
              : ayudaFlotaListado
          }
          viajeEditHint={viajeEditHint}
          fechaCargaError={fechaCargaError}
          fechaDescargaError={fechaDescargaError}
          destinosError={destinosError}
          onClearDestinosError={() => setDestinosError(null)}
          transportistaEfectivoError={transportistaEfectivoError}
          onClearTransportistaEfectivoError={() =>
            setTransportistaEfectivoError(null)
          }
          onDraftFechasPatch={(p) => {
            setDraft((prev) => (prev ? { ...prev, ...p } : prev));
            if (p.fechaCarga) setFechaCargaError(null);
            if (p.fechaDescarga) setFechaDescargaError(null);
          }}
          onClose={cancelEdit}
          onSave={() => void saveInline(editingId)}
          onFacturar={() => {
            const v = {
              ...viajeEdicionSnapshot,
              clienteId:
                draft.clienteId.trim() || viajeEdicionSnapshot.clienteId,
            };
            void navigateToFacturacion(v);
          }}
          onEliminar={() => requestDeleteViaje(viajeEdicionSnapshot)}
          saving={savingId === editingId}
          error={error}
          crearVehiculoHref={
            platform
              ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(tid)}`
              : undefined
          }
          getToken={getToken}
          tenantId={platform ? tid : undefined}
          onProductoCreado={(p) => setProductosCatalogo((prev) => [...prev, p])}
          onClienteCreado={(c) => upsertMaestroEdicion("clientes", c)}
          onTransportistaCreado={(t) =>
            upsertMaestroEdicion("transportistas", t)
          }
          onChoferCreado={(c) => upsertMaestroEdicion("choferes", c)}
          onVehiculoCreado={(v) => upsertMaestroEdicion("vehiculos", v)}
        />
      )}

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
          if (editingId === updated.id) {
            setDraft((d) =>
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
          if (editingId === updated.id) {
            setDraft((d) =>
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
            // La liquidación se creó; refrescar listado para reflejar el nuevo estado si corresponde
            setListadoQueryVersion((v) => v + 1);
          }}
          onFacturarManual={() => void navigateToFacturacion(emitirCvlpViaje)}
        />
      )}

      {selectorViaje && (
        <FacturarSelectorModal
          onClose={() => setSelectorViaje(null)}
          onFacturarCliente={() => void navigateToFacturacion(selectorViaje)}
          onLiquidacion={() => {
            setCrearLiqViaje(selectorViaje);
            setSelectorViaje(null);
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
            ? `¿Eliminás el viaje ${viajeDeleteConfirm.numero}? Esta acción no se puede deshacer.`
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

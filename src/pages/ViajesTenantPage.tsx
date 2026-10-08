import { createPortal } from "react-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { isOrgAdmin } from "@/lib/roleLabels";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useViajeEditor } from "@/hooks/useViajeEditor";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useTipoFlotaVisible } from "@/hooks/useTipoFlotaVisible";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ClienteSearchSelect,
  ChoferSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import { PaisUbicacionSelect } from "@/components/forms/PaisUbicacionSelect";
import { AgregarGastoModal } from "@/components/viajes/AgregarGastoModal";
import { RegistrarPagoTransportistaModal } from "@/components/viajes/RegistrarPagoTransportistaModal";
import { ExportarViajeModal } from "@/components/viajes/ExportarViajeModal";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import {
  type FacturaLetra,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
  condicionIvaLabel,
} from "@/lib/arcaCbteTipo";
import { apiJson, apiFetch, ApiError } from "@/lib/api";
import { liquidacionContratoPdfUrl } from "@/lib/liquidacionContratoPdf";
import { useToast } from "@/lib/toast";
import { friendlyError } from "@/lib/friendlyError";
import {
  mergeMaestroPorId,
  clientesRutaListadoViaje,
  nombreChoferListadoViaje,
  nombreTransportistaExternoListadoViaje,
  nombreTransportistaEfectivoListadoViaje,
  numeroVisibleViaje,
  labelIdentificacionPersonalizadaViajes,
  idSistemaHabilitado,
  idPropio1Habilitado,
  idPropio2Habilitado,
  idPropio2Label,
  transportistaEfectivoIdDesdeViaje,
  viajeFacturableParaCliente,
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import { ViajeOrigenDestinoLinea } from "@/components/viajes/ViajeOrigenDestinoLinea";
import { ViajeEditModal } from "@/components/viajes/ViajeEditModal";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeAccionesMenu } from "@/components/viajes/ViajeAccionesMenu";
import { ViajesResumenFiltros } from "@/components/viajes/ViajesResumenFiltros";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { otroGastoDraftFromApi } from "@/components/viajes/OtrosGastosFieldset";
import { pagoTransportistaDraftFromApi } from "@/components/viajes/PagosTransportistaFieldset";
import { type PaisCodigo } from "@/lib/ciudades";
import { paisCodigoDesdeTexto } from "@/lib/ciudades/paises";
import {
  formatIsoFechaCortaListadoEsAr,
  formatIsoFechaHoraListadoEsAr,
} from "@/lib/viajeFechaHora";
import {
  viajePendienteComprobanteTransportista,
  viajeTieneLiquidacionActivaParaTransportista,
  liquidacionElegidaDeViaje,
  facturaBorradorIdDeViaje,
  liquidacionBorradorIdDeViaje,
} from "@/lib/viajesComprobantes";
import {
  etapaViajeBadgeClass,
  etapaViajeBadgeClassDefault,
  etapaViajeLabel,
  tooltipEtapaViaje,
  VIAJE_ETAPAS_TODAS,
} from "@/lib/viajesIndicadores";
import { ViajeFacturacionIndicador } from "@/components/viajes/ViajeFacturacionIndicador";
import { ViajeEtapaIcono } from "@/components/viajes/ViajeEtapaIcono";
import { ViajeLiquidacionIndicador } from "@/components/viajes/ViajeLiquidacionIndicador";
import { ViajePagoTransportistaIndicador } from "@/components/viajes/ViajePagoTransportistaIndicador";
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
  canAccessEmisionFacturasArca,
  canAccessEmisionLiquidoProductoArca,
  canAccessFacturacion,
  canAccessLiquidaciones,
} from "@/lib/tenantModules";
import {
  MSG_ARCA_NO_FACTURA_USD,
  MSG_ARCA_NO_LIQUIDA_USD,
  arcaBloqueaFacturarUsd,
  arcaBloqueaLiquidarUsd,
} from "@/lib/arcaUsdRestriction";
import { FacturarSelectorMultiClienteModal } from "@/components/viajes/FacturarSelectorMultiClienteModal";
import { VerFacturasMultiClienteModal } from "@/components/viajes/VerFacturasMultiClienteModal";
import type {
  Chofer,
  Cliente,
  Factura,
  PaginatedMeta,
  Producto,
  Transportista,
  Vehiculo,
  Viaje,
  ViajeEliminacionConflicto,
} from "@/types/api";
import {
  appendViajeSortQuery,
  sortViajesListado,
  type ViajeSortDir,
  type ViajeSortField,
} from "@/lib/viajesOrdenamiento";
import { ViajesOrdenamientoMenu } from "@/components/viajes/ViajesOrdenamientoMenu";
import { CornerDownRight, Download, Filter, Upload } from "lucide-react";
import { ExcelExportModal } from "@/components/stock/ExcelExportModal";
import {
  VIAJES_EXPORT_COLUMNS,
  generarViajesExcel,
} from "@/lib/viajesExcelExport";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { LiquidacionViewModal } from "@/components/liquidaciones/LiquidacionViewModal";

// Importaciones para el nuevo flujo de Facturación Inline
import { FacturaCreateModal } from "@/components/facturacion/FacturaCreateModal";
import type { FacturaDraft } from "@/components/facturacion/FacturaEditModal";

// ─── COMPONENTE DE BUSCADOR CON COMBOBOX (AUTOCOMPLETE) ────────────────────
function AutocompleteInput({
  value,
  onChange,
  onSearch,
  placeholder,
  disabled,
  prefix = "",
}: {
  value: string;
  onChange: (val: string) => void;
  onSearch: (query: string) => Promise<string[]>;
  placeholder?: string;
  disabled?: boolean;
  prefix?: string;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        wrapperRef.current &&
        document.contains(target) &&
        !wrapperRef.current.contains(target)
      ) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  useEffect(() => {
    let active = true;
    const queryClean = query.trim();

    if (queryClean === value.trim() && !open) return;

    if (!queryClean) {
      setOptions([]);
      setOpen(false);
      if (value) onChange("");
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      onSearch(queryClean).then((res) => {
        if (!active) return;
        setOptions(res);
        setOpen(true);
        setLoading(false);
      });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value, onChange, onSearch, open]);

  const handleApply = (valToApply: string) => {
    setQuery(valToApply);
    setOpen(false);
    onChange(valToApply);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className={`flex items-center h-9 w-full border border-black/15 bg-white px-2 text-sm focus-within:ring-1 focus-within:ring-vialto-fire ${
          value ? "text-vialto-fire" : "text-vialto-charcoal"
        } ${disabled ? "opacity-60 bg-gray-50" : ""}`}
      >
        {prefix && (
          <span className="text-vialto-steel mr-0.5 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            let val = e.target.value;
            if (prefix === "#") {
              val = val.replace(/#/g, "");
            }
            setQuery(val);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply(query.trim());
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (query.trim() && options.length > 0) setOpen(true);
          }}
          className="flex-1 min-w-0 outline-none bg-transparent"
          autoComplete="off"
        />
      </div>
      {open && query.trim() !== "" && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-black/15 bg-white py-1 shadow-lg text-sm text-vialto-charcoal">
          {loading ? (
            <li className="px-3 py-2 text-vialto-steel">Buscando...</li>
          ) : options.length === 0 ? (
            <li
              className="cursor-pointer px-3 py-2 hover:bg-vialto-mist/80 text-vialto-steel"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleApply(query.trim());
              }}
            >
              Presiona{" "}
              <kbd className="font-sans font-medium px-1 bg-gray-100 border border-gray-300 rounded">
                Enter
              </kbd>{" "}
              para buscar "{query}"
            </li>
          ) : (
            options.map((opt, idx) => {
              return (
                <li
                  key={idx}
                  className="cursor-pointer px-3 py-2 hover:bg-vialto-mist/80"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleApply(opt);
                  }}
                >
                  {prefix}
                  {opt}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

type ViajesPaginatedResponse = {
  items: Viaje[];
  meta: PaginatedMeta;
};

export function ViajesTenantPage({
  tenantId,
  embeddedInSuperadmin,
  tenantModules,
  filtroRapidoPortalTarget,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
  /** Módulos de la empresa elegida (vista superadmin) — `useCurrentTenant()` no aplica acá. */
  tenantModules?: string[];
  /**
   * Vista superadmin: nodo (junto al título "Viajes" que renderiza `ViajesSuperadminPage.tsx`)
   * donde teletransportar el botón de filtros rápidos + panel, para que quede al lado del
   * título igual que en la vista de tenant — acá no se puede simplemente mover el `<h1>`
   * porque este componente recién monta después de elegir una empresa.
   */
  filtroRapidoPortalTarget?: HTMLElement | null;
} = {}) {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const { tenant: currentTenant } = useCurrentTenant();
  const { showToast } = useToast();
  const { isVisible: isViajeFieldVisible } = useFieldConfig("viajes");
  useFieldConfig("liquidaciones");

  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);
  const [viewingLiquidacion, setViewingLiquidacion] = useState<any | null>(
    null,
  );

  const [isFacturaModalOpen, setIsFacturaModalOpen] = useState(false);
  const [facturaDraft, setFacturaDraft] = useState<FacturaDraft>({
    tipo: "cliente",
    transportistaId: "",
    clienteId: "",
    numero: "",
    fechaEmision: new Date().toISOString().split("T")[0],
    fechaVencimiento: "",
    ivaPct: "",
    viajeIds: [],
    facturarPorTramo: false,
    tramos: [],
    comprobanteUrl: null,
    comprobanteFile: null,
    letraComprobante: null,
  });

  const platform = Boolean(tenantId?.trim());
  const puedeImportar =
    !embeddedInSuperadmin &&
    isOrgAdmin({ orgRole, publicMetadata: user?.publicMetadata }) &&
    !currentTenant?.importacionesOcultas;
  const hasFacturasArca =
    !platform && canAccessEmisionFacturasArca(currentTenant?.modules ?? []);
  const hasLiquidoProductoArca =
    !platform &&
    canAccessEmisionLiquidoProductoArca(currentTenant?.modules ?? []);
  const hasFacturacionSinArca =
    !platform &&
    !hasFacturasArca &&
    canAccessFacturacion(currentTenant?.modules ?? []);
  // Mismo criterio que "hasLiquidaciones" en AppShell.tsx: la grilla debe mostrar el
  // estado de liquidación (sin_liquidar/liquidado) apenas el tenant tiene acceso a
  // Liquidaciones, no solo cuando además tiene emision-liquido-producto-arca — un
  // tenant con registro de liquidaciones sin ARCA (ej. LSF) igual crea Liquidaciones
  // manuales reales.
  const hasLiquidaciones =
    hasLiquidoProductoArca ||
    (!platform && canAccessLiquidaciones(currentTenant?.modules ?? []));
  // Vista superadmin: `useCurrentTenant()` no resuelve la empresa elegida (esa vive en
  // `tenantModules`, que trae `ViajesSuperadminPage.tsx` desde `useTenantsList()`) — sin
  // esto la grilla embebida en superadmin siempre caía al badge de "pago transportista"
  // en vez de "sin liquidar"/"liquidado", aunque la empresa sí tuviera Liquidaciones.
  const hasLiquidoProductoArcaResuelto = platform
    ? canAccessEmisionLiquidoProductoArca(tenantModules ?? [])
    : hasLiquidoProductoArca;
  const hasLiquidacionesResuelto = platform
    ? hasLiquidoProductoArcaResuelto ||
      canAccessLiquidaciones(tenantModules ?? [])
    : hasLiquidaciones;
  const tid = tenantId?.trim() ?? "";
  // Empresa solo de flota propia (Tenant.tipoFlota): no terceriza transporte,
  // la columna "Transporte" diría siempre "Flota propia".
  const { transportistaExternoVisible: mostrarColumnaTransporte } =
    useTipoFlotaVisible(tid || undefined);

  const [clientesP, setClientesP] = useState<Cliente[]>([]);
  const [choferesP, setChoferesP] = useState<Chofer[]>([]);
  const [transportistasP, setTransportistasP] = useState<Transportista[]>([]);
  const [vehiculosP, setVehiculosP] = useState<Vehiculo[]>([]);
  const clientes = platform ? clientesP : maestro.clientes;
  const choferes = platform ? choferesP : maestro.choferes;
  const transportistas = platform ? transportistasP : maestro.transportistas;
  const vehiculos = platform ? vehiculosP : maestro.vehiculos;

  const viajeApiUrl = useCallback(
    (id: string, opts?: { force?: boolean }) => {
      const base = !platform
        ? `/api/viajes/${encodeURIComponent(id)}`
        : `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tid)}`;
      if (!opts?.force) return base;
      return `${base}${base.includes("?") ? "&" : "?"}force=true`;
    },
    [platform, tid],
  );

  function facturasPorClienteUrl(clienteId: string) {
    if (!platform) {
      return `/api/facturacion/facturas?clienteId=${encodeURIComponent(clienteId)}`;
    }
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}&clienteId=${encodeURIComponent(clienteId)}`;
  }

  const facturacionNavExtras = () => (platform ? { tenantId: tid } : {});

  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [exportarViaje, setExportarViaje] = useState<Viaje | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  /** Fila/card clickeada: abre el menú de acciones de ese viaje en vez del modal de detalle. */
  const [accionesAbiertoViajeId, setAccionesAbiertoViajeId] = useState<
    string | null
  >(null);
  const [abriendoEditorViaje, setAbriendoEditorViaje] = useState(false);
  const [viajeDeleteConfirm, setViajeDeleteConfirm] = useState<Viaje | null>(
    null,
  );
  const [viajeDeleteImpacto, setViajeDeleteImpacto] = useState<{
    viaje: Viaje;
    conflicto: ViajeEliminacionConflicto;
  } | null>(null);
  const [deletingViajeId, setDeletingViajeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<ViajeSortField>("fecha_creacion");
  const [sortDir, setSortDir] = useState<ViajeSortDir>("desc");

  const ordenamientoAplicadoRef = useRef({
    sortBy: "fecha_creacion" as ViajeSortField,
    sortDir: "desc" as ViajeSortDir,
  });

  const initialEstadoFromUrl = searchParams.get("etapa")?.trim() ?? "";
  const initialPagoTransportistaFromUrl = (() => {
    const p = searchParams.get(VIAJE_PAGO_TRANSPORTISTA_QUERY)?.trim() ?? "";
    return esFiltroPagoTransportistaValido(p) ? p : "";
  })();

  const filtrosAplicadosRef = useRef({
    numero: "",
    ctg: "",
    idPropio2: "",
    clienteId: "",
    transportistaId: "",
    choferId: "",
    estado: initialEstadoFromUrl,
    facturacionEstado: "",
    liquidacionEstado: "",
    pagoTransportista:
      initialPagoTransportistaFromUrl as ViajePagoTransportistaFiltro,
    tipoFecha: "" as "" | "carga" | "descarga",
    fechaDesde: "",
    fechaHasta: "",
    tipoUbicacion: "" as "" | "origen" | "destino",
    ubicacion: "",
    periodo: "todos" as "todos" | "desde_hoy" | "anteriores",
  });

  const [numeroFiltroActivo, setNumeroFiltroActivo] = useState("");
  const [ctgFiltroActivo, setCtgFiltroActivo] = useState("");
  const [idPropio2FiltroActivo, setIdPropio2FiltroActivo] = useState("");
  const [clienteIdFiltroActivo, setClienteIdFiltroActivo] = useState("");
  const [transportistaIdFiltroActivo, setTransportistaIdFiltroActivo] =
    useState("");
  const [choferIdFiltroActivo, setChoferIdFiltroActivo] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState(initialEstadoFromUrl);
  const [facturacionFiltro, setFacturacionFiltro] = useState("");
  const [liquidacionFiltro, setLiquidacionFiltro] = useState("");
  const [pagoTransportistaFiltro, setPagoTransportistaFiltro] =
    useState<ViajePagoTransportistaFiltro>(initialPagoTransportistaFromUrl);
  const [showFiltrosRapidos, setShowFiltrosRapidos] = useState(false);
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

  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [idsSeleccionLote, setIdsSeleccionLote] = useState<string[]>(
    [],
  );
  /** Viajes seleccionados para facturar/liquidar en lote (la selección puede abarcar varias páginas). */
  const viajesSeleccionLote = useRef(new Map<string, Viaje>());
  const [liquidarLote, setLiquidarLote] = useState<{
    transportistaId: string;
    viajeIds: string[];
  } | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [agregarGastoViaje, setAgregarGastoViaje] = useState<Viaje | null>(
    null,
  );
  const [registrarPagoViaje, setRegistrarPagoViaje] = useState<Viaje | null>(
    null,
  );

  const [facturarMultiClienteViaje, setFacturarMultiClienteViaje] =
    useState<Viaje | null>(null);
  const [verFacturasMultiClienteViaje, setVerFacturasMultiClienteViaje] =
    useState<Viaje | null>(null);
  const [crearLiqViaje, setCrearLiqViaje] = useState<Viaje | null>(null);
  const [facturandoLoadingId, setFacturandoLoadingId] = useState<string | null>(
    null,
  );

  const [resumen, setResumen] = useState<{
    sinFacturar: number;
    sinCobrar: number;
    sinPagar: number;
    pagados: number;
  } | null>(null);

  // Funciones asincrónicas de búsqueda de Autocompletado
  const searchNumero = useCallback(
    async (q: string) => {
      const qClean = q.replace(/#/g, "").trim().toLowerCase();
      if (!qClean) return [];

      const params = new URLSearchParams();
      if (platform && tid) params.set("tenantId", tid);
      // NO le pasamos qClean a la API para que no nos devuelva 0 resultados por el filtro estricto.
      // Descargamos un lote general y lo filtramos aquí mismo.
      params.set("page", "1");
      params.set("pageSize", "1000");

      const url = platform
        ? `/api/platform/viajes/paginated?${params.toString()}`
        : `/api/viajes/paginated?${params.toString()}`;

      try {
        const res = await apiJson<ViajesPaginatedResponse>(url, () =>
          getTokenRef.current(),
        );

        // Filtramos de forma estricta localmente asegurando coincidencia parcial
        const matches = res.items.filter((v) =>
          String(v.numero).toLowerCase().includes(qClean),
        );

        return Array.from(new Set(matches.map((v) => String(v.numero))));
      } catch {
        return [];
      }
    },
    [platform, tid],
  );

  const searchCtg = useCallback(
    async (q: string) => {
      const qClean = q.trim().toLowerCase();
      if (!qClean) return [];

      const params = new URLSearchParams();
      if (platform && tid) params.set("tenantId", tid);
      params.set("page", "1");
      params.set("pageSize", "1000");

      const url = platform
        ? `/api/platform/viajes/paginated?${params.toString()}`
        : `/api/viajes/paginated?${params.toString()}`;

      try {
        const res = await apiJson<ViajesPaginatedResponse>(url, () =>
          getTokenRef.current(),
        );

        // Filtro local estricto
        const matches = res.items
          .map((v) => v.numeroIdentificacionPersonalizado?.trim() || "")
          .filter((x) => x.toLowerCase().includes(qClean));

        return Array.from(new Set(matches));
      } catch {
        return [];
      }
    },
    [platform, tid],
  );

  const searchIdPropio2 = useCallback(
    async (q: string) => {
      const qClean = q.trim().toLowerCase();
      if (!qClean) return [];

      const params = new URLSearchParams();
      if (platform && tid) params.set("tenantId", tid);
      params.set("page", "1");
      params.set("pageSize", "1000");

      const url = platform
        ? `/api/platform/viajes/paginated?${params.toString()}`
        : `/api/viajes/paginated?${params.toString()}`;

      try {
        const res = await apiJson<ViajesPaginatedResponse>(url, () =>
          getTokenRef.current(),
        );

        // Filtro local estricto
        const matches = res.items
          .map((v) => v.idPropio2?.trim() || "")
          .filter((x) => x.toLowerCase().includes(qClean));

        return Array.from(new Set(matches));
      } catch {
        return [];
      }
    },
    [platform, tid],
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
    hasFacturasArca: hasFacturasArca,
    refreshMaestroListas: fetchMaestroListasFresh,
    onEntityCreated: (key, item) => {
      if (!platform) return;
      const mergeOne = <T extends { id: string }>(prev: T[]) =>
        mergeMaestroPorId(prev, [item as unknown as T]);
      if (key === "clientes") setClientesP((prev) => mergeOne(prev));
      if (key === "choferes") setChoferesP((prev) => mergeOne(prev));
      if (key === "transportistas")
        setTransportistasP((prev) => mergeOne(prev));
      if (key === "vehiculos") setVehiculosP((prev) => mergeOne(prev));
    },
    onViajeRefetched: (viaje) => {
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === viaje.id ? viaje : r)) : prev,
      );
    },
    onViajeSaved: (viaje) => {
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === viaje.id ? viaje : r)) : prev,
      );
    },
    fetchProductosCatalogo: fetchProductosCatalogoParaEditor,
  });

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

  function beginEditViaje(v: Viaje, origen: "listado" | "remoto" = "listado") {
    return viajeEditor.beginEditViaje(v, origen);
  }

  function cancelEdit() {
    viajeEditor.cancelEdit();
  }

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
    if (platform && !tid) return;
    let cancelled = false;
    (async () => {
      const base = platform
        ? `/api/platform/viajes/paginated?tenantId=${encodeURIComponent(tid)}&`
        : "/api/viajes/paginated?";
      const [estadoSF, estadoSC, pagoSP, pagoPag] = await Promise.allSettled([
        apiJson<ViajesPaginatedResponse>(
          `${base}etapa=finalizado&facturacionEstado=sin_facturar&page=1&pageSize=1`,
          () => getToken(),
        ),
        apiJson<ViajesPaginatedResponse>(
          `${base}facturacionEstado=facturado&page=1&pageSize=1`,
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
          numero: numF,
          ctg: ctgF,
          idPropio2: idp2F,
          clienteId: cid,
          transportistaId: transpFiltro,
          choferId: choferFiltro,
          estado: estF,
          facturacionEstado: facEstF,
          liquidacionEstado: liqEstF,
          pagoTransportista: pagoTranspF,
          tipoFecha: tf,
          fechaDesde: fd,
          fechaHasta: fh,
          tipoUbicacion: tu,
          ubicacion: ut,
          periodo: per,
        } = filtrosAplicadosRef.current;

        // Por seguridad, enviamos los datos en la consulta, pero no confiamos ciegamente en el backend si el texto es parcial.
        if (numF.trim()) {
          const cleanNum = numF.replace(/#/g, "").trim();
          filtros.set("numero", cleanNum);
          filtros.set("q", cleanNum);
          filtros.set("busqueda", cleanNum);
        }
        if (ctgF.trim()) {
          filtros.set("ctg", ctgF.trim());
          filtros.set("numeroIdentificacionPersonalizado", ctgF.trim());
          filtros.set("q", ctgF.trim());
          filtros.set("busqueda", ctgF.trim());
        }
        if (idp2F.trim()) {
          filtros.set("idPropio2", idp2F.trim());
          filtros.set("q", idp2F.trim());
          filtros.set("busqueda", idp2F.trim());
        }

        if (cid) filtros.set("clienteId", cid);
        if (transpFiltro) filtros.set("transportistaId", transpFiltro);
        if (choferFiltro) filtros.set("choferId", choferFiltro);
        if (estF.trim()) filtros.set("etapa", estF.trim());
        if (facEstF.trim()) filtros.set("facturacionEstado", facEstF.trim());
        if (liqEstF.trim()) filtros.set("liquidacionEstado", liqEstF.trim());
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

        const isLocalSearch = !!numF.trim() || !!ctgF.trim() || !!idp2F.trim();
        const pageApi = isLocalSearch ? 1 : Math.max(1, Math.floor(page));
        // Traemos de a muchos si es búsqueda local para garantizar encontrarlo
        const pageSizeApi = isLocalSearch ? 1000 : pageSizeApiValido(pageSize);

        const pagoFiltroActivo =
          pagoTranspF === "sin_pagar" || pagoTranspF === "pagado"
            ? pagoTranspF
            : null;

        let items: Viaje[];
        let meta: PaginatedMeta;

        const sortFetch = ordenamientoAplicadoRef.current;

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

        // --- FILTRADO LOCAL (FALLBACK INFALIBLE DE LA GRILLA) ---
        if (isLocalSearch) {
          const qNum = numF.replace(/#/g, "").trim().toLowerCase();
          const qCtg = ctgF.trim().toLowerCase();
          const qIdPropio2 = idp2F.trim().toLowerCase();

          let filteredItems = items;
          if (qNum) {
            filteredItems = filteredItems.filter((v) =>
              String(v.numero).toLowerCase().includes(qNum),
            );
          }
          if (qCtg) {
            filteredItems = filteredItems.filter((v) =>
              (v.numeroIdentificacionPersonalizado || "")
                .toLowerCase()
                .includes(qCtg),
            );
          }
          if (qIdPropio2) {
            filteredItems = filteredItems.filter((v) =>
              (v.idPropio2 || "").toLowerCase().includes(qIdPropio2),
            );
          }

          // Sobrescribimos paginación con el resultado local exacto
          meta = {
            ...meta,
            total: filteredItems.length,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(filteredItems.length / pageSize) || 1,
          };
          items = filteredItems.slice((page - 1) * pageSize, page * pageSize);
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

  function aplicarFiltroColumnaNumero(val: string) {
    const num = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      numero: num,
    };
    setListadoRefetching(true);
    setNumeroFiltroActivo(num);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroColumnaCTG(val: string) {
    const ctg = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      ctg: ctg,
    };
    setListadoRefetching(true);
    setCtgFiltroActivo(ctg);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroColumnaIdPropio2(val: string) {
    const idp2 = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      idPropio2: idp2,
    };
    setListadoRefetching(true);
    setIdPropio2FiltroActivo(idp2);
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

  function aplicarFiltroColumnaChofer(choferId: string) {
    const chid = choferId.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      choferId: chid,
    };
    setListadoRefetching(true);
    setChoferIdFiltroActivo(chid);
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
      ...(p ? { facturacionEstado: "" } : {}),
    };
    setPagoTransportistaFiltro(p);
    if (p) setFacturacionFiltro("");
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroFacturacion(val: string) {
    const f = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      facturacionEstado: f,
      ...(f ? { pagoTransportista: "" as ViajePagoTransportistaFiltro } : {}),
    };
    setFacturacionFiltro(f);
    if (f) setPagoTransportistaFiltro("");
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroLiquidacion(val: string) {
    const l = val.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      liquidacionEstado: l,
    };
    setLiquidacionFiltro(l);
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

      const dirActual =
        ordenamientoAplicadoRef.current.sortBy === sortByFecha
          ? ordenamientoAplicadoRef.current.sortDir
          : "desc";

      ordenamientoAplicadoRef.current = {
        sortBy: sortByFecha,
        sortDir: dirActual,
      };
      setSortBy(sortByFecha);
      setSortDir(dirActual);
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
      numero: "",
      ctg: "",
      idPropio2: "",
      clienteId: "",
      transportistaId: "",
      choferId: "",
      estado: "",
      facturacionEstado: "",
      liquidacionEstado: "",
      pagoTransportista: "",
      tipoFecha: "",
      fechaDesde: "",
      fechaHasta: "",
      tipoUbicacion: "",
      ubicacion: "",
      periodo: "todos",
    };
    setListadoRefetching(true);
    setNumeroFiltroActivo("");
    setCtgFiltroActivo("");
    setIdPropio2FiltroActivo("");
    setClienteIdFiltroActivo("");
    setTransportistaIdFiltroActivo("");
    setChoferIdFiltroActivo("");
    setEstadoFiltro("");
    setFacturacionFiltro("");
    setLiquidacionFiltro("");
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

  const cantidadFiltrosRapidosActivos =
    (facturacionFiltro.trim() ? 1 : 0) +
    (pagoTransportistaFiltro.trim() ? 1 : 0);

  const hayFiltrosColumnasActivos =
    !!numeroFiltroActivo.trim() ||
    !!ctgFiltroActivo.trim() ||
    !!idPropio2FiltroActivo.trim() ||
    !!clienteIdFiltroActivo.trim() ||
    !!transportistaIdFiltroActivo.trim() ||
    !!choferIdFiltroActivo.trim() ||
    !!estadoFiltro.trim() ||
    !!facturacionFiltro.trim() ||
    !!liquidacionFiltro.trim() ||
    !!pagoTransportistaFiltro.trim() ||
    !!fechaDesdeFiltro.trim() ||
    !!fechaHastaFiltro.trim() ||
    !!ubicacionFiltro.trim() ||
    periodoFiltro !== "todos";

  const cantidadFiltrosColumnasActivos = useMemo(() => {
    let n = 0;
    if (numeroFiltroActivo.trim()) n += 1;
    if (ctgFiltroActivo.trim()) n += 1;
    if (idPropio2FiltroActivo.trim()) n += 1;
    if (clienteIdFiltroActivo.trim()) n += 1;
    if (transportistaIdFiltroActivo.trim()) n += 1;
    if (choferIdFiltroActivo.trim()) n += 1;
    if (estadoFiltro.trim()) n += 1;
    if (facturacionFiltro.trim()) n += 1;
    if (liquidacionFiltro.trim()) n += 1;
    if (pagoTransportistaFiltro.trim()) n += 1;
    if (ubicacionFiltro.trim()) n += 1;
    if (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim()) n += 1;
    if (periodoFiltro !== "todos") n += 1;
    return n;
  }, [
    numeroFiltroActivo,
    ctgFiltroActivo,
    idPropio2FiltroActivo,
    clienteIdFiltroActivo,
    transportistaIdFiltroActivo,
    choferIdFiltroActivo,
    estadoFiltro,
    facturacionFiltro,
    liquidacionFiltro,
    pagoTransportistaFiltro,
    ubicacionFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    periodoFiltro,
  ]);

  useEffect(() => {
    setIdsSeleccionLote([]);
    viajesSeleccionLote.current.clear();
  }, [clienteIdFiltroActivo, transportistaIdFiltroActivo]);

  const loteFacturarActivo = clienteIdFiltroActivo.trim() !== "";
  const loteLiquidarActivo =
    hasLiquidaciones && transportistaIdFiltroActivo.trim() !== "";

  function esElegibleLiquidarLote(v: Viaje): boolean {
    const tid = transportistaIdFiltroActivo.trim();
    if (!tid) return false;
    if (v.etapa?.toLowerCase() === "cancelado") return false;
    const esDelTransportista =
      String(v.transportistaId ?? "").trim() === tid ||
      transportistaEfectivoIdDesdeViaje(v) === tid;
    if (!esDelTransportista) return false;
    if (!viajePendienteComprobanteTransportista(v)) return false;
    if (viajeTieneLiquidacionActivaParaTransportista(v, tid)) return false;
    if (
      arcaBloqueaLiquidarUsd(
        hasLiquidoProductoArca,
        v.monedaPrecioTransportistaExterno,
      )
    )
      return false;
    return true;
  }

  /** Fila con checkbox: elegible para alguna de las acciones en lote activas. */
  function esElegibleLote(v: Viaje): boolean {
    return (
      (loteFacturarActivo && esElegibleFacturarLote(v)) ||
      (loteLiquidarActivo && esElegibleLiquidarLote(v))
    );
  }

  function viajesSeleccionados(): Viaje[] {
    return idsSeleccionLote
      .map((id) => viajesSeleccionLote.current.get(id))
      .filter((v): v is Viaje => Boolean(v));
  }

  function esElegibleFacturarLote(v: Viaje): boolean {
    if (v.etapa?.toLowerCase() === "cancelado") return false;
    // Solo la factura al cliente filtrado (su tramo, si el viaje tiene varios clientes).
    // No usar `viajePermiteBotonFacturar`: también da true si falta la liquidación al
    // transportista, y dejaba tildar viajes ya facturados al cliente.
    if (!viajeFacturableParaCliente(v, clienteIdFiltroActivo)) return false;
    if (arcaBloqueaFacturarUsd(hasFacturasArca, v.monedaMonto)) return false;
    return true;
  }

  function toggleSeleccionLote(v: Viaje) {
    viajesSeleccionLote.current.set(v.id, v);
    setIdsSeleccionLote((prev) =>
      prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id],
    );
  }

  function toggleSeleccionarTodosEnPagina() {
    const elegiblesViajes = (rows ?? []).filter(esElegibleLote);
    for (const v of elegiblesViajes) viajesSeleccionLote.current.set(v.id, v);
    const elegibles = elegiblesViajes.map((v) => v.id);
    if (elegibles.length === 0) return;
    const todosMarcados = elegibles.every((id) =>
      idsSeleccionLote.includes(id),
    );
    if (todosMarcados) {
      const setE = new Set(elegibles);
      setIdsSeleccionLote((prev) => prev.filter((id) => !setE.has(id)));
    } else {
      setIdsSeleccionLote((prev) => [...new Set([...prev, ...elegibles])]);
    }
  }

  function liquidarSeleccionMultiple() {
    const tid = transportistaIdFiltroActivo.trim();
    const seleccion = viajesSeleccionados().filter(esElegibleLiquidarLote);
    if (seleccion.length === 0 || !tid) return;
    const monedas = new Set(
      seleccion.map((v) => v.monedaPrecioTransportistaExterno || "ARS"),
    );
    if (monedas.size > 1) {
      showToast(
        "Una liquidación no puede mezclar viajes en distintas monedas.",
        "error",
      );
      return;
    }
    setLiquidarLote({ transportistaId: tid, viajeIds: seleccion.map((v) => v.id) });
  }

  function facturarSeleccionMultiple() {
    const ids = viajesSeleccionados()
      .filter(esElegibleFacturarLote)
      .map((v) => v.id);
    const cid = clienteIdFiltroActivo.trim();
    if (ids.length === 0 || !cid) return;
    if (hasFacturasArca) {
      const seleccion = (rows ?? []).filter((v) => ids.includes(v.id));
      const conUsd = seleccion.some((v) =>
        arcaBloqueaFacturarUsd(true, v.monedaMonto),
      );
      if (conUsd) {
        showToast(MSG_ARCA_NO_FACTURA_USD, "error");
        return;
      }
    }

    setFacturaDraft({
      tipo: "cliente",
      transportistaId: "",
      clienteId: cid,
      numero: "",
      fechaEmision: new Date().toISOString().split("T")[0],
      fechaVencimiento: "",
      ivaPct: "",
      viajeIds: ids,
      facturarPorTramo: false,
      tramos: [],
      comprobanteUrl: null,
      comprobanteFile: null,
      letraComprobante: null,
    });
    setIsFacturaModalOpen(true);
  }

  function requestDeleteViaje(v: Viaje) {
    setError(null);
    setViajeDeleteConfirm(v);
  }

  function onViajeEliminadoOk(v: Viaje) {
    showToast("Viaje eliminado correctamente", "success");
    setRows((prev) => (prev ? prev.filter((r) => r.id !== v.id) : prev));
    setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
    setIdsSeleccionLote((ids) => ids.filter((id) => id !== v.id));
    if (viajeEditor.editingId === v.id) cancelEdit();
    if (viewingViaje?.id === v.id) setViewingViaje(null);
    if (exportarViaje?.id === v.id) setExportarViaje(null);
    if (agregarGastoViaje?.id === v.id) setAgregarGastoViaje(null);
    if (registrarPagoViaje?.id === v.id) setRegistrarPagoViaje(null);
    if (crearLiqViaje?.id === v.id) setCrearLiqViaje(null);
    if (viewingFactura?.id === v.facturaId) setViewingFactura(null);
    setViajeDeleteConfirm(null);
    setViajeDeleteImpacto(null);
  }

  async function confirmDeleteViaje() {
    const v = viajeDeleteConfirm;
    if (!v || deletingViajeId) return;
    setDeletingViajeId(v.id);
    try {
      await apiJson(viajeApiUrl(v.id), () => getToken(), { method: "DELETE" });
      onViajeEliminadoOk(v);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as Partial<ViajeEliminacionConflicto> | undefined;
        if (body?.code === "VIAJE_TIENE_LIQUIDACIONES") {
          setViajeDeleteConfirm(null);
          setViajeDeleteImpacto({
            viaje: v,
            conflicto: body as ViajeEliminacionConflicto,
          });
          setDeletingViajeId(null);
          return;
        }
      }
      setError(friendlyError(e, platform ? "plataforma" : "viajes"));
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeletingViajeId(null);
    }
  }

  async function confirmDeleteViajeForzado() {
    const impacto = viajeDeleteImpacto;
    if (!impacto || deletingViajeId) return;
    const v = impacto.viaje;
    setDeletingViajeId(v.id);
    try {
      await apiJson(viajeApiUrl(v.id, { force: true }), () => getToken(), {
        method: "DELETE",
      });
      onViajeEliminadoOk(v);
    } catch (e) {
      setError(friendlyError(e, platform ? "plataforma" : "viajes"));
      showToast("Ocurrió un error al intentar eliminar", "error");
      setViajeDeleteImpacto(null);
    } finally {
      setDeletingViajeId(null);
    }
  }

  // --- LOGICA DE EXPORTACIÓN A EXCEL ---
  async function handleExportarExcel(selectedIds: string[]) {
    try {
      setExportandoExcel(true);
      const filtros = new URLSearchParams();
      const {
        numero: numF,
        ctg: ctgF,
        clienteId: cid,
        transportistaId: transpFiltro,
        choferId: choferFiltro,
        estado: estF,
        facturacionEstado: facEstF,
        liquidacionEstado: liqEstF,
        pagoTransportista: pagoTranspF,
        tipoFecha: tf,
        fechaDesde: fd,
        fechaHasta: fh,
        tipoUbicacion: tu,
        ubicacion: ut,
        periodo: per,
      } = filtrosAplicadosRef.current;

      // Replicamos la logica de filtros exactamente igual al useEffect para descargar todo el set
      if (numF.trim()) {
        const cleanNum = numF.replace(/#/g, "").trim();
        filtros.set("numero", cleanNum);
        filtros.set("q", cleanNum);
        filtros.set("busqueda", cleanNum);
      }
      if (ctgF.trim()) {
        filtros.set("ctg", ctgF.trim());
        filtros.set("numeroIdentificacionPersonalizado", ctgF.trim());
        filtros.set("q", ctgF.trim());
        filtros.set("busqueda", ctgF.trim());
      }
      if (cid) filtros.set("clienteId", cid);
      if (transpFiltro) filtros.set("transportistaId", transpFiltro);
      if (choferFiltro) filtros.set("choferId", choferFiltro);
      if (estF.trim()) filtros.set("etapa", estF.trim());
      if (facEstF.trim()) filtros.set("facturacionEstado", facEstF.trim());
      if (liqEstF.trim()) filtros.set("liquidacionEstado", liqEstF.trim());
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

      const pageSizeApi = 5000; // Un lote grande para traer la tabla entera
      let itemsExport: Viaje[] = [];
      const sortFetch = ordenamientoAplicadoRef.current;
      const pagoFiltroActivo =
        pagoTranspF === "sin_pagar" || pagoTranspF === "pagado"
          ? pagoTranspF
          : null;

      // Hacemos el pedido sin paginar
      if (pagoFiltroActivo) {
        const pagoData = await listarViajesPorPagoTransportistaDesdeApi(
          listBase,
          pagoFiltroActivo,
          1,
          pageSizeApi,
          sortFetch.sortBy,
          sortFetch.sortDir,
          () => getTokenRef.current(),
        );
        itemsExport = pagoData.items;
      } else if (
        viajeListadoRequiereOrdenCliente(sortFetch.sortBy, sortFetch.sortDir)
      ) {
        const ordenData = await listarViajesOrdenadosClienteDesdeApi(
          listBase,
          1,
          pageSizeApi,
          sortFetch.sortBy,
          sortFetch.sortDir,
          () => getTokenRef.current(),
        );
        itemsExport = ordenData.items;
      } else {
        const data = await apiJson<ViajesPaginatedResponse>(
          `${listBase}page=1&pageSize=${pageSizeApi}`,
          () => getTokenRef.current(),
        );
        itemsExport = sortViajesListado(
          data.items,
          sortFetch.sortBy,
          sortFetch.sortDir,
        );
      }

      // Filtros locales si aplican
      const isLocalSearch = !!numF.trim() || !!ctgF.trim();
      if (isLocalSearch) {
        const qNum = numF.replace(/#/g, "").trim().toLowerCase();
        const qCtg = ctgF.trim().toLowerCase();
        if (qNum)
          itemsExport = itemsExport.filter((v) =>
            String(v.numero).toLowerCase().includes(qNum),
          );
        if (qCtg)
          itemsExport = itemsExport.filter((v) =>
            (v.numeroIdentificacionPersonalizado || "")
              .toLowerCase()
              .includes(qCtg),
          );
      }

      const cols = viajesExportColumnsDisponibles.filter((c) =>
        selectedIds.includes(c.id),
      );
      await generarViajesExcel(
        cols,
        itemsExport,
        clientes,
        transportistas,
        choferes,
        "Viajes_Exportados",
      );

      showToast("Excel exportado exitosamente", "success");
    } catch (error) {
      showToast("Ocurrió un error al exportar el Excel", "error");
    } finally {
      setExportandoExcel(false);
      setExportModalOpen(false);
    }
  }

  useEffect(() => {
    if (
      !searchParams.has("etapa") &&
      !searchParams.has(VIAJE_PAGO_TRANSPORTISTA_QUERY)
    )
      return;
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("etapa");
        n.delete(VIAJE_PAGO_TRANSPORTISTA_QUERY);
        return n;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

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
        setViewingViaje(v);
      } catch {
        /* error ignorable */
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
  }, [
    searchParams,
    isLoaded,
    isSignedIn,
    rows,
    getToken,
    setSearchParams,
    viajeApiUrl,
  ]);

  function openVerFacturaFlow(v: Viaje) {
    if ((v.clientesViaje ?? []).length > 0) {
      setVerFacturasMultiClienteViaje(v);
    } else if (v.facturaId) {
      void abrirFacturaModalEnContexto(v);
    }
  }

  /**
   * "Facturar" y "Liquidar" son acciones separadas (grilla y modal de edición), sin
   * selector intermedio. Facturar se ofrece si el tenant factura desde Vialto — o si no
   * tiene Liquidaciones (criterio heredado del viejo selector, que en ese caso iba
   * directo a la factura).
   */
  const puedeFacturarDesdeGrilla =
    platform || hasFacturasArca || hasFacturacionSinArca || !hasLiquidaciones;

  /** Viaje del editor con los cambios del borrador que afectan a facturar/liquidar. */
  function viajeDesdeEditor(): Viaje {
    const draft = viajeEditor.draft!;
    const snapshot = viajeEditor.viajeSnapshot!;
    return {
      ...snapshot,
      clienteId: draft.clienteId.trim() || snapshot.clienteId,
      monedaMonto: draft.monedaMonto,
      monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
      transportistaId:
        draft.operacionModo === "externo"
          ? draft.transportistaId
          : snapshot.transportistaId,
    };
  }

  function liquidarViaje(v: Viaje) {
    if (arcaBloqueaLiquidarUsd(hasLiquidoProductoArca, v.monedaPrecioTransportistaExterno)) {
      showToast(MSG_ARCA_NO_LIQUIDA_USD, "error");
      return;
    }
    setCrearLiqViaje(v);
  }

  function facturarViaje(v: Viaje, targetClienteId?: string) {
    if (arcaBloqueaFacturarUsd(hasFacturasArca, v.monedaMonto)) {
      showToast(MSG_ARCA_NO_FACTURA_USD, "error");
      return;
    }

    if (!targetClienteId && isMultiClient(v)) {
      setFacturarMultiClienteViaje(v);
      return;
    }

    proceedAfterMultiClientSelector(v, targetClienteId);
  }

  function proceedAfterMultiClientSelector(v: Viaje, targetClienteId?: string) {
    if (hasFacturasArca) {
      const cid = targetClienteId ?? v.clienteId;
      const cliente =
        clientes?.find((c) => c.id === cid) ??
        (v.clienteId === cid ? v.cliente : undefined) ??
        v.clientesViaje?.find((cv) => cv.clienteId === cid)?.cliente;
      const clienteFull = cliente as Partial<Cliente> | undefined;
      const letra = facturaLetraFromCondicionIva(clienteFull?.condicionIva ?? null);
      const paisCodigo = clienteFull?.pais ? paisCodigoDesdeTexto(clienteFull.pais) : "AR";
      const esExterior = Boolean(paisCodigo && paisCodigo !== "AR");
      const condTexto = esExterior
        ? clienteFull?.condicionTributaria?.trim() || "Cliente del Exterior"
        : condicionIvaLabel(clienteFull?.condicionIva ?? null);

      showToast(
        `Se emitirá ${facturaLetraLabel(letra)} — ${condTexto}`,
        "success",
      );
      void navigateToFacturacion(v, letra, targetClienteId);
    } else {
      void navigateToFacturacion(v, undefined, targetClienteId);
    }
  }

  function isMultiClient(v: Viaje) {
    return (v.clientesViaje ?? []).length > 0;
  }

  async function navigateToFacturacion(
    v: Viaje,
    letra?: FacturaLetra,
    targetClienteId?: string,
  ) {
    setFacturandoLoadingId(v.id);
    try {
      const cid = targetClienteId ?? v.clienteId ?? "";
      const facturasCliente = await apiJson<Factura[]>(
        facturasPorClienteUrl(cid),
        () => getToken(),
      );
      const yaVinculada = facturasCliente.find(
        (f) => f.viajeIds.includes(v.id) && f.estado !== "anulado",
      );

      if (yaVinculada) {
        await abrirFacturaModalEnContexto(v, yaVinculada.id, cid);
        return;
      }
    } catch {
    } finally {
      setFacturandoLoadingId(null);
    }

    setFacturaDraft({
      tipo: "cliente",
      transportistaId: "",
      clienteId: targetClienteId ?? v.clienteId ?? "",
      numero: "",
      fechaEmision: new Date().toISOString().split("T")[0],
      fechaVencimiento: "",
      ivaPct: "",
      viajeIds: [v.id],
      facturarPorTramo: false,
      tramos: [],
      comprobanteUrl: null,
      comprobanteFile: null,
      letraComprobante: letra ?? null,
    });
    setIsFacturaModalOpen(true);
  }

  async function abrirFacturaModalEnContexto(
    v: Viaje,
    targetFacturaId?: string,
    targetClienteId?: string,
  ) {
    const fId = targetFacturaId ?? v.facturaId;
    const cId = targetClienteId ?? v.clienteId;

    if (!fId || !cId) return;

    setFacturandoLoadingId(fId);

    try {
      const facturasCliente = await apiJson<Factura[]>(
        facturasPorClienteUrl(cId),
        () => getToken(),
      );
      const facturaEncontrada = facturasCliente.find((f) => f.id === fId);

      if (facturaEncontrada) {
        setViewingFactura(facturaEncontrada);
      } else {
        showToast("No se encontró el detalle de la factura", "error");
      }
    } catch (e) {
      showToast("Error al cargar la factura", "error");
    } finally {
      setFacturandoLoadingId(null);
    }
  }

  /** Factura del viaje (o de alguno de sus clientes) que quedó con error de ARCA. */
  function facturaIdConErrorDeViaje(v: Viaje): string | undefined {
    if (v.facturacionEstado === "error_afip" && v.facturaId) return v.facturaId;
    return (
      v.clientesViaje?.find(
        (c) => c.facturacionEstado === "error_afip" && c.facturaId,
      )?.facturaId ?? undefined
    );
  }

  /** Liquidación del viaje que quedó con error de ARCA. */
  function liquidacionIdConErrorDeViaje(v: Viaje): string | undefined {
    return v.liquidacionesViaje?.find((lv) => lv.liquidacion.estado === "error")
      ?.liquidacion.id;
  }

  /**
   * "Reintentar" (error de ARCA) y "Continuar" (borrador sin emitir): lleva a la pantalla
   * del comprobante y abre directo su emisión, en vez de crear uno nuevo.
   */
  function abrirEmisionFactura(facturaId: string) {
    navigate("/facturacion", {
      state: { ...facturacionNavExtras(), emitirFacturaId: facturaId },
    });
  }

  function abrirEmisionLiquidacion(liquidacionId: string) {
    const params = new URLSearchParams();
    if (platform && tid) params.set("tenantId", tid);
    params.set("liquidacion", liquidacionId);
    params.set("emitir", "1");
    navigate(`/liquidaciones?${params.toString()}`);
  }

  function abrirLiquidacionEnContexto(v: Viaje) {
    const elegida = liquidacionElegidaDeViaje(v);
    if (!elegida) return;

    const transpId = v.transportistaId ?? (elegida as any).transportistaId;
    const tData = transportistas.find((t) => t.id === transpId);
    const tName =
      tData?.nombre ?? (elegida as any).transportistaNombre ?? transpId;

    let viajesLista = (elegida as any).viajes || [];

    if (viajesLista.length === 0) {
      viajesLista = [
        {
          viajeId: v.id,
          viaje: v,
          subtotal: v.precioTransportistaExterno ?? 0,
        },
      ];
    } else {
      viajesLista = viajesLista.map((item: any) => {
        const viajeCompleto =
          item.viajeId === v.id
            ? v
            : (rows ?? []).find((r) => r.id === item.viajeId);

        return {
          ...item,
          viaje: viajeCompleto ?? item.viaje,
        };
      });
    }
    setViewingLiquidacion({
      ...elegida,
      transportista: {
        id: transpId,
        nombre: tName,
        idFiscal: tData?.idFiscal ?? null,
      },
      viajes: viajesLista,
    });
  }

  const mostrarColumnaSeleccionLote = loteFacturarActivo || loteLiquidarActivo;
  // Si el tenant tiene ocultos tanto "Chofer (flota propia)" como "Chofer
  // (externo)" en Configuración por empresa, no tiene sentido mostrar la
  // columna (quedaría siempre vacía).
  const mostrarColumnaChofer =
    isViajeFieldVisible("edicion_viaje", "choferId") ||
    isViajeFieldVisible("edicion_viaje", "choferExternoId");
  // Columna "Etapa": una sola línea con hasta 3 íconos (etapa, factura, liquidación),
  // cada uno visible según la configuración de campos del tenant.
  const mostrarColumnaEtapa = isViajeFieldVisible("detalle_viaje", "etapa");
  const mostrarColumnaFactura = isViajeFieldVisible(
    "detalle_viaje",
    "facturacionEstado",
  );
  const mostrarColumnaLiquidacion = isViajeFieldVisible(
    "detalle_viaje",
    "liquidacionEstado",
  );
  const mostrarColumnaEstado =
    mostrarColumnaEtapa || mostrarColumnaFactura || mostrarColumnaLiquidacion;
  const cantidadColumnasEstado = mostrarColumnaEstado ? 1 : 0;

  // Filtros de la columna Etapa. Los estados de AFIP solo se ofrecen si el tenant
  // emite por ARCA (sin ARCA nunca existen y el filtro siempre vendría vacío).
  const arcaFacturasResuelto = platform
    ? canAccessEmisionFacturasArca(tenantModules ?? [])
    : hasFacturasArca;
  const opcionesFiltroFacturacion: { value: string; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "sin_facturar", label: "Sin facturar" },
    ...(arcaFacturasResuelto
      ? [
          { value: "borrador", label: "En borrador" },
          { value: "esperando_afip", label: "Esperando AFIP" },
        ]
      : []),
    { value: "facturado", label: "Facturado" },
    { value: "cobrado", label: "Cobrado" },
    ...(arcaFacturasResuelto
      ? [
          { value: "error_afip", label: "Error de AFIP" },
          { value: "anulado", label: "Anulada" },
        ]
      : []),
  ];
  const opcionesFiltroLiquidacion: { value: string; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "sin_liquidar", label: "Sin liquidar" },
    ...(hasLiquidoProductoArcaResuelto
      ? [
          { value: "borrador", label: "En borrador" },
          { value: "esperando_afip", label: "Esperando AFIP" },
        ]
      : []),
    { value: "liquidado", label: "Liquidado" },
    ...(hasLiquidoProductoArcaResuelto
      ? [{ value: "error_afip", label: "Error de AFIP" }]
      : []),
    { value: "anulado", label: "Anulada" },
  ];
  const mostrarPagosTransportista = isViajeFieldVisible(
    "edicion_viaje",
    "pagosTransportista",
  );
  const mostrarColumnaIdSistema = idSistemaHabilitado(currentTenant);
  const mostrarColumnaIdPropio1 = idPropio1Habilitado(currentTenant);
  const mostrarColumnaIdPropio2 = idPropio2Habilitado(currentTenant);
  // Mismo criterio que la columna/badge de la grilla: si el tenant tiene el
  // campo oculto, tampoco se ofrece como columna en la exportación a Excel.
  const viajesExportColumnsDisponibles = VIAJES_EXPORT_COLUMNS.filter((c) => {
    if (c.id === "chofer") return mostrarColumnaChofer;
    if (c.id === "transportista") return mostrarColumnaTransporte;
    if (c.id === "estadoPago") return mostrarPagosTransportista;
    if (c.id === "idPropio2") return mostrarColumnaIdPropio2;
    if (c.id === "numero") return mostrarColumnaIdSistema;
    if (c.id === "id") return mostrarColumnaIdPropio1;
    return true;
  });
  const tableColSpanBase =
    (mostrarColumnaChofer ? 7 : 6) +
    cantidadColumnasEstado +
    (mostrarColumnaTransporte ? 0 : -1) +
    (mostrarColumnaIdPropio2 ? 1 : 0) +
    (mostrarColumnaIdSistema ? 0 : -1) +
    (mostrarColumnaIdPropio1 ? 0 : -1);
  const tableColSpan = mostrarColumnaSeleccionLote
    ? tableColSpanBase + 1
    : tableColSpanBase;

  // Si el superadmin oculta la columna mientras el usuario tenía un filtro
  // activo sobre ella, el filtro queda invisible pero sigue acotando
  // resultados — se limpia solo al detectar que la columna se ocultó.
  useEffect(() => {
    if (!mostrarColumnaIdSistema && numeroFiltroActivo.trim()) {
      aplicarFiltroColumnaNumero("");
    }
  }, [mostrarColumnaIdSistema]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mostrarColumnaIdPropio1 && ctgFiltroActivo.trim()) {
      aplicarFiltroColumnaCTG("");
    }
  }, [mostrarColumnaIdPropio1]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mostrarColumnaIdPropio2 && idPropio2FiltroActivo.trim()) {
      aplicarFiltroColumnaIdPropio2("");
    }
  }, [mostrarColumnaIdPropio2]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mostrarColumnaTransporte && transportistaIdFiltroActivo.trim()) {
      aplicarFiltroColumnaTransportista("");
    }
  }, [mostrarColumnaTransporte]); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrarCargandoListado = !error && (rows === null || listadoRefetching);
  const elegiblesEnPagina = (rows ?? []).filter(esElegibleLote);
  const cantidadFacturarLote = loteFacturarActivo
    ? viajesSeleccionados().filter(esElegibleFacturarLote).length
    : 0;
  const cantidadLiquidarLote = loteLiquidarActivo
    ? viajesSeleccionados().filter(esElegibleLiquidarLote).length
    : 0;
  const todosElegiblesMarcados =
    elegiblesEnPagina.length > 0 &&
    elegiblesEnPagina.every((v) => idsSeleccionLote.includes(v.id));

  // ─── RENDER DE LA BARRA DE FILTROS ─────────────────────────────────────────
  const viajesListadoFiltros = (
    <>
      {mostrarColumnaIdSistema && (
        <ListadoFiltroCampo label="ID" active={!!numeroFiltroActivo.trim()}>
          <AutocompleteInput
            value={numeroFiltroActivo}
            onChange={(val) => aplicarFiltroColumnaNumero(val)}
            onSearch={searchNumero}
            disabled={listadoRefetching}
            placeholder="Buscar ID..."
            prefix="#"
          />
        </ListadoFiltroCampo>
      )}
      {mostrarColumnaIdPropio1 && (
        <ListadoFiltroCampo
          label={labelIdentificacionPersonalizadaViajes(currentTenant) ?? "CTG"}
          active={!!ctgFiltroActivo.trim()}
        >
          <AutocompleteInput
            value={ctgFiltroActivo}
            onChange={(val) => aplicarFiltroColumnaCTG(val)}
            onSearch={searchCtg}
            disabled={listadoRefetching}
            placeholder="Buscar valor..."
          />
        </ListadoFiltroCampo>
      )}
      {mostrarColumnaIdPropio2 && (
        <ListadoFiltroCampo
          label={idPropio2Label(currentTenant)}
          active={!!idPropio2FiltroActivo.trim()}
        >
          <AutocompleteInput
            value={idPropio2FiltroActivo}
            onChange={(val) => aplicarFiltroColumnaIdPropio2(val)}
            onSearch={searchIdPropio2}
            disabled={listadoRefetching}
            placeholder="Buscar valor..."
          />
        </ListadoFiltroCampo>
      )}
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
      {mostrarColumnaTransporte && (
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
      )}
      {mostrarColumnaChofer && (
        <ListadoFiltroCampo
          label="Chofer"
          active={!!choferIdFiltroActivo.trim()}
        >
          <ChoferSearchSelect
            id="viajes-filtro-chofer"
            choferes={choferes}
            value={choferIdFiltroActivo}
            onChange={(id) => aplicarFiltroColumnaChofer(id)}
            allowEmptyValue
            emptyListChoiceLabel="Todos"
            placeholderCerrado="Todos"
            disabled={listadoRefetching}
            aria-label="Filtrar listado por chofer"
            inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
              choferIdFiltroActivo.trim()
                ? "text-vialto-fire"
                : "text-vialto-charcoal"
            }`}
          />
        </ListadoFiltroCampo>
      )}
      <ListadoFiltroCampo label="Etapa" active={!!estadoFiltro.trim()}>
        <select
          value={estadoFiltro}
          onChange={(e) => aplicarFiltroEstado(e.target.value)}
          disabled={listadoRefetching}
          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            estadoFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
          }`}
          aria-label="Filtrar listado por etapa"
        >
          <option value="">TODOS</option>
          <option value="cancelado">CANCELADO</option>
          {VIAJE_ETAPAS_TODAS.filter((x) => x !== "cancelado").map((est) => (
            <option key={est} value={est} title={tooltipEtapaViaje(est)}>
              {etapaViajeLabel[est] ?? est}
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

  const filtroRapidoContent = (
    <>
      {resumen && (
        <button
          type="button"
          onClick={() => setShowFiltrosRapidos((v) => !v)}
          aria-expanded={showFiltrosRapidos}
          aria-label="Mostrar filtros rápidos"
          className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-vialto-steel transition-colors hover:bg-vialto-mist hover:text-vialto-charcoal ${
            showFiltrosRapidos ? "bg-vialto-mist text-vialto-charcoal" : ""
          }`}
        >
          <Filter className="h-4 w-4" aria-hidden />
          {cantidadFiltrosRapidosActivos > 0 && (
            <span
              className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vialto-fire px-1 font-[family-name:var(--font-ui)] text-[10px] font-semibold tabular-nums leading-none text-white"
              aria-hidden
            >
              {cantidadFiltrosRapidosActivos}
            </span>
          )}
        </button>
      )}

      {resumen && showFiltrosRapidos && (
        <div className="min-w-0">
          <ViajesResumenFiltros
            resumen={resumen}
            facturacionFiltro={facturacionFiltro}
            pagoTransportistaFiltro={pagoTransportistaFiltro}
            onFiltroFacturacion={aplicarFiltroFacturacion}
            onFiltroPago={aplicarFiltroPagoTransportista}
            mostrarFiltroPago={mostrarPagosTransportista}
          />
        </div>
      )}

      {hayFiltrosColumnasActivos && (
        <button
          type="button"
          onClick={limpiarFiltrosColumnas}
          disabled={listadoRefetching}
          className="hidden h-10 shrink-0 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none lg:inline-flex"
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
    </>
  );

  return (
    <div className="w-full">
      {filtroRapidoPortalTarget
        ? createPortal(filtroRapidoContent, filtroRapidoPortalTarget)
        : null}
      {/* Título + filtros rápidos a la izquierda; acciones a la derecha, en la misma línea. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {!embeddedInSuperadmin && (
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide text-vialto-charcoal">
            Viajes
          </h1>
        )}

        {!filtroRapidoPortalTarget && filtroRapidoContent}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {puedeImportar && (
            <Link
              to="/importar?volverA=/viajes"
              className="inline-flex h-10 items-center gap-1.5 px-4 bg-white border border-black/15 text-sm uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Importar
            </Link>
          )}

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={
              listadoRefetching ||
              !meta?.total ||
              meta.total === 0 ||
              exportandoExcel
            }
            className="inline-flex h-10 items-center gap-1.5 px-4 bg-white border border-black/15 text-sm uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="h-4 w-4" aria-hidden />
            {exportandoExcel ? "Generando..." : "Exportar"}
          </button>

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

      {mostrarColumnaSeleccionLote && idsSeleccionLote.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-black/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-vialto-steel">
            <span className="font-medium text-vialto-charcoal">
              {idsSeleccionLote.length}
            </span>{" "}
            viaje{idsSeleccionLote.length !== 1 ? "s" : ""} seleccionado
            {idsSeleccionLote.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {cantidadFacturarLote > 0 && (
              <button
                type="button"
                onClick={facturarSeleccionMultiple}
                className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
              >
                Facturar
                {loteLiquidarActivo ? ` (${cantidadFacturarLote})` : ""}
              </button>
            )}
            {cantidadLiquidarLote > 0 && (
              <button
                type="button"
                onClick={liquidarSeleccionMultiple}
                className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
              >
                Liquidar
                {loteFacturarActivo ? ` (${cantidadLiquidarLote})` : ""}
              </button>
            )}
          </div>
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
            {mostrarColumnaSeleccionLote && (
              <th className="px-2 py-2.5 w-10 text-center align-middle">
                <span className="sr-only">
                  Seleccionar para facturar o liquidar en lote
                </span>
                {elegiblesEnPagina.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={todosElegiblesMarcados}
                    onChange={toggleSeleccionarTodosEnPagina}
                    className="accent-vialto-charcoal"
                    title="Marcar o desmarcar todos los viajes seleccionables en esta página"
                    aria-label="Marcar o desmarcar todos los viajes seleccionables en esta página"
                  />
                ) : null}
              </th>
            )}
            {mostrarColumnaIdSistema && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="ID"
                  filterActive={!!numeroFiltroActivo.trim()}
                  filterSignature={numeroFiltroActivo}
                  minWidthClass="min-w-0"
                >
                  <AutocompleteInput
                    value={numeroFiltroActivo}
                    onChange={(val) => aplicarFiltroColumnaNumero(val)}
                    onSearch={searchNumero}
                    disabled={listadoRefetching}
                    placeholder="Buscar ID..."
                    prefix="#"
                  />
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            {mostrarColumnaIdPropio1 && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title={
                    labelIdentificacionPersonalizadaViajes(currentTenant) ?? "CTG"
                  }
                  filterActive={!!ctgFiltroActivo.trim()}
                  filterSignature={ctgFiltroActivo}
                  minWidthClass="min-w-0"
                >
                  <AutocompleteInput
                    value={ctgFiltroActivo}
                    onChange={(val) => aplicarFiltroColumnaCTG(val)}
                    onSearch={searchCtg}
                    disabled={listadoRefetching}
                    placeholder="Buscar valor..."
                  />
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            {mostrarColumnaIdPropio2 && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title={idPropio2Label(currentTenant)}
                  filterActive={!!idPropio2FiltroActivo.trim()}
                  filterSignature={idPropio2FiltroActivo}
                  minWidthClass="min-w-0"
                >
                  <AutocompleteInput
                    value={idPropio2FiltroActivo}
                    onChange={(val) => aplicarFiltroColumnaIdPropio2(val)}
                    onSearch={searchIdPropio2}
                    disabled={listadoRefetching}
                    placeholder="Buscar valor..."
                  />
                </ViajesListadoHeaderFiltro>
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
            {mostrarColumnaTransporte && (
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
            )}
            {mostrarColumnaChofer && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Chofer"
                  filterActive={!!choferIdFiltroActivo.trim()}
                  filterSignature={choferIdFiltroActivo}
                  minWidthClass="min-w-0"
                >
                  <ChoferSearchSelect
                    id="viajes-col-filtro-chofer"
                    choferes={choferes}
                    value={choferIdFiltroActivo}
                    onChange={(id) => aplicarFiltroColumnaChofer(id)}
                    allowEmptyValue
                    emptyListChoiceLabel="Todos"
                    placeholderCerrado="Todos"
                    disabled={listadoRefetching}
                    aria-label="Filtrar listado por chofer"
                    inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      choferIdFiltroActivo.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                  />
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            {mostrarColumnaEstado && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Etapa"
                  filterActive={
                    !!estadoFiltro.trim() ||
                    !!facturacionFiltro.trim() ||
                    !!liquidacionFiltro.trim()
                  }
                  filterSignature={`${estadoFiltro}|${facturacionFiltro}|${liquidacionFiltro}`}
                  minWidthClass="min-w-0"
                  titleNoWrap
                >
                  <div className="flex flex-col gap-2">
                    {mostrarColumnaEtapa && (
                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Etapa
                        <select
                          value={estadoFiltro}
                          onChange={(e) => aplicarFiltroEstado(e.target.value)}
                          disabled={listadoRefetching}
                          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm normal-case tracking-normal ${
                            estadoFiltro.trim()
                              ? "text-vialto-fire"
                              : "text-vialto-charcoal"
                          }`}
                        >
                          <option value="">Todas</option>
                          {VIAJE_ETAPAS_TODAS.map((est) => (
                            <option
                              key={est}
                              value={est}
                              title={tooltipEtapaViaje(est)}
                            >
                              {etapaViajeLabel[est] ?? est}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {mostrarColumnaFactura && (
                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Factura
                        <select
                          value={facturacionFiltro}
                          onChange={(e) =>
                            aplicarFiltroFacturacion(e.target.value)
                          }
                          disabled={listadoRefetching}
                          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm normal-case tracking-normal ${
                            facturacionFiltro.trim()
                              ? "text-vialto-fire"
                              : "text-vialto-charcoal"
                          }`}
                        >
                          {opcionesFiltroFacturacion.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {mostrarColumnaLiquidacion && (
                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                        Liquidación
                        <select
                          value={liquidacionFiltro}
                          onChange={(e) =>
                            aplicarFiltroLiquidacion(e.target.value)
                          }
                          disabled={listadoRefetching}
                          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm normal-case tracking-normal ${
                            liquidacionFiltro.trim()
                              ? "text-vialto-fire"
                              : "text-vialto-charcoal"
                          }`}
                        >
                          {opcionesFiltroLiquidacion.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Origen — Destino"
                filterActive={!!ubicacionFiltro.trim()}
                filterSignature={`${tipoUbicacionFiltro}|${paisUbicacionFiltro}|${ubicacionFiltro}`}
                minWidthClass="min-w-0"
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
                minWidthClass="min-w-0"
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
              Acciones
            </th>
          </tr>
        }
        renderTableRow={(v) => {
          const clientesRuta = clientesRutaListadoViaje(v, clientes);
          const nombreCliente = clientesRuta[0].nombre;
          const nombreTransp = nombreTransportistaExternoListadoViaje(
            v,
            transportistas,
          );
          const nombreTranspEfectivo = nombreTransportistaEfectivoListadoViaje(
            v,
            transportistas,
          );
          const nombreChofer = nombreChoferListadoViaje(v, choferes);
          return (
            <tr
              key={v.id}
              className={`${listadoTablaBodyRowClass} cursor-pointer`}
              onClick={() => setAccionesAbiertoViajeId(v.id)}
            >
              {mostrarColumnaSeleccionLote && (
                <td
                  className="px-2 py-2 align-middle text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {esElegibleLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsSeleccionLote.includes(v.id)}
                      onChange={() => toggleSeleccionLote(v)}
                      className="accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${numeroVisibleViaje(v)} en la selección en lote`}
                    />
                  ) : null}
                </td>
              )}
              {mostrarColumnaIdSistema && (
                <td className="px-3 py-2 text-vialto-steel tabular-nums">
                  <span
                    className="block max-w-[5rem] truncate"
                    title={`#${v.numero}`}
                  >
                    #{v.numero}
                  </span>
                </td>
              )}
              {mostrarColumnaIdPropio1 && (
                <td className="px-3 py-2 text-vialto-steel tabular-nums">
                  <span
                    className="block max-w-[5rem] truncate"
                    title={v.numeroIdentificacionPersonalizado?.trim() || undefined}
                  >
                    {v.numeroIdentificacionPersonalizado?.trim() || "—"}
                  </span>
                </td>
              )}
              {mostrarColumnaIdPropio2 && (
                <td className="px-3 py-2 text-vialto-steel tabular-nums">
                  <span
                    className="block max-w-[5rem] truncate"
                    title={v.idPropio2?.trim() || undefined}
                  >
                    {v.idPropio2?.trim() || "—"}
                  </span>
                </td>
              )}
              <td className="px-3 py-2 text-vialto-charcoal">
                <div
                  className="flex min-w-0 max-w-[9rem] items-center gap-1"
                  title={clientesRuta.map((c) => c.nombre).join(", ")}
                >
                  <span className="truncate font-medium">{nombreCliente}</span>
                  {clientesRuta.length > 1 && (
                    <span className="shrink-0 rounded-sm bg-vialto-fire/10 px-1 text-[11px] text-vialto-fire">
                      +{clientesRuta.length - 1}
                    </span>
                  )}
                </div>
              </td>
              {mostrarColumnaTransporte && (
              <td className="px-3 py-2 text-vialto-steel">
                <div className="flex min-w-0 max-w-[9rem] items-center gap-1">
                  <span className="truncate" title={nombreTransp}>
                    {nombreTransp}
                  </span>
                  {nombreTranspEfectivo && (
                    <span
                      className="shrink-0 text-vialto-steel/70"
                      title={`Ejecuta: ${nombreTranspEfectivo}`}
                      aria-label={`Ejecuta: ${nombreTranspEfectivo}`}
                    >
                      <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </div>
              </td>
              )}
              {mostrarColumnaChofer && (
                <td className="px-3 py-2 text-vialto-steel">
                  <span className="block max-w-[6rem] truncate" title={nombreChofer}>
                    {nombreChofer}
                  </span>
                </td>
              )}
              {mostrarColumnaEstado && (
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {mostrarColumnaEtapa && <ViajeEtapaIcono etapa={v.etapa} />}
                    {v.etapa?.toLowerCase() !== "cancelado" && (
                      <>
                        {mostrarColumnaFactura && (
                          <ViajeFacturacionIndicador
                            viaje={v}
                            tenantId={platform ? tid : undefined}
                            variante="icono"
                            onClickOverride={
                              (v.clientesViaje ?? []).length > 0
                                ? () => openVerFacturaFlow(v)
                                : undefined
                            }
                            onFacturar={
                              puedeFacturarDesdeGrilla
                                ? () => facturarViaje(v, undefined)
                                : undefined
                            }
                          />
                        )}
                        {mostrarColumnaLiquidacion &&
                          (hasLiquidacionesResuelto ? (
                            <ViajeLiquidacionIndicador
                              viaje={v}
                              tenantId={platform ? tid : undefined}
                              hasArca={hasLiquidoProductoArcaResuelto}
                              onRegistrarPago={() => setRegistrarPagoViaje(v)}
                              onLiquidar={
                                hasLiquidaciones ? () => liquidarViaje(v) : undefined
                              }
                              variante="icono"
                            />
                          ) : (
                            <ViajePagoTransportistaIndicador
                              viaje={v}
                              onClick={() => setRegistrarPagoViaje(v)}
                              variante="icono"
                            />
                          ))}
                      </>
                    )}
                  </div>
                </td>
              )}
              <td className="px-3 py-2">
                <ViajeOrigenDestinoLinea
                  origen={v.origen}
                  destino={v.destino}
                  destinosViaje={v.destinosViaje}
                  compacto
                  className="max-w-[11rem]"
                />
              </td>
              <td className="px-3 py-2 text-vialto-steel tabular-nums">
                <div
                  className="max-w-[6.5rem] truncate"
                  title={
                    v.fechaDescarga
                      ? `Carga: ${formatIsoFechaHoraListadoEsAr(v.fechaCarga)}\nDescarga: ${formatIsoFechaHoraListadoEsAr(v.fechaDescarga)}`
                      : `Carga: ${formatIsoFechaHoraListadoEsAr(v.fechaCarga)}`
                  }
                >
                  <span
                    className={
                      ordenResaltaFechaCarga ? "font-medium text-vialto-charcoal" : ""
                    }
                  >
                    {formatIsoFechaCortaListadoEsAr(v.fechaCarga)}
                  </span>
                  {v.fechaDescarga && (
                    <>
                      <span className="mx-1 text-vialto-steel/75" aria-hidden>
                        →
                      </span>
                      <span
                        className={
                          ordenResaltaFechaDescarga
                            ? "font-medium text-vialto-charcoal"
                            : ""
                        }
                      >
                        {formatIsoFechaCortaListadoEsAr(v.fechaDescarga)}
                      </span>
                    </>
                  )}
                </div>
              </td>
              <td
                className="px-3 py-2 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <ViajeAccionesMenu
                  viaje={v}
                  hasFacturasArca={hasFacturasArca}
                  hasLiquidoProductoArca={hasLiquidoProductoArca}
                  hasExportacionActiva={Boolean(
                    currentTenant?.habilitarExportacionPautMicCrt,
                  )}
                  open={accionesAbiertoViajeId === v.id}
                  onOpenChange={(o) =>
                    setAccionesAbiertoViajeId(o ? v.id : null)
                  }
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={
                    puedeFacturarDesdeGrilla
                      ? () => facturarViaje(v, undefined)
                      : undefined
                  }
                  onLiquidar={
                    hasLiquidaciones ? () => liquidarViaje(v) : undefined
                  }
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId ||
                    (v.clientesViaje &&
                      v.clientesViaje.some((c) => c.facturaId))
                      ? () => openVerFacturaFlow(v)
                      : undefined
                  }
                  onVerLiquidacion={
                    liquidacionElegidaDeViaje(v)
                      ? () => abrirLiquidacionEnContexto(v)
                      : undefined
                  }
                  onReintentarFactura={(() => {
                    const id = facturaIdConErrorDeViaje(v);
                    return id ? () => abrirEmisionFactura(id) : undefined;
                  })()}
                  onReintentarLiquidacion={(() => {
                    const id = liquidacionIdConErrorDeViaje(v);
                    return id
                      ? () => abrirEmisionLiquidacion(id)
                      : undefined;
                  })()}
                  onContinuarFactura={(() => {
                    const id = facturaBorradorIdDeViaje(v);
                    return id ? () => abrirEmisionFactura(id) : undefined;
                  })()}
                  onContinuarLiquidacion={(() => {
                    const id = liquidacionBorradorIdDeViaje(v);
                    return id
                      ? () => abrirEmisionLiquidacion(id)
                      : undefined;
                  })()}
                  onEliminar={() => requestDeleteViaje(v)}
                />
              </td>
            </tr>
          );
        }}
        renderMobileCard={(v) => {
          const clientesRuta = clientesRutaListadoViaje(v, clientes);
          const nombreCliente = clientesRuta[0].nombre;
          const nombreTransp = nombreTransportistaExternoListadoViaje(
            v,
            transportistas,
          );
          const nombreTranspEfectivo = nombreTransportistaEfectivoListadoViaje(
            v,
            transportistas,
          );
          const nombreChofer = nombreChoferListadoViaje(v, choferes);
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
            <div
              className="flex w-full flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {mostrarColumnaEtapa && (
                // Solo lectura: la etapa se actualiza sola por fechas; los cambios
                // manuales (cancelar, viajes sin fechas) se hacen desde el modal del viaje.
                <span
                  title={tooltipEtapaViaje(v.etapa)}
                  className={`inline-block self-start whitespace-nowrap rounded-sm border font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 ${
                    etapaViajeBadgeClass[v.etapa] ?? etapaViajeBadgeClassDefault
                  }`}
                >
                  {etapaViajeLabel[v.etapa] ?? "Sin clasificar"}
                </span>
              )}
              {v.etapa?.toLowerCase() !== "cancelado" && (
                <>
                  {isViajeFieldVisible("detalle_viaje", "facturacionEstado") && (
                    <ViajeFacturacionIndicador
                      viaje={v}
                      tenantId={platform ? tid : undefined}
                      fullWidth
                      onClickOverride={
                        (v.clientesViaje ?? []).length > 0
                          ? () => openVerFacturaFlow(v)
                          : undefined
                      }
                      onFacturar={
                        puedeFacturarDesdeGrilla
                          ? () => facturarViaje(v, undefined)
                          : undefined
                      }
                    />
                  )}
                  {isViajeFieldVisible("detalle_viaje", "liquidacionEstado") && (
                    hasLiquidacionesResuelto ? (
                      <ViajeLiquidacionIndicador
                        viaje={v}
                        tenantId={platform ? tid : undefined}
                        hasArca={hasLiquidoProductoArcaResuelto}
                        onRegistrarPago={() => setRegistrarPagoViaje(v)}
                        onLiquidar={
                          hasLiquidaciones ? () => liquidarViaje(v) : undefined
                        }
                      />
                    ) : (
                      <ViajePagoTransportistaIndicador
                        viaje={v}
                        onClick={() => setRegistrarPagoViaje(v)}
                      />
                    )
                  )}
                </>
              )}
            </div>
          );
          return (
            <ListadoCard
              onClick={() => setAccionesAbiertoViajeId(v.id)}
              primary={
                <div className="flex items-start gap-2">
                  {mostrarColumnaSeleccionLote && esElegibleLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsSeleccionLote.includes(v.id)}
                      onChange={() => toggleSeleccionLote(v)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${numeroVisibleViaje(v)} en la selección en lote`}
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span
                      className="block truncate font-medium"
                      title={clientesRuta.map((c) => c.nombre).join(", ")}
                    >
                      {nombreCliente}
                    </span>
                    {clientesRuta.length > 1 && (
                      <span className="block text-[11px] text-vialto-fire">
                        +{clientesRuta.length - 1} más
                      </span>
                    )}
                  </span>
                </div>
              }
              fields={[
                ...(mostrarColumnaIdSistema
                  ? [{ label: "ID sistema", value: `#${v.numero}` }]
                  : []),
                ...(mostrarColumnaIdPropio1
                  ? [
                      {
                        label: labelIdentificacionPersonalizadaViajes(currentTenant),
                        value: v.numeroIdentificacionPersonalizado?.trim() || "—",
                      },
                    ]
                  : []),
                ...(mostrarColumnaIdPropio2
                  ? [
                      {
                        label: idPropio2Label(currentTenant),
                        value: v.idPropio2?.trim() || "—",
                      },
                    ]
                  : []),
                ...(mostrarColumnaTransporte
                  ? [{ label: "Transporte", value: transporteValue }]
                  : []),
                ...(mostrarColumnaChofer
                  ? [{ label: "Chofer", value: nombreChofer }]
                  : []),
                ...(mostrarColumnaEstado
                  ? [{ label: "Etapa", value: estadoValue }]
                  : []),
                {
                  label: "Origen — Destino",
                  value: (
                    <>
                      <ViajeOrigenDestinoLinea
                        origen={v.origen}
                        destino={v.destino}
                        destinosViaje={v.destinosViaje}
                      />
                      {clientesRuta.length > 1 && (
                        <span className="mt-0.5 block text-[11px] text-vialto-fire">
                          +{clientesRuta.length - 1} más
                        </span>
                      )}
                    </>
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
              ]}
              actions={
                <ViajeAccionesMenu
                  viaje={v}
                  hasFacturasArca={hasFacturasArca}
                  hasLiquidoProductoArca={hasLiquidoProductoArca}
                  hasExportacionActiva={Boolean(
                    currentTenant?.habilitarExportacionPautMicCrt,
                  )}
                  open={accionesAbiertoViajeId === v.id}
                  onOpenChange={(o) =>
                    setAccionesAbiertoViajeId(o ? v.id : null)
                  }
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={
                    puedeFacturarDesdeGrilla
                      ? () => facturarViaje(v, undefined)
                      : undefined
                  }
                  onLiquidar={
                    hasLiquidaciones ? () => liquidarViaje(v) : undefined
                  }
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId ||
                    (v.clientesViaje &&
                      v.clientesViaje.some((c) => c.facturaId))
                      ? () => openVerFacturaFlow(v)
                      : undefined
                  }
                  onVerLiquidacion={
                    liquidacionElegidaDeViaje(v)
                      ? () => abrirLiquidacionEnContexto(v)
                      : undefined
                  }
                  onReintentarFactura={(() => {
                    const id = facturaIdConErrorDeViaje(v);
                    return id ? () => abrirEmisionFactura(id) : undefined;
                  })()}
                  onReintentarLiquidacion={(() => {
                    const id = liquidacionIdConErrorDeViaje(v);
                    return id
                      ? () => abrirEmisionLiquidacion(id)
                      : undefined;
                  })()}
                  onContinuarFactura={(() => {
                    const id = facturaBorradorIdDeViaje(v);
                    return id ? () => abrirEmisionFactura(id) : undefined;
                  })()}
                  onContinuarLiquidacion={(() => {
                    const id = liquidacionBorradorIdDeViaje(v);
                    return id
                      ? () => abrirEmisionLiquidacion(id)
                      : undefined;
                  })()}
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
          hasLiquidoProductoArca={hasLiquidoProductoArca}
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
          onVerFactura={
            viewingViaje.facturaId ||
            (viewingViaje.clientesViaje ?? []).some((c) => c.facturaId)
              ? () => {
                  setViewingViaje(null);
                  openVerFacturaFlow(viewingViaje);
                }
              : undefined
          }
          onRegistrarPago={
            !hasLiquidoProductoArca && viewingViaje.transportistaId
              ? () => {
                  const v = viewingViaje;
                  setViewingViaje(null);
                  setRegistrarPagoViaje(v);
                }
              : undefined
          }
        />
      )}

      {/* 1. Contexto de Apilamiento Base (z-100) para el Modal de Edición Principal.
             Debe ser mayor al Header (que suele ser z-40 o z-50) pero menor a los modales secundarios. */}
      <div className="relative" style={{ zIndex: 45 }}>
        {viajeEditor.editingId &&
          viajeEditor.draft &&
          viajeEditor.viajeSnapshot && (
            <ViajeEditModal
              open
              draft={viajeEditor.draft}
              setDraft={viajeEditor.setDraft}
              snapshotViaje={viajeEditor.viajeSnapshot}
              opcionesProducto={viajeEditor.opcionesProducto}
              clientes={viajeEditor.edicionMaestro?.clientes ?? clientes}
              choferes={viajeEditor.edicionMaestro?.choferes ?? choferes}
              transportistas={
                viajeEditor.edicionMaestro?.transportistas ?? transportistas
              }
              vehiculos={viajeEditor.edicionMaestro?.vehiculos ?? vehiculos}
              choferesPropios={viajeEditor.choferesPropios}
              choferesExterno={viajeEditor.choferesExterno}
              vehiculosPropios={viajeEditor.vehiculosPropios}
              onModoChange={viajeEditor.applyDraftModo}
              ayudaFlota={viajeEditor.ayudaFlota}
              viajeEditHint={viajeEditor.viajeEditHint}
              fechaCargaError={viajeEditor.fechaCargaError}
              fechaDescargaError={viajeEditor.fechaDescargaError}
              destinosError={viajeEditor.destinosError}
              onClearDestinosError={viajeEditor.onClearDestinosError}
              clientesRowErrors={viajeEditor.clientesRowErrors}
              onClearClientesRowErrors={viajeEditor.onClearClientesRowErrors}
              transportistaEfectivoError={
                viajeEditor.transportistaEfectivoError
              }
              onClearTransportistaEfectivoError={
                viajeEditor.onClearTransportistaEfectivoError
              }
              onDraftFechasPatch={viajeEditor.onDraftFechasPatch}
              onClose={cancelEdit}
              onSave={() => void viajeEditor.saveInline()}
              onFacturar={
                puedeFacturarDesdeGrilla
                  ? () => facturarViaje(viajeDesdeEditor(), undefined)
                  : undefined
              }
              facturarBloqueoMotivo={
                arcaBloqueaFacturarUsd(
                  hasFacturasArca,
                  viajeEditor.draft.monedaMonto,
                )
                  ? MSG_ARCA_NO_FACTURA_USD
                  : null
              }
              onLiquidar={
                hasLiquidaciones
                  ? () => liquidarViaje(viajeDesdeEditor())
                  : undefined
              }
              liquidarBloqueoMotivo={
                arcaBloqueaLiquidarUsd(
                  hasLiquidoProductoArca,
                  viajeEditor.draft.monedaPrecioTransportistaExterno,
                )
                  ? MSG_ARCA_NO_LIQUIDA_USD
                  : null
              }
              onContinuarFactura={(() => {
                const id = facturaBorradorIdDeViaje(viajeEditor.viajeSnapshot);
                return id ? () => abrirEmisionFactura(id) : undefined;
              })()}
              onContinuarLiquidacion={(() => {
                const id = liquidacionBorradorIdDeViaje(viajeEditor.viajeSnapshot);
                return id ? () => abrirEmisionLiquidacion(id) : undefined;
              })()}
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
              tenant={!platform ? currentTenant : undefined}
              hasLiquidoProductoArca={hasLiquidoProductoArca}
              hasFacturasArca={hasFacturasArca}
              onRegistrarPago={() =>
                setRegistrarPagoViaje(viajeEditor.viajeSnapshot)
              }
              onProductoCreado={viajeEditor.onProductoCreado}
              onClienteCreado={(c) =>
                viajeEditor.upsertMaestroEdicion("clientes", c)
              }
              onTransportistaCreado={(t) =>
                viajeEditor.upsertMaestroEdicion("transportistas", t)
              }
              onChoferCreado={(c) =>
                viajeEditor.upsertMaestroEdicion("choferes", c)
              }
              onVehiculoCreado={(v) =>
                viajeEditor.upsertMaestroEdicion("vehiculos", v)
              }
            />
          )}
      </div>

      {/* 2. Contexto de Apilamiento Máximo (z-9999) para Modales Secundarios y Overlays */}
      <div className="relative" style={{ zIndex: 9999 }}>
        {facturandoLoadingId && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-5 py-4 shadow-lg">
              <Spinner className="h-5 w-5 text-vialto-fire" />
              <span className="text-sm text-vialto-charcoal">Abriendo…</span>
            </div>
          </div>
        )}

        {agregarGastoViaje != null && (
          <AgregarGastoModal
            open={true}
            viaje={agregarGastoViaje}
            tenantId={platform ? tid : undefined}
            onSuccess={(updated) => {
              setRows((prev) =>
                prev
                  ? prev.map((r) => (r.id === updated.id ? updated : r))
                  : prev,
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
        )}

        {registrarPagoViaje != null && (
          <RegistrarPagoTransportistaModal
            open={true}
            viaje={registrarPagoViaje}
            tenantId={platform ? tid : undefined}
            onSuccess={(updated) => {
              setRows((prev) =>
                prev
                  ? prev.map((r) => (r.id === updated.id ? updated : r))
                  : prev,
              );
              if (viajeEditor.editingId === updated.id) {
                viajeEditor.setDraft((d) =>
                  d
                    ? {
                        ...d,
                        pagosTransportista: (
                          updated.pagosTransportista ?? []
                        ).map(pagoTransportistaDraftFromApi),
                      }
                    : d,
                );
                viajeEditor.patchViajeSnapshot(updated);
              }
              setRegistrarPagoViaje(null);
            }}
            onClose={() => setRegistrarPagoViaje(null)}
          />
        )}

        {exportarViaje && (
          <ExportarViajeModal
            viaje={exportarViaje}
            onClose={() => setExportarViaje(null)}
            tenantId={platform ? tid : undefined}
          />
        )}

        <RegistrarPagoTransportistaModal
          open={registrarPagoViaje != null}
          viaje={registrarPagoViaje}
          tenantId={platform ? tid : undefined}
          onSuccess={(updated) => {
            setRows((prev) =>
              prev
                ? prev.map((r) => (r.id === updated.id ? updated : r))
                : prev,
            );
            if (viajeEditor.editingId === updated.id) {
              viajeEditor.setDraft((d) =>
                d
                  ? {
                      ...d,
                      pagosTransportista: (
                        updated.pagosTransportista ?? []
                      ).map(pagoTransportistaDraftFromApi),
                    }
                  : d,
              );
              viajeEditor.patchViajeSnapshot(updated);
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

        {crearLiqViaje && (
          <CrearLiquidacionManualModal
            viajeInicial={crearLiqViaje}
            transportistas={maestro.transportistas}
            hasLiquidoProductoArca={hasLiquidoProductoArca}
            getToken={getToken}
            idSistemaHabilitado={idSistemaHabilitado(currentTenant)}
            idPropio1Habilitado={idPropio1Habilitado(currentTenant)}
            idPropio1Label={labelIdentificacionPersonalizadaViajes(currentTenant)}
            idPropio2Habilitado={idPropio2Habilitado(currentTenant)}
            idPropio2Label={idPropio2Label(currentTenant)}
            onDataSaved={() => {
              void maestro.refreshTransportistas();
              void maestro.refreshClientes();
            }}
            onLiquidacionEmitida={() => {
              setListadoQueryVersion((v) => v + 1);
            }}
            onSuccess={() => {
              setCrearLiqViaje(null);
              setListadoQueryVersion((v) => v + 1);
            }}
            onClose={() => setCrearLiqViaje(null)}
          />
        )}

        {liquidarLote && (
          <CrearLiquidacionManualModal
            transportistaIdInicial={liquidarLote.transportistaId}
            viajeIdsIniciales={liquidarLote.viajeIds}
            transportistas={maestro.transportistas}
            hasLiquidoProductoArca={hasLiquidoProductoArca}
            getToken={getToken}
            idSistemaHabilitado={idSistemaHabilitado(currentTenant)}
            idPropio1Habilitado={idPropio1Habilitado(currentTenant)}
            idPropio1Label={labelIdentificacionPersonalizadaViajes(currentTenant)}
            idPropio2Habilitado={idPropio2Habilitado(currentTenant)}
            idPropio2Label={idPropio2Label(currentTenant)}
            onDataSaved={() => {
              void maestro.refreshTransportistas();
              void maestro.refreshClientes();
            }}
            onLiquidacionEmitida={() => {
              setIdsSeleccionLote([]);
              setListadoQueryVersion((v) => v + 1);
            }}
            onSuccess={() => {
              setLiquidarLote(null);
              setIdsSeleccionLote([]);
              setListadoQueryVersion((v) => v + 1);
            }}
            onClose={() => setLiquidarLote(null)}
          />
        )}

        {viajeDeleteConfirm != null && (
          <ConfirmDialog
            open={true}
            title="Eliminar viaje"
            message={
              viajeDeleteConfirm
                ? `¿Seguro que querés eliminar el viaje ${numeroVisibleViaje(viajeDeleteConfirm)}? Esta acción no se puede deshacer.`
                : ""
            }
            confirmLabel="Eliminar"
            tone="danger"
            busy={
              !!deletingViajeId && deletingViajeId === viajeDeleteConfirm.id
            }
            onCancel={() => {
              if (!deletingViajeId) setViajeDeleteConfirm(null);
            }}
            onConfirm={() => void confirmDeleteViaje()}
          />
        )}

        {viajeDeleteImpacto != null && (
          <ConfirmDialog
            open={true}
            title="Este viaje tiene liquidaciones asociadas"
            message={
              viajeDeleteImpacto
                ? `El viaje ${numeroVisibleViaje(viajeDeleteImpacto.viaje)} está incluido en ${
                    viajeDeleteImpacto.conflicto.liquidaciones.length === 1
                      ? "esta liquidación sin autorizar por AFIP"
                      : "estas liquidaciones sin autorizar por AFIP"
                  }. Si continuás, se van a eliminar también:`
                : ""
            }
            confirmLabel="Eliminar todo"
            tone="danger"
            busy={
              !!deletingViajeId &&
              deletingViajeId === viajeDeleteImpacto.viaje.id
            }
            onCancel={() => {
              if (!deletingViajeId) setViajeDeleteImpacto(null);
            }}
            onConfirm={() => void confirmDeleteViajeForzado()}
          >
            <ul className="space-y-1.5 rounded border border-black/10 bg-vialto-mist/60 p-2.5 text-xs text-vialto-charcoal">
              {viajeDeleteImpacto?.conflicto.liquidaciones.map((l) => (
                <li key={l.id} className="flex flex-col">
                  <span className="font-medium">
                    Liquidación a {l.transportistaNombre}
                  </span>
                  <span className="text-vialto-steel">
                    Período{" "}
                    {new Date(l.periodoDesde).toLocaleDateString("es-AR")} –{" "}
                    {new Date(l.periodoHasta).toLocaleDateString("es-AR")} ·
                    estado: {l.estado}
                  </span>
                </li>
              ))}
            </ul>
          </ConfirmDialog>
        )}

        {facturarMultiClienteViaje && (
          <FacturarSelectorMultiClienteModal
            viaje={facturarMultiClienteViaje}
            onClose={() => setFacturarMultiClienteViaje(null)}
            onSelect={(clienteId) => {
              const v = facturarMultiClienteViaje;
              setFacturarMultiClienteViaje(null);
              proceedAfterMultiClientSelector(v, clienteId);
            }}
          />
        )}

        {verFacturasMultiClienteViaje && (
          <VerFacturasMultiClienteModal
            viaje={verFacturasMultiClienteViaje}
            onClose={() => setVerFacturasMultiClienteViaje(null)}
            onVerFactura={(facturaId, clienteId) => {
              void abrirFacturaModalEnContexto(
                verFacturasMultiClienteViaje,
                facturaId,
                clienteId,
              );
            }}
          />
        )}

        {exportModalOpen && (
          <ExcelExportModal
            columns={viajesExportColumnsDisponibles}
            rowCount={meta?.total ?? rows?.length ?? 0}
            onExport={handleExportarExcel}
            onClose={() => !exportandoExcel && setExportModalOpen(false)}
          />
        )}

        {viewingFactura && (
          <FacturaViewModal
            getToken={getToken}
            factura={viewingFactura}
            cliente={
              clientes.find((c) => c.id === viewingFactura.clienteId) ??
              (viewingFactura as any).cliente ??
              ({
                condicionIva:
                  (viewingFactura as any).letraComprobante === "a"
                    ? "responsable_inscripto"
                    : "consumidor_final",
              } as any)
            }
            clienteNombre={
              clientes.find((c) => c.id === viewingFactura.clienteId)?.nombre ??
              (viewingFactura as any).clienteNombre ??
              (viewingFactura as any).nombreCliente ??
              "—"
            }
            hasArca={true}
            onClose={() => setViewingFactura(null)}
            onVerComprobante={
              viewingFactura.comprobanteUrl
                ? () =>
                    window.open(
                      viewingFactura.comprobanteUrl!,
                      "_blank",
                      "noopener,noreferrer",
                    )
                : undefined
            }
            onEditar={() => {
              setViewingFactura(null);
              navigate("/facturacion", {
                state: {
                  ...facturacionNavExtras(),
                  expandFacturaId: viewingFactura.id,
                },
              });
            }}
            onMarcarCobrada={() => {
              setViewingFactura(null);
              navigate("/facturacion", {
                state: {
                  ...facturacionNavExtras(),
                  viewFacturaId: viewingFactura.id,
                },
              });
            }}
            onEmitirArca={() => {
              setViewingFactura(null);
              navigate("/facturacion", {
                state: {
                  ...facturacionNavExtras(),
                  viewFacturaId: viewingFactura.id,
                },
              });
            }}
            onAnular={() => {
              setViewingFactura(null);
              navigate("/facturacion", {
                state: {
                  ...facturacionNavExtras(),
                  viewFacturaId: viewingFactura.id,
                },
              });
            }}
            onVerNotaCredito={
              viewingFactura.arcaEstado === "anulado"
                ? () => {
                    if (viewingFactura.notaCreditoUrl) {
                      window.open(
                        viewingFactura.notaCreditoUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    } else {
                      setViewingFactura(null);
                      navigate("/facturacion", {
                        state: {
                          ...facturacionNavExtras(),
                          viewFacturaId: viewingFactura.id,
                        },
                      });
                    }
                  }
                : undefined
            }
          />
        )}

        {viewingLiquidacion && (
          <LiquidacionViewModal
            liq={viewingLiquidacion}
            hasArca={
              hasLiquidoProductoArca ||
              viewingLiquidacion.cbteNro != null ||
              viewingLiquidacion.cae != null
            }
            canEdit={false}
            onEditar={() => {
              setViewingLiquidacion(null);
              const params = new URLSearchParams();
              if (platform && tid) params.set("tenantId", tid);
              params.set("liquidacion", viewingLiquidacion.id);
              navigate(`/liquidaciones?${params.toString()}`);
            }}
            onClose={() => setViewingLiquidacion(null)}
            contratoPdfUrl={liquidacionContratoPdfUrl(
              viewingLiquidacion.id,
              platform && tid ? { platform: true, tenantId: tid } : undefined,
            )}
            onVerComprobante={
              viewingLiquidacion.cbteNro != null ||
              viewingLiquidacion.cae != null
                ? () => {
                    const url =
                      platform && tid
                        ? `/api/platform/integracion-arca/liquidaciones/${encodeURIComponent(viewingLiquidacion.id)}/pdf?tenantId=${encodeURIComponent(tid)}`
                        : `/api/integracion-arca/liquidaciones/${encodeURIComponent(viewingLiquidacion.id)}/pdf`;

                    const ventana = window.open("", "_blank");

                    apiFetch(url, () => getToken())
                      .then((res) => {
                        if (!res.ok) throw new Error("Error al generar PDF");
                        return res.blob();
                      })
                      .then((blob) => {
                        const blobUrl = URL.createObjectURL(blob);
                        if (ventana) ventana.location.href = blobUrl;
                        else window.open(blobUrl, "_blank");
                      })
                      .catch(() => {
                        ventana?.close();
                        showToast(
                          "No se pudo cargar el PDF del comprobante",
                          "error",
                        );
                      });
                  }
                : viewingLiquidacion.comprobanteUrl?.trim()
                  ? () =>
                      window.open(
                        viewingLiquidacion.comprobanteUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                  : undefined
            }
          />
        )}

        {isFacturaModalOpen && (
          <FacturaCreateModal
            open={isFacturaModalOpen}
            draft={facturaDraft}
            setDraft={setFacturaDraft}
            clientes={clientes}
            viajes={rows ?? []}
            viajesNueva={rows ?? []}
            viajesLoading={listadoRefetching}
            onClose={() => setIsFacturaModalOpen(false)}
            hasArca={hasFacturasArca}
            tenantId={platform ? tid : undefined}
            idSistemaHabilitado={idSistemaHabilitado(currentTenant)}
            idPropio1Habilitado={idPropio1Habilitado(currentTenant)}
            idPropio1Label={labelIdentificacionPersonalizadaViajes(currentTenant)}
            idPropio2Habilitado={idPropio2Habilitado(currentTenant)}
            idPropio2Label={idPropio2Label(currentTenant)}
            getToken={getToken}
            facturasCreateUrl={
              platform
                ? `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}`
                : "/api/facturacion/facturas"
            }
            onFacturaGuardada={() => {
              setIdsSeleccionLote([]);
              setListadoQueryVersion((v) => v + 1);
            }}
            onFacturaEmitida={() => {
              setIdsSeleccionLote([]);
              setListadoQueryVersion((v) => v + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

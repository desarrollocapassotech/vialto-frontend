import { useAuth, useUser } from "@clerk/clerk-react";
import { isOrgAdmin } from "@/lib/roleLabels";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useViajeEditor } from "@/hooks/useViajeEditor";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
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
import { TipoFacturaClienteModal } from "@/components/viajes/TipoFacturaClienteModal";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import type { FacturaLetra } from "@/lib/arcaCbteTipo";
import { apiJson, apiFetch, ApiError } from "@/lib/api";
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
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import { ViajeOrigenDestinoLinea } from "@/components/viajes/ViajeOrigenDestinoLinea";
import { ViajeEditModal } from "@/components/viajes/ViajeEditModal";
import { gananciaBrutaManualEnPatchParcial } from "@/lib/viajesGananciaBruta";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeAccionesMenu } from "@/components/viajes/ViajeAccionesMenu";
import { ViajesResumenFiltros } from "@/components/viajes/ViajesResumenFiltros";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { otroGastoDraftFromApi } from "@/components/viajes/OtrosGastosFieldset";
import { pagoTransportistaDraftFromApi } from "@/components/viajes/PagosTransportistaFieldset";
import { type PaisCodigo } from "@/lib/ciudades";
import { formatIsoFechaHoraListadoEsAr } from "@/lib/viajeFechaHora";
import {
  viajePermiteBotonFacturar,
  viajePendienteComprobanteCliente,
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
  liquidacionElegidaDeViaje,
} from "@/lib/viajesComprobantes";
import {
  etapaViajeBadgeClass,
  etapaViajeBadgeClassDefault,
  etapaViajeLabel,
  tooltipEtapaViaje,
  VIAJE_ETAPAS_TODAS,
} from "@/lib/viajesIndicadores";
import { ViajeFacturacionIndicador } from "@/components/viajes/ViajeFacturacionIndicador";
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
} from "@/lib/tenantModules";
import {
  MSG_ARCA_NO_FACTURA_USD,
  MSG_ARCA_NO_LIQUIDA_USD,
  arcaBloqueaFacturarUsd,
  arcaBloqueaLiquidarUsd,
  motivoBloqueoAccionFacturarArcaUsd,
} from "@/lib/arcaUsdRestriction";
import { FacturarSelectorModal } from "@/components/viajes/FacturarSelectorModal";
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
import { Download, Upload } from "lucide-react";
import { ExcelExportModal } from "@/components/stock/ExcelExportModal";
import {
  VIAJES_EXPORT_COLUMNS,
  generarViajesExcel,
} from "@/lib/viajesExcelExport";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { LiquidacionViewModal } from "@/components/liquidaciones/LiquidacionViewModal";

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
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
} = {}) {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const { tenant: currentTenant } = useCurrentTenant();
  const { showToast } = useToast();

  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);
  const [viewingLiquidacion, setViewingLiquidacion] = useState<any | null>(
    null,
  );

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
  const tid = tenantId?.trim() ?? "";

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

  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const [exportarViaje, setExportarViaje] = useState<Viaje | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
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
    clienteId: "",
    transportistaId: "",
    choferId: "",
    estado: initialEstadoFromUrl,
    facturacionEstado: "",
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
  const [clienteIdFiltroActivo, setClienteIdFiltroActivo] = useState("");
  const [transportistaIdFiltroActivo, setTransportistaIdFiltroActivo] =
    useState("");
  const [choferIdFiltroActivo, setChoferIdFiltroActivo] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState(initialEstadoFromUrl);
  const [facturacionFiltro, setFacturacionFiltro] = useState("");
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

  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [idsFacturarSeleccion, setIdsFacturarSeleccion] = useState<string[]>(
    [],
  );

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [agregarGastoViaje, setAgregarGastoViaje] = useState<Viaje | null>(
    null,
  );
  const [registrarPagoViaje, setRegistrarPagoViaje] = useState<Viaje | null>(
    null,
  );
  const [selectorViaje, setSelectorViaje] = useState<{
    viaje: Viaje;
    targetClienteId?: string;
  } | null>(null);
  const [tipoFacturaViaje, setTipoFacturaViaje] = useState<{
    viaje: Viaje;
    targetClienteId?: string;
  } | null>(null);
  const [facturarMultiClienteViaje, setFacturarMultiClienteViaje] = useState<Viaje | null>(null);
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
    setEstadoQuickId(null);
    return viajeEditor.beginEditViaje(v, origen);
  }

  function cancelEdit() {
    setEstadoQuickId(null);
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
          clienteId: cid,
          transportistaId: transpFiltro,
          choferId: choferFiltro,
          estado: estF,
          facturacionEstado: facEstF,
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

        if (cid) filtros.set("clienteId", cid);
        if (transpFiltro) filtros.set("transportistaId", transpFiltro);
        if (choferFiltro) filtros.set("choferId", choferFiltro);
        if (estF.trim()) filtros.set("etapa", estF.trim());
        if (facEstF.trim()) filtros.set("facturacionEstado", facEstF.trim());
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

        const isLocalSearch = !!numF.trim() || !!ctgF.trim();
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
      clienteId: "",
      transportistaId: "",
      choferId: "",
      estado: "",
      facturacionEstado: "",
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
    setClienteIdFiltroActivo("");
    setTransportistaIdFiltroActivo("");
    setChoferIdFiltroActivo("");
    setEstadoFiltro("");
    setFacturacionFiltro("");
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
    !!numeroFiltroActivo.trim() ||
    !!ctgFiltroActivo.trim() ||
    !!clienteIdFiltroActivo.trim() ||
    !!transportistaIdFiltroActivo.trim() ||
    !!choferIdFiltroActivo.trim() ||
    !!estadoFiltro.trim() ||
    !!facturacionFiltro.trim() ||
    !!pagoTransportistaFiltro.trim() ||
    !!fechaDesdeFiltro.trim() ||
    !!fechaHastaFiltro.trim() ||
    !!ubicacionFiltro.trim() ||
    periodoFiltro !== "todos";

  const cantidadFiltrosColumnasActivos = useMemo(() => {
    let n = 0;
    if (numeroFiltroActivo.trim()) n += 1;
    if (ctgFiltroActivo.trim()) n += 1;
    if (clienteIdFiltroActivo.trim()) n += 1;
    if (transportistaIdFiltroActivo.trim()) n += 1;
    if (choferIdFiltroActivo.trim()) n += 1;
    if (estadoFiltro.trim()) n += 1;
    if (facturacionFiltro.trim()) n += 1;
    if (pagoTransportistaFiltro.trim()) n += 1;
    if (ubicacionFiltro.trim()) n += 1;
    if (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim()) n += 1;
    if (periodoFiltro !== "todos") n += 1;
    return n;
  }, [
    numeroFiltroActivo,
    ctgFiltroActivo,
    clienteIdFiltroActivo,
    transportistaIdFiltroActivo,
    choferIdFiltroActivo,
    estadoFiltro,
    facturacionFiltro,
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
    if (v.etapa?.toLowerCase() === "cancelado") return false;
    if (!viajePermiteBotonFacturar(v)) return false;
    if (arcaBloqueaFacturarUsd(hasFacturasArca, v.monedaMonto)) return false;
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

  function facturarSeleccionMultiple() {
    const ids = idsFacturarSeleccion;
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

  function onViajeEliminadoOk(v: Viaje) {
    showToast("Viaje eliminado correctamente", "success");
    setRows((prev) => (prev ? prev.filter((r) => r.id !== v.id) : prev));
    setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
    setIdsFacturarSeleccion((ids) => ids.filter((id) => id !== v.id));
    if (viajeEditor.editingId === v.id) cancelEdit();
    if (viewingViaje?.id === v.id) setViewingViaje(null);
    if (exportarViaje?.id === v.id) setExportarViaje(null);
    if (agregarGastoViaje?.id === v.id) setAgregarGastoViaje(null);
    if (registrarPagoViaje?.id === v.id) setRegistrarPagoViaje(null);
    if (crearLiqViaje?.id === v.id) setCrearLiqViaje(null);
    if (selectorViaje?.viaje.id === v.id) setSelectorViaje(null);
    if (tipoFacturaViaje?.viaje.id === v.id) setTipoFacturaViaje(null);
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

      const cols = VIAJES_EXPORT_COLUMNS.filter((c) =>
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

  async function patchEstadoDesdeListado(v: Viaje, nuevaEtapa: string) {
    if (nuevaEtapa === v.etapa) {
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
            etapa: nuevaEtapa,
            ...gananciaBrutaManualEnPatchParcial(v),
          }),
        },
      );
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === v.id ? updated : r)) : prev,
      );
      setEstadoQuickId(null);
      showToast("Estado actualizado correctamente", "success");
    } catch (e) {
      setError(friendlyError(e, "viajes"));
      showToast("No se pudo actualizar el estado", "error");
    } finally {
      setSavingEstadoId(null);
    }
  }

  function openFacturarFlow(v: Viaje) {
    handleFacturarViaje(v);
  }

  function openVerFacturaFlow(v: Viaje) {
    if ((v.clientesViaje ?? []).length > 0) {
      setVerFacturasMultiClienteViaje(v);
    } else if (v.facturaId) {
      void abrirFacturaModalEnContexto(v);
    }
  }

  function handleFacturarViaje(v: Viaje) {
    if (viajeRequiereComprobanteDual(v)) {
      if (hasFacturasArca || hasFacturacionSinArca) {
        setSelectorViaje({ viaje: v, targetClienteId: undefined });
        return;
      }
    }
    proceedAfterDualSelector(v, undefined);
  }

  function proceedAfterDualSelector(v: Viaje, targetClienteId?: string) {
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
      setTipoFacturaViaje({ viaje: v, targetClienteId });
    } else {
      void navigateToFacturacion(v, undefined, targetClienteId);
    }
  }

  function isMultiClient(v: Viaje) {
    return (v.clientesViaje ?? []).length > 0;
  }

  async function navigateToFacturacion(v: Viaje, letra?: FacturaLetra, targetClienteId?: string) {
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
        navigate("/facturacion", {
          state: { ...facturacionNavExtras(), expandFacturaId: yaVinculada.id },
        });
        return;
      }
    } catch {
      // Ignorar fallback
    } finally {
      setFacturandoLoadingId(null);
    }
    navigate("/facturacion", {
      state: {
        ...facturacionNavExtras(),
        newFacturaDraft: {
          clienteId: targetClienteId ?? v.clienteId ?? "",
          viajeIds: [v.id],
          letraComprobante: letra,
        },
      },
    });
  }

  async function abrirFacturaModalEnContexto(v: Viaje, targetFacturaId?: string, targetClienteId?: string) {
    const fId = targetFacturaId ?? v.facturaId;
    const cId = targetClienteId ?? v.clienteId;
    
    if (!fId || !cId) return;

    setFacturandoLoadingId(fId);

    try {
      const facturasCliente = await apiJson<Factura[]>(
        facturasPorClienteUrl(cId),
        () => getToken(),
      );
      const facturaEncontrada = facturasCliente.find(
        (f) => f.id === fId,
      );

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

  const mostrarColumnaFacturarLote = clienteIdFiltroActivo.trim() !== "";
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
      <ListadoFiltroCampo label="Chofer" active={!!choferIdFiltroActivo.trim()}>
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
          <option value="">Todos</option>
          <option value="cancelado">Cancelados</option>
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

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {!embeddedInSuperadmin ? (
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide text-vialto-charcoal">
            Viajes
          </h1>
        ) : (
          <span />
        )}

        <div className="flex shrink-0 gap-2">
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
        </div>
      </div>

      {resumen && (
        <div className="mt-3">
          <ViajesResumenFiltros
            resumen={resumen}
            facturacionFiltro={facturacionFiltro}
            pagoTransportistaFiltro={pagoTransportistaFiltro}
            onFiltroFacturacion={aplicarFiltroFacturacion}
            onFiltroPago={aplicarFiltroPagoTransportista}
          />
        </div>
      )}

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
                title="ID"
                filterActive={!!numeroFiltroActivo.trim()}
                filterSignature={numeroFiltroActivo}
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
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title={
                  labelIdentificacionPersonalizadaViajes(currentTenant) ?? "CTG"
                }
                filterActive={!!ctgFiltroActivo.trim()}
                filterSignature={ctgFiltroActivo}
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
                title="Chofer"
                filterActive={!!choferIdFiltroActivo.trim()}
                filterSignature={choferIdFiltroActivo}
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
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Etapa"
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
                  aria-label="Filtrar listado por etapa"
                >
                  <option value="">Todos</option>
                  <option value="cancelado">Cancelados</option>
                  {VIAJE_ETAPAS_TODAS.filter((x) => x !== "cancelado").map(
                    (est) => (
                      <option
                        key={est}
                        value={est}
                        title={tooltipEtapaViaje(est)}
                      >
                        {etapaViajeLabel[est] ?? est}
                      </option>
                    ),
                  )}
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
              onClick={() => setViewingViaje(v)}
            >
              {mostrarColumnaFacturarLote && (
                <td
                  className="px-2 py-3 align-middle text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {esElegibleFacturarLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsFacturarSeleccion.includes(v.id)}
                      onChange={() => toggleFacturarLote(v.id)}
                      className="accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${numeroVisibleViaje(v)} en facturación conjunta`}
                    />
                  ) : null}
                </td>
              )}
              <td className="px-4 py-3 text-vialto-steel tabular-nums">
                #{v.numero}
              </td>
              <td className="px-4 py-3 text-vialto-steel tabular-nums">
                {v.numeroIdentificacionPersonalizado?.trim() || "—"}
              </td>
              <td className="px-4 py-3 max-w-[12rem] text-vialto-charcoal">
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
              <td className="px-4 py-3 max-w-[10rem] text-vialto-steel">
                <span className="block truncate" title={nombreChofer}>
                  {nombreChofer}
                </span>
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-0.5 items-start">
                  {estadoQuickId === v.id ? (
                    <select
                      autoFocus
                      value={v.etapa}
                      disabled={savingEstadoId === v.id}
                      onChange={(e) =>
                        void patchEstadoDesdeListado(v, e.target.value)
                      }
                      onBlur={() => setEstadoQuickId(null)}
                      className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                      aria-label="Cambiar etapa del viaje"
                    >
                      {VIAJE_ETAPAS_TODAS.map((x) => (
                        <option key={x} value={x} title={tooltipEtapaViaje(x)}>
                          {etapaViajeLabel[x] ?? x}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      title={tooltipEtapaViaje(v.etapa)}
                      aria-label={`Etapa ${etapaViajeLabel[v.etapa] ?? v.etapa}. Abrir selector para cambiar.`}
                      disabled={savingEstadoId === v.id}
                      onClick={() => {
                        if (savingEstadoId) return;
                        setEstadoQuickId(v.id);
                      }}
                      className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                        etapaViajeBadgeClass[v.etapa] ??
                        etapaViajeBadgeClassDefault
                      }`}
                    >
                      {savingEstadoId === v.id
                        ? "…"
                        : (etapaViajeLabel[v.etapa] ?? "Sin clasificar")}
                    </button>
                  )}
                  {v.etapa?.toLowerCase() !== "cancelado" && (
                    <>
                      <ViajeFacturacionIndicador
                        viaje={v}
                        tenantId={platform ? tid : undefined}
                        onClickOverride={
                          (v.clientesViaje ?? []).length > 0
                            ? () => openVerFacturaFlow(v)
                            : undefined
                        }
                      />
                      {hasLiquidoProductoArca ? (
                        <ViajeLiquidacionIndicador
                          viaje={v}
                          tenantId={platform ? tid : undefined}
                        />
                      ) : (
                        <ViajePagoTransportistaIndicador
                          viaje={v}
                          onClick={() => setRegistrarPagoViaje(v)}
                        />
                      )}
                    </>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 align-top text-vialto-steel min-w-[11rem] max-w-sm">
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
              <td
                className="px-4 py-3 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <ViajeAccionesMenu
                  viaje={v}
                  hasFacturasArca={hasFacturasArca}
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => openFacturarFlow(v)}
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId || (v.clientesViaje && v.clientesViaje.some(c => c.facturaId))
                      ? () => openVerFacturaFlow(v)
                      : undefined
                  }
                  onVerLiquidacion={
                    liquidacionElegidaDeViaje(v)
                      ? () => abrirLiquidacionEnContexto(v)
                      : undefined
                  }
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
              className="flex flex-col gap-0.5 items-start"
              onClick={(e) => e.stopPropagation()}
            >
              {estadoQuickId === v.id ? (
                <select
                  autoFocus
                  value={v.etapa}
                  disabled={savingEstadoId === v.id}
                  onChange={(e) =>
                    void patchEstadoDesdeListado(v, e.target.value)
                  }
                  onBlur={() => setEstadoQuickId(null)}
                  className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                  aria-label="Cambiar etapa del viaje"
                >
                  {VIAJE_ETAPAS_TODAS.map((x) => (
                    <option key={x} value={x} title={tooltipEtapaViaje(x)}>
                      {etapaViajeLabel[x] ?? x}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  title={tooltipEtapaViaje(v.etapa)}
                  aria-label={`Etapa ${etapaViajeLabel[v.etapa] ?? v.etapa}. Abrir selector para cambiar.`}
                  disabled={savingEstadoId === v.id}
                  onClick={() => {
                    if (savingEstadoId) return;
                    setEstadoQuickId(v.id);
                  }}
                  className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                    etapaViajeBadgeClass[v.etapa] ?? etapaViajeBadgeClassDefault
                  }`}
                >
                  {savingEstadoId === v.id
                    ? "…"
                    : (etapaViajeLabel[v.etapa] ?? "Sin clasificar")}
                </button>
              )}
              {v.etapa?.toLowerCase() !== "cancelado" && (
                <>
                  <ViajeFacturacionIndicador
                    viaje={v}
                    tenantId={platform ? tid : undefined}
                    onClickOverride={
                      (v.clientesViaje ?? []).length > 0
                        ? () => openVerFacturaFlow(v)
                        : undefined
                    }
                  />
                  {hasLiquidoProductoArca ? (
                    <ViajeLiquidacionIndicador
                      viaje={v}
                      tenantId={platform ? tid : undefined}
                    />
                  ) : (
                    <ViajePagoTransportistaIndicador
                      viaje={v}
                      onClick={() => setRegistrarPagoViaje(v)}
                    />
                  )}
                </>
              )}
            </div>
          );
          return (
            <ListadoCard
              onClick={() => setViewingViaje(v)}
              primary={
                <div className="flex items-start gap-2">
                  {mostrarColumnaFacturarLote && esElegibleFacturarLote(v) ? (
                    <input
                      type="checkbox"
                      checked={idsFacturarSeleccion.includes(v.id)}
                      onChange={() => toggleFacturarLote(v.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 accent-vialto-charcoal"
                      aria-label={`Incluir viaje ${numeroVisibleViaje(v)} en facturación conjunta`}
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
                { label: "ID sistema", value: `#${v.numero}` },
                {
                  label: labelIdentificacionPersonalizadaViajes(currentTenant),
                  value: v.numeroIdentificacionPersonalizado?.trim() || "—",
                },
                { label: "Transporte", value: transporteValue },
                { label: "Chofer", value: nombreChofer },
                { label: "Etapa", value: estadoValue },
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
                  onVer={() => setViewingViaje(v)}
                  onAgregarGasto={() => setAgregarGastoViaje(v)}
                  onRegistrarPago={() => setRegistrarPagoViaje(v)}
                  onFacturar={() => openFacturarFlow(v)}
                  onExportar={() => setExportarViaje(v)}
                  onVerFactura={
                    v.facturaId || (v.clientesViaje && v.clientesViaje.some(c => c.facturaId))
                      ? () => openVerFacturaFlow(v)
                      : undefined
                  }
                  onVerLiquidacion={
                    liquidacionElegidaDeViaje(v)
                      ? () => abrirLiquidacionEnContexto(v)
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
            (viewingViaje.clientesViaje ?? []).length > 0 || viewingViaje.facturaId
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

      {/* Editor Modal Inferior para Editar Viajes en Listado */}
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
              hasFacturasArca,
              {
                ...viajeEditor.viajeSnapshot,
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
            tenant={!platform ? currentTenant : undefined}
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

      {facturandoLoadingId && (
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

      {selectorViaje && (
        <FacturarSelectorModal
          onClose={() => setSelectorViaje(null)}
          clienteCompletado={!viajePendienteComprobanteCliente(selectorViaje.viaje)}
          transportistaCompletado={
            !viajePendienteComprobanteTransportista(selectorViaje.viaje)
          }
          clienteBloqueadoMotivo={
            arcaBloqueaFacturarUsd(hasFacturasArca, selectorViaje.viaje.monedaMonto)
              ? MSG_ARCA_NO_FACTURA_USD
              : null
          }
          transportistaBloqueadoMotivo={
            arcaBloqueaLiquidarUsd(
              hasLiquidoProductoArca,
              selectorViaje.viaje.monedaPrecioTransportistaExterno,
            )
              ? MSG_ARCA_NO_LIQUIDA_USD
              : null
          }
          subtituloCliente={
            hasFacturasArca
              ? "Elegí Factura A o B según IVA del cliente"
              : "Registro manual"
          }
          subtituloTransportista={
            hasLiquidoProductoArca ? "CVLP tipo 60" : "Registro manual"
          }
          onFacturarCliente={() => {
            if (
              arcaBloqueaFacturarUsd(hasFacturasArca, selectorViaje.viaje.monedaMonto)
            ) {
              showToast(MSG_ARCA_NO_FACTURA_USD, "error");
              return;
            }
            const v = selectorViaje.viaje;
            const cid = selectorViaje.targetClienteId;
            setSelectorViaje(null);
            proceedAfterDualSelector(v, cid);
          }}
          onLiquidacion={() => {
            if (
              arcaBloqueaLiquidarUsd(
                hasLiquidoProductoArca,
                selectorViaje.viaje.monedaPrecioTransportistaExterno,
              )
            ) {
              showToast(MSG_ARCA_NO_LIQUIDA_USD, "error");
              return;
            }
            setCrearLiqViaje(selectorViaje.viaje);
            setSelectorViaje(null);
          }}
        />
      )}

      {tipoFacturaViaje && (
        <TipoFacturaClienteModal
          viaje={tipoFacturaViaje.viaje}
          clienteAfacturar={clientes?.find(c => c.id === (
            tipoFacturaViaje.targetClienteId ??
              tipoFacturaViaje.viaje.clienteId
          )) ?? null}
          onClose={() => setTipoFacturaViaje(null)}
          onConfirm={(letra) => {
            const v = tipoFacturaViaje.viaje;
            const cid = tipoFacturaViaje.targetClienteId;
            setTipoFacturaViaje(null);
            void navigateToFacturacion(v, letra, cid);
          }}
        />
      )}

      {crearLiqViaje && (
        <CrearLiquidacionManualModal
          viajeInicial={crearLiqViaje}
          transportistas={maestro.transportistas}
          hasLiquidoProductoArca={hasLiquidoProductoArca}
          getToken={getToken}
          onDataSaved={() => {
            void maestro.refreshTransportistas();
            void maestro.refreshClientes();
          }}
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
            ? `¿Seguro que querés eliminar el viaje ${numeroVisibleViaje(viajeDeleteConfirm)}? Esta acción no se puede deshacer.`
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

      <ConfirmDialog
        open={viajeDeleteImpacto != null}
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
          viajeDeleteImpacto != null &&
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
                Período {new Date(l.periodoDesde).toLocaleDateString("es-AR")} –{" "}
                {new Date(l.periodoHasta).toLocaleDateString("es-AR")} · estado:{" "}
                {l.estado}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>

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
          columns={VIAJES_EXPORT_COLUMNS}
          rowCount={meta?.total ?? rows?.length ?? 0}
          onExport={handleExportarExcel}
          onClose={() => !exportandoExcel && setExportModalOpen(false)}
        />
      )}

      {viewingFactura && (
        <FacturaViewModal
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
          onVerComprobante={
            viewingLiquidacion.cbteNro != null || viewingLiquidacion.cae != null
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
    </div>
  );
}

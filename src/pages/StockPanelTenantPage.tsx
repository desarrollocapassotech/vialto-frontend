import { useAuth, useUser } from "@clerk/clerk-react";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Warehouse,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClienteSearchSelect } from "@/components/forms/MaestroSearchSelects";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ExcelExportModal } from "@/components/stock/ExcelExportModal";
import { ProductoModal } from "@/components/stock/ProductoModal";
import {
  FechaVencimientoLote,
  filasDesdeLotesResponse,
  StockInventarioLotesDetalle,
  type StockInventarioLoteFila,
} from "@/components/stock/StockInventarioLotesDetalle";
import { StockProductoDetalleModal } from "@/components/stock/StockProductoDetalleModal";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { paginatedItems as extractPaginatedItems } from "@/lib/paginatedItems";
import { generarExcel, stockItemColumnas } from "@/lib/stockExcelExport";
import { puedeGestionarComoAdminEmpresa } from "@/lib/roleLabels";
import { fetchLotesDisponibles } from "@/lib/stockLote";
import {
  listadoTablaAccionClass,
  listadoTablaBodyRowClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type {
  Cliente,
  Deposito,
  PaginatedResponse,
  Producto,
  StockItem,
} from "@/types/api";

type ProductoModalState =
  | { mode: "closed" }
  | { mode: "view"; producto: Producto }
  | { mode: "edit"; producto: Producto };

type ProductoFiltro = { id: string; nombre: string };

type LotesCacheEntry = {
  loading: boolean;
  error: string | null;
  filas: StockInventarioLoteFila[] | null;
};

function buildQs(tenantId?: string) {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
}

const LABEL_SUELTOS = "Sueltos";

function cantidad1Cell(item: StockItem, unidad1Nombre: string) {
  return (
    <>
      <span
        className={
          item.cantidad1 === 0
            ? "text-vialto-steel"
            : "font-semibold text-vialto-charcoal"
        }
      >
        {item.cantidad1}
      </span>{" "}
      <span className="text-xs text-vialto-steel">{unidad1Nombre}</span>
    </>
  );
}

function stockTotalCell(
  item: StockItem,
  unidad1Nombre: string,
  showUnidad2: boolean,
  unidad2Nombre: string | null,
) {
  const sinStock = item.cantidad1 === 0 && item.cantidad2 === 0;
  return (
    <span
      className={`inline-flex items-center justify-end gap-2 ${
        sinStock ? "text-vialto-steel" : "text-vialto-charcoal"
      }`}
    >
      <Package
        className="h-3.5 w-3.5 shrink-0 text-vialto-steel"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="tabular-nums">
        <span className={sinStock ? "" : "font-semibold"}>
          {item.cantidad1}
        </span>
        <span className="text-xs text-vialto-steel"> {unidad1Nombre}</span>
        {showUnidad2 && unidad2Nombre != null && (
          <>
            <span className="text-vialto-steel"> · </span>
            <span
              className={
                item.cantidad2 === 0 || sinStock ? "" : "font-semibold"
              }
            >
              {item.cantidad2}
            </span>
            <span className="text-xs text-vialto-steel"> {unidad2Nombre}</span>
          </>
        )}
      </span>
    </span>
  );
}

function cantidad2Cell(item: StockItem, unidad2Nombre: string | null) {
  if (unidad2Nombre === null) {
    return <span className="text-vialto-steel">—</span>;
  }
  return (
    <>
      <span
        className={
          item.cantidad2 === 0
            ? "text-vialto-steel"
            : "font-semibold text-vialto-charcoal"
        }
      >
        {item.cantidad2}
      </span>{" "}
      <span className="text-xs text-vialto-steel">{unidad2Nombre}</span>
    </>
  );
}

type StockPanelTenantPageProps = {
  isPlatform?: boolean;
  tenantId?: string;
};

export function StockPanelTenantPage({
  isPlatform = false,
  tenantId = "",
}: StockPanelTenantPageProps) {
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
  const puedeGestionar = puedeGestionarComoAdminEmpresa(
    orgRole,
    user?.publicMetadata,
  );

  // Hook que trae las empresas (solo plataforma; /api/tenants es superadmin).
  const allTenants = useTenantsList({ enabled: isPlatform });

  // Estado del Tenant Manager
  const tenants = isPlatform ? allTenants : null;
  const [activeTenantId, setActiveTenantId] = useState(tenantId);

  // URLs dinámicas basadas en activeTenantId
  const disponibleUrl = isPlatform
    ? `/api/platform/stock/disponible${buildQs(activeTenantId)}`
    : "/api/stock/disponible";

  const disponibleAgrupadoUrl = isPlatform
    ? `/api/platform/stock/disponible/agrupado${buildQs(activeTenantId)}`
    : "/api/stock/disponible/agrupado";

  const depositosUrl = isPlatform
    ? `/api/platform/stock/depositos${buildQs(activeTenantId)}${activeTenantId ? "&" : "?"}page=1&pageSize=500`
    : "/api/stock/depositos?page=1&pageSize=500";

  const productosBase = isPlatform
    ? "/api/platform/stock/productos"
    : "/api/stock/productos";

  const lotesBase = isPlatform
    ? "/api/platform/stock/lotes"
    : "/api/stock/lotes";

  // Estados de grilla y UI
  const [items, setItems] = useState<StockItem[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [productosDetalle, setProductosDetalle] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [depositoActivoId, setDepositoActivoId] = useState<string | null>(null);
  const [depositoSheetOpen, setDepositoSheetOpen] = useState(false);
  const [filtroClienteId, setFiltroClienteId] = useState("");
  const [filtroProductoId, setFiltroProductoId] = useState("");
  const [soloConStockCant1, setSoloConStockCant1] = useState(false);
  const [soloConStockCant2, setSoloConStockCant2] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [productoModal, setProductoModal] = useState<ProductoModalState>({
    mode: "closed",
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [lotesCache, setLotesCache] = useState<Record<string, LotesCacheEntry>>(
    {},
  );

  const [resumenProducto, setResumenProducto] = useState<{
    productoId: string;
    nombre: string;
    totalKg: number;
    composicion: Array<{
      presentacionId: string | null;
      presentacionNombre: string;
      bultos: number;
      sueltas: number;
      kg: number;
    }>;
  } | null>(null);

  const [productoDetalleModal, setProductoDetalleModal] = useState<{
    productoId: string;
    productoNombre: string;
  } | null>(null);

  const load = useCallback(async () => {
    // Short-circuit: Si es admin y no eligió empresa, limpiamos la vista
    if (isPlatform && !activeTenantId) {
      setItems([]);
      setDepositos([]);
      setProductosDetalle([]);
      setDepositoActivoId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [stockData, depositosData] = await Promise.all([
        apiJson<StockItem[]>(disponibleUrl, () => getToken()),
        apiJson<PaginatedResponse<Deposito>>(depositosUrl, () => getToken()),
      ]);
      const qs = buildQs(activeTenantId);
      const productoIds = [
        ...new Set(stockData.map((item) => item.productoId)),
      ];
      const productos = await Promise.all(
        productoIds.map((productoId) =>
          apiJson<Producto>(
            `${productosBase}/${encodeURIComponent(productoId)}${qs}`,
            () => getToken(),
          ).catch(() => null),
        ),
      );
      setItems(stockData);
      setProductosDetalle(productos.filter((p): p is Producto => p !== null));
      setDepositos(
        extractPaginatedItems(depositosData).filter((d) => d.activo),
      );
    } catch (e) {
      setError(friendlyError(e, "stock"));
    } finally {
      setLoading(false);
    }
  }, [
    disponibleUrl,
    depositosUrl,
    productosBase,
    activeTenantId,
    isPlatform,
    getToken,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      depositos.length > 0 &&
      (depositoActivoId === null ||
        !depositos.find((d) => d.id === depositoActivoId))
    ) {
      setDepositoActivoId(depositos[0].id);
      setPage(1);
    }
  }, [depositos, depositoActivoId]);

  const handleTenantChange = (newTenantId: string) => {
    setActiveTenantId(newTenantId);
    setDepositoActivoId(null);
    setFiltroClienteId("");
    setFiltroProductoId("");
    setExpandedIds(new Set());
    setLotesCache({});
    setPage(1);
  };

  const handleCambiarTab = (id: string) => {
    setDepositoActivoId(id);
    setFiltroClienteId("");
    setFiltroProductoId("");
    setSoloConStockCant1(false);
    setSoloConStockCant2(false);
    setDepositoSheetOpen(false);
    setExpandedIds(new Set());
    setPage(1);
  };

  const cargarLotesItem = useCallback(
    async (item: StockItem) => {
      setLotesCache((prev) => {
        if (prev[item.id]?.loading) return prev;
        return {
          ...prev,
          [item.id]: {
            loading: true,
            error: null,
            filas: prev[item.id]?.filas ?? null,
          },
        };
      });
      try {
        const data = await fetchLotesDisponibles(() => getToken(), lotesBase, {
          productoId: item.productoId,
          clienteId: item.clienteId,
          depositoId: item.depositoId,
          presentacionId: item.presentacionId ?? "",
          tenantId: isPlatform ? activeTenantId : undefined,
        });
        setLotesCache((prev) => ({
          ...prev,
          [item.id]: {
            loading: false,
            error: null,
            filas: filasDesdeLotesResponse(data),
          },
        }));
      } catch (e) {
        setLotesCache((prev) => ({
          ...prev,
          [item.id]: {
            loading: false,
            error: friendlyError(e, "stock"),
            filas: null,
          },
        }));
      }
    },
    [getToken, lotesBase, isPlatform, activeTenantId],
  );

  const toggleExpand = useCallback((item: StockItem) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        return next;
      }
      next.add(item.id);
      return next;
    });
    // Si había error previo, limpiar para reintentar al reabrir.
    setLotesCache((prev) => {
      if (!prev[item.id]?.error) return prev;
      const { [item.id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Al expandir una fila, cargar lotes si aún no están en caché.
  useEffect(() => {
    for (const id of expandedIds) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const cache = lotesCache[id];
      if (cache?.loading || cache?.filas || cache?.error) continue;
      void cargarLotesItem(item);
    }
  }, [expandedIds, items, lotesCache, cargarLotesItem]);

  function presentacionNombre(item: StockItem): string | null {
    const producto = productosDetalle.find((p) => p.id === item.productoId);
    const pres = producto?.productoPresentaciones?.find(
      (p) => p.id === item.presentacionId,
    );
    return (
      item.presentacion?.presentacion?.nombre ??
      pres?.presentacion?.nombre ??
      null
    );
  }

  function unidadNombres(item: StockItem) {
    const producto = productosDetalle.find((p) => p.id === item.productoId);
    const pres = producto?.productoPresentaciones?.find(
      (p) => p.id === item.presentacionId,
    );
    const nombrePres =
      item.presentacion?.presentacion?.nombre ??
      pres?.presentacion?.nombre ??
      null;
    const sinUnidad2 = item.producto?.unidad2Nombre === null;
    return {
      unidad1: nombrePres || "Bultos",
      unidad2: sinUnidad2 ? null : LABEL_SUELTOS,
    };
  }

  const clientesEnDeposito = useMemo(() => {
    if (!depositoActivoId) return [];
    const map = new Map<string, Cliente>();
    for (const item of items) {
      if (item.depositoId !== depositoActivoId || !item.cliente) continue;
      if (!map.has(item.cliente.id)) {
        map.set(item.cliente.id, {
          id: item.cliente.id,
          tenantId: item.tenantId,
          nombre: item.cliente.nombre,
          idFiscal: null,
          email: null,
          telefono: null,
          direccion: null,
          pais: null,
          condicionIva: null,
          condicionTributaria: null,
          createdAt: "",
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items, depositoActivoId]);

  const productosEnDeposito = useMemo(() => {
    if (!depositoActivoId) return [];
    const map = new Map<string, ProductoFiltro>();
    for (const item of items) {
      if (item.depositoId !== depositoActivoId || !item.producto) continue;
      if (!map.has(item.producto.id)) {
        map.set(item.producto.id, {
          id: item.producto.id,
          nombre: item.producto.nombre,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items, depositoActivoId]);

  const filteredItems = useMemo(() => {
    if (!depositoActivoId) return [];
    return items.filter((item) => {
      if (item.depositoId !== depositoActivoId) return false;
      if (filtroClienteId && item.clienteId !== filtroClienteId) return false;
      if (filtroProductoId && item.productoId !== filtroProductoId)
        return false;
      if (soloConStockCant1 && item.cantidad1 === 0) return false;
      if (
        soloConStockCant2 &&
        item.producto?.unidad2Nombre !== null &&
        item.cantidad2 === 0
      ) {
        return false;
      }
      return true;
    });
  }, [
    items,
    depositoActivoId,
    filtroClienteId,
    filtroProductoId,
    soloConStockCant1,
    soloConStockCant2,
  ]);

  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, page, pageSize]);

  const meta = useMemo(() => {
    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      total,
      page,
      pageSize,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }, [filteredItems.length, page, pageSize]);

  const countByDeposito = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.depositoId] = (map[item.depositoId] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const depositoActivo = depositos.find((d) => d.id === depositoActivoId);
  const depositoActivoCount = depositoActivoId
    ? (countByDeposito[depositoActivoId] ?? 0)
    : 0;

  const depositoOptions: SelectorOpcion[] = depositos.map((dep) => {
    const count = countByDeposito[dep.id] ?? 0;
    return {
      id: dep.id,
      label: dep.nombre,
      trailing: (
        <span className="rounded-full bg-black/8 px-1.5 py-0.5 text-xs font-semibold leading-none text-vialto-steel">
          {count}
        </span>
      ),
    };
  });

  const showUnidad2 = useMemo(
    () =>
      items.some(
        (i) =>
          i.depositoId === depositoActivoId &&
          i.producto?.unidad2Nombre !== null,
      ),
    [items, depositoActivoId],
  );

  // expand + cliente + producto + stock total (+ sueltas) + kg + acciones
  const colSpan = 6 + (showUnidad2 ? 1 : 0);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filtroClienteId.trim()) n += 1;
    if (filtroProductoId.trim()) n += 1;
    if (soloConStockCant1) n += 1;
    if (soloConStockCant2) n += 1;
    return n;
  }, [filtroClienteId, filtroProductoId, soloConStockCant1, soloConStockCant2]);

  function limpiarFiltros() {
    setFiltroClienteId("");
    setFiltroProductoId("");
    setSoloConStockCant1(false);
    setSoloConStockCant2(false);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
  }, [filtroClienteId, filtroProductoId, soloConStockCant1, soloConStockCant2]);

  useEffect(() => {
    if (!filtroProductoId) {
      setResumenProducto(null);
      return;
    }
    if (isPlatform && !activeTenantId) return;

    let cancelado = false;
    (async () => {
      try {
        const qs = buildQs(activeTenantId);
        const separador = qs ? "&" : "?";
        const url = `${disponibleAgrupadoUrl}${qs}${separador}productoId=${encodeURIComponent(filtroProductoId)}`;
        const data = await apiJson<
          Array<{
            productoId: string;
            nombre: string;
            totalKg: number;
            composicion: Array<{
              presentacionId: string | null;
              presentacionNombre: string;
              bultos: number;
              sueltas: number;
              kg: number;
            }>;
          }>
        >(url, () => getToken());
        if (!cancelado) {
          setResumenProducto(data[0] ?? null);
        }
      } catch {
        if (!cancelado) setResumenProducto(null);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [
    filtroProductoId,
    disponibleAgrupadoUrl,
    activeTenantId,
    isPlatform,
    getToken,
  ]);

  const stockEmptyMessage =
    filtroClienteId ||
    filtroProductoId ||
    soloConStockCant1 ||
    soloConStockCant2
      ? "Sin resultados para los filtros aplicados."
      : "Sin stock registrado en este depósito.";

  const filterToolbar = (
    <>
      <ListadoFiltroCampo label="Cliente" active={!!filtroClienteId.trim()}>
        <ClienteSearchSelect
          id="stock-panel-filtro-cliente"
          clientes={clientesEnDeposito}
          value={filtroClienteId}
          onChange={setFiltroClienteId}
          allowEmptyValue
          emptyListChoiceLabel="Todos"
          placeholderCerrado="Todos"
          placeholderBuscar="Buscar por nombre…"
          aria-label="Filtrar por cliente"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            filtroClienteId.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Producto" active={!!filtroProductoId.trim()}>
        <SearchableEntitySelect<ProductoFiltro>
          items={productosEnDeposito}
          value={filtroProductoId}
          onChange={setFiltroProductoId}
          allowEmptyValue
          emptyListChoiceLabel="Todos"
          placeholderCerrado="Todos"
          placeholderBuscar="Buscar por nombre…"
          filterItems={(lista, q) => {
            const lq = q.toLowerCase();
            return lista.filter((p) => p.nombre.toLowerCase().includes(lq));
          }}
          getPrimaryLabel={(p) => p.nombre}
          searchAriaLabel="Filtrar productos"
          aria-label="Filtrar por producto"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            filtroProductoId.trim()
              ? "text-vialto-fire"
              : "text-vialto-charcoal"
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Bultos" active={soloConStockCant1}>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
          <input
            type="checkbox"
            checked={soloConStockCant1}
            onChange={(e) => setSoloConStockCant1(e.target.checked)}
            className="h-4 w-4 accent-vialto-charcoal"
          />
          Solo con stock
        </label>
      </ListadoFiltroCampo>
      {showUnidad2 && (
        <ListadoFiltroCampo label={LABEL_SUELTOS} active={soloConStockCant2}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
            <input
              type="checkbox"
              checked={soloConStockCant2}
              onChange={(e) => setSoloConStockCant2(e.target.checked)}
              className="h-4 w-4 accent-vialto-charcoal"
            />
            Solo con stock
          </label>
        </ListadoFiltroCampo>
      )}
    </>
  );

  const exportExcelButton = (
    <button
      type="button"
      onClick={() => setExportModalOpen(true)}
      disabled={filteredItems.length === 0}
      className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
    >
      <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
      Descargar Excel
    </button>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">
            Inventario
          </h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Stock disponible en cada depósito, en tiempo real.
          </p>
        </div>

        {/* Solo mostramos el botón de Excel si no estamos en la pantalla inicial de plataforma */}
        {(!isPlatform || activeTenantId) && (
          <div className="flex w-full items-center justify-end gap-4 sm:w-auto">
            {exportExcelButton}
          </div>
        )}
      </div>

      {/* Buscador debajo del título para Superadmins */}
      {isPlatform && (
        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={activeTenantId}
            onChange={handleTenantChange}
          />
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Estado vacío minimalista igual al de facturación */}
      {isPlatform && !activeTenantId && (
        <p className="mt-10 text-sm text-vialto-steel">
          Seleccioná una empresa para ver su inventario.
        </p>
      )}

      {/* Solo renderizamos el contenido si estamos en modo normal o si ya se seleccionó una empresa */}
      {(!isPlatform || activeTenantId) && (
        <>
          {loading && <p className="text-sm text-vialto-steel">Cargando…</p>}

          {!loading && depositos.length === 0 && (
            <p className="text-sm text-vialto-steel">
              No hay depósitos activos configurados.
            </p>
          )}

          {!loading && depositos.length > 0 && (
            <>
              {/* Selector mobile / tabs desktop por depósito */}
              <div className="border-b border-black/10">
                <div className="pb-3 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setDepositoSheetOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={depositoSheetOpen}
                    className={selectorTriggerClass}
                  >
                    <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                      Depósito
                    </span>
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <Warehouse
                        className="h-4 w-4 shrink-0 text-vialto-steel"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                        {depositoActivo?.nombre ?? "Depósito"}
                      </span>
                      <span className="shrink-0 rounded-full bg-vialto-fire/15 px-1.5 py-0.5 text-xs font-semibold leading-none text-vialto-fire">
                        {depositoActivoCount}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-vialto-steel"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </span>
                  </button>
                  <SelectorOpcionesSheet
                    open={depositoSheetOpen}
                    onClose={() => setDepositoSheetOpen(false)}
                    title="Elegir depósito"
                    options={depositoOptions}
                    activeId={depositoActivoId}
                    onSelect={handleCambiarTab}
                  />
                </div>

                <nav
                  className="-mb-px hidden flex-wrap gap-0 lg:flex"
                  aria-label="Depósitos"
                >
                  {depositos.map((dep) => {
                    const activo = depositoActivoId === dep.id;
                    const count = countByDeposito[dep.id] ?? 0;
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => handleCambiarTab(dep.id)}
                        className={[
                          "flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                          activo
                            ? "border-vialto-fire text-vialto-charcoal"
                            : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:border-black/20",
                        ].join(" ")}
                      >
                        <Warehouse
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {dep.nombre}
                        <span
                          className={[
                            "rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                            activo
                              ? "bg-vialto-fire/15 text-vialto-fire"
                              : "bg-black/8 text-vialto-steel",
                          ].join(" ")}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {resumenProducto && (
                <div className="mb-4 rounded border border-black/10 bg-vialto-mist/40 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-vialto-charcoal">
                      {resumenProducto.nombre}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-vialto-charcoal">
                        {resumenProducto.totalKg} kg totales
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setProductoDetalleModal({
                            productoId: resumenProducto.productoId,
                            productoNombre: resumenProducto.nombre,
                          })
                        }
                        className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {resumenProducto.composicion.map((c, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm text-vialto-steel"
                      >
                        <span>
                          {c.bultos > 0 &&
                            `${c.bultos} ${c.presentacionNombre}`}
                          {c.bultos > 0 && c.sueltas > 0 && " + "}
                          {c.sueltas > 0 && `${c.sueltas} sueltas`}
                        </span>
                        <span className="font-medium text-vialto-charcoal">
                          {c.kg} kg
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ListadoDatos
                columns={[]}
                rows={paginatedItems}
                rowKey={(item) => item.id}
                emptyMessage={stockEmptyMessage}
                tableColSpan={colSpan}
                filters={filterToolbar}
                activeFilterCount={activeFilterCount}
                onClearFilters={limpiarFiltros}
                tableHead={
                  <tr className={listadoTablaHeadRowClass}>
                    <th
                      scope="col"
                      className={`${listadoTablaThClass} w-10 align-middle`}
                    >
                      <span className="sr-only">Desglose por lote</span>
                    </th>
                    <th
                      scope="col"
                      className={`${listadoTablaThClass} align-top`}
                    >
                      <ViajesListadoHeaderFiltro
                        title="Cliente"
                        filterActive={!!filtroClienteId.trim()}
                        filterSignature={filtroClienteId}
                      >
                        <ClienteSearchSelect
                          id="stock-panel-filtro-cliente"
                          clientes={clientesEnDeposito}
                          value={filtroClienteId}
                          onChange={setFiltroClienteId}
                          allowEmptyValue
                          emptyListChoiceLabel="Todos"
                          placeholderCerrado="Todos"
                          placeholderBuscar="Buscar por nombre…"
                          aria-label="Filtrar por cliente"
                          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                            filtroClienteId.trim()
                              ? "text-vialto-fire"
                              : "text-vialto-charcoal"
                          }`}
                        />
                      </ViajesListadoHeaderFiltro>
                    </th>
                    <th
                      scope="col"
                      className={`${listadoTablaThClass} align-top`}
                    >
                      <ViajesListadoHeaderFiltro
                        title="Producto"
                        filterActive={!!filtroProductoId.trim()}
                        filterSignature={filtroProductoId}
                      >
                        <SearchableEntitySelect<ProductoFiltro>
                          items={productosEnDeposito}
                          value={filtroProductoId}
                          onChange={setFiltroProductoId}
                          allowEmptyValue
                          emptyListChoiceLabel="Todos"
                          placeholderCerrado="Todos"
                          placeholderBuscar="Buscar por nombre…"
                          filterItems={(lista, q) => {
                            const lq = q.toLowerCase();
                            return lista.filter((p) =>
                              p.nombre.toLowerCase().includes(lq),
                            );
                          }}
                          getPrimaryLabel={(p) => p.nombre}
                          searchAriaLabel="Filtrar productos"
                          aria-label="Filtrar por producto"
                          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                            filtroProductoId.trim()
                              ? "text-vialto-fire"
                              : "text-vialto-charcoal"
                          }`}
                        />
                      </ViajesListadoHeaderFiltro>
                    </th>
                    <th
                      scope="col"
                      className={`${listadoTablaThClass} text-right align-top`}
                    >
                      <ViajesListadoHeaderFiltro
                        title="Stock total"
                        alignRight
                        filterActive={soloConStockCant1}
                        filterSignature={soloConStockCant1 ? "1" : ""}
                      >
                        <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-vialto-charcoal">
                          <input
                            type="checkbox"
                            checked={soloConStockCant1}
                            onChange={(e) =>
                              setSoloConStockCant1(e.target.checked)
                            }
                            className="h-4 w-4 accent-vialto-charcoal"
                          />
                          Solo con stock
                        </label>
                      </ViajesListadoHeaderFiltro>
                    </th>
                    <th
                      scope="col"
                      className={`${listadoTablaThClass} text-right align-top`}
                    >
                      Kg
                    </th>
                    {showUnidad2 && (
                      <th
                        scope="col"
                        className={`${listadoTablaThClass} text-right align-top`}
                      >
                        <ViajesListadoHeaderFiltro
                          title={LABEL_SUELTOS}
                          alignRight
                          filterActive={soloConStockCant2}
                          filterSignature={soloConStockCant2 ? "1" : ""}
                        >
                          <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-vialto-charcoal">
                            <input
                              type="checkbox"
                              checked={soloConStockCant2}
                              onChange={(e) =>
                                setSoloConStockCant2(e.target.checked)
                              }
                              className="h-4 w-4 accent-vialto-charcoal"
                            />
                            Solo con stock
                          </label>
                        </ViajesListadoHeaderFiltro>
                      </th>
                    )}
                    <th scope="col" className={`${listadoTablaThClass} w-16`} />
                  </tr>
                }
                renderTableRow={(item) => {
                  const sinStock = item.cantidad1 === 0 && item.cantidad2 === 0;
                  const expanded = expandedIds.has(item.id);
                  const cache = lotesCache[item.id];
                  const units = unidadNombres(item);
                  const presentacion = presentacionNombre(item);
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`${listadoTablaBodyRowClass} ${
                          expanded
                            ? "bg-vialto-mist/40 border-l-2 border-l-vialto-charcoal/25"
                            : ""
                        }`}
                      >
                        <td className={`${listadoTablaTdClass} w-10 pr-1`}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(item)}
                            aria-expanded={expanded}
                            aria-label={
                              expanded
                                ? "Ocultar desglose por lote"
                                : "Ver desglose por lote"
                            }
                            className={`inline-flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                              expanded
                                ? "border-vialto-charcoal/25 bg-vialto-mist text-vialto-charcoal"
                                : "border-black/15 bg-white text-vialto-charcoal hover:bg-vialto-mist"
                            }`}
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 ${
                                expanded ? "rotate-90" : ""
                              }`}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          </button>
                        </td>
                        <td className={listadoTablaTdClass}>
                          <span
                            className={
                              sinStock
                                ? "text-vialto-steel"
                                : "font-medium text-vialto-charcoal"
                            }
                          >
                            {item.cliente?.nombre ?? item.clienteId}
                          </span>
                        </td>
                        <td className={listadoTablaTdClass}>
                          <div className={sinStock ? "text-vialto-steel" : ""}>
                            <p className="font-medium text-vialto-charcoal">
                              {item.producto?.nombre ?? item.productoId}
                            </p>
                            {presentacion && (
                              <p className="mt-0.5 text-xs text-vialto-steel">
                                {presentacion}
                              </p>
                            )}
                          </div>
                        </td>
                        <td
                          className={`${listadoTablaTdClass} text-right tabular-nums`}
                        >
                          {stockTotalCell(
                            item,
                            units.unidad1,
                            false,
                            units.unidad2,
                          )}
                        </td>
                        <td
                          className={`${listadoTablaTdClass} text-right tabular-nums font-medium`}
                        >
                          {item.kg} kg
                        </td>
                        {showUnidad2 && (
                          <td
                            className={`${listadoTablaTdClass} text-right tabular-nums`}
                          >
                            {cantidad2Cell(item, units.unidad2)}
                          </td>
                        )}
                        <td className={`${listadoTablaTdClass} text-right`}>
                          <button
                            type="button"
                            onClick={() =>
                              setProductoDetalleModal({
                                productoId: item.productoId,
                                productoNombre:
                                  item.producto?.nombre ?? item.productoId,
                              })
                            }
                            className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <StockInventarioLotesDetalle
                          colSpan={colSpan}
                          showUnidad2={showUnidad2}
                          unidad1Nombre={units.unidad1}
                          unidad2Nombre={units.unidad2}
                          loading={!cache || Boolean(cache.loading)}
                          error={cache?.error ?? null}
                          filas={cache?.filas ?? null}
                          productoId={item.productoId}
                          clienteId={item.clienteId}
                          depositoId={item.depositoId}
                          tenantId={
                            isPlatform ? activeTenantId || undefined : undefined
                          }
                        />
                      )}
                    </Fragment>
                  );
                }}
                renderMobileCard={(item) => {
                  const sinStock = item.cantidad1 === 0 && item.cantidad2 === 0;
                  const clienteNombre = item.cliente?.nombre ?? item.clienteId;
                  const productoNombre =
                    item.producto?.nombre ?? item.productoId;
                  const expanded = expandedIds.has(item.id);
                  const cache = lotesCache[item.id];
                  const units = unidadNombres(item);
                  const presentacion = presentacionNombre(item);
                  const fields = [
                    {
                      label: "Producto",
                      value: (
                        <span className={sinStock ? "text-vialto-steel" : ""}>
                          {productoNombre}
                          {presentacion ? (
                            <span className="mt-0.5 block text-xs text-vialto-steel">
                              {presentacion}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      label: "Stock total",
                      value: cantidad1Cell(item, units.unidad1),
                    },
                  ];
                  if (showUnidad2) {
                    fields.push({
                      label: LABEL_SUELTOS,
                      value: cantidad2Cell(item, units.unidad2),
                    });
                  }
                  if (expanded) {
                    if (!cache || cache.loading) {
                      fields.push({
                        label: "Lotes",
                        value: (
                          <span className="text-vialto-steel">Cargando…</span>
                        ),
                      });
                    } else if (cache?.error) {
                      fields.push({
                        label: "Lotes",
                        value: (
                          <span className="text-red-700">{cache.error}</span>
                        ),
                      });
                    } else if (cache?.filas) {
                      for (const fila of cache.filas) {
                        fields.push({
                          label: fila.loteLabel,
                          value: (
                            <div className="space-y-1">
                              <p className="tabular-nums text-vialto-charcoal">
                                {fila.cantidad1} {units.unidad1}
                                {showUnidad2 && units.unidad2 != null
                                  ? ` · ${fila.cantidad2} ${units.unidad2}`
                                  : ""}
                              </p>
                              <div className="text-xs">
                                <span className="text-vialto-steel">Vto. </span>
                                <FechaVencimientoLote
                                  fechaVencimiento={fila.fechaVencimiento}
                                />
                              </div>
                              <Link
                                to={`/stock/movimientos?productoId=${encodeURIComponent(item.productoId)}&clienteId=${encodeURIComponent(item.clienteId)}&depositoId=${encodeURIComponent(item.depositoId)}&lote=${encodeURIComponent(fila.loteParam)}${isPlatform && activeTenantId ? `&tenantId=${encodeURIComponent(activeTenantId)}` : ""}`}
                                className={`${listadoTablaAccionClass} inline-flex`}
                              >
                                Ver movimiento
                              </Link>
                            </div>
                          ),
                        });
                      }
                    }
                  }
                  return (
                    <ListadoCard
                      primary={
                        <span className={sinStock ? "text-vialto-steel" : ""}>
                          {clienteNombre}
                        </span>
                      }
                      fields={fields}
                      actions={
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item)}
                            aria-expanded={expanded}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist transition-colors"
                          >
                            {expanded ? "Ocultar lotes" : "Ver lotes"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setProductoDetalleModal({
                                productoId: item.productoId,
                                productoNombre:
                                  item.producto?.nombre ?? item.productoId,
                              })
                            }
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist transition-colors"
                          >
                            Ver
                          </button>
                        </div>
                      }
                    />
                  );
                }}
              />

              {filteredItems.length > 0 && (
                <div className="mt-4">
                  <ListadoPagination
                    meta={meta}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={stockItemColumnas(filteredItems, productosDetalle)}
          rowCount={filteredItems.length}
          onExport={(selectedIds) => {
            const allCols = stockItemColumnas(filteredItems, productosDetalle);
            const cols = allCols.filter((c) => selectedIds.includes(c.id));
            const deposito = depositoActivo?.nombre ?? "inventario";
            generarExcel(cols, filteredItems, `inventario-${deposito}`);
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {productoModal.mode === "view" && (
        <ProductoModal
          modo="view"
          productoInicial={productoModal.producto}
          getToken={getToken}
          baseUrl={productosBase}
          tenantId={activeTenantId}
          onClose={() => setProductoModal({ mode: "closed" })}
          onSaved={() => {}}
          onEdit={
            puedeGestionar
              ? () =>
                  setProductoModal({
                    mode: "edit",
                    producto: productoModal.producto,
                  })
              : undefined
          }
        />
      )}

      {productoDetalleModal && (
        <StockProductoDetalleModal
          productoId={productoDetalleModal.productoId}
          productoNombre={productoDetalleModal.productoNombre}
          disponibleAgrupadoUrl={disponibleAgrupadoUrl}
          depositoId={depositoActivoId ?? ""}
          getToken={getToken}
          onClose={() => setProductoDetalleModal(null)}
        />
      )}

      {productoModal.mode === "edit" && (
        <ProductoModal
          modo="edit"
          productoInicial={productoModal.producto}
          getToken={getToken}
          baseUrl={productosBase}
          tenantId={activeTenantId}
          onClose={() => setProductoModal({ mode: "closed" })}
          onSaved={async () => {
            setProductoModal({ mode: "closed" });
            await load();
          }}
        />
      )}
    </div>
  );
}

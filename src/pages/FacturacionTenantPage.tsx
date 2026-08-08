import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/lib/toast";
import {
  emptyFacturaDraft,
  FacturaCreateModal,
  FacturaEditModal,
  facturaPayloadFromDraft,
  facturaToEditDraft,
  type FacturaDraft,
} from "@/components/facturacion/FacturaEditModal";
import { FacturaAccionesMenu } from "@/components/facturacion/FacturaAccionesMenu";
import { AnularFacturaModal } from "@/components/facturacion/AnularFacturaModal";
import { EmitirFacturaModal } from "@/components/facturacion/EmitirFacturaModal";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ClienteSearchSelect } from "@/components/forms/MaestroSearchSelects";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { apiJson } from "@/lib/api";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { friendlyError } from "@/lib/friendlyError";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useTenantsList } from "@/hooks/useTenantsList";
import { canAccessIntegracionArca } from "@/lib/tenantModules";
import {
  MSG_ARCA_NO_FACTURA_USD,
  arcaBloqueaFacturarUsd,
} from "@/lib/arcaUsdRestriction";
import { Landmark } from "lucide-react";
import {
  monedaUnicaDeViajes,
  textoImporteFacturaListado,
  viajesFiltradosParaFactura,
} from "@/lib/viajesFlota";
import {
  metaPaginacionCliente,
  pageSizeListadoValido,
  slicePaginaCliente,
} from "@/lib/listadoPaginacion";
import {
  listadoTablaBodyRowClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type {
  ArcaConfig,
  Cliente,
  Factura,
  PaginatedMeta,
  Transportista,
  Viaje,
} from "@/types/api";

type FacturasPaginatedResponse = {
  items: Factura[];
  meta: PaginatedMeta;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "PENDIENTE",
  cobrada: "COBRADA",
  vencida: "VENCIDA",
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-950 border-amber-300/90",
  cobrada: "bg-emerald-100 text-emerald-950 border-emerald-500/80",
  vencida: "bg-red-100 text-red-950 border-red-400/80",
};

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type FacturaNuevaNavState = {
  tenantId?: string;
  newFacturaDraft?: {
    clienteId: string;
    viajeIds: string[];
    letraComprobante?: "a" | "b";
  };
  expandFacturaId?: string;
  viewFacturaId?: string;
};

export function FacturacionTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
} = {}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());
  const tid = tenantId?.trim() ?? "";
  const tenantsList = useTenantsList({ enabled: platform });
  const platformTenant = useMemo(
    () =>
      platform
        ? tenantsList?.find((t) => t.clerkOrgId === tid || t.id === tid) ?? null
        : null,
    [platform, tenantsList, tid],
  );
  const tenantModules = platform
    ? (platformTenant?.modules ?? [])
    : (maestro.tenant?.modules ?? []);
  const hasArca = canAccessIntegracionArca(tenantModules);
  /** Adjunto manual solo para tenants sin integración ARCA (vista org, no plataforma). */
  const showComprobanteAdjunto = !platform && !hasArca;
  const [clientesPlatform, setClientesPlatform] = useState<Cliente[]>([]);
  const [transportistasPlatform, setTransportistasPlatform] = useState<
    Transportista[]
  >([]);
  const clientes = platform ? clientesPlatform : maestro.clientes;
  const transportistas = platform
    ? transportistasPlatform
    : maestro.transportistas;

  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  useEffect(() => {
    if (!hasArca || (platform && !tid) || (!platform && (!isLoaded || !isSignedIn))) {
      setArcaConfig(null);
      return;
    }
    let cancelled = false;
    const configUrl = platform
      ? `/api/platform/arca/config?tenantId=${encodeURIComponent(tid)}`
      : "/api/integracion-arca/config";
    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig | null>(configUrl, () => getToken());
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        if (!cancelled) setArcaConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasArca, platform, tid, isLoaded, isSignedIn, getToken]);

  const facturasListUrl = useMemo(() => {
    if (!platform) return "/api/facturacion/facturas";
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}`;
  }, [platform, tid]);

  const viajesListUrl = useMemo(() => {
    if (!platform) return "/api/viajes";
    return `/api/platform/viajes?tenantId=${encodeURIComponent(tid)}`;
  }, [platform, tid]);

  function marcarCobradaUrl(id: string) {
    return platform
      ? `/api/platform/facturas/${encodeURIComponent(id)}/marcar-cobrada?tenantId=${encodeURIComponent(tid)}`
      : `/api/facturacion/facturas/${encodeURIComponent(id)}/marcar-cobrada`;
  }

  function facturaUrl(id: string) {
    if (!platform) return `/api/facturacion/facturas/${encodeURIComponent(id)}`;
    return `/api/platform/facturas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tid)}`;
  }

  function facturasCreateUrl() {
    if (!platform) return "/api/facturacion/facturas";
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}`;
  }

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FacturaDraft>(emptyFacturaDraft());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FacturaDraft | null>(null);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [facturaDeleteConfirm, setFacturaDeleteConfirm] =
    useState<Factura | null>(null);
  const [marcandoCobradaId, setMarcandoCobradaId] = useState<string | null>(
    null,
  );
  const [marcarCobradaConfirm, setMarcarCobradaConfirm] =
    useState<Factura | null>(null);
  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);
  const [emittingFactura, setEmittingFactura] = useState<Factura | null>(null);
  const [anularFactura, setAnularFactura] = useState<Factura | null>(null);
  const [previewComprobanteUrl, setPreviewComprobanteUrl] = useState<
    string | null
  >(null);

  const [numFiltro, setNumFiltro] = useState("");
  const [numFiltroInput, setNumFiltroInput] = useState("");
  const [clienteIdFiltro, setClienteIdFiltro] = useState("");
  const [emisionDesdeFiltro, setEmisionDesdeFiltro] = useState("");
  const [emisionHastaFiltro, setEmisionHastaFiltro] = useState("");
  const [vencimientoDesdeFiltro, setVencimientoDesdeFiltro] = useState("");
  const [vencimientoHastaFiltro, setVencimientoHastaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const fetchRef = useRef(0);
  const expandFacturaHandledRef = useRef(false);
  const viewFacturaHandledRef = useRef(false);

  const viajesNuevaFactura = useMemo(() => {
    const list = viajesFiltradosParaFactura(
      viajes,
      draft.tipo,
      draft.clienteId,
      draft.transportistaId,
    );
    if (!hasArca) return list;
    return list.filter((v) => !arcaBloqueaFacturarUsd(true, v.monedaMonto));
  }, [viajes, draft.tipo, draft.clienteId, draft.transportistaId, hasArca]);

  const viajesEdicionFactura = useMemo(() => {
    if (!editDraft || !editingId) return [];
    const list = viajesFiltradosParaFactura(
      viajes,
      editDraft.tipo,
      editDraft.clienteId,
      editDraft.transportistaId,
      {
        facturaEdicionId: editingId,
        viajeIdsFacturaEdicion: editDraft.viajeIds,
      },
    );
    if (!hasArca) return list;
    return list.filter(
      (v) =>
        editDraft.viajeIds.includes(v.id) ||
        !arcaBloqueaFacturarUsd(true, v.monedaMonto),
    );
  }, [viajes, editDraft, editingId, hasArca]);

  const facturaEdicionSnapshot = useMemo(
    () =>
      editingId && facturas
        ? (facturas.find((r) => r.id === editingId) ?? null)
        : null,
    [editingId, facturas],
  );

  useEffect(() => {
    if (!platform || !tid || !isLoaded || !isSignedIn) {
      setClientesPlatform([]);
      setTransportistasPlatform([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [c, t] = await Promise.all([
          apiJson<Cliente[]>(
            `/api/platform/clientes?tenantId=${encodeURIComponent(tid)}`,
            () => getToken(),
          ),
          apiJson<Transportista[]>(
            `/api/platform/transportistas?tenantId=${encodeURIComponent(tid)}`,
            () => getToken(),
          ),
        ]);
        if (!cancelled) {
          setClientesPlatform(c);
          setTransportistasPlatform(t);
        }
      } catch {
        if (!cancelled) {
          setClientesPlatform([]);
          setTransportistasPlatform([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, tid, isLoaded, isSignedIn, getToken]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (numFiltro.trim()) n += 1;
    if (clienteIdFiltro) n += 1;
    if (emisionDesdeFiltro || emisionHastaFiltro) n += 1;
    if (vencimientoDesdeFiltro || vencimientoHastaFiltro) n += 1;
    if (estadoFiltro) n += 1;
    return n;
  }, [
    numFiltro,
    clienteIdFiltro,
    emisionDesdeFiltro,
    emisionHastaFiltro,
    vencimientoDesdeFiltro,
    vencimientoHastaFiltro,
    estadoFiltro,
  ]);

  const anyFiltroActivo = activeFilterCount > 0;

  const facturasFiltradas = useMemo(() => {
    if (!platform || !facturas) return null;
    return facturas.filter((f) => {
      if (
        numFiltro.trim() &&
        !f.numero.toLowerCase().includes(numFiltro.trim().toLowerCase())
      )
        return false;
      if (clienteIdFiltro && f.clienteId !== clienteIdFiltro) return false;
      const emision = f.fechaEmision ? f.fechaEmision.substring(0, 10) : "";
      if (emisionDesdeFiltro && emision < emisionDesdeFiltro) return false;
      if (emisionHastaFiltro && emision > emisionHastaFiltro) return false;
      const vence = f.fechaVencimiento
        ? f.fechaVencimiento.substring(0, 10)
        : "";
      if (vencimientoDesdeFiltro && (!vence || vence < vencimientoDesdeFiltro))
        return false;
      if (vencimientoHastaFiltro && (!vence || vence > vencimientoHastaFiltro))
        return false;
      if (estadoFiltro && f.estado !== estadoFiltro) return false;
      return true;
    });
  }, [
    platform,
    facturas,
    numFiltro,
    clienteIdFiltro,
    emisionDesdeFiltro,
    emisionHastaFiltro,
    vencimientoDesdeFiltro,
    vencimientoHastaFiltro,
    estadoFiltro,
  ]);

  const metaListado = useMemo(() => {
    if (platform) {
      const total = facturasFiltradas?.length ?? 0;
      return metaPaginacionCliente(total, page, pageSize);
    }
    return meta;
  }, [platform, facturasFiltradas, page, pageSize, meta]);

  const filasListado = useMemo(() => {
    if (platform) {
      if (facturasFiltradas === null) return null;
      return slicePaginaCliente(facturasFiltradas, page, pageSize);
    }
    return facturas;
  }, [platform, facturasFiltradas, facturas, page, pageSize]);

  useEffect(() => {
    if (!creating || viajes.length === 0) return;
    const allowed = new Set(viajesNuevaFactura.map((v) => v.id));
    setDraft((d) => {
      const next = d.viajeIds.filter((id) => allowed.has(id));
      if (next.length === d.viajeIds.length) return d;
      return { ...d, viajeIds: next };
    });
  }, [creating, viajes.length, viajesNuevaFactura]);

  useEffect(() => {
    if (!editingId || !editDraft || viajes.length === 0) return;
    const allowed = new Set(viajesEdicionFactura.map((v) => v.id));
    setEditDraft((ed) => {
      if (!ed) return ed;
      const next = ed.viajeIds.filter((id) => allowed.has(id));
      if (next.length === ed.viajeIds.length) return ed;
      return { ...ed, viajeIds: next };
    });
  }, [
    editingId,
    editDraft?.clienteId,
    editDraft?.transportistaId,
    editDraft?.tipo,
    viajes.length,
    viajesEdicionFactura,
  ]);

  function buildFacturasPaginatedQuery(pageApi: number, pageSizeApi: number) {
    const params = new URLSearchParams();
    params.set("page", String(pageApi));
    params.set("pageSize", String(pageSizeApi));
    if (numFiltro.trim()) params.set("numero", numFiltro.trim());
    if (clienteIdFiltro) params.set("clienteId", clienteIdFiltro);
    if (emisionDesdeFiltro) params.set("emisionDesde", emisionDesdeFiltro);
    if (emisionHastaFiltro) params.set("emisionHasta", emisionHastaFiltro);
    if (vencimientoDesdeFiltro)
      params.set("vencimientoDesde", vencimientoDesdeFiltro);
    if (vencimientoHastaFiltro)
      params.set("vencimientoHasta", vencimientoHastaFiltro);
    if (estadoFiltro) params.set("estado", estadoFiltro);
    return params.toString();
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (platform && !tid) return;
    let cancelled = false;
    (async () => {
      try {
        if (platform) {
          const facturasData = await apiJson<Factura[]>(facturasListUrl, () =>
            getToken(),
          );
          if (!cancelled) {
            setFacturas(facturasData);
            setMeta(null);
            setError(null);
            setListadoRefetching(false);
          }
          return;
        }

        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeListadoValido(pageSize);
        const data = await apiJson<FacturasPaginatedResponse>(
          `/api/facturacion/facturas/paginated?${buildFacturasPaginatedQuery(pageApi, pageSizeApi)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setFacturas(data.items);
          setMeta(data.meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setFacturas(null);
          setMeta(null);
          setError(friendlyError(e, platform ? "plataforma" : "facturacion"));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    facturasListUrl,
    platform,
    tid,
    page,
    pageSize,
    numFiltro,
    clienteIdFiltro,
    emisionDesdeFiltro,
    emisionHastaFiltro,
    vencimientoDesdeFiltro,
    vencimientoHastaFiltro,
    estadoFiltro,
  ]);

  useEffect(() => {
    const id = searchParams.get("factura")?.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const f = await apiJson<Factura>(facturaUrl(id), () => getToken());
        if (cancelled) return;
        setViewingFactura(f);
        setSearchParams(
          (p) => {
            const next = new URLSearchParams(p);
            next.delete("factura");
            return next;
          },
          { replace: true },
        );
      } catch {
        if (!cancelled) {
          setSearchParams(
            (p) => {
              const next = new URLSearchParams(p);
              next.delete("factura");
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
  }, [searchParams, setSearchParams]);

  async function ensureViajesLoaded() {
    if (viajes.length > 0 || viajesLoading) return;
    setViajesLoading(true);
    try {
      const data = await apiJson<Viaje[]>(viajesListUrl, () => getToken());
      setViajes(data);
    } catch {
    } finally {
      setViajesLoading(false);
    }
  }

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (!state) return;
    if (state.expandFacturaId?.trim()) return;
    if (!state.newFacturaDraft) return;
    const { clienteId, viajeIds, letraComprobante } = state.newFacturaDraft;
    setDraft({
      ...emptyFacturaDraft(),
      clienteId: clienteId ?? "",
      viajeIds: viajeIds ?? [],
      letraComprobante: letraComprobante ?? null,
    });
    setCreating(true);
    void ensureViajesLoaded();
    window.history.replaceState({}, "");
  }, []);

  useEffect(() => {
    const expand = (
      location.state as FacturaNuevaNavState | null
    )?.expandFacturaId?.trim();
    if (!expand || expandFacturaHandledRef.current) return;
    expandFacturaHandledRef.current = true;
    window.history.replaceState({}, "");
    void (async () => {
      try {
        const f = await apiJson<Factura>(facturaUrl(expand), () => getToken());
        startEdit(f);
      } catch {}
    })();
  }, [location.state, getToken]);

  useEffect(() => {
    const viewId = (
      location.state as FacturaNuevaNavState | null
    )?.viewFacturaId?.trim();
    if (!viewId || viewFacturaHandledRef.current) return;
    viewFacturaHandledRef.current = true;
    window.history.replaceState({}, "");
    void (async () => {
      try {
        const f = await apiJson<Factura>(facturaUrl(viewId), () => getToken());
        setViewingFactura(f);
      } catch {}
    })();
  }, [location.state, getToken]);

  async function refetchFacturas() {
    const gen = ++fetchRef.current;
    try {
      if (platform) {
        const data = await apiJson<Factura[]>(facturasListUrl, () =>
          getToken(),
        );
        if (gen === fetchRef.current) setFacturas(data);
        return;
      }
      const pageApi = Math.max(1, Math.floor(page));
      const pageSizeApi = pageSizeListadoValido(pageSize);
      const data = await apiJson<FacturasPaginatedResponse>(
        `/api/facturacion/facturas/paginated?${buildFacturasPaginatedQuery(pageApi, pageSizeApi)}`,
        () => getToken(),
      );
      if (gen === fetchRef.current) {
        setFacturas(data.items);
        setMeta(data.meta);
      }
    } catch {}
  }

  async function resolveComprobanteUrl(
    d: FacturaDraft,
  ): Promise<string | null | undefined> {
    if (!showComprobanteAdjunto) return undefined;
    if (d.comprobanteFile) {
      return uploadComprobante(
        () => getToken(),
        d.comprobanteFile,
        "facturacion",
      );
    }
    return d.comprobanteUrl;
  }

  async function handleCreate() {
    setDraftError(null);
    if (!draft.numero.trim()) {
      setDraftError("Ingresá el número de factura.");
      return;
    }
    if (!draft.fechaEmision) {
      setDraftError("Ingresá la fecha de emisión.");
      return;
    }
    if (monedaUnicaDeViajes(draft.viajeIds, viajes) === null) {
      setDraftError(
        "Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.",
      );
      return;
    }
    if (
      hasArca &&
      draft.viajeIds.some((id) => {
        const v = viajes.find((x) => x.id === id);
        return v ? arcaBloqueaFacturarUsd(true, v.monedaMonto) : false;
      })
    ) {
      setDraftError(MSG_ARCA_NO_FACTURA_USD);
      return;
    }
    setSaving(true);
    try {
      const comprobanteUrl = await resolveComprobanteUrl(draft);
      await apiJson<Factura>(facturasCreateUrl(), () => getToken(), {
        method: "POST",
        body: JSON.stringify(facturaPayloadFromDraft(draft, comprobanteUrl)),
      });
      showToast("Factura creada exitosamente", "success");
      setCreating(false);
      setDraft(emptyFacturaDraft());
      await refetchFacturas();
    } catch (e) {
      setDraftError(
        e instanceof Error ? e.message : "No se pudo guardar la factura.",
      );
      showToast("No se pudo crear la factura", "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(f: Factura) {
    setEditError(null);
    setEditingId(f.id);
    setEditDraft(facturaToEditDraft(f));
    setCreating(false);
    void ensureViajesLoaded();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    setEditError(null);
    if (!editDraft.numero.trim()) {
      setEditError("Ingresá el número de factura.");
      return;
    }
    if (!editDraft.fechaEmision) {
      setEditError("Ingresá la fecha de emisión.");
      return;
    }
    if (monedaUnicaDeViajes(editDraft.viajeIds, viajes) === null) {
      setEditError(
        "Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.",
      );
      return;
    }
    setSavingEditId(editingId);
    try {
      const comprobanteUrl = await resolveComprobanteUrl(editDraft);
      const updated = await apiJson<Factura>(
        facturaUrl(editingId),
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify(
            facturaPayloadFromDraft(editDraft, comprobanteUrl),
          ),
        },
      );
      setFacturas((prev) =>
        prev ? prev.map((r) => (r.id === editingId ? updated : r)) : prev,
      );
      showToast("Factura actualizada exitosamente", "success");
      cancelEdit();
      if (!platform) void refetchFacturas();
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "No se pudo guardar la factura.",
      );
      showToast("No se pudo actualizar la factura", "error");
    } finally {
      setSavingEditId(null);
    }
  }

  async function confirmDeleteFactura() {
    const f = facturaDeleteConfirm;
    if (!f || deletingId) return;
    setDeletingId(f.id);
    try {
      await apiJson(facturaUrl(f.id), () => getToken(), { method: "DELETE" });
      showToast("Factura eliminada correctamente", "success");
      if (platform) {
        setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      } else if (meta && facturas?.length === 1 && meta.page > 1) {
        setPage(meta.page - 1);
      } else {
        await refetchFacturas();
      }
      if (editingId === f.id) cancelEdit();
      setFacturaDeleteConfirm(null);
    } catch {
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function puedeMarcarCobrada(f: Factura) {
    return f.tipo === "cliente" && f.arcaEstado !== "anulado";
  }

  function abrirMarcarCobrada(f: Factura) {
    if (f.estado === "cobrada") {
      showToast("Esta factura ya está cobrada.", "success");
      return;
    }
    setMarcarCobradaConfirm(f);
  }

  async function confirmMarcarCobrada() {
    const f = marcarCobradaConfirm;
    if (!f || marcandoCobradaId) return;
    setMarcandoCobradaId(f.id);
    try {
      const res = await apiJson<{ yaCobrada: boolean; factura: Factura }>(
        marcarCobradaUrl(f.id),
        () => getToken(),
        { method: "POST" },
      );
      setMarcarCobradaConfirm(null);
      if (res.yaCobrada) {
        showToast("Esta factura ya está cobrada.", "success");
        return;
      }
      const cantViajes = res.factura.viajeIds?.length ?? 0;
      showToast(
        cantViajes > 0
          ? `Factura marcada como cobrada. ${cantViajes} viaje${cantViajes === 1 ? "" : "s"} vinculado${cantViajes === 1 ? "" : "s"} actualizado${cantViajes === 1 ? "" : "s"} a "Cobrado".`
          : "Factura marcada como cobrada.",
        "success",
      );
      if (platform) {
        setFacturas((prev) =>
          prev?.map((r) => (r.id === f.id ? res.factura : r)) ?? prev,
        );
      } else {
        await refetchFacturas();
      }
    } catch (e) {
      showToast(friendlyError(e, "facturacion"), "error");
    } finally {
      setMarcandoCobradaId(null);
    }
  }

  function nombreCliente(id: string | null | undefined) {
    if (!id) return "—";
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  function clienteById(id: string | null | undefined) {
    if (!id) return null;
    return clientes.find((c) => c.id === id) ?? null;
  }

  function abrirEmitirArca(f: Factura) {
    setViewingFactura(null);
    setAnularFactura(null);
    setEmittingFactura(f);
  }

  function abrirAnularFactura(f: Factura) {
    setViewingFactura(null);
    setEmittingFactura(null);
    setAnularFactura(f);
  }

  function handleFacturaEmitida(f: Factura) {
    setFacturas((prev) =>
      prev ? prev.map((row) => (row.id === f.id ? { ...row, ...f } : row)) : prev,
    );
    if (viewingFactura?.id === f.id) setViewingFactura(f);
    setEmittingFactura(f);
  }

  function handleFacturaAnulada(f: Factura) {
    setFacturas((prev) =>
      prev ? prev.map((row) => (row.id === f.id ? { ...row, ...f } : row)) : prev,
    );
    if (viewingFactura?.id === f.id) setViewingFactura(f);
    setAnularFactura(f);
  }

  function verComprobanteUrl(url: string | null | undefined) {
    if (url?.trim()) setPreviewComprobanteUrl(url);
  }

  function verNotaCredito(f: Factura) {
    if (f.notaCreditoUrl?.trim()) {
      setPreviewComprobanteUrl(f.notaCreditoUrl);
      return;
    }
    // Sin URL en Cloudinary aún: abrir el modal de anulación en modo ya-anulada
    // (permite descargar el PDF generado on-demand).
    abrirAnularFactura(f);
  }

  function nombreContraparte(f: Factura) {
    return nombreCliente(f.clienteId);
  }

  function limpiarFiltros() {
    setNumFiltro("");
    setNumFiltroInput("");
    setClienteIdFiltro("");
    setEmisionDesdeFiltro("");
    setEmisionHastaFiltro("");
    setVencimientoDesdeFiltro("");
    setVencimientoHastaFiltro("");
    setEstadoFiltro("");
    setListadoRefetching(true);
    setPage(1);
  }

  function irAPagina(nuevaPagina: number) {
    if (!platform) setListadoRefetching(true);
    setPage(Math.max(1, nuevaPagina));
  }

  function cambiarPageSize(nuevoSize: number) {
    if (!platform) setListadoRefetching(true);
    setPageSize(nuevoSize);
    setPage(1);
  }

  function aplicarFiltroNumero() {
    setListadoRefetching(true);
    setNumFiltro(numFiltroInput);
    setPage(1);
  }

  const facturasEmptyMessage =
    (metaListado?.total ?? 0) === 0 &&
    !anyFiltroActivo &&
    !(platform && (facturas?.length ?? 0) > 0)
      ? 'Todavía no hay facturas. Hacé clic en "Nueva factura" para empezar.'
      : "No hay facturas que coincidan con los filtros aplicados.";

  const facturasListadoFiltros = (
    <>
      <ListadoFiltroCampo label="Número" active={!!numFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={numFiltroInput}
            onChange={(e) => setNumFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") aplicarFiltroNumero();
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              numFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por número de factura"
          />
          <button
            type="button"
            onClick={() => aplicarFiltroNumero()}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Cliente" active={!!clienteIdFiltro}>
        <ClienteSearchSelect
          id="facturas-filtro-cliente"
          clientes={clientes}
          value={clienteIdFiltro}
          onChange={(id) => {
            setListadoRefetching(true);
            setPage(1);
            setClienteIdFiltro(id);
          }}
          allowEmptyValue
          emptyListChoiceLabel="Todos"
          placeholderCerrado="Todos"
          aria-label="Filtrar por cliente"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            clienteIdFiltro ? "text-vialto-fire" : "text-vialto-charcoal"
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Emisión"
        active={!!emisionDesdeFiltro || !!emisionHastaFiltro}
      >
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
            Desde
            <input
              type="date"
              value={emisionDesdeFiltro}
              onChange={(e) => {
                setListadoRefetching(true);
                setPage(1);
                setEmisionDesdeFiltro(e.target.value);
              }}
              className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
            Hasta
            <input
              type="date"
              value={emisionHastaFiltro}
              onChange={(e) => {
                setListadoRefetching(true);
                setPage(1);
                setEmisionHastaFiltro(e.target.value);
              }}
              className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
            />
          </label>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo
        label="Vencimiento"
        active={!!vencimientoDesdeFiltro || !!vencimientoHastaFiltro}
      >
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
            Desde
            <input
              type="date"
              value={vencimientoDesdeFiltro}
              onChange={(e) => {
                setListadoRefetching(true);
                setPage(1);
                setVencimientoDesdeFiltro(e.target.value);
              }}
              className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
            Hasta
            <input
              type="date"
              value={vencimientoHastaFiltro}
              onChange={(e) => {
                setListadoRefetching(true);
                setPage(1);
                setVencimientoHastaFiltro(e.target.value);
              }}
              className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
            />
          </label>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Estado" active={!!estadoFiltro}>
        <select
          value={estadoFiltro}
          onChange={(e) => {
            setListadoRefetching(true);
            setPage(1);
            setEstadoFiltro(e.target.value);
          }}
          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            estadoFiltro ? "text-vialto-fire" : "text-vialto-charcoal"
          }`}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="cobrada">Cobrada</option>
          <option value="vencida">Vencida</option>
        </select>
      </ListadoFiltroCampo>
    </>
  );

  return (
    <div className="w-full">
      {!embeddedInSuperadmin && (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
            Facturas
          </h1>
          <p className="mt-2 text-vialto-steel">
            Facturas emitidas a clientes.
          </p>
          {hasArca && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
                <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                Emisión electrónica vía ARCA
              </div>
              <AmbienteTestBadge ambiente={arcaConfig?.ambiente} />
            </div>
          )}
        </>
      )}

      {embeddedInSuperadmin && hasArca && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            Emisión electrónica vía ARCA
          </div>
          <AmbienteTestBadge ambiente={arcaConfig?.ambiente} />
        </div>
      )}

      <div className="mt-4">
        {error && <CrudFormErrorAlert message={error} />}
        <div className="flex justify-end gap-2 mt-2">
          {anyFiltroActivo && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              Limpiar filtros
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(emptyFacturaDraft());
              setDraftError(null);
              void ensureViajesLoaded();
              setCreating(true);
            }}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Nueva factura
          </button>
        </div>
      </div>

      <ListadoDatos
        className="mt-6"
        columns={[]}
        rows={error ? [] : filasListado}
        rowKey={(f) => f.id}
        emptyMessage={
          error ? "No se pudieron cargar las facturas." : facturasEmptyMessage
        }
        loadingMessage="Cargando…"
        tableColSpan={7}
        filters={facturasListadoFiltros}
        activeFilterCount={activeFilterCount}
        onClearFilters={limpiarFiltros}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Número"
                filterActive={!!numFiltro.trim()}
                filterSignature={numFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={numFiltroInput}
                    onChange={(e) => setNumFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") aplicarFiltroNumero();
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      numFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por número de factura"
                  />
                  <button
                    type="button"
                    onClick={() => aplicarFiltroNumero()}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Cliente"
                filterActive={!!clienteIdFiltro}
                filterSignature={clienteIdFiltro}
              >
                <ClienteSearchSelect
                  id="facturas-col-filtro-cliente"
                  clientes={clientes}
                  value={clienteIdFiltro}
                  onChange={(id) => {
                    setListadoRefetching(true);
                    setPage(1);
                    setClienteIdFiltro(id);
                  }}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  aria-label="Filtrar por cliente"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    clienteIdFiltro
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Emisión"
                filterActive={!!emisionDesdeFiltro || !!emisionHastaFiltro}
                filterSignature={`${emisionDesdeFiltro}|${emisionHastaFiltro}`}
              >
                <div className="flex flex-col gap-1.5">
                  <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Desde
                    <input
                      type="date"
                      value={emisionDesdeFiltro}
                      onChange={(e) => {
                        setListadoRefetching(true);
                        setPage(1);
                        setEmisionDesdeFiltro(e.target.value);
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input
                      type="date"
                      value={emisionHastaFiltro}
                      onChange={(e) => {
                        setListadoRefetching(true);
                        setPage(1);
                        setEmisionHastaFiltro(e.target.value);
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Vencimiento"
                filterActive={
                  !!vencimientoDesdeFiltro || !!vencimientoHastaFiltro
                }
                filterSignature={`${vencimientoDesdeFiltro}|${vencimientoHastaFiltro}`}
              >
                <div className="flex flex-col gap-1.5">
                  <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Desde
                    <input
                      type="date"
                      value={vencimientoDesdeFiltro}
                      onChange={(e) => {
                        setListadoRefetching(true);
                        setPage(1);
                        setVencimientoDesdeFiltro(e.target.value);
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input
                      type="date"
                      value={vencimientoHastaFiltro}
                      onChange={(e) => {
                        setListadoRefetching(true);
                        setPage(1);
                        setVencimientoHastaFiltro(e.target.value);
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={!!estadoFiltro}
                filterSignature={estadoFiltro}
              >
                <select
                  value={estadoFiltro}
                  onChange={(e) => {
                    setListadoRefetching(true);
                    setPage(1);
                    setEstadoFiltro(e.target.value);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    estadoFiltro ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por estado"
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="cobrada">Cobrada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Importe
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        renderTableRow={(f) => (
          <tr key={f.id} className={listadoTablaBodyRowClass}>
            <td className="px-4 py-3 font-medium break-all">{f.numero}</td>
            <td className="px-4 py-3 truncate" title={nombreContraparte(f)}>
              {nombreContraparte(f)}
            </td>
            <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
              {fmtFecha(f.fechaEmision)}
            </td>
            <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
              {fmtFecha(f.fechaVencimiento)}
            </td>
            <td className="px-4 py-3">
              {puedeMarcarCobrada(f) ? (
                <button
                  type="button"
                  onClick={() => abrirMarcarCobrada(f)}
                  title="Marcar como cobrada"
                  className={[
                    "border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap cursor-pointer hover:brightness-95",
                    ESTADO_BADGE[f.estado] ?? "",
                  ].join(" ")}
                >
                  {ESTADO_LABEL[f.estado] ?? f.estado}
                </button>
              ) : (
                <span
                  className={[
                    "border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    ESTADO_BADGE[f.estado] ?? "",
                  ].join(" ")}
                >
                  {ESTADO_LABEL[f.estado] ?? f.estado}
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
              {textoImporteFacturaListado(f, viajes)}
            </td>
            <td className="px-4 py-3 text-right">
              <FacturaAccionesMenu
                factura={f}
                deleting={deletingId === f.id}
                hasArca={hasArca}
                onVer={() => setViewingFactura(f)}
                onEliminar={() => setFacturaDeleteConfirm(f)}
                onMarcarCobrada={() => abrirMarcarCobrada(f)}
                onEmitirArca={hasArca ? () => abrirEmitirArca(f) : undefined}
                onAnular={hasArca ? () => abrirAnularFactura(f) : undefined}
                onVerComprobante={
                  f.comprobanteUrl
                    ? () => verComprobanteUrl(f.comprobanteUrl)
                    : undefined
                }
                onVerNotaCredito={
                  hasArca && f.arcaEstado === "anulado"
                    ? () => verNotaCredito(f)
                    : undefined
                }
              />
            </td>
          </tr>
        )}
        renderMobileCard={(f) => (
          <ListadoCard
            primary={f.numero}
            fields={[
              { label: "Cliente", value: nombreContraparte(f) },
              { label: "Emisión", value: fmtFecha(f.fechaEmision) },
              { label: "Vencimiento", value: fmtFecha(f.fechaVencimiento) },
              {
                label: "Estado",
                value: puedeMarcarCobrada(f) ? (
                  <button
                    type="button"
                    onClick={() => abrirMarcarCobrada(f)}
                    title="Marcar como cobrada"
                    className={[
                      "border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap cursor-pointer hover:brightness-95",
                      ESTADO_BADGE[f.estado] ?? "",
                    ].join(" ")}
                  >
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </button>
                ) : (
                  <span
                    className={[
                      "border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      ESTADO_BADGE[f.estado] ?? "",
                    ].join(" ")}
                  >
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </span>
                ),
              },
              {
                label: "Importe",
                value: textoImporteFacturaListado(f, viajes),
              },
            ]}
            actions={
              <FacturaAccionesMenu
                factura={f}
                deleting={deletingId === f.id}
                hasArca={hasArca}
                onVer={() => setViewingFactura(f)}
                onEliminar={() => setFacturaDeleteConfirm(f)}
                onMarcarCobrada={() => abrirMarcarCobrada(f)}
                onEmitirArca={hasArca ? () => abrirEmitirArca(f) : undefined}
                onAnular={hasArca ? () => abrirAnularFactura(f) : undefined}
                onVerComprobante={
                  f.comprobanteUrl
                    ? () => verComprobanteUrl(f.comprobanteUrl)
                    : undefined
                }
                onVerNotaCredito={
                  hasArca && f.arcaEstado === "anulado"
                    ? () => verNotaCredito(f)
                    : undefined
                }
              />
            }
          />
        )}
      />

      {metaListado && metaListado.total > 0 && (
        <ListadoPagination
          meta={metaListado}
          pageSize={pageSize}
          loading={listadoRefetching}
          totalLabel="facturas"
          onPageChange={irAPagina}
          onPageSizeChange={cambiarPageSize}
        />
      )}

      <FacturaCreateModal
        open={creating}
        draft={draft}
        setDraft={setDraft}
        clientes={clientes}
        transportistas={transportistas}
        viajes={viajes}
        viajesNueva={viajesNuevaFactura}
        viajesLoading={viajesLoading}
        onClose={() => {
          setCreating(false);
          setDraftError(null);
        }}
        onSave={() => void handleCreate()}
        saving={saving}
        error={draftError}
        showComprobanteAdjunto={showComprobanteAdjunto}
      />

      {viewingFactura && (
        <FacturaViewModal
          factura={viewingFactura}
          clienteNombre={nombreCliente(viewingFactura.clienteId)}
          cliente={clienteById(viewingFactura.clienteId)}
          hasArca={hasArca}
          onClose={() => setViewingFactura(null)}
          onEditar={() => {
            const f = viewingFactura;
            setViewingFactura(null);
            startEdit(f);
          }}
          onEmitirArca={
            hasArca ? () => abrirEmitirArca(viewingFactura) : undefined
          }
          onAnular={
            hasArca ? () => abrirAnularFactura(viewingFactura) : undefined
          }
          onVerComprobante={
            viewingFactura.comprobanteUrl
              ? () => verComprobanteUrl(viewingFactura.comprobanteUrl)
              : undefined
          }
          onVerNotaCredito={
            hasArca && viewingFactura.arcaEstado === "anulado"
              ? () => verNotaCredito(viewingFactura)
              : undefined
          }
          onMarcarCobrada={() => abrirMarcarCobrada(viewingFactura)}
        />
      )}

      {emittingFactura && (
        <EmitirFacturaModal
          factura={emittingFactura}
          viajes={viajes}
          tenantId={platform ? tid : undefined}
          clienteInicial={clienteById(emittingFactura.clienteId)}
          onClose={() => setEmittingFactura(null)}
          onEmitido={(f) => {
            handleFacturaEmitida(f);
          }}
        />
      )}

      {anularFactura && (
        <AnularFacturaModal
          factura={anularFactura}
          viajes={viajes}
          tenantId={platform ? tid : undefined}
          clienteInicial={clienteById(anularFactura.clienteId)}
          onClose={() => setAnularFactura(null)}
          onAnulada={handleFacturaAnulada}
        />
      )}

      {editingId && editDraft && facturaEdicionSnapshot && (
        <FacturaEditModal
          open
          draft={editDraft}
          setDraft={setEditDraft}
          snapshotFactura={facturaEdicionSnapshot}
          clientes={clientes}
          transportistas={transportistas}
          viajes={viajes}
          viajesEdicion={viajesEdicionFactura}
          viajesLoading={viajesLoading}
          onClose={cancelEdit}
          onSave={() => void saveEdit()}
          saving={savingEditId === editingId}
          error={editError}
          showComprobanteAdjunto={showComprobanteAdjunto}
        />
      )}

      <ConfirmDialog
        open={facturaDeleteConfirm != null}
        title="Eliminar factura"
        message={
          facturaDeleteConfirm
            ? `¿Eliminás la factura ${facturaDeleteConfirm.numero}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={
          !!deletingId &&
          facturaDeleteConfirm != null &&
          deletingId === facturaDeleteConfirm.id
        }
        onCancel={() => {
          if (!deletingId) setFacturaDeleteConfirm(null);
        }}
        onConfirm={() => void confirmDeleteFactura()}
      />

      <ConfirmDialog
        open={marcarCobradaConfirm != null}
        title="Marcar como cobrada"
        message={
          marcarCobradaConfirm
            ? `¿Marcás la factura ${marcarCobradaConfirm.numero} como cobrada? Se va a registrar el pago del saldo pendiente y todos los viajes vinculados van a pasar a "Cobrado".`
            : ""
        }
        confirmLabel="Marcar como cobrada"
        busy={
          !!marcandoCobradaId &&
          marcarCobradaConfirm != null &&
          marcandoCobradaId === marcarCobradaConfirm.id
        }
        onCancel={() => {
          if (!marcandoCobradaId) setMarcarCobradaConfirm(null);
        }}
        onConfirm={() => void confirmMarcarCobrada()}
      />

      {previewComprobanteUrl && (
        <AdjuntoPreviewModal
          url={previewComprobanteUrl}
          title="Comprobante"
          onClose={() => setPreviewComprobanteUrl(null)}
        />
      )}
    </div>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { ViajeKmLitrosDialog } from '@/components/viajes/ViajeKmLitrosDialog';
import { apiJson } from '@/lib/api';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { flotaPropiaListaValida, normalizarIdEnLista, textoMontoFacturarListado } from '@/lib/viajesFlota';
import { esEtiquetaCiudadValida, inferirPaisDesdeUbicacion, type PaisCodigo } from '@/lib/ciudades';
import {
  estadoViajeBadgeClass,
  estadoViajeBadgeClassDefault,
  estadoViajeLabel,
  estadoMuestraKmLitros,
  draftKmLitrosVacios,
  parseKmLitrosOpcionales,
  viajeTieneKmYLitrosEnApi,
  VIAJE_ESTADOS_TODOS,
} from '@/lib/viajesEstados';
import type { Chofer, Cliente, PaginatedMeta, Transportista, Vehiculo, Viaje } from '@/types/api';

const ESTADOS = VIAJE_ESTADOS_TODOS;

type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculoId: string;
  patenteTractor: string;
  patenteSemirremolque: string;
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  fechaCarga: string;
  fechaDescarga: string;
  mercaderia: string;
  observaciones: string;
  monto: string;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  documentacionCsv: string;
};

type ViajesPaginatedResponse = {
  items: Viaje[];
  meta: PaginatedMeta;
};

type KmLitrosPrompt =
  | { kind: 'quick'; viaje: Viaje; nuevoEstado: string }
  | { kind: 'save'; viajeId: string }
  | { kind: 'estado-draft'; nextEstado: string };

type SaveInlineKmOpts = {
  skipKmLitrosPrompt?: boolean;
  kmRecorridos?: number;
  litrosConsumidos?: number;
};

export function ViajesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  /** Fila donde el usuario abrió el selector de estado con un clic en el badge. */
  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [kmLitrosPrompt, setKmLitrosPrompt] = useState<KmLitrosPrompt | null>(null);
  const [kmLitrosKm, setKmLitrosKm] = useState('');
  const [kmLitrosLitros, setKmLitrosLitros] = useState('');
  const [kmLitrosFieldError, setKmLitrosFieldError] = useState<string | null>(null);
  /** IDs de viajes que ya tienen al menos una factura asociada. */
  const [viajesConFactura, setViajesConFactura] = useState<Set<string>>(new Set());

  function toLocalDateTime(value?: string | null) {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 16);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<ViajesPaginatedResponse>(
          `/api/viajes/paginated?page=${page}&pageSize=${pageSize}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setMeta(data.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, 'viajes'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const [clientesData, choferesData, transportistasData, vehiculosData, facturasData] = await Promise.all([
          apiJson<Cliente[]>('/api/clientes', () => getToken()),
          apiJson<Chofer[]>('/api/choferes', () => getToken()),
          apiJson<Transportista[]>('/api/transportistas', () => getToken()),
          apiJson<Vehiculo[]>('/api/vehiculos', () => getToken()),
          apiJson<{ id: string; viajeId: string | null }[]>('/api/facturacion/facturas', () => getToken()).catch(() => [] as { id: string; viajeId: string | null }[]),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setChoferes(choferesData);
          setTransportistas(transportistasData);
          setVehiculos(vehiculosData);
          setViajesConFactura(new Set(facturasData.flatMap((f) => f.viajeIds)));
        }
      } catch {
        if (!cancelled) {
          setClientes([]);
          setChoferes([]);
          setTransportistas([]);
          setVehiculos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!editingId || !draft || draft.operacionModo !== 'propio') return;
    setDraft((p) => {
      if (!p || p.operacionModo !== 'propio') return p;
      const cid = normalizarIdEnLista(p.choferId, choferes);
      const vid = normalizarIdEnLista(p.vehiculoId, vehiculos);
      if (cid === p.choferId && vid === p.vehiculoId) return p;
      return { ...p, choferId: cid, vehiculoId: vid };
    });
  }, [editingId, draft?.operacionModo, choferes, vehiculos]);

  function startEdit(v: Viaje) {
    setEstadoQuickId(null);
    setEditingId(v.id);
    setDraft({
      numero: v.numero ?? '',
      estado: v.estado ?? 'pendiente',
      clienteId: v.clienteId ?? '',
      operacionModo: (v.transportistaId ?? '').trim() ? 'externo' : 'propio',
      choferId: normalizarIdEnLista(v.choferId, choferes),
      transportistaId: v.transportistaId ?? '',
      vehiculoId: normalizarIdEnLista(v.vehiculoId, vehiculos),
      patenteTractor: v.patenteTractor ?? '',
      patenteSemirremolque: v.patenteSemirremolque ?? '',
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ''),
      paisDestino: inferirPaisDesdeUbicacion(v.destino ?? ''),
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: toLocalDateTime(v.fechaCarga),
      fechaDescarga: toLocalDateTime(v.fechaDescarga),
      mercaderia: v.mercaderia ?? '',
      observaciones: v.observaciones ?? '',
      monto: formatCurrencyArFromNumber(v.monto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : '',
      litrosConsumidos: v.litrosConsumidos != null ? String(v.litrosConsumidos) : '',
      precioTransportistaExterno: formatCurrencyArFromNumber(v.precioTransportistaExterno),
      documentacionCsv: (v.documentacion ?? []).join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEstadoQuickId(null);
  }

  async function patchEstadoDesdeListado(v: Viaje, nuevoEstado: string) {
    if (nuevoEstado === v.estado) {
      setEstadoQuickId(null);
      return;
    }
    if (estadoMuestraKmLitros(nuevoEstado) && !viajeTieneKmYLitrosEnApi(v)) {
      setKmLitrosKm(v.kmRecorridos != null ? String(v.kmRecorridos) : '');
      setKmLitrosLitros(v.litrosConsumidos != null ? String(v.litrosConsumidos) : '');
      setKmLitrosPrompt({ kind: 'quick', viaje: v, nuevoEstado });
      setKmLitrosFieldError(null);
      setEstadoQuickId(null);
      return;
    }
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(v.id)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === v.id ? updated : r)) : prev));
      setEstadoQuickId(null);
      if (nuevoEstado === 'facturado_sin_cobrar') navigateToFacturacion(v);
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSavingEstadoId(null);
    }
  }

  async function patchEstadoConKmLitrosOpcional(
    v: Viaje,
    nuevoEstado: string,
    km?: number,
    litros?: number,
  ): Promise<boolean> {
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const body: Record<string, unknown> = { estado: nuevoEstado };
      if (km !== undefined) body.kmRecorridos = km;
      if (litros !== undefined) body.litrosConsumidos = litros;
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(v.id)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === v.id ? updated : r)) : prev));
      setEstadoQuickId(null);
      if (nuevoEstado === 'facturado_sin_cobrar') navigateToFacturacion(v);
      return true;
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
      return false;
    } finally {
      setSavingEstadoId(null);
    }
  }

  function confirmKmLitrosDialog() {
    const parsed = parseKmLitrosOpcionales(kmLitrosKm, kmLitrosLitros);
    if (!parsed.ok) {
      setKmLitrosFieldError(parsed.message);
      return;
    }
    setKmLitrosFieldError(null);
    if (!kmLitrosPrompt) return;
    if (kmLitrosPrompt.kind === 'quick') {
      const { viaje, nuevoEstado } = kmLitrosPrompt;
      void patchEstadoConKmLitrosOpcional(viaje, nuevoEstado, parsed.km, parsed.litros).then((ok) => {
        if (ok) setKmLitrosPrompt(null);
      });
      return;
    }
    if (kmLitrosPrompt.kind === 'estado-draft') {
      const { nextEstado } = kmLitrosPrompt;
      setDraft((p) =>
        p
          ? {
              ...p,
              estado: nextEstado,
              kmRecorridos: parsed.km !== undefined ? String(parsed.km) : '',
              litrosConsumidos: parsed.litros !== undefined ? String(parsed.litros) : '',
            }
          : p,
      );
      setKmLitrosPrompt(null);
      return;
    }
    const viajeId = kmLitrosPrompt.viajeId;
    setKmLitrosPrompt(null);
    void saveInline(viajeId, {
      skipKmLitrosPrompt: true,
      kmRecorridos: parsed.km,
      litrosConsumidos: parsed.litros,
    });
  }

  function cancelKmLitrosDialog() {
    setKmLitrosPrompt(null);
    setKmLitrosFieldError(null);
  }

  async function navigateToFacturacion(v: Viaje) {
    try {
      const facturas = await apiJson<{ id: string; viajeIds: string[] }[]>('/api/facturacion/facturas', () => getToken());
      const existente = facturas.find((f) => f.viajeIds.includes(v.id));
      if (existente) {
        navigate('/facturacion', { state: { expandFacturaId: existente.id } });
        return;
      }
    } catch {
      // si falla la consulta, igualmente navegamos para no bloquear al usuario
    }
    navigate('/facturacion', {
      state: {
        newFacturaDraft: {
          clienteId: v.clienteId ?? '',
          viajeId: v.id,
          importe: v.monto ?? 0,
        },
      },
    });
  }

  function applyDraftModo(m: ViajeOperacionModo) {
    setDraft((p) =>
      p
        ? {
            ...p,
            operacionModo: m,
            ...(m === 'externo'
              ? { choferId: '', vehiculoId: '' }
              : {
                  transportistaId: '',
                  choferId: normalizarIdEnLista(p.choferId, choferes),
                  vehiculoId: normalizarIdEnLista(p.vehiculoId, vehiculos),
                }),
          }
        : p,
    );
  }

  async function saveInline(viajeId: string, opts?: SaveInlineKmOpts) {
    if (!draft) return;
    if (!draft.numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    const externo = draft.operacionModo === 'externo';
    if (externo && !draft.transportistaId.trim()) {
      setError('Seleccioná un transportista externo.');
      return;
    }
    if (!externo && !flotaPropiaListaValida(draft.choferId, draft.vehiculoId, choferes, vehiculos)) {
      setError('En flota propia, elegí chofer y vehículo de las listas (si no aparecen, cargá la página).');
      return;
    }
    const o = draft.origen.trim();
    const d = draft.destino.trim();
    if (o || d) {
      const [okO, okD] = await Promise.all([
        o ? esEtiquetaCiudadValida(draft.paisOrigen, o) : Promise.resolve(true),
        d ? esEtiquetaCiudadValida(draft.paisDestino, d) : Promise.resolve(true),
      ]);
      if (!okO || !okD) {
        setError('Origen y destino deben elegirse de la lista de ciudades (no se admite texto libre).');
        return;
      }
    }
    if (
      !opts?.skipKmLitrosPrompt &&
      estadoMuestraKmLitros(draft.estado) &&
      draftKmLitrosVacios(draft.kmRecorridos, draft.litrosConsumidos)
    ) {
      setKmLitrosKm(draft.kmRecorridos);
      setKmLitrosLitros(draft.litrosConsumidos);
      setKmLitrosPrompt({ kind: 'save', viajeId });
      setKmLitrosFieldError(null);
      return;
    }
    const kmResolved = opts?.skipKmLitrosPrompt
      ? opts.kmRecorridos
      : draft.kmRecorridos.trim()
        ? Number(draft.kmRecorridos.replace(',', '.'))
        : undefined;
    const litResolved = opts?.skipKmLitrosPrompt
      ? opts.litrosConsumidos
      : draft.litrosConsumidos.trim()
        ? Number(draft.litrosConsumidos.replace(',', '.'))
        : undefined;
    setSavingId(viajeId);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(viajeId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          numero: draft.numero.trim(),
          estado: draft.estado,
          clienteId: draft.clienteId || undefined,
          ...(externo
            ? {
                transportistaId: draft.transportistaId.trim(),
                choferId: null,
                vehiculoId: null,
              }
            : {
                transportistaId: null,
                choferId: draft.choferId.trim(),
                vehiculoId: draft.vehiculoId.trim(),
              }),
          patenteTractor: draft.patenteTractor.trim() || undefined,
          patenteSemirremolque: draft.patenteSemirremolque.trim() || undefined,
          origen: draft.origen.trim() || undefined,
          destino: draft.destino.trim() || undefined,
          fechaCarga: draft.fechaCarga ? new Date(draft.fechaCarga).toISOString() : undefined,
          fechaDescarga: draft.fechaDescarga ? new Date(draft.fechaDescarga).toISOString() : undefined,
          mercaderia: draft.mercaderia.trim() || undefined,
          observaciones: draft.observaciones.trim() || undefined,
          monto: parseCurrencyAr(draft.monto),
          kmRecorridos: kmResolved,
          litrosConsumidos: litResolved,
          precioTransportistaExterno: parseCurrencyAr(draft.precioTransportistaExterno),
          documentacion: draft.documentacionCsv
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === viajeId ? updated : r)) : prev));
      const wasFacturado = draft.estado === 'facturado_sin_cobrar';
      cancelEdit();
      if (wasFacturado) navigateToFacturacion(updated);
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSavingId(null);
    }
  }

  const tableColSpan = editingId ? 5 : 6;

  function formatFechaCargaCelda(iso: string | null | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Número, estado, origen, destino, fecha de carga y monto a facturar de cada operación.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        {editingId ? (
          <>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={savingId === editingId}
              className="inline-flex h-10 items-center px-4 border border-black/20 bg-white text-vialto-charcoal text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-60"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => saveInline(editingId)}
              disabled={savingId === editingId}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
            >
              {savingId === editingId ? 'Guardando…' : 'Modificar cambios'}
            </button>
          </>
        ) : (
          <Link
            to="/viajes/nuevo"
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear viaje
          </Link>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3">Fecha de carga</th>
              <th className="px-4 py-3 text-right">Monto a facturar</th>
              {!editingId && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  Todavía no hay viajes cargados.
                </td>
              </tr>
            )}
            {rows?.map((v) => (
              <Fragment key={v.id}>
              <tr className="border-b border-black/5 hover:bg-vialto-mist/80">
                <td className="px-4 py-3 font-medium">
                  {draft && editingId === v.id ? draft.numero : v.numero}
                </td>
                <td className="px-4 py-3">
                  {editingId === v.id ? (
                    <select
                      value={draft?.estado ?? 'pendiente'}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!draft) return;
                        if (
                          estadoMuestraKmLitros(next) &&
                          draftKmLitrosVacios(draft.kmRecorridos, draft.litrosConsumidos)
                        ) {
                          setKmLitrosKm(draft.kmRecorridos);
                          setKmLitrosLitros(draft.litrosConsumidos);
                          setKmLitrosPrompt({ kind: 'estado-draft', nextEstado: next });
                          setKmLitrosFieldError(null);
                          return;
                        }
                        setDraft((prev) => (prev ? { ...prev, estado: next } : prev));
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    >
                      {ESTADOS.filter((x) => !(x === 'finalizado_sin_facturar' && viajesConFactura.has(v.id))).map((x) => (
                        <option key={x} value={x}>
                          {estadoViajeLabel[x] ?? x}
                        </option>
                      ))}
                    </select>
                  ) : estadoQuickId === v.id ? (
                    <select
                      autoFocus
                      value={v.estado}
                      disabled={savingEstadoId === v.id}
                      onChange={(e) => void patchEstadoDesdeListado(v, e.target.value)}
                      onBlur={() => setEstadoQuickId(null)}
                      className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                      aria-label="Cambiar estado del viaje"
                    >
                      {ESTADOS.filter((x) => !(x === 'finalizado_sin_facturar' && viajesConFactura.has(v.id))).map((x) => (
                        <option key={x} value={x}>
                          {estadoViajeLabel[x] ?? x}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      title="Cambiar estado"
                      disabled={savingEstadoId === v.id}
                      onClick={() => {
                        if (savingEstadoId) return;
                        setEstadoQuickId(v.id);
                      }}
                      className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                        estadoViajeBadgeClass[v.estado] ?? estadoViajeBadgeClassDefault
                      }`}
                    >
                      {savingEstadoId === v.id ? '…' : estadoViajeLabel[v.estado] ?? 'Sin clasificar'}
                    </button>
                  )}
                </td>
                <td
                  className={`px-4 py-3 text-vialto-steel ${
                    editingId === v.id ? 'min-w-[220px]' : 'max-w-[180px] truncate'
                  }`}
                >
                  {editingId === v.id && draft ? (
                    <div className="flex flex-col gap-1">
                      <PaisUbicacionSelect
                        value={draft.paisOrigen}
                        onChange={(p) =>
                          setDraft((prev) => (prev ? { ...prev, paisOrigen: p, origen: '' } : prev))
                        }
                        aria-label="País de origen"
                        className="h-8 w-full min-w-[140px] border border-black/15 bg-white px-2 text-xs"
                      />
                      <CiudadCombobox
                        pais={draft.paisOrigen}
                        value={draft.origen}
                        onChange={(next) => setDraft((prev) => (prev ? { ...prev, origen: next } : prev))}
                        inputClassName="h-9 w-full min-w-[200px] border border-black/15 bg-white px-2 text-sm"
                      />
                    </div>
                  ) : (
                    (v.origen ?? '—')
                  )}
                </td>
                <td
                  className={`px-4 py-3 text-vialto-steel ${
                    editingId === v.id ? 'min-w-[220px]' : 'max-w-[180px] truncate'
                  }`}
                >
                  {editingId === v.id && draft ? (
                    <div className="flex flex-col gap-1">
                      <PaisUbicacionSelect
                        value={draft.paisDestino}
                        onChange={(p) =>
                          setDraft((prev) => (prev ? { ...prev, paisDestino: p, destino: '' } : prev))
                        }
                        aria-label="País de destino"
                        className="h-8 w-full min-w-[140px] border border-black/15 bg-white px-2 text-xs"
                      />
                      <CiudadCombobox
                        pais={draft.paisDestino}
                        value={draft.destino}
                        onChange={(next) => setDraft((prev) => (prev ? { ...prev, destino: next } : prev))}
                        inputClassName="h-9 w-full min-w-[200px] border border-black/15 bg-white px-2 text-sm"
                      />
                    </div>
                  ) : (
                    (v.destino ?? '—')
                  )}
                </td>
                <td className="px-4 py-3 text-vialto-steel whitespace-nowrap tabular-nums">
                  {editingId === v.id && draft ? (
                    <input
                      type="datetime-local"
                      value={draft.fechaCarga}
                      onChange={(e) => setDraft((p) => (p ? { ...p, fechaCarga: e.target.value } : p))}
                      className="h-9 min-w-[10.5rem] border border-black/15 bg-white px-2 text-sm"
                    />
                  ) : (
                    formatFechaCargaCelda(v.fechaCarga)
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {textoMontoFacturarListado(v)}
                </td>
                {!editingId && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
              {editingId === v.id && draft && (
                <tr className="border-b border-black/10 bg-vialto-mist/40">
                  <td colSpan={tableColSpan} className="px-4 py-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Cliente</span>
                          <select value={draft.clienteId} onChange={(e) => setDraft((p) => (p ? { ...p, clienteId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                            Monto a facturar
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={draft.monto}
                            onChange={(e) =>
                              setDraft((p) =>
                                p ? { ...p, monto: maskCurrencyArInput(e.target.value) } : p,
                              )
                            }
                            placeholder="Ej. 1.500.000,50"
                            className="h-9 border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                          />
                        </div>
                      </div>
                      <ViajeOperacionTipoFieldset
                        modo={draft.operacionModo}
                        onModoChange={applyDraftModo}
                        groupName={`viaje-op-${draft.numero || 'edit'}`}
                        externoContent={
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                Transportista externo
                              </span>
                              <select
                                value={draft.transportistaId}
                                onChange={(e) =>
                                  setDraft((p) => (p ? { ...p, transportistaId: e.target.value } : p))
                                }
                                className="h-9 border border-black/15 bg-white px-2 text-sm"
                              >
                                <option value="">Elegí un transportista…</option>
                                {transportistas.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                Precio transportista externo
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                value={draft.precioTransportistaExterno}
                                onChange={(e) =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          precioTransportistaExterno: maskCurrencyArInput(e.target.value),
                                        }
                                      : p,
                                  )
                                }
                                placeholder="Ej. 1.200.000,50"
                                className="h-9 border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                              />
                            </div>
                          </div>
                        }
                        propioContent={
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                Chofer
                              </span>
                              <select
                                value={draft.choferId}
                                onChange={(e) =>
                                  setDraft((p) => (p ? { ...p, choferId: e.target.value } : p))
                                }
                                className="h-9 border border-black/15 bg-white px-2 text-sm"
                              >
                                {choferes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                Vehículo
                              </span>
                              <select
                                value={draft.vehiculoId}
                                onChange={(e) =>
                                  setDraft((p) => (p ? { ...p, vehiculoId: e.target.value } : p))
                                }
                                className="h-9 border border-black/15 bg-white px-2 text-sm"
                              >
                                <option value="">Elegí un vehículo…</option>
                                {vehiculos.map((vh) => (
                                  <option key={vh.id} value={vh.id}>
                                    {vh.patente}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        }
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Patente tractor</span>
                          <input value={draft.patenteTractor} onChange={(e) => setDraft((p) => (p ? { ...p, patenteTractor: e.target.value } : p))} placeholder="Ej. AA123BB" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Patente semirremolque</span>
                          <input value={draft.patenteSemirremolque} onChange={(e) => setDraft((p) => (p ? { ...p, patenteSemirremolque: e.target.value } : p))} placeholder="Ej. AA456CC" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de carga</span>
                          <input type="datetime-local" value={draft.fechaCarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaCarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de descarga</span>
                          <input type="datetime-local" value={draft.fechaDescarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaDescarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                      </div>
                      {estadoMuestraKmLitros(draft.estado) && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Km recorridos</span>
                            <input type="number" value={draft.kmRecorridos} onChange={(e) => setDraft((p) => (p ? { ...p, kmRecorridos: e.target.value } : p))} placeholder="0" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Litros consumidos</span>
                            <input type="number" value={draft.litrosConsumidos} onChange={(e) => setDraft((p) => (p ? { ...p, litrosConsumidos: e.target.value } : p))} placeholder="0" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Mercadería</span>
                        <textarea value={draft.mercaderia} onChange={(e) => setDraft((p) => (p ? { ...p, mercaderia: e.target.value } : p))} placeholder="Descripción de la carga" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
                      </div>
                      <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Documentación</span>
                        <textarea value={draft.documentacionCsv} onChange={(e) => setDraft((p) => (p ? { ...p, documentacionCsv: e.target.value } : p))} placeholder="URLs separadas por coma" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
                      </div>
                      <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Observaciones</span>
                        <textarea value={draft.observaciones} onChange={(e) => setDraft((p) => (p ? { ...p, observaciones: e.target.value } : p))} placeholder="Notas adicionales" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 inline-flex gap-2">
                      <button type="button" onClick={() => saveInline(v.id)} disabled={savingId === v.id} className="text-xs uppercase tracking-wider px-3 py-1 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60">
                        {savingId === v.id ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={savingId === v.id} className="text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-60">
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

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
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 border border-black/20 bg-white px-2 text-xs"
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
              disabled={!meta.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <ViajeKmLitrosDialog
        open={kmLitrosPrompt != null}
        title={
          kmLitrosPrompt?.kind === 'quick'
            ? `Cambiar a «${estadoViajeLabel[kmLitrosPrompt.nuevoEstado] ?? kmLitrosPrompt.nuevoEstado}»`
            : kmLitrosPrompt?.kind === 'estado-draft'
              ? `Estado «${estadoViajeLabel[kmLitrosPrompt.nextEstado] ?? kmLitrosPrompt.nextEstado}»`
              : 'Guardar viaje'
        }
        km={kmLitrosKm}
        litros={kmLitrosLitros}
        error={kmLitrosFieldError}
        busy={
          (kmLitrosPrompt?.kind === 'quick' && savingEstadoId === kmLitrosPrompt.viaje.id) ||
          (kmLitrosPrompt?.kind === 'save' && savingId === kmLitrosPrompt.viajeId)
        }
        onKmChange={setKmLitrosKm}
        onLitrosChange={setKmLitrosLitros}
        onConfirm={confirmKmLitrosDialog}
        onCancel={cancelKmLitrosDialog}
      />
    </div>
  );
}

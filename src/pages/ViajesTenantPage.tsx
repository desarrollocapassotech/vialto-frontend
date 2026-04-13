import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { ViajeKmLitrosDialog } from '@/components/viajes/ViajeKmLitrosDialog';
import { apiJson } from '@/lib/api';
import {
  formatNumberForMoneda,
  maskCurrencyForMoneda,
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  choferesFlotaPropia,
  flotaPropiaVehiculosListaValida,
  mensajesAyudaFlotaPropia,
  normalizarIdEnLista,
  textoMontoFacturarListado,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
} from '@/lib/viajesFlota';
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from '@/components/viajes/ViajeVehiculosLista';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { esEtiquetaCiudadValida, inferirPaisDesdeUbicacion, type PaisCodigo } from '@/lib/ciudades';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
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
import type {
  Chofer,
  Cliente,
  Factura,
  PaginatedMeta,
  Transportista,
  Vehiculo,
  Viaje,
} from '@/types/api';

const ESTADOS = VIAJE_ESTADOS_TODOS;

type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  detalleCarga: string;
  observaciones: string;
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
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
  /** Aviso al editar un viaje en flota propia si chofer/vehículo del maestro no era compatible. */
  const [viajeEditHint, setViajeEditHint] = useState<string | null>(null);

  const choferesPropios = useMemo(() => choferesFlotaPropia(choferes), [choferes]);
  const vehiculosPropios = useMemo(() => vehiculosFlotaPropia(vehiculos), [vehiculos]);
  const ayudaFlotaListado = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );

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
          apiJson<Factura[]>('/api/facturacion/facturas', () => getToken()).catch(() => [] as Factura[]),
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
      const cid = normalizarIdEnLista(p.choferId, choferesPropios);
      if (cid === p.choferId) return p;
      return { ...p, choferId: cid };
    });
  }, [editingId, draft?.operacionModo, choferesPropios]);

  useEffect(() => {
    if (draft?.operacionModo === 'externo') setViajeEditHint(null);
  }, [draft?.operacionModo]);

  function startEdit(v: Viaje) {
    setEstadoQuickId(null);
    setEditingId(v.id);
    const esExterno = !!(v.transportistaId ?? '').trim();
    const chRow = choferes.find((c) => c.id === v.choferId);
    const partes: string[] = [];
    if (!esExterno && v.choferId && chRow?.transportistaId) {
      partes.push(
        'El chofer asociado a este viaje figura con transportista externo en su ficha; elegí uno de flota propia o actualizá el chofer.',
      );
    }
    if (!esExterno && v.vehiculosViaje?.length) {
      for (const vv of v.vehiculosViaje) {
        const vr = vehiculos.find((x) => x.id === vv.vehiculoId);
        if (vr?.transportistaId) {
          partes.push(
            'Algún vehículo del viaje figura con transportista externo en su ficha; elegí flota propia o actualizá el maestro.',
          );
          break;
        }
      }
    }
    setViajeEditHint(partes.length ? partes.join(' ') : null);
    const partesFc = isoToFechaHora(v.fechaCarga);
    const partesFd = isoToFechaHora(v.fechaDescarga);
    setDraft({
      numero: v.numero ?? '',
      estado: v.estado ?? 'pendiente',
      clienteId: v.clienteId ?? '',
      operacionModo: esExterno ? 'externo' : 'propio',
      choferId: normalizarIdEnLista(v.choferId, choferesPropios),
      transportistaId: v.transportistaId ?? '',
      vehiculosRows:
        !esExterno && v.vehiculosViaje && v.vehiculosViaje.length > 0
          ? [...v.vehiculosViaje]
              .sort((a, b) => a.orden - b.orden)
              .map((x) => ({
                tipo: (x.vehiculo?.tipo ?? 'tractor').toLowerCase(),
                vehiculoId: normalizarIdEnLista(x.vehiculoId, vehiculosPropios),
              }))
          : !esExterno
            ? [{ tipo: 'tractor', vehiculoId: '' }]
            : [],
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ''),
      paisDestino: inferirPaisDesdeUbicacion(v.destino ?? ''),
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: partesFc.fecha,
      horaCarga: partesFc.hora,
      fechaDescarga: partesFd.fecha,
      horaDescarga: partesFd.hora,
      detalleCarga: v.detalleCarga ?? '',
      observaciones: v.observaciones ?? '',
      monto: formatNumberForMoneda(v.monto, normalizeViajeMoneda(v.monedaMonto)),
      monedaMonto: normalizeViajeMoneda(v.monedaMonto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : '',
      litrosConsumidos: v.litrosConsumidos != null ? String(v.litrosConsumidos) : '',
      precioTransportistaExterno: formatNumberForMoneda(
        v.precioTransportistaExterno,
        normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
      ),
      monedaPrecioTransportistaExterno: normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEstadoQuickId(null);
    setViajeEditHint(null);
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
              ? { choferId: '', vehiculosRows: [] }
              : {
                  transportistaId: '',
                  choferId: normalizarIdEnLista(p.choferId, choferesPropios),
                  vehiculosRows:
                    p.vehiculosRows.length > 0 ? p.vehiculosRows : [{ tipo: 'tractor', vehiculoId: '' }],
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
    const vids = vehiculoIdsDesdeRows(draft.vehiculosRows);
    if (!externo && vids.length === 0) {
      setError('Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).');
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(draft.choferId, vids, choferesPropios, vehiculosPropios)
    ) {
      setError('En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).');
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
                vehiculoIds: [],
              }
            : {
                transportistaId: null,
                choferId: draft.choferId.trim(),
                vehiculoIds: vids,
              }),
          origen: draft.origen.trim() || undefined,
          destino: draft.destino.trim() || undefined,
          fechaCarga: fechaHoraToIso(draft.fechaCarga, draft.horaCarga),
          fechaDescarga: fechaHoraToIso(draft.fechaDescarga, draft.horaDescarga),
          detalleCarga: draft.detalleCarga.trim() || undefined,
          observaciones: draft.observaciones.trim() || undefined,
          monto: parseCurrencyForMoneda(draft.monto, draft.monedaMonto),
          monedaMonto: draft.monedaMonto,
          kmRecorridos: kmResolved,
          litrosConsumidos: litResolved,
          precioTransportistaExterno: parseCurrencyForMoneda(
            draft.precioTransportistaExterno,
            draft.monedaPrecioTransportistaExterno,
          ),
          monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
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
        <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
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
                <td className="px-4 py-3 text-vialto-steel whitespace-nowrap tabular-nums align-top">
                  {editingId === v.id && draft ? (
                    <ViajeFechaHoraFields
                      mode="cargaOnly"
                      fechaCarga={draft.fechaCarga}
                      horaCarga={draft.horaCarga}
                      fechaDescarga={draft.fechaDescarga}
                      horaDescarga={draft.horaDescarga}
                      onPatch={(p) => setDraft((prev) => (prev ? { ...prev, ...p } : prev))}
                      labelClassName="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel"
                      inputClassName="h-8 w-full min-w-[8.5rem] border border-black/15 bg-white px-2 text-xs"
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
                          <ClienteSearchSelect
                            clientes={clientes}
                            value={draft.clienteId}
                            onChange={(id) =>
                              setDraft((p) => (p ? { ...p, clienteId: id } : p))
                            }
                            inputClassName="h-9 border border-black/15 bg-white px-2 text-sm"
                            aria-label="Cliente"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                            Monto a facturar
                          </span>
                          <div className="flex min-w-0 gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={draft.monto}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        monto: maskCurrencyForMoneda(e.target.value, p.monedaMonto),
                                      }
                                    : p,
                                )
                              }
                              placeholder={
                                draft.monedaMonto === 'USD'
                                  ? 'Ej. 12,500.50'
                                  : 'Ej. 1.500.000,50'
                              }
                              className="h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                            />
                            <MonedaSelect
                              value={draft.monedaMonto}
                              onChange={(m: ViajeMonedaCodigo) =>
                                setDraft((p) => (p ? { ...p, monedaMonto: m, monto: '' } : p))
                              }
                              aria-label="Moneda monto a facturar"
                            />
                          </div>
                        </div>
                      </div>
                      <ViajeOperacionTipoFieldset
                        modo={draft.operacionModo}
                        onModoChange={applyDraftModo}
                        groupName={`viaje-op-${draft.numero || 'edit'}`}
                        externoContent={
                          <div className="grid gap-2">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                  Transportista externo
                                </span>
                                <TransportistaSearchSelect
                                  transportistas={transportistas}
                                  value={draft.transportistaId}
                                  onChange={(id) =>
                                    setDraft((p) => (p ? { ...p, transportistaId: id } : p))
                                  }
                                  inputClassName="h-9 border border-black/15 bg-white px-2 text-sm"
                                  aria-label="Transportista externo"
                                />
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                  Precio transportista externo
                                </span>
                                <div className="flex min-w-0 gap-2">
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
                                              precioTransportistaExterno: maskCurrencyForMoneda(
                                                e.target.value,
                                                p.monedaPrecioTransportistaExterno,
                                              ),
                                            }
                                          : p,
                                      )
                                    }
                                    placeholder={
                                      draft.monedaPrecioTransportistaExterno === 'USD'
                                        ? 'Ej. 8,500.00'
                                        : 'Ej. 1.200.000,50'
                                    }
                                    className="h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                                  />
                                  <MonedaSelect
                                    value={draft.monedaPrecioTransportistaExterno}
                                    onChange={(m: ViajeMonedaCodigo) =>
                                      setDraft((p) =>
                                        p
                                          ? {
                                              ...p,
                                              monedaPrecioTransportistaExterno: m,
                                              precioTransportistaExterno: '',
                                            }
                                          : p,
                                      )
                                    }
                                    aria-label="Moneda precio transportista externo"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                        propioContent={
                          <div className="grid gap-3">
                            <div className="flex min-w-0 max-w-md flex-col gap-1">
                              <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                                Chofer (flota propia)
                              </span>
                              <ChoferSearchSelect
                                choferes={choferesPropios}
                                value={draft.choferId}
                                onChange={(id) =>
                                  setDraft((p) => (p ? { ...p, choferId: id } : p))
                                }
                                inputClassName="h-9 border border-black/15 bg-white px-2 text-sm"
                                aria-label="Chofer flota propia"
                              />
                              {ayudaFlotaListado.chofer && (
                                <p className="text-xs text-amber-800/90">{ayudaFlotaListado.chofer}</p>
                              )}
                            </div>
                            <ViajeVehiculosLista
                              groupId={`viaje-inline-${draft.numero || 'e'}`}
                              crearVehiculoHref="/vehiculos/nuevo"
                              rows={draft.vehiculosRows}
                              onChange={(rows) => setDraft((p) => (p ? { ...p, vehiculosRows: rows } : p))}
                              vehiculos={vehiculosPropios}
                            />
                            {ayudaFlotaListado.vehiculo && (
                              <p className="text-xs text-amber-800/90">{ayudaFlotaListado.vehiculo}</p>
                            )}
                            {viajeEditHint && (
                              <p className="text-xs text-amber-800/90">{viajeEditHint}</p>
                            )}
                          </div>
                        }
                      />
                      <ViajeFechaHoraFields
                        fechaCarga={draft.fechaCarga}
                        horaCarga={draft.horaCarga}
                        fechaDescarga={draft.fechaDescarga}
                        horaDescarga={draft.horaDescarga}
                        onPatch={(p) => setDraft((prev) => (prev ? { ...prev, ...p } : prev))}
                        labelClassName="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel"
                        inputClassName="h-9 border border-black/15 bg-white px-2 text-sm"
                      />
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
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Detalle de carga</span>
                        <textarea value={draft.detalleCarga} onChange={(e) => setDraft((p) => (p ? { ...p, detalleCarga: e.target.value } : p))} placeholder="Ej. producto, bultos, temperatura, notas sobre la carga" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
                      </div>
                      <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Observaciones</span>
                        <textarea value={draft.observaciones} onChange={(e) => setDraft((p) => (p ? { ...p, observaciones: e.target.value } : p))} placeholder="Notas adicionales" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
                      </div>
                    </div>
                    {error && (
                      <p role="alert" className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                      </p>
                    )}
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

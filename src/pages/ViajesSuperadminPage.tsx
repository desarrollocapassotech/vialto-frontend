import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { esEtiquetaCiudadValida, inferirPaisDesdeUbicacion, type PaisCodigo } from '@/lib/ciudades';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { Chofer, Cliente, ConEmpresa, Transportista, Vehiculo, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

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
  fechaSalida: string;
  fechaLlegada: string;
  mercaderia: string;
  observaciones: string;
  monto: string;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioCliente: string;
  precioTransportistaExterno: string;
  documentacionCsv: string;
};

export function ViajesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Viaje>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const tenants = useTenantsList();

  function toLocalDateTime(value?: string | null) {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 16);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<ConEmpresa<Viaje>[]>(
          `/api/platform/viajes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'plataforma'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !filtroEmpresa) {
      setClientes([]);
      setChoferes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [clientesData, choferesData, transportistasData, vehiculosData] = await Promise.all([
          apiJson<Cliente[]>(`/api/platform/clientes?tenantId=${encodeURIComponent(filtroEmpresa)}`, () => getToken()),
          apiJson<Chofer[]>(`/api/platform/choferes?tenantId=${encodeURIComponent(filtroEmpresa)}`, () => getToken()),
          apiJson<Transportista[]>(`/api/platform/transportistas?tenantId=${encodeURIComponent(filtroEmpresa)}`, () => getToken()),
          apiJson<Vehiculo[]>(`/api/platform/vehiculos?tenantId=${encodeURIComponent(filtroEmpresa)}`, () => getToken()),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setChoferes(choferesData);
          setTransportistas(transportistasData);
          setVehiculos(vehiculosData);
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
  }, [filtroEmpresa, getToken, isLoaded, isSignedIn]);

  function startEdit(v: ConEmpresa<Viaje>) {
    setEditingId(v.id);
    setDraft({
      numero: v.numero ?? '',
      estado: v.estado ?? 'pendiente',
      clienteId: v.clienteId ?? '',
      operacionModo: (v.transportistaId ?? '').trim() ? 'externo' : 'propio',
      choferId: v.choferId ?? '',
      transportistaId: v.transportistaId ?? '',
      vehiculoId: v.vehiculoId ?? '',
      patenteTractor: v.patenteTractor ?? '',
      patenteSemirremolque: v.patenteSemirremolque ?? '',
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ''),
      paisDestino: inferirPaisDesdeUbicacion(v.destino ?? ''),
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: toLocalDateTime(v.fechaCarga),
      fechaDescarga: toLocalDateTime(v.fechaDescarga),
      fechaSalida: toLocalDateTime(v.fechaSalida),
      fechaLlegada: toLocalDateTime(v.fechaLlegada),
      mercaderia: v.mercaderia ?? '',
      observaciones: v.observaciones ?? '',
      monto: formatCurrencyArFromNumber(v.monto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : '',
      litrosConsumidos: v.litrosConsumidos != null ? String(v.litrosConsumidos) : '',
      precioCliente: formatCurrencyArFromNumber(v.precioCliente),
      precioTransportistaExterno: formatCurrencyArFromNumber(v.precioTransportistaExterno),
      documentacionCsv: (v.documentacion ?? []).join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
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
                  choferId: p.choferId.trim() || choferes[0]?.id || '',
                }),
          }
        : p,
    );
  }

  async function saveInline(viajeId: string) {
    if (!filtroEmpresa || !draft) return;
    if (!draft.numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    const externo = draft.operacionModo === 'externo';
    if (externo && !draft.transportistaId.trim()) {
      setError('Seleccioná un transportista externo.');
      return;
    }
    if (!externo && (!draft.choferId.trim() || !draft.vehiculoId.trim())) {
      setError('En flota propia, indicá chofer y vehículo.');
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
    setSavingId(viajeId);
    setError(null);
    try {
      const updated = await apiJson<ConEmpresa<Viaje>>(
        `/api/platform/viajes/${encodeURIComponent(viajeId)}?tenantId=${encodeURIComponent(
          filtroEmpresa,
        )}`,
        () => getToken(),
        {
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
            fechaSalida: draft.fechaSalida ? new Date(draft.fechaSalida).toISOString() : undefined,
            fechaLlegada: draft.fechaLlegada ? new Date(draft.fechaLlegada).toISOString() : undefined,
            mercaderia: draft.mercaderia.trim() || undefined,
            observaciones: draft.observaciones.trim() || undefined,
            monto: parseCurrencyAr(draft.monto),
            kmRecorridos: draft.kmRecorridos.trim() ? Number(draft.kmRecorridos) : undefined,
            litrosConsumidos: draft.litrosConsumidos.trim() ? Number(draft.litrosConsumidos) : undefined,
            precioCliente: parseCurrencyAr(draft.precioCliente),
            precioTransportistaExterno: parseCurrencyAr(draft.precioTransportistaExterno),
            documentacion: draft.documentacionCsv
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        },
      );
      setRows((prev) => (prev ? prev.map((r) => (r.id === viajeId ? { ...r, ...updated } : r)) : prev));
      cancelEdit();
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para listar viajes de esa org. El filtro lo aplica el
        servidor.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={setFiltroEmpresa}
        />
      </div>
      <div className="mt-4 flex justify-end">
        {editingId ? (
          <button
            type="button"
            onClick={() => saveInline(editingId)}
            disabled={savingId === editingId || !filtroEmpresa}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
          >
            {savingId === editingId ? 'Guardando…' : 'Modificar cambios'}
          </button>
        ) : (
          <Link
            to={
              filtroEmpresa
                ? `/viajes/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
                : '#'
            }
            className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
              filtroEmpresa
                ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
                : 'bg-vialto-charcoal/50 pointer-events-none'
            }`}
            aria-disabled={!filtroEmpresa}
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
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Transportista ext.</th>
              <th className="px-4 py-3 text-right">Margen</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!filtroEmpresa && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-vialto-steel">
                  Seleccioná una empresa para ver los viajes.
                </td>
              </tr>
            )}
            {filtroEmpresa && rows === null && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {filtroEmpresa && rows !== null && rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-vialto-steel">
                  No hay viajes registrados para esta empresa.
                </td>
              </tr>
            )}
            {filtroEmpresa &&
              rows?.map((v) => (
                <Fragment key={v.id}>
                <tr className="border-b border-black/5 hover:bg-vialto-mist/80">
                  <td className="px-4 py-3 font-medium">
                    {draft && editingId === v.id ? draft.numero : v.numero}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === v.id ? (
                      <select
                        value={draft?.estado ?? 'pendiente'}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, estado: e.target.value } : prev))
                        }
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      >
                        {ESTADOS.map((x) => (
                          <option key={x} value={x}>
                            {estadoViajeLabel[x] ?? x}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                        {estadoViajeLabel[v.estado] ?? 'Sin clasificar'}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-vialto-steel ${
                      editingId === v.id ? 'min-w-[220px]' : 'max-w-[160px] truncate'
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
                      editingId === v.id ? 'min-w-[220px]' : 'max-w-[160px] truncate'
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
                  <td className="px-4 py-3 text-right tabular-nums">
                    {editingId === v.id ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft?.monto ?? ''}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, monto: maskCurrencyArInput(e.target.value) } : prev,
                          )
                        }
                        className="h-9 w-[10rem] border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                      />
                    ) : v.monto != null ? (
                      `$ ${v.monto.toLocaleString('es-AR')}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {editingId === v.id ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft?.precioTransportistaExterno ?? ''}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  precioTransportistaExterno: maskCurrencyArInput(e.target.value),
                                }
                              : prev,
                          )
                        }
                        className="h-9 w-[10rem] border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                      />
                    ) : v.precioTransportistaExterno != null ? (
                      `$ ${v.precioTransportistaExterno.toLocaleString('es-AR')}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {v.gananciaBruta != null
                      ? `$ ${v.gananciaBruta.toLocaleString('es-AR')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => (editingId === v.id ? cancelEdit() : startEdit(v))}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      {editingId === v.id ? 'Cerrar' : 'Edición rápida'}
                    </button>
                  </td>
                </tr>
                {editingId === v.id && draft && (
                  <tr className="border-b border-black/10 bg-vialto-mist/40">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Cliente</span>
                          <select value={draft.clienteId} onChange={(e) => setDraft((p) => (p ? { ...p, clienteId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>
                        <ViajeOperacionTipoFieldset
                          modo={draft.operacionModo}
                          onModoChange={applyDraftModo}
                          groupName={`viaje-op-sa-${draft.numero || 'edit'}`}
                          externoContent={
                            <div className="flex flex-col gap-1">
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
                          }
                          propioContent={
                            <>
                              <div className="flex flex-col gap-1">
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
                              <div className="flex flex-col gap-1 pt-2">
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
                            </>
                          }
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Patente tractor</span>
                          <input value={draft.patenteTractor} onChange={(e) => setDraft((p) => (p ? { ...p, patenteTractor: e.target.value } : p))} placeholder="Ej. AA123BB" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Patente semirremolque</span>
                          <input value={draft.patenteSemirremolque} onChange={(e) => setDraft((p) => (p ? { ...p, patenteSemirremolque: e.target.value } : p))} placeholder="Ej. AA456CC" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de carga</span>
                          <input type="datetime-local" value={draft.fechaCarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaCarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de descarga</span>
                          <input type="datetime-local" value={draft.fechaDescarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaDescarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de salida</span>
                          <input type="datetime-local" value={draft.fechaSalida} onChange={(e) => setDraft((p) => (p ? { ...p, fechaSalida: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Fecha de llegada</span>
                          <input type="datetime-local" value={draft.fechaLlegada} onChange={(e) => setDraft((p) => (p ? { ...p, fechaLlegada: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Mercadería</span>
                          <input value={draft.mercaderia} onChange={(e) => setDraft((p) => (p ? { ...p, mercaderia: e.target.value } : p))} placeholder="Descripción de la carga" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Observaciones</span>
                          <input value={draft.observaciones} onChange={(e) => setDraft((p) => (p ? { ...p, observaciones: e.target.value } : p))} placeholder="Notas adicionales" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Km recorridos</span>
                          <input type="number" value={draft.kmRecorridos} onChange={(e) => setDraft((p) => (p ? { ...p, kmRecorridos: e.target.value } : p))} placeholder="0" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Litros consumidos</span>
                          <input type="number" value={draft.litrosConsumidos} onChange={(e) => setDraft((p) => (p ? { ...p, litrosConsumidos: e.target.value } : p))} placeholder="0" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Precio cliente</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={draft.precioCliente}
                            onChange={(e) =>
                              setDraft((p) =>
                                p ? { ...p, precioCliente: maskCurrencyArInput(e.target.value) } : p,
                              )
                            }
                            placeholder="Ej. 1.500.000,50"
                            className="h-9 border border-black/15 bg-white px-2 text-sm text-right tabular-nums"
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">Documentación</span>
                          <textarea value={draft.documentacionCsv} onChange={(e) => setDraft((p) => (p ? { ...p, documentacionCsv: e.target.value } : p))} placeholder="URLs separadas por coma" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm" />
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
    </div>
  );
}

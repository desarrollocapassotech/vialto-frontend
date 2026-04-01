import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { Chofer, Cliente, ConEmpresa, Transportista, Vehiculo, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  choferId: string;
  transportistaId: string;
  vehiculoId: string;
  patenteTractor: string;
  patenteSemirremolque: string;
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
      choferId: v.choferId ?? '',
      transportistaId: v.transportistaId ?? '',
      vehiculoId: v.vehiculoId ?? '',
      patenteTractor: v.patenteTractor ?? '',
      patenteSemirremolque: v.patenteSemirremolque ?? '',
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: toLocalDateTime(v.fechaCarga),
      fechaDescarga: toLocalDateTime(v.fechaDescarga),
      fechaSalida: toLocalDateTime(v.fechaSalida),
      fechaLlegada: toLocalDateTime(v.fechaLlegada),
      mercaderia: v.mercaderia ?? '',
      observaciones: v.observaciones ?? '',
      monto: v.monto != null ? String(v.monto) : '',
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : '',
      litrosConsumidos: v.litrosConsumidos != null ? String(v.litrosConsumidos) : '',
      precioCliente: v.precioCliente != null ? String(v.precioCliente) : '',
      precioTransportistaExterno:
        v.precioTransportistaExterno != null
          ? String(v.precioTransportistaExterno)
          : '',
      documentacionCsv: (v.documentacion ?? []).join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveInline(viajeId: string) {
    if (!filtroEmpresa || !draft) return;
    if (!draft.numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
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
            choferId: draft.choferId || undefined,
            transportistaId: draft.transportistaId.trim() || undefined,
            vehiculoId: draft.vehiculoId.trim() || undefined,
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
            monto: draft.monto.trim() ? Number(draft.monto) : undefined,
            kmRecorridos: draft.kmRecorridos.trim() ? Number(draft.kmRecorridos) : undefined,
            litrosConsumidos: draft.litrosConsumidos.trim() ? Number(draft.litrosConsumidos) : undefined,
            precioCliente: draft.precioCliente.trim() ? Number(draft.precioCliente) : undefined,
            precioTransportistaExterno: draft.precioTransportistaExterno.trim()
              ? Number(draft.precioTransportistaExterno)
              : undefined,
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
              <th className="px-4 py-3 text-right">Precio transportista externo</th>
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
                    {editingId === v.id ? (
                      <input
                        value={draft?.numero ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, numero: e.target.value } : prev))
                        }
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    ) : (
                      v.numero
                    )}
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
                  <td className="px-4 py-3 text-vialto-steel max-w-[160px] truncate">
                    {editingId === v.id ? (
                      <input
                        value={draft?.origen ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, origen: e.target.value } : prev))
                        }
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    ) : (
                      (v.origen ?? '—')
                    )}
                  </td>
                  <td className="px-4 py-3 text-vialto-steel max-w-[160px] truncate">
                    {editingId === v.id ? (
                      <input
                        value={draft?.destino ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, destino: e.target.value } : prev))
                        }
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    ) : (
                      (v.destino ?? '—')
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {editingId === v.id ? (
                      <input
                        type="number"
                        value={draft?.monto ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, monto: e.target.value } : prev))
                        }
                        className="h-9 w-[8rem] border border-black/15 bg-white px-2 text-sm text-right"
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
                        type="number"
                        value={draft?.precioTransportistaExterno ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, precioTransportistaExterno: e.target.value } : prev))
                        }
                        className="h-9 w-[8rem] border border-black/15 bg-white px-2 text-sm text-right"
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
                        <input value={draft.numero} onChange={(e) => setDraft((p) => (p ? { ...p, numero: e.target.value } : p))} placeholder="Número" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <select value={draft.estado} onChange={(e) => setDraft((p) => (p ? { ...p, estado: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                          {ESTADOS.map((x) => <option key={x} value={x}>{estadoViajeLabel[x] ?? x}</option>)}
                        </select>
                        <select value={draft.clienteId} onChange={(e) => setDraft((p) => (p ? { ...p, clienteId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <select value={draft.choferId} onChange={(e) => setDraft((p) => (p ? { ...p, choferId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                          {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <select value={draft.transportistaId} onChange={(e) => setDraft((p) => (p ? { ...p, transportistaId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                          <option value="">Sin transportista</option>
                          {transportistas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                        <select value={draft.vehiculoId} onChange={(e) => setDraft((p) => (p ? { ...p, vehiculoId: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm">
                          <option value="">Sin vehículo</option>
                          {vehiculos.map((vh) => <option key={vh.id} value={vh.id}>{vh.patente}</option>)}
                        </select>
                        <input value={draft.patenteTractor} onChange={(e) => setDraft((p) => (p ? { ...p, patenteTractor: e.target.value } : p))} placeholder="Patente tractor" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input value={draft.patenteSemirremolque} onChange={(e) => setDraft((p) => (p ? { ...p, patenteSemirremolque: e.target.value } : p))} placeholder="Patente semirremolque" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input value={draft.origen} onChange={(e) => setDraft((p) => (p ? { ...p, origen: e.target.value } : p))} placeholder="Origen" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input value={draft.destino} onChange={(e) => setDraft((p) => (p ? { ...p, destino: e.target.value } : p))} placeholder="Destino" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="datetime-local" value={draft.fechaCarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaCarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="datetime-local" value={draft.fechaDescarga} onChange={(e) => setDraft((p) => (p ? { ...p, fechaDescarga: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="datetime-local" value={draft.fechaSalida} onChange={(e) => setDraft((p) => (p ? { ...p, fechaSalida: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="datetime-local" value={draft.fechaLlegada} onChange={(e) => setDraft((p) => (p ? { ...p, fechaLlegada: e.target.value } : p))} className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input value={draft.mercaderia} onChange={(e) => setDraft((p) => (p ? { ...p, mercaderia: e.target.value } : p))} placeholder="Mercadería" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input value={draft.observaciones} onChange={(e) => setDraft((p) => (p ? { ...p, observaciones: e.target.value } : p))} placeholder="Observaciones" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="number" value={draft.monto} onChange={(e) => setDraft((p) => (p ? { ...p, monto: e.target.value } : p))} placeholder="Monto" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="number" value={draft.kmRecorridos} onChange={(e) => setDraft((p) => (p ? { ...p, kmRecorridos: e.target.value } : p))} placeholder="Km recorridos" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="number" value={draft.litrosConsumidos} onChange={(e) => setDraft((p) => (p ? { ...p, litrosConsumidos: e.target.value } : p))} placeholder="Litros consumidos" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="number" value={draft.precioCliente} onChange={(e) => setDraft((p) => (p ? { ...p, precioCliente: e.target.value } : p))} placeholder="Precio cliente" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <input type="number" value={draft.precioTransportistaExterno} onChange={(e) => setDraft((p) => (p ? { ...p, precioTransportistaExterno: e.target.value } : p))} placeholder="Precio transportista externo" className="h-9 border border-black/15 bg-white px-2 text-sm" />
                        <textarea value={draft.documentacionCsv} onChange={(e) => setDraft((p) => (p ? { ...p, documentacionCsv: e.target.value } : p))} placeholder="Documentación (URLs separadas por coma)" className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm md:col-span-2 lg:col-span-3" />
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

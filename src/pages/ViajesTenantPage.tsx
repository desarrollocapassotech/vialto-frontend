import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { PaginatedMeta, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_transito', 'despachado', 'cerrado'] as const;

type ViajeInlineDraft = {
  numero: string;
  estado: string;
  origen: string;
  destino: string;
  precioCliente: string;
  precioFletero: string;
};

type ViajesPaginatedResponse = {
  items: Viaje[];
  meta: PaginatedMeta;
};

export function ViajesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  function startEdit(v: Viaje) {
    setEditingId(v.id);
    setDraft({
      numero: v.numero ?? '',
      estado: v.estado ?? 'pendiente',
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      precioCliente: v.precioCliente != null ? String(v.precioCliente) : '',
      precioFletero: v.precioFletero != null ? String(v.precioFletero) : '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveInline(viajeId: string) {
    if (!draft) return;
    if (!draft.numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    setSavingId(viajeId);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(viajeId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          numero: draft.numero.trim(),
          estado: draft.estado,
          origen: draft.origen.trim() || undefined,
          destino: draft.destino.trim() || undefined,
          precioCliente: draft.precioCliente.trim() ? Number(draft.precioCliente) : undefined,
          precioFletero: draft.precioFletero.trim() ? Number(draft.precioFletero) : undefined,
        }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === viajeId ? updated : r)) : prev));
      cancelEdit();
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Número, estado, origen, destino y margen de cada operación.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/viajes/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
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
              <th className="px-4 py-3 text-right">Precio cliente</th>
              <th className="px-4 py-3 text-right">Precio fletero</th>
              <th className="px-4 py-3 text-right">Margen</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-vialto-steel">
                  Todavía no hay viajes cargados.
                </td>
              </tr>
            )}
            {rows?.map((v) => (
              <tr
                key={v.id}
                className="border-b border-black/5 hover:bg-vialto-mist/80"
              >
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
                <td className="px-4 py-3 text-vialto-steel max-w-[180px] truncate">
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
                <td className="px-4 py-3 text-vialto-steel max-w-[180px] truncate">
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
                      value={draft?.precioCliente ?? ''}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, precioCliente: e.target.value } : prev))
                      }
                      className="h-9 w-[8rem] border border-black/15 bg-white px-2 text-sm text-right"
                    />
                  ) : v.precioCliente != null ? (
                    `$ ${v.precioCliente.toLocaleString('es-AR')}`
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {editingId === v.id ? (
                    <input
                      type="number"
                      value={draft?.precioFletero ?? ''}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, precioFletero: e.target.value } : prev))
                      }
                      className="h-9 w-[8rem] border border-black/15 bg-white px-2 text-sm text-right"
                    />
                  ) : v.precioFletero != null ? (
                    `$ ${v.precioFletero.toLocaleString('es-AR')}`
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
                  {editingId === v.id ? (
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveInline(v.id)}
                        disabled={savingId === v.id}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
                      >
                        {savingId === v.id ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingId === v.id}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
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
    </div>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Cliente, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_transito', 'despachado', 'cerrado'] as const;

export function ViajeEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('pendiente');
  const [clienteId, setClienteId] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [precioCliente, setPrecioCliente] = useState('');
  const [precioFletero, setPrecioFletero] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const viajePath = tenantId
          ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/viajes/${encodeURIComponent(id)}`;
        const clientesPath = tenantId
          ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/clientes';
        const [row, clientesData] = await Promise.all([
          apiJson<Viaje>(viajePath, () => getToken()),
          apiJson<Cliente[]>(clientesPath, () => getToken()),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setNumero(row.numero);
          setEstado((ESTADOS.includes(row.estado as any) ? row.estado : 'pendiente') as (typeof ESTADOS)[number]);
          setClienteId(row.clienteId);
          setOrigen(row.origen ?? '');
          setDestino(row.destino ?? '');
          setPrecioCliente(row.precioCliente != null ? String(row.precioCliente) : '');
          setPrecioFletero(row.precioFletero != null ? String(row.precioFletero) : '');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'viajes'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  async function onSave() {
    if (!id) return;
    if (!numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    if (!clienteId) {
      setError('Seleccioná un cliente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/viajes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          numero: numero.trim(),
          estado,
          clienteId,
          origen: origen.trim() || undefined,
          destino: destino.trim() || undefined,
          precioCliente: precioCliente ? Number(precioCliente) : undefined,
          precioFletero: precioFletero ? Number(precioFletero) : undefined,
        }),
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || confirmDelete.trim() !== numero.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/viajes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar viaje"
      backTo="/viajes"
      backLabel="← Volver a viajes"
      error={error}
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Numero
              </span>
              <CrudInput
                value={numero}
                placeholder="Ej: VIA-000123"
                onChange={(e) => setNumero(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Estado
              </span>
              <CrudSelect
                value={estado}
                onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
              >
                {ESTADOS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Cliente
              </span>
              <CrudSelect value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Origen
              </span>
              <CrudInput
                value={origen}
                placeholder="Ej: Rosario, Santa Fe"
                onChange={(e) => setOrigen(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Destino
              </span>
              <CrudInput
                value={destino}
                placeholder="Ej: Cordoba Capital"
                onChange={(e) => setDestino(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Precio cliente
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 1500000"
                value={precioCliente}
                onChange={(e) => setPrecioCliente(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Precio fletero
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 1200000"
                value={precioFletero}
                onChange={(e) => setPrecioFletero(e.target.value)}
              />
            </label>
            <CrudSubmitButton loading={loading} label="Guardar cambios" />
          </form>
          <CrudDangerZone
            message="Escribí el número del viaje para eliminarlo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === numero.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar viaje"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

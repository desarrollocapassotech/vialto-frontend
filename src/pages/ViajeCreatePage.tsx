import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Cliente } from '@/types/api';

const ESTADOS = ['pendiente', 'en_transito', 'despachado', 'cerrado'] as const;

export function ViajeCreatePage() {
  const { getToken } = useAuth();
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
  const [loading, setLoading] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientesPath = tenantId
          ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/clientes';
        const data = await apiJson<Cliente[]>(clientesPath, () => getToken());
        if (!cancelled) {
          setClientes(data);
          if (data.length > 0) setClienteId(data[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'viajes'));
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

  async function onSubmit() {
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
        ? `/api/platform/viajes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/viajes';
      await apiJson(path, () => getToken(), {
        method: 'POST',
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

  return (
    <CrudPageLayout
      title="Crear viaje"
      backTo="/viajes"
      backLabel="← Volver a viajes"
      error={error}
    >
      {loadingRefs ? (
        <p className="mt-6 text-vialto-steel">Cargando referencias…</p>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <CrudInput placeholder="Número *" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <CrudSelect value={estado} onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}>
            {ESTADOS.map((x) => <option key={x} value={x}>{x}</option>)}
          </CrudSelect>
          <CrudSelect value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            {clientes.length === 0 && <option value="">Sin clientes</option>}
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </CrudSelect>
          <CrudInput placeholder="Origen" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          <CrudInput placeholder="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
          <CrudInput type="number" placeholder="Precio cliente" value={precioCliente} onChange={(e) => setPrecioCliente(e.target.value)} />
          <CrudInput type="number" placeholder="Precio fletero" value={precioFletero} onChange={(e) => setPrecioFletero(e.target.value)} />
          <CrudSubmitButton loading={loading} label="Crear viaje" />
        </form>
      )}
    </CrudPageLayout>
  );
}

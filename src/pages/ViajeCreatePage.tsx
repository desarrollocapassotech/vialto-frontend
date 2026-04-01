import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Chofer, Cliente } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

export function ViajeCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('pendiente');
  const [clienteId, setClienteId] = useState('');
  const [choferId, setChoferId] = useState('');
  const [patenteTractor, setPatenteTractor] = useState('');
  const [patenteSemirremolque, setPatenteSemirremolque] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fechaCarga, setFechaCarga] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [mercaderia, setMercaderia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [monto, setMonto] = useState('');
  const [precioCliente, setPrecioCliente] = useState('');
  const [precioTransportistaExterno, setPrecioTransportistaExterno] = useState('');
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
        const choferesPath = tenantId
          ? `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/choferes';
        const [clientesData, choferesData] = await Promise.all([
          apiJson<Cliente[]>(clientesPath, () => getToken()),
          apiJson<Chofer[]>(choferesPath, () => getToken()),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setChoferes(choferesData);
          if (clientesData.length > 0) setClienteId(clientesData[0].id);
          if (choferesData.length > 0) setChoferId(choferesData[0].id);
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
    if (!choferId) {
      setError('Seleccioná un chofer.');
      return;
    }
    if (!patenteTractor.trim() || !patenteSemirremolque.trim()) {
      setError('Completá patente de tractor y semirremolque.');
      return;
    }
    if (!origen.trim() || !destino.trim()) {
      setError('Completá origen y destino.');
      return;
    }
    if (!fechaCarga || !fechaDescarga) {
      setError('Completá fecha de carga y fecha de descarga.');
      return;
    }
    if (!mercaderia.trim()) {
      setError('Ingresá la descripción de mercadería.');
      return;
    }
    if (!observaciones.trim()) {
      setError('Ingresá observaciones.');
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
          choferId,
          patenteTractor: patenteTractor.trim().toUpperCase(),
          patenteSemirremolque: patenteSemirremolque.trim().toUpperCase(),
          origen: origen.trim(),
          destino: destino.trim(),
          fechaCarga: new Date(fechaCarga).toISOString(),
          fechaDescarga: new Date(fechaDescarga).toISOString(),
          mercaderia: mercaderia.trim(),
          observaciones: observaciones.trim(),
          monto: monto ? Number(monto) : undefined,
          precioCliente: precioCliente ? Number(precioCliente) : undefined,
          precioTransportistaExterno: precioTransportistaExterno
            ? Number(precioTransportistaExterno)
            : undefined,
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
          <CrudSelect value={choferId} onChange={(e) => setChoferId(e.target.value)}>
            {choferes.length === 0 && <option value="">Sin choferes</option>}
            {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </CrudSelect>
          <CrudInput placeholder="Patente tractor *" value={patenteTractor} onChange={(e) => setPatenteTractor(e.target.value)} />
          <CrudInput placeholder="Patente semirremolque *" value={patenteSemirremolque} onChange={(e) => setPatenteSemirremolque(e.target.value)} />
          <CrudInput placeholder="Origen *" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          <CrudInput placeholder="Destino *" value={destino} onChange={(e) => setDestino(e.target.value)} />
          <CrudInput type="datetime-local" placeholder="Fecha carga *" value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} />
          <CrudInput type="datetime-local" placeholder="Fecha descarga *" value={fechaDescarga} onChange={(e) => setFechaDescarga(e.target.value)} />
          <CrudInput placeholder="Mercadería *" value={mercaderia} onChange={(e) => setMercaderia(e.target.value)} />
          <CrudInput placeholder="Observaciones *" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          <CrudInput type="number" placeholder="Monto del viaje" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <CrudInput type="number" placeholder="Precio cliente" value={precioCliente} onChange={(e) => setPrecioCliente(e.target.value)} />
          <CrudInput type="number" placeholder="Precio transportista externo" value={precioTransportistaExterno} onChange={(e) => setPrecioTransportistaExterno(e.target.value)} />
          <CrudSubmitButton loading={loading} label="Crear viaje" />
        </form>
      )}
    </CrudPageLayout>
  );
}

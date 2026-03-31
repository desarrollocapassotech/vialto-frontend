import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

export function VehiculoCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [patente, setPatente] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('camion');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [kmActual, setKmActual] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!patente.trim()) {
      setError('Ingresá la patente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/vehiculos';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          patente: patente.trim().toUpperCase(),
          tipo,
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          anio: anio ? Number(anio) : undefined,
          kmActual: kmActual ? Number(kmActual) : undefined,
        }),
      });
      navigate('/vehiculos', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear vehículo"
      backTo="/vehiculos"
      backLabel="← Volver a vehículos"
      error={error}
    >
      <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <CrudInput placeholder="Patente *" value={patente} onChange={(e) => setPatente(e.target.value)} />
        <CrudSelect value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </CrudSelect>
        <CrudInput placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
        <CrudInput placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        <CrudInput type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} />
        <CrudInput type="number" placeholder="Km actual" value={kmActual} onChange={(e) => setKmActual(e.target.value)} />
        <CrudSubmitButton loading={loading} label="Crear vehículo" />
      </form>
    </CrudPageLayout>
  );
}

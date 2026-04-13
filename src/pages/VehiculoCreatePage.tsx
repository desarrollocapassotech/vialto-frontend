import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TransportistaAsignacionFields,
  type AsignacionModo,
} from '@/components/crud/TransportistaAsignacionFields';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

export function VehiculoCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const transportistas = useTransportistasList(tenantId || undefined);
  const [patente, setPatente] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('camion');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [modoAsignacion, setModoAsignacion] = useState<AsignacionModo>('propio');
  const [transportistaId, setTransportistaId] = useState('');
const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!patente.trim()) {
      setError('Ingresá la patente.');
      return;
    }
    if (modoAsignacion === 'externo' && !transportistaId.trim()) {
      setError('Seleccioná un transportista o elegí flota propia.');
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
          transportistaId:
            modoAsignacion === 'externo' ? transportistaId.trim() : null,
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
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Patente *
          </span>
          <CrudInput placeholder="Ej: AA123BB" value={patente} onChange={(e) => setPatente(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Tipo
          </span>
          <CrudSelect value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </CrudSelect>
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Marca
          </span>
          <CrudInput placeholder="Ej: Scania" value={marca} onChange={(e) => setMarca(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Modelo
          </span>
          <CrudInput placeholder="Ej: R450" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Año
          </span>
          <CrudInput type="number" placeholder="Ej: 2020" value={anio} onChange={(e) => setAnio(e.target.value)} />
        </label>
        <TransportistaAsignacionFields
          modo={modoAsignacion}
          onModoChange={(m) => {
            setModoAsignacion(m);
            if (m === 'propio') setTransportistaId('');
          }}
          transportistaId={transportistaId}
          onTransportistaIdChange={setTransportistaId}
          transportistas={transportistas ?? []}
          loadingTransportistas={transportistas === null}
        />
<CrudSubmitButton loading={loading} label="Crear vehículo" />
      </form>
    </CrudPageLayout>
  );
}

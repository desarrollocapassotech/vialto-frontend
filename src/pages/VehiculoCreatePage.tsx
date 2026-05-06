import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

const LABEL = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

export function VehiculoCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [patente, setPatente] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('camion');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [nroChasis, setNroChasis] = useState('');
  const [poliza, setPoliza] = useState('');
  const [vencimientoPoliza, setVencimientoPoliza] = useState('');
  const [tara, setTara] = useState('');
  const [precinto, setPrecinto] = useState('');
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
          nroChasis: nroChasis.trim() || undefined,
          poliza: poliza.trim() || undefined,
          vencimientoPoliza: vencimientoPoliza || undefined,
          tara: tara ? Number(tara.replace(',', '.')) : undefined,
          precinto: precinto.trim() || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshVehiculos();
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
    >
      <form
        className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <span className={LABEL}>Patente *</span>
          <CrudInput placeholder="Ej: AA123BB" value={patente} onChange={(e) => setPatente(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Tipo</span>
          <CrudSelect value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </CrudSelect>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Marca</span>
          <CrudInput placeholder="Ej: Scania" value={marca} onChange={(e) => setMarca(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Modelo</span>
          <CrudInput placeholder="Ej: R450" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Año</span>
          <CrudInput type="number" placeholder="Ej: 2020" value={anio} onChange={(e) => setAnio(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Nro. de chasis</span>
          <CrudInput placeholder="Ej: 9BM379182LB123456" value={nroChasis} onChange={(e) => setNroChasis(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Póliza</span>
          <CrudInput placeholder="Ej: POL-2024-001234" value={poliza} onChange={(e) => setPoliza(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Vencimiento de póliza</span>
          <CrudInput type="date" value={vencimientoPoliza} onChange={(e) => setVencimientoPoliza(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Tara (kg)</span>
          <CrudInput type="number" placeholder="Ej: 8500" value={tara} onChange={(e) => setTara(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Precinto</span>
          <CrudInput placeholder="Ej: 00123456" value={precinto} onChange={(e) => setPrecinto(e.target.value)} />
        </label>
        <div className="md:col-span-2">
          <CrudFormErrorAlert message={error} />
        </div>
        <div className="md:col-span-2">
          <CrudSubmitButton loading={loading} label="Crear vehículo" />
        </div>
      </form>
    </CrudPageLayout>
  );
}

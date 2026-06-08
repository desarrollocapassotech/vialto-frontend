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
import { vehiculoWritePayloadFromForm, type VehiculoFormState } from '@/lib/vehiculoForm';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

const LABEL = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

const emptyForm = (): VehiculoFormState => ({
  patente: '',
  tipo: 'camion',
  marca: '',
  modelo: '',
  anio: '',
  nroChasis: '',
  poliza: '',
  vencimientoPoliza: '',
  tara: '',
  precinto: '',
});

export function VehiculoCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [form, setForm] = useState<VehiculoFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<VehiculoFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function onSubmit() {
    if (!form.patente.trim()) {
      setError('Ingresá la patente.');
      return;
    }
    const taraRaw = form.tara.trim();
    if (taraRaw && vehiculoWritePayloadFromForm(form).tara == null) {
      setError('La tara debe ser un número válido.');
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
        body: JSON.stringify(vehiculoWritePayloadFromForm(form)),
      });
      if (!tenantId) void maestro.refreshVehiculos();
      navigate(`/base-de-datos?tab=vehiculos${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear vehículo"
      backTo={`/base-de-datos?tab=vehiculos${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`}
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
          <span className={LABEL}>Patente <span className="text-red-500">*</span></span>
          <CrudInput
            placeholder="Ej: AA123BB"
            value={form.patente}
            onChange={(e) => patch({ patente: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Tipo</span>
          <CrudSelect
            value={form.tipo}
            onChange={(e) => patch({ tipo: e.target.value })}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </CrudSelect>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Marca</span>
          <CrudInput
            placeholder="Ej: Scania"
            value={form.marca}
            onChange={(e) => patch({ marca: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Modelo</span>
          <CrudInput
            placeholder="Ej: R450"
            value={form.modelo}
            onChange={(e) => patch({ modelo: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Año</span>
          <CrudInput
            type="number"
            placeholder="Ej: 2020"
            value={form.anio}
            onChange={(e) => patch({ anio: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Nro. de chasis</span>
          <CrudInput
            placeholder="Ej: 9BM379182LB123456"
            value={form.nroChasis}
            onChange={(e) => patch({ nroChasis: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Póliza</span>
          <CrudInput
            placeholder="Ej: POL-2024-001234"
            value={form.poliza}
            onChange={(e) => patch({ poliza: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Vencimiento de póliza</span>
          <CrudInput
            type="date"
            value={form.vencimientoPoliza}
            onChange={(e) => patch({ vencimientoPoliza: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Tara (kg)</span>
          <CrudInput
            type="number"
            placeholder="Ej: 8500"
            value={form.tara}
            onChange={(e) => patch({ tara: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Precinto</span>
          <CrudInput
            placeholder="Ej: 00123456"
            value={form.precinto}
            onChange={(e) => patch({ precinto: e.target.value })}
          />
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

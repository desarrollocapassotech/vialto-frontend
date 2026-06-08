import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import {
  vehiculoFormStateFromApi,
  vehiculoWritePayloadFromForm,
  type VehiculoFormState,
} from '@/lib/vehiculoForm';
import type { Vehiculo } from '@/types/api';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;
const LABEL = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

function vehiculoDetailUrl(id: string, tenantId: string): string {
  if (tenantId) {
    return `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `/api/vehiculos/${encodeURIComponent(id)}`;
}

export function VehiculoEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [form, setForm] = useState<VehiculoFormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function patch(p: Partial<VehiculoFormState>) {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const row = await apiJson<Vehiculo>(vehiculoDetailUrl(id, tenantId), () => getToken());
        if (!cancelled) {
          setForm(vehiculoFormStateFromApi(row));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'vehiculos'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  async function onSave() {
    if (!id || !form) return;
    const errs: Record<string, string> = {};
    if (!form.patente.trim()) errs.patente = 'Ingresá la patente.';
    if (form.tara.trim() && vehiculoWritePayloadFromForm(form).tara == null) errs.tara = 'La tara debe ser un número válido.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      await apiJson<Vehiculo>(vehiculoDetailUrl(id, tenantId), () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify(vehiculoWritePayloadFromForm(form)),
      });
      if (!tenantId) void maestro.refreshVehiculos();
      navigate('/base-de-datos?tab=vehiculos', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || !form || confirmDelete.trim().toUpperCase() !== form.patente.trim().toUpperCase()) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiJson(vehiculoDetailUrl(id, tenantId), () => getToken(), {
        method: 'DELETE',
      });
      if (!tenantId) void maestro.refreshVehiculos();
      navigate('/base-de-datos?tab=vehiculos', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar vehículo"
      backTo="/base-de-datos?tab=vehiculos"
      backLabel="← Volver a vehículos"
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : form ? (
        <>
          <form
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <label className="grid gap-1.5">
              <span className={LABEL}>Patente <span className="text-red-500">*</span></span>
              <CrudInput
                value={form.patente}
                placeholder="Ej: AA123BB"
                error={fieldErrors.patente}
                onChange={(e) => patch({ patente: e.target.value })}
              />
              <CrudFieldError message={fieldErrors.patente} />
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
                value={form.marca}
                placeholder="Ej: Scania"
                onChange={(e) => patch({ marca: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Modelo</span>
              <CrudInput
                value={form.modelo}
                placeholder="Ej: R450"
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
                value={form.nroChasis}
                placeholder="Ej: 9BM379182LB123456"
                onChange={(e) => patch({ nroChasis: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Póliza</span>
              <CrudInput
                value={form.poliza}
                placeholder="Ej: POL-2024-001234"
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
                error={fieldErrors.tara}
                onChange={(e) => patch({ tara: e.target.value })}
              />
              <CrudFieldError message={fieldErrors.tara} />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Precinto</span>
              <CrudInput
                value={form.precinto}
                placeholder="Ej: 00123456"
                onChange={(e) => patch({ precinto: e.target.value })}
              />
            </label>
            <div className="md:col-span-2">
              <CrudFormErrorAlert message={error} />
            </div>
            <div className="md:col-span-2">
              <CrudSubmitButton loading={loading} label="Guardar cambios" />
            </div>
          </form>
          <CrudDangerZone
            message="Escribí la patente para eliminar este vehículo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={
              confirmDelete.trim().toUpperCase() === form.patente.trim().toUpperCase()
            }
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar vehículo"
          />
        </>
      ) : (
        <CrudFormErrorAlert message={error ?? 'No se pudo cargar el vehículo.'} />
      )}
    </CrudPageLayout>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import {
  choferWritePayloadFromForm,
  validarDniForm,
  type ChoferFormState,
} from '@/lib/choferForm';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';

const emptyForm = (): ChoferFormState => ({
  nombre: '',
  dni: '',
  cuit: '',
  telefono: '',
});

export function ChoferCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [form, setForm] = useState<ChoferFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function patch(p: Partial<ChoferFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function onSubmit() {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'Ingresá el nombre del chofer.';
    const dniError = validarDniForm(form.dni);
    if (dniError) errs.dni = dniError;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/choferes';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(choferWritePayloadFromForm(form)),
      });
      if (!tenantId) void maestro.refreshChoferes();
      navigate(`/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout title="Crear chofer" backTo={`/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`} backLabel="← Volver a choferes">
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Nombre</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: Juan Perez"
            value={form.nombre}
            error={fieldErrors.nombre}
            onChange={(e) => patch({ nombre: e.target.value })}
          />
          <CrudFieldError message={fieldErrors.nombre} />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>DNI</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: 30123456"
            value={form.dni}
            error={fieldErrors.dni}
            onChange={(e) => patch({ dni: e.target.value })}
          />
          <CrudFieldError message={fieldErrors.dni} />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>CUIT</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: 20-30123456-7"
            value={form.cuit}
            onChange={(e) => patch({ cuit: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>Teléfono</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: +54 9 11 1234-5678"
            value={form.telefono}
            onChange={(e) => patch({ telefono: e.target.value })}
          />
        </label>
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear chofer" />
      </form>
    </CrudPageLayout>
  );
}

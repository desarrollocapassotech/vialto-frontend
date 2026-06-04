import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput } from '@/components/crud/CrudFields';
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

  function patch(p: Partial<ChoferFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function onSubmit() {
    if (!form.nombre.trim()) {
      setError('Ingresá el nombre del chofer.');
      return;
    }
    const dniError = validarDniForm(form.dni);
    if (dniError) {
      setError(dniError);
      return;
    }
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
      navigate('/base-de-datos?tab=choferes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setLoading(false);
    }
  }

  const labelClass =
    'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

  return (
    <CrudPageLayout title="Crear chofer" backTo="/base-de-datos?tab=choferes" backLabel="← Volver a choferes">
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <span className={labelClass}>Nombre *</span>
          <CrudInput
            placeholder="Ej: Juan Perez"
            value={form.nombre}
            onChange={(e) => patch({ nombre: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>DNI</span>
          <CrudInput
            placeholder="Ej: 30123456"
            value={form.dni}
            onChange={(e) => patch({ dni: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>CUIT</span>
          <CrudInput
            placeholder="Ej: 20-30123456-7"
            value={form.cuit}
            onChange={(e) => patch({ cuit: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Teléfono</span>
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

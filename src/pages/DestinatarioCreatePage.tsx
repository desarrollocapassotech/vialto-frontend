import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import type { Destinatario } from '@/types/api';

export function DestinatarioCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre del destinatario.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/destinatarios?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/destinatarios';
      await apiJson<Destinatario>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      if (!tenantId) await maestro.refreshDestinatarios();
      navigate(
        `/base-de-datos?tab=destinatarios${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`,
        { replace: true },
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un destinatario con ese nombre.'
          : friendlyError(e, 'destinatarios'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear destinatario"
      backTo={`/base-de-datos?tab=destinatarios${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`}
      backLabel="← Volver a destinatarios"
    >
      <form
        className="max-w-lg grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Nombre</CrudFieldLabel>
          <CrudInput
            value={nombre}
            error={fieldErrors.nombre}
            placeholder="Ej: Luvi SRL, Myca SRL…"
            maxLength={200}
            onChange={(e) => setNombre(e.target.value)}
          />
          <CrudFieldError message={fieldErrors.nombre} />
        </label>
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear destinatario" />
      </form>
    </CrudPageLayout>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import type { Destinatario } from '@/types/api';

function destinatarioDetailUrl(id: string, tenantId: string): string {
  if (tenantId) {
    return `/api/platform/destinatarios/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `/api/destinatarios/${encodeURIComponent(id)}`;
}

export function DestinatarioEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const row = await apiJson<Destinatario>(destinatarioDetailUrl(id, tenantId), () => getToken());
        if (!cancelled) {
          setNombre(row.nombre);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'destinatarios'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  async function onSave() {
    if (!id) return;
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
      await apiJson<Destinatario>(destinatarioDetailUrl(id, tenantId), () => getToken(), {
        method: 'PATCH',
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

  async function onDelete() {
    if (!id || confirmDelete !== nombre) return;
    setDeleting(true);
    setError(null);
    try {
      await apiJson(destinatarioDetailUrl(id, tenantId), () => getToken(), { method: 'DELETE' });
      if (!tenantId) await maestro.refreshDestinatarios();
      navigate(
        `/base-de-datos?tab=destinatarios${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, 'destinatarios'));
    } finally {
      setDeleting(false);
    }
  }

  const backTo = `/base-de-datos?tab=destinatarios${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`;

  return (
    <CrudPageLayout title="Editar destinatario" backTo={backTo} backLabel="← Volver a destinatarios">
      {initialLoading ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : (
        <form
          className="max-w-lg grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <label className="grid gap-1.5">
            <CrudFieldLabel required>Nombre</CrudFieldLabel>
            <CrudInput
              value={nombre}
              error={fieldErrors.nombre}
              maxLength={200}
              onChange={(e) => setNombre(e.target.value)}
            />
            <CrudFieldError message={fieldErrors.nombre} />
          </label>
          <CrudFormErrorAlert message={error} />
          <CrudSubmitButton loading={loading} label="Guardar cambios" />
          <CrudDangerZone
            message="Escribí el nombre del destinatario para eliminarlo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={() => void onDelete()}
            deleteLabel="Eliminar destinatario"
          />
        </form>
      )}
    </CrudPageLayout>
  );
}

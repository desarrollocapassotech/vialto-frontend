import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import {
  choferFormStateFromApi,
  choferWritePayloadFromForm,
  validarDniForm,
  type ChoferFormState,
} from '@/lib/choferForm';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import type { Chofer } from '@/types/api';

function choferDetailUrl(id: string, tenantId: string): string {
  if (tenantId) {
    return `/api/platform/choferes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `/api/choferes/${encodeURIComponent(id)}`;
}

export function ChoferEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [form, setForm] = useState<ChoferFormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<ChoferFormState>) {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const row = await apiJson<Chofer>(choferDetailUrl(id, tenantId), () => getToken());
        if (!cancelled) {
          setForm(choferFormStateFromApi(row));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'choferes'));
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
      await apiJson<Chofer>(choferDetailUrl(id, tenantId), () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify(choferWritePayloadFromForm(form)),
      });
      if (!tenantId) void maestro.refreshChoferes();
      navigate('/choferes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || !form || confirmDelete.trim() !== form.nombre.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      await apiJson(choferDetailUrl(id, tenantId), () => getToken(), { method: 'DELETE' });
      if (!tenantId) void maestro.refreshChoferes();
      navigate('/choferes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setDeleting(false);
    }
  }

  const labelClass =
    'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

  return (
    <CrudPageLayout title="Editar chofer" backTo="/choferes" backLabel="← Volver a choferes">
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : form ? (
        <>
          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <label className="grid gap-1.5">
              <span className={labelClass}>Nombre</span>
              <CrudInput
                value={form.nombre}
                placeholder="Ej: Juan Perez"
                onChange={(e) => patch({ nombre: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>DNI</span>
              <CrudInput
                value={form.dni}
                placeholder="Ej: 30123456"
                onChange={(e) => patch({ dni: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>CUIT</span>
              <CrudInput
                value={form.cuit}
                placeholder="Ej: 20-30123456-7"
                onChange={(e) => patch({ cuit: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Teléfono</span>
              <CrudInput
                value={form.telefono}
                placeholder="Ej: +54 9 11 1234-5678"
                onChange={(e) => patch({ telefono: e.target.value })}
              />
            </label>
            <CrudFormErrorAlert message={error} />
            <CrudSubmitButton loading={loading} label="Guardar cambios" />
          </form>
          <CrudDangerZone
            message="Escribí el nombre del chofer para eliminarlo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === form.nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar chofer"
          />
        </>
      ) : (
        <CrudFormErrorAlert message={error ?? 'No se pudo cargar el chofer.'} />
      )}
    </CrudPageLayout>
  );
}

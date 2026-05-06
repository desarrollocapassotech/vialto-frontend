import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import type { Chofer } from '@/types/api';

export function ChoferEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
const [telefono, setTelefono] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/choferes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/choferes/${encodeURIComponent(id)}`;
        const row = await apiJson<Chofer>(path, () => getToken());
        if (!cancelled) {
          setNombre(row.nombre);
          setDni(row.dni ?? '');
          setTelefono(row.telefono ?? '');
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
    if (!id) return;
    if (!nombre.trim()) {
      setError('Ingresá el nombre del chofer.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/choferes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/choferes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni: dni.trim() || undefined,
          telefono: telefono.trim() || undefined,
        }),
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
    if (!id || confirmDelete.trim() !== nombre.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/choferes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/choferes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      if (!tenantId) void maestro.refreshChoferes();
      navigate('/choferes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar chofer"
      backTo="/choferes"
      backLabel="← Volver a choferes"
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                Nombre
              </span>
              <CrudInput
                value={nombre}
                placeholder="Ej: Juan Perez"
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                DNI
              </span>
              <CrudInput
                value={dni}
                placeholder="Ej: 30123456"
                onChange={(e) => setDni(e.target.value)}
              />
            </label>
<label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                Teléfono
              </span>
              <CrudInput
                value={telefono}
                placeholder="Ej: +54 9 11 1234-5678"
                onChange={(e) => setTelefono(e.target.value)}
              />
            </label>
            <CrudFormErrorAlert message={error} />
            <CrudSubmitButton loading={loading} label="Guardar cambios" />
          </form>
          <CrudDangerZone
            message="Escribí el nombre del chofer para eliminarlo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar chofer"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

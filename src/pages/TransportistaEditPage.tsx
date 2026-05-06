import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { esPaisSoportado, idFiscalPorPais } from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Transportista } from '@/types/api';

export function TransportistaEditPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [idFiscal, setIdFiscal] = useState('');
  const [pais, setPais] = useState<PaisCodigo | ''>('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setError('No hay sesión con el servidor. Recargá la página o volvé a iniciar sesión.');
            setInitialLoading(false);
          }
          return;
        }
        const withToken = async () => token;

        const detailPath = tenantId
          ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/transportistas/${encodeURIComponent(id)}`;
        const row = await apiJson<Transportista>(detailPath, withToken);
        if (!cancelled) {
          setNombre(row.nombre);
          setIdFiscal(row.idFiscal ?? '');
          setPais(esPaisSoportado(row.pais ?? '') ? (row.pais as PaisCodigo) : '');
          setEmail(row.email ?? '');
          setTelefono(row.telefono ?? '');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'transportistas'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId, isLoaded, isSignedIn]);

  async function onSave() {
    if (!id) return;
    if (!nombre.trim()) {
      setError('Ingresá el nombre del transportista.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          idFiscal: idFiscal.trim() || undefined,
          pais: pais || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshTransportistas();
      navigate('/transportistas', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'transportistas'));
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
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      if (!tenantId) void maestro.refreshTransportistas();
      navigate('/transportistas', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'transportistas'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar transportista"
      backTo="/transportistas"
      backLabel="← Volver a transportistas"
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                Nombre
              </span>
              <CrudInput
                value={nombre}
                placeholder="Ej: Transportes del Norte SA"
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                País
              </span>
              <PaisUbicacionSelect
                value={pais}
                onChange={setPais}
                placeholder="Seleccioná un país"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                {idFiscalPorPais(pais).label}
              </span>
              <CrudInput
                value={idFiscal}
                placeholder={idFiscalPorPais(pais).placeholder}
                onChange={(e) => setIdFiscal(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel">
                Email
              </span>
              <CrudInput
                value={email}
                placeholder="Ej: contacto@empresa.com"
                onChange={(e) => setEmail(e.target.value)}
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
            message="Para eliminar este transportista, escribí su nombre exacto."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar transportista"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

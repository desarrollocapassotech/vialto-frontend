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
  const [paut, setPaut] = useState('');
  const [permisoInternacional, setPermisoInternacional] = useState('');
  const [fechaVencimientoPermiso, setFechaVencimientoPermiso] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [bandera, setBandera] = useState('');
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
          ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
          : `/api/transportistas/${encodeURIComponent(id)}`;
        const row = await apiJson<Transportista>(detailPath, withToken);
        if (!cancelled) {
          setNombre(row.nombre);
          setIdFiscal(row.idFiscal ?? '');
          setPais(esPaisSoportado(row.pais ?? '') ? (row.pais as PaisCodigo) : '');
          setEmail(row.email ?? '');
          setTelefono(row.telefono ?? '');
          setPaut(row.paut ?? '');
          setPermisoInternacional(row.permisoInternacional ?? '');
          setFechaVencimientoPermiso(
            row.fechaVencimientoPermiso ? row.fechaVencimientoPermiso.slice(0, 10) : '',
          );
          setDomicilio(row.domicilio ?? '');
          setBandera(row.bandera ?? '');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'transportistas'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          idFiscal: idFiscal.trim() || undefined,
          pais: pais || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          paut: paut.trim() || undefined,
          permisoInternacional: permisoInternacional.trim() || undefined,
          fechaVencimientoPermiso: fechaVencimientoPermiso || undefined,
          domicilio: domicilio.trim() || undefined,
          bandera: bandera.trim() || undefined,
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
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), { method: 'DELETE' });
      if (!tenantId) void maestro.refreshTransportistas();
      navigate('/transportistas', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'transportistas'));
    } finally {
      setDeleting(false);
    }
  }

  const labelClass = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';
  const sectionClass = 'mt-2 border-t border-black/10 pt-4';

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
            onSubmit={(e) => { e.preventDefault(); onSave(); }}
          >
            <label className="grid gap-1.5">
              <span className={labelClass}>Nombre</span>
              <CrudInput value={nombre} placeholder="Ej: Transportes del Norte SA" onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>País</span>
              <PaisUbicacionSelect value={pais} onChange={setPais} placeholder="Seleccioná un país" />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>{idFiscalPorPais(pais).label}</span>
              <CrudInput value={idFiscal} placeholder={idFiscalPorPais(pais).placeholder} onChange={(e) => setIdFiscal(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Email</span>
              <CrudInput value={email} placeholder="Ej: contacto@empresa.com" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Teléfono</span>
              <CrudInput value={telefono} placeholder="Ej: +54 9 11 1234-5678" onChange={(e) => setTelefono(e.target.value)} />
            </label>

            <div className={sectionClass}>
              <p className={`${labelClass} mb-3`}>Datos para PAUT</p>
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className={labelClass}>N° PAUT</span>
                  <CrudInput placeholder="Ej: 17597" value={paut} onChange={(e) => setPaut(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Domicilio</span>
                  <CrudInput placeholder="Ej: Av. Libertador 1234" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Permiso Internacional</span>
                  <CrudInput placeholder="Ej: 20113C19113" value={permisoInternacional} onChange={(e) => setPermisoInternacional(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Vencimiento Permiso Internacional</span>
                  <CrudInput type="date" value={fechaVencimientoPermiso} onChange={(e) => setFechaVencimientoPermiso(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Bandera (país de registro)</span>
                  <CrudInput placeholder="Ej: ARGENTINA" value={bandera} onChange={(e) => setBandera(e.target.value)} />
                </label>
              </div>
            </div>

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

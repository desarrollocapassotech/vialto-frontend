import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudFieldLabel, CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { TransportistaPautHelperNotice } from '@/components/transportistas/TransportistaPautHelperNotice';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { validateTransportistaForm } from '@/lib/clienteForm';
import { esPaisSoportado, idFiscalPorPais, validarIdFiscal, condicionTributariaPorPais } from '@/lib/ciudades';
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
  const [pais, setPais] = useState<PaisCodigo | ''>('');
  const [idFiscal, setIdFiscal] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState('');
  const [paut, setPaut] = useState('');
  const [permisoInternacional, setPermisoInternacional] = useState('');
  const [fechaVencimientoPermiso, setFechaVencimientoPermiso] = useState('');
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
          setPais(esPaisSoportado(row.pais ?? '') ? (row.pais as PaisCodigo) : '');
          setIdFiscal(row.idFiscal ?? '');
          setEmail(row.email ?? '');
          setTelefono(row.telefono ?? '');
          setDomicilio(row.domicilio ?? '');
          setCondicionIva(row.condicionIva ?? null);
          setCondicionTributaria(row.condicionTributaria ?? '');
          setPaut(row.paut ?? '');
          setPermisoInternacional(row.permisoInternacional ?? '');
          setFechaVencimientoPermiso(
            row.fechaVencimientoPermiso ? row.fechaVencimientoPermiso.slice(0, 10) : '',
          );
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'transportistas'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, id, tenantId, isLoaded, isSignedIn]);

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  async function onSave() {
    if (!id) return;
    const validationError = validateTransportistaForm(nombre, pais, idFiscal);
    if (validationError) {
      setError(validationError);
      return;
    }
    const errorFiscal = validarIdFiscal(pais, idFiscal.trim());
    if (errorFiscal) {
      setError(errorFiscal);
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
          pais,
          idFiscal: idFiscal.trim(),
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          domicilio: domicilio.trim() || undefined,
          condicionIva: pais === 'AR' ? (condicionIva ?? undefined) : undefined,
          condicionTributaria: pais !== 'AR' ? (condicionTributaria.trim() || undefined) : undefined,
          paut: paut.trim() || undefined,
          permisoInternacional: permisoInternacional.trim() || undefined,
          fechaVencimientoPermiso: fechaVencimientoPermiso || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshTransportistas();
      navigate(`/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
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
      navigate(`/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'transportistas'));
    } finally {
      setDeleting(false);
    }
  }

  const labelClass = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';
  const sectionClass = 'mt-2 border-t border-black/10 pt-4';
  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;

  return (
    <CrudPageLayout
      title="Editar transportista"
      backTo={`/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`}
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
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <CrudInput value={nombre} placeholder="Ej: Transportes del Norte SA" onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel required>País</CrudFieldLabel>
              <PaisUbicacionSelect value={pais} onChange={handlePaisChange} placeholder="Seleccioná un país" />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <CrudFieldLabel required>{idFiscalPorPais(pais).label}</CrudFieldLabel>
                <CrudInput
                  value={idFiscal}
                  placeholder={idFiscalPorPais(pais).placeholder}
                  onChange={(e) => setIdFiscal(e.target.value)}
                  className={errorFiscal ? 'border-red-400' : undefined}
                />
                {errorFiscal && <p className="text-xs text-red-600">{errorFiscal}</p>}
              </label>
              <label className="grid gap-1.5">
                <span className={labelClass}>{condInfo.label}</span>
                {condInfo.type === 'select' ? (
                  <CrudSelect
                    value={condicionIva ?? ''}
                    onChange={(e) => setCondicionIva(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Seleccioná una opción</option>
                    {condInfo.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </CrudSelect>
                ) : (
                  <CrudInput
                    value={condicionTributaria}
                    placeholder={condInfo.placeholder}
                    onChange={(e) => setCondicionTributaria(e.target.value)}
                  />
                )}
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className={labelClass}>Domicilio</span>
              <CrudInput value={domicilio} placeholder="Ej: Av. Libertador 1234, Buenos Aires" onChange={(e) => setDomicilio(e.target.value)} />
            </label>
            <TransportistaPautHelperNotice />
            <label className="grid gap-1.5">
              <span className={labelClass}>Email</span>
              <CrudInput value={email} placeholder="Ej: contacto@empresa.com" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Teléfono</span>
              <CrudInput value={telefono} placeholder="Ej: +54 9 11 1234-5678" onChange={(e) => setTelefono(e.target.value)} />
            </label>

            <div className={sectionClass}>
              <p className={`${labelClass} mb-3`}>Datos para Nómina</p>
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className={labelClass}>N° PAUT</span>
                  <CrudInput placeholder="Ej: 17597" value={paut} onChange={(e) => setPaut(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Permiso Internacional</span>
                  <CrudInput placeholder="Ej: 20113C19113" value={permisoInternacional} onChange={(e) => setPermisoInternacional(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Vencimiento Permiso Internacional</span>
                  <CrudInput type="date" value={fechaVencimientoPermiso} onChange={(e) => setFechaVencimientoPermiso(e.target.value)} />
                </label>
              </div>
            </div>

            <CrudFormErrorAlert message={error} />
            <CrudSubmitButton loading={loading} label="Guardar cambios" disabled={!!errorFiscal} />
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

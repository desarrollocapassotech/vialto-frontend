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
import type { Cliente } from '@/types/api';

export function ClienteEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [pais, setPais] = useState<PaisCodigo | ''>('');
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
          ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/clientes/${encodeURIComponent(id)}`;
        const row = await apiJson<Cliente>(path, () => getToken());
        if (!cancelled) {
          setNombre(row.nombre);
          setCuit(row.cuit ?? '');
          setEmail(row.email ?? '');
          setTelefono(row.telefono ?? '');
          setDireccion(row.direccion ?? '');
          setPais(esPaisSoportado(row.pais ?? '') ? (row.pais as PaisCodigo) : '');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'clientes'));
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
      setError('Ingresá el nombre del cliente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/clientes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          cuit: cuit.trim() || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          pais: pais || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshClientes();
      navigate('/clientes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'clientes'));
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
        ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/clientes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      if (!tenantId) void maestro.refreshClientes();
      navigate('/clientes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'clientes'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar cliente"
      backTo="/clientes"
      backLabel="← Volver a clientes"
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
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Nombre
              </span>
              <CrudInput
                value={nombre}
                placeholder="Ej: Transportes del Norte SA"
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                País
              </span>
              <PaisUbicacionSelect
                value={pais}
                onChange={setPais}
                placeholder="Seleccioná un país"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Dirección
              </span>
              <CrudInput
                value={direccion}
                placeholder="Ej: Av. Corrientes 1234"
                onChange={(e) => setDireccion(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                {idFiscalPorPais(pais).label}
              </span>
              <CrudInput
                value={cuit}
                placeholder={idFiscalPorPais(pais).placeholder}
                onChange={(e) => setCuit(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Email
              </span>
              <CrudInput
                value={email}
                placeholder="Ej: contacto@empresa.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
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
            message="Para eliminar este cliente, escribí su nombre exacto."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar cliente"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

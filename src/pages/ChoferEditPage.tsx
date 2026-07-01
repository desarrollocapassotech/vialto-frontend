import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import {
  choferFormStateFromApi,
  choferWritePayloadFromForm,
  validarDniForm,
  validarPinForm,
  type ChoferFormState,
} from '@/lib/choferForm';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { canAccessCombustible } from '@/lib/tenantModules';
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
  const showPinField = !!tenantId || canAccessCombustible(maestro.tenant?.modules ?? []);
  const [form, setForm] = useState<ChoferFormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPinInput, setShowPinInput] = useState(false);

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
          setShowPinInput(false);
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
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'Ingresá el nombre del chofer.';
    const dniError = validarDniForm(form.dni);
    if (dniError) errs.dni = dniError;
    const pinError = showPinField ? validarPinForm(form.pin) : null;
    if (pinError) errs.pin = pinError;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      await apiJson<Chofer>(choferDetailUrl(id, tenantId), () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify(choferWritePayloadFromForm(form)),
      });
      if (!tenantId) await maestro.refreshChoferes();
      navigate(`/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
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
      navigate(`/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout title="Editar chofer" backTo={`/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`} backLabel="← Volver a choferes">
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
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <CrudInput
                value={form.nombre}
                placeholder="Ej: Juan Perez"
                error={fieldErrors.nombre}
                onChange={(e) => patch({ nombre: e.target.value })}
              />
              <CrudFieldError message={fieldErrors.nombre} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>DNI</CrudFieldLabel>
              <CrudInput
                value={form.dni}
                placeholder="Ej: 30123456"
                error={fieldErrors.dni}
                onChange={(e) => patch({ dni: e.target.value })}
              />
              <CrudFieldError message={fieldErrors.dni} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>CUIT</CrudFieldLabel>
              <CrudInput
                value={form.cuit}
                placeholder="Ej: 20-30123456-7"
                onChange={(e) => patch({ cuit: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Teléfono</CrudFieldLabel>
              <CrudInput
                value={form.telefono}
                placeholder="Ej: +54 9 11 1234-5678"
                onChange={(e) => patch({ telefono: e.target.value })}
              />
            </label>
            {showPinField && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <CrudFieldLabel>PIN app combustible</CrudFieldLabel>
                  {form.pinConfigured ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">Configurado ✓</span>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Sin PIN</span>
                  )}
                  {!showPinInput && (
                    <button
                      type="button"
                      onClick={() => setShowPinInput(true)}
                      className="text-xs font-medium px-2.5 py-1 rounded border border-black/20 bg-white hover:bg-vialto-mist"
                    >
                      {form.pinConfigured ? 'Cambiar PIN' : 'Agregar PIN'}
                    </button>
                  )}
                </div>
                {showPinInput && (
                  <div className="grid gap-1.5">
                    {form.pinConfigured && (
                      <p className="text-xs text-vialto-steel">El nuevo PIN reemplazará al actual.</p>
                    )}
                    <CrudInput
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      placeholder="4 dígitos"
                      value={form.pin ?? ''}
                      error={fieldErrors.pin}
                      maxLength={4}
                      onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, '') })}
                    />
                    <CrudFieldError message={fieldErrors.pin} />
                  </div>
                )}
              </div>
            )}
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

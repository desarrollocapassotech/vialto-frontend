import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudSelect } from '@/components/crud/CrudFields';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { PlatformUser } from '@/types/api';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Miembro' },
] as const;

function fromOrgRole(role: string): (typeof ROLE_OPTIONS)[number]['value'] {
  if (role === 'org:admin') return 'admin';
  return 'member';
}

export function SuperadminUserEditPage() {
  const { getToken } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]['value']>('member');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !tenantId) {
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const data = await apiJson<PlatformUser>(
          `/api/platform/users/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRole(fromOrgRole(data.role));
          setEmail(data.email ?? '');
          setDisplayName([data.firstName, data.lastName].filter(Boolean).join(' ') || 'Sin nombre');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'plataforma'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId, userId]);

  async function onSubmit() {
    if (!tenantId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      await apiJson(
        `/api/platform/users/${encodeURIComponent(userId)}/role?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ role }) },
      );
      navigate(`/superadmin/usuarios?tenantId=${encodeURIComponent(tenantId)}`, {
        replace: true,
      });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!tenantId || !userId || confirmDelete.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiJson(
        `/api/platform/users/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: 'DELETE' },
      );
      navigate(`/superadmin/usuarios?tenantId=${encodeURIComponent(tenantId)}`, {
        replace: true,
      });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SuperadminOnly>
      <CrudPageLayout
        title="Editar usuario"
        backTo={`/superadmin/usuarios${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`}
        backLabel="← Volver a usuarios"
      >
        {initialLoading ? (
          <p className="mt-6 text-vialto-steel">Cargando…</p>
        ) : (
          <>
            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <label className="grid gap-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                  Nombre
                </span>
                <div className="h-10 border border-black/10 bg-white px-3 text-sm flex items-center">
                  {displayName || '—'}
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                  Email
                </span>
                <div className="h-10 border border-black/10 bg-white px-3 text-sm flex items-center">
                  {email || '—'}
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                  Rol
                </span>
                <CrudSelect value={role} onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number]['value'])}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </CrudSelect>
              </label>
              <CrudFormErrorAlert message={error} />
              <CrudSubmitButton loading={loading} label="Guardar cambios" />
            </form>

            <CrudDangerZone
              message="Para quitar este usuario de la empresa, escribí su email exacto."
              confirmValue={confirmDelete}
              onConfirmValueChange={setConfirmDelete}
              canDelete={confirmDelete.trim().toLowerCase() === email.trim().toLowerCase()}
              deleting={deleting}
              onDelete={onDelete}
              deleteLabel="Eliminar usuario"
            />
          </>
        )}
      </CrudPageLayout>
    </SuperadminOnly>
  );
}

import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import { apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from '@/lib/listadoTabla';
import type { PlatformUser } from '@/types/api';

type TenantUser = Pick<PlatformUser, 'userId' | 'firstName' | 'lastName' | 'email' | 'role' | 'createdAt'>;

type ModalState =
  | { mode: 'view'; user: TenantUser }
  | { mode: 'edit-role'; user: TenantUser; selectedRole: 'admin' | 'member' }
  | { mode: 'invite' };

function formatRole(role: string) {
  return role === 'org:admin' ? 'Administrador' : 'Miembro';
}

function formatDate(value: number | string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function toApiRole(role: string): 'admin' | 'member' {
  return role === 'org:admin' ? 'admin' : 'member';
}

// ─── Modal de usuario (ver / editar rol) ────────────────────────────────────

function UsuarioModal({
  modal,
  currentUserId,
  busy,
  onClose,
  onStartEditRole,
  onSaveRole,
  onSetSelectedRole,
  onDelete,
}: {
  modal: Extract<ModalState, { mode: 'view' | 'edit-role' }>;
  currentUserId: string | null | undefined;
  busy: boolean;
  onClose: () => void;
  onStartEditRole: () => void;
  onSaveRole: () => void;
  onSetSelectedRole: (role: 'admin' | 'member') => void;
  onDelete: () => void;
}) {
  const user = modal.user;
  const nombre = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const esMismoUsuario = user.userId === currentUserId;

  if (modal.mode === 'edit-role') {
    return (
      <ViewModalShell
        title={nombre}
        onClose={onClose}
        maxWidthClass="sm:max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className={viewModalBtnGhost}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveRole}
              disabled={busy}
              className={viewModalBtnPrimary}
            >
              {busy ? 'Guardando…' : 'Guardar rol'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-vialto-steel">
            Elegí el nuevo rol para <strong className="text-vialto-charcoal">{nombre}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            {(['admin', 'member'] as const).map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-4 py-3 hover:bg-vialto-mist"
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={modal.selectedRole === r}
                  onChange={() => onSetSelectedRole(r)}
                  className="accent-vialto-fire"
                />
                <span className="text-sm font-medium text-vialto-charcoal">
                  {r === 'admin' ? 'Administrador' : 'Miembro'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </ViewModalShell>
    );
  }

  return (
    <ViewModalShell
      title={nombre}
      onClose={onClose}
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {!esMismoUsuario && (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-wider border border-red-200 text-red-800 bg-white hover:bg-red-50 md:min-h-0"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={onStartEditRole}
                className={viewModalBtnPrimary}
              >
                Editar rol
              </button>
            </>
          )}
        </>
      }
    >
      <div className={viewModalGridClass}>
        {[
          { label: 'Nombre', value: nombre },
          { label: 'Email', value: user.email ?? '—' },
          { label: 'Rol', value: formatRole(user.role) },
          { label: 'Alta', value: formatDate(user.createdAt) },
        ].map((c) => (
          <div key={c.label}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>
      {esMismoUsuario && (
        <p className="mt-4 text-xs text-vialto-steel">
          No podés modificar tu propio rol ni eliminarte de la organización.
        </p>
      )}
    </ViewModalShell>
  );
}

// ─── Modal de invitación ─────────────────────────────────────────────────────

function InviteModal({
  busy,
  error,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (email: string, role: 'admin' | 'member') => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    if (!email.trim()) {
      setFieldErrors({ email: 'Ingresá el email del usuario.' });
      return;
    }
    setFieldErrors({});
    onSubmit(email, role);
  }

  return (
    <ViewModalShell
      title="Invitar usuario"
      onClose={onClose}
      maxWidthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={viewModalBtnGhost}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={viewModalBtnPrimary}
          >
            {busy ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-vialto-steel">
          Se enviará un email de invitación. El usuario deberá aceptarla para unirse.
        </p>
        <div>
          <label className="text-xs uppercase tracking-[0.08em] text-vialto-steel" htmlFor="invite-email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            className={`mt-1 w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-fire ${fieldErrors.email ? 'border-red-400' : 'border-black/15'}`}
            disabled={busy}
          />
          <CrudFieldError message={fieldErrors.email} />
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.08em] text-vialto-steel">Rol</p>
          <div className="flex flex-col gap-2">
            {(['member', 'admin'] as const).map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-4 py-3 hover:bg-vialto-mist"
              >
                <input
                  type="radio"
                  name="invite-role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="accent-vialto-fire"
                />
                <span className="text-sm font-medium text-vialto-charcoal">
                  {r === 'admin' ? 'Administrador' : 'Miembro'}
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </ViewModalShell>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function UsuariosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [rows, setRows] = useState<TenantUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TenantUser | null>(null);

  const load = useCallback(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<TenantUser[]>('/api/users', () => getToken());
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'usuarios'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  async function handleSaveRole() {
    if (!modal || modal.mode !== 'edit-role' || !modal.user.userId) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiJson(`/api/users/${modal.user.userId}/role`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ role: modal.selectedRole }),
      });
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, 'usuarios'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete?.userId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/users/${confirmDelete.userId}`, () => getToken(), {
        method: 'DELETE',
      });
      setConfirmDelete(null);
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, 'usuarios'));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(email: string, role: 'admin' | 'member') {
    setBusy(true);
    setActionError(null);
    try {
      await apiJson('/api/users/invite', () => getToken(), {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, 'usuarios'));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
        Usuarios
      </h1>
      <p className="mt-2 text-vialto-steel">
        Miembros de tu organización y sus roles de acceso.
      </p>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => { setActionError(null); setModal({ mode: 'invite' }); }}
          className="inline-flex min-h-11 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite md:min-h-0 md:h-10"
        >
          Invitar usuario
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {actionError && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'email',
            header: 'Email',
            cell: (u) => u.email ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'rol',
            header: 'Rol',
            cell: (u) => formatRole(u.role),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'alta',
            header: 'Alta',
            cell: (u) => formatDate(u.createdAt),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(u) => u.userId ?? u.email ?? `${u.firstName}-${u.lastName}`}
        emptyMessage="No hay usuarios en esta organización."
        loadingMessage="Cargando…"
        renderActions={(u) =>
          u.userId ? (
            <button
              type="button"
              onClick={() => { setActionError(null); setModal({ mode: 'view', user: u }); }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          ) : (
            <span className="text-xs text-vialto-steel">—</span>
          )
        }
      />

      {modal && modal.mode !== 'invite' && (
        <UsuarioModal
          modal={modal}
          currentUserId={user?.id}
          busy={busy}
          onClose={() => setModal(null)}
          onStartEditRole={() =>
            setModal({
              mode: 'edit-role',
              user: modal.user,
              selectedRole: toApiRole(modal.user.role),
            })
          }
          onSaveRole={handleSaveRole}
          onSetSelectedRole={(r) =>
            setModal({ mode: 'edit-role', user: modal.user, selectedRole: r })
          }
          onDelete={() => setConfirmDelete(modal.user)}
        />
      )}

      {modal?.mode === 'invite' && (
        <InviteModal
          busy={busy}
          error={actionError}
          onClose={() => setModal(null)}
          onSubmit={handleInvite}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar usuario"
        message={`¿Eliminás a ${[confirmDelete?.firstName, confirmDelete?.lastName].filter(Boolean).join(' ') || confirmDelete?.email} de la organización? Perderá acceso de inmediato.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

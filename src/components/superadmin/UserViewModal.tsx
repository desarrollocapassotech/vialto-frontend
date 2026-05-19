import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PlatformUser } from '@/types/api';

function formatRole(role: string, platformRole?: string | null) {
  if (platformRole === 'superadmin') return 'Superadmin';
  if (role === 'org:admin') return 'Admin';
  if (role === 'org:supervisor' || role === 'org:member') return 'Miembro';
  return role;
}

function formatDate(value: number | string) {
  try {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      typeof value === 'number' ? new Date(value) : new Date(value),
    );
  } catch {
    return '—';
  }
}


export function UserViewModal({
  user,
  tenantId,
  onClose,
}: {
  user: PlatformUser;
  tenantId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const nombreCompleto = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const editTo = user.userId
    ? `/superadmin/usuarios/${encodeURIComponent(user.userId)}/editar?tenantId=${encodeURIComponent(tenantId)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {nombreCompleto}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: 'Nombre', value: nombreCompleto },
            { label: 'Email', value: user.email },
            { label: 'Rol', value: formatRole(user.role, user.platformRole) },
            { label: 'Alta', value: formatDate(user.createdAt) },
          ].filter(c => c.value != null && c.value !== '').map((c, i) => (
            <div key={i}>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
              <p className="mt-1 text-sm">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
          {editTo && (
            <Link
              to={editTo}
              className="inline-flex h-9 items-center px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
            >
              Editar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

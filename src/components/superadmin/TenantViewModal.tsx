import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { labelBillingStatus, labelModulo } from '@/lib/platformLabels';
import type { Tenant } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export function TenantViewModal({
  tenant,
  onClose,
}: {
  tenant: Tenant;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {tenant.name}
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

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { label: 'Nombre', value: tenant.name },
              { label: 'ID Fiscal', value: tenant.idFiscal },
              { label: 'Estado billing', value: labelBillingStatus(tenant.billingStatus) },
              { label: 'Renueva', value: tenant.billingRenewsAt ? fmtDate(tenant.billingRenewsAt) : null },
              { label: 'Máx. usuarios', value: tenant.maxUsers },
              { label: 'Dominio propio', value: tenant.whiteLabelDomain },
              { label: 'Alta', value: fmtDate(tenant.createdAt) },
            ].filter(c => c.value != null && c.value !== '').map((c, i) => (
              <div key={i}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
                <p className="mt-1 text-sm">{c.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Módulos</p>
            {tenant.modules.length === 0 ? (
              <p className="mt-1 text-sm text-vialto-steel">Ninguno</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {tenant.modules.map((m) => (
                  <span
                    key={m}
                    className="inline-block text-xs px-2 py-0.5 bg-vialto-mist text-vialto-charcoal rounded"
                  >
                    {labelModulo(m)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
          <Link
            to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
            className="inline-flex h-9 items-center px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}

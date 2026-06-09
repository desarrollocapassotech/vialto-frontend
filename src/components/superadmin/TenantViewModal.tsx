import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
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
    <ViewModalShell
      title={tenant.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <Link
            to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
            className={viewModalBtnPrimary}
          >
            Editar
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className={viewModalGridClass}>
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
    </ViewModalShell>
  );
}

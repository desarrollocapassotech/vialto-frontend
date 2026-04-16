import { useState } from 'react';
import {
  labelBillingStatus,
  labelModulo,
} from '@/lib/platformLabels';
import { Link } from 'react-router-dom';
import type { Tenant } from '@/types/api';
import { ImportacionModal } from './ImportacionModal';

interface TenantsTableProps {
  loading: boolean;
  items: Tenant[];
  statusUpdatingByOrgId: Record<string, boolean>;
  onToggleEnabled: (clerkOrgId: string, enabled: boolean) => void;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function TenantsTable({
  loading,
  items,
  statusUpdatingByOrgId,
  onToggleEnabled,
}: TenantsTableProps) {
  const [importTenant, setImportTenant] = useState<Tenant | null>(null);
  const isDisabledStatus = (status: string) =>
    ['suspended', 'expired'].includes(status.toLowerCase());

  return (
    <>
    {importTenant && (
      <ImportacionModal
        tenant={importTenant}
        onClose={() => setImportTenant(null)}
      />
    )}
    <div className="mt-10 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Suscripción</th>
            <th className="px-4 py-3">Funciones</th>
            <th className="px-4 py-3 whitespace-nowrap">Alta</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                Cargando empresas…
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                No encontramos empresas para este criterio.
              </td>
            </tr>
          )}
          {!loading &&
            items.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-black/5 hover:bg-vialto-mist/80 align-top"
              >
                <td className="px-4 py-3 font-medium">{tenant.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                    {labelBillingStatus(tenant.billingStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  {tenant.modules.length === 0 ? (
                    <span className="text-vialto-steel">Ninguna</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {tenant.modules.slice(0, 4).map((m) => (
                        <span
                          key={m}
                          className="inline-block text-[11px] px-2 py-0.5 bg-vialto-mist text-vialto-charcoal rounded"
                        >
                          {labelModulo(m)}
                        </span>
                      ))}
                      {tenant.modules.length > 4 ? (
                        <span className="text-xs text-vialto-steel self-center">
                          +{tenant.modules.length - 4}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-vialto-steel whitespace-nowrap">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!isDisabledStatus(tenant.billingStatus)}
                      aria-label={`Estado de ${tenant.name}`}
                      disabled={Boolean(statusUpdatingByOrgId[tenant.clerkOrgId])}
                      onClick={() =>
                        onToggleEnabled(
                          tenant.clerkOrgId,
                          isDisabledStatus(tenant.billingStatus),
                        )
                      }
                      className={[
                        'group relative inline-flex h-7 w-28 items-center rounded-full border transition-colors px-2',
                        isDisabledStatus(tenant.billingStatus)
                          ? 'bg-white border-black/20'
                          : 'bg-vialto-charcoal border-vialto-charcoal',
                        statusUpdatingByOrgId[tenant.clerkOrgId]
                          ? 'opacity-60 cursor-wait'
                          : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'w-full text-[10px] uppercase tracking-wider text-center select-none',
                          isDisabledStatus(tenant.billingStatus)
                            ? 'text-vialto-steel'
                            : 'text-white',
                        ].join(' ')}
                      >
                        {isDisabledStatus(tenant.billingStatus)
                          ? 'Deshabilitado'
                          : 'Habilitado'}
                      </span>
                      <span
                        className={[
                          'absolute h-5 w-5 rounded-full shadow-sm transition-transform',
                          isDisabledStatus(tenant.billingStatus)
                            ? 'left-1 bg-vialto-steel/70'
                            : 'left-[5.5rem] bg-white',
                        ].join(' ')}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTenant(tenant)}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      Importar
                    </button>
                    <Link
                      to={`/superadmin/empresas/${encodeURIComponent(
                        tenant.clerkOrgId,
                      )}/editar`}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

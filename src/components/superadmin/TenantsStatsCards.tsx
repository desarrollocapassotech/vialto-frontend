import type { TenantsPageStats } from '@/hooks/usePaginatedTenants';
import { Link } from 'react-router-dom';

interface TenantsStatsCardsProps {
  loading: boolean;
  stats: TenantsPageStats;
  empresasLinkTo?: string;
}

export function TenantsStatsCards({
  loading,
  stats,
  empresasLinkTo,
}: TenantsStatsCardsProps) {
  return (
    <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Empresas
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : stats.total}
        </span>
        {empresasLinkTo && (
          <Link
            to={empresasLinkTo}
            className="absolute right-3 bottom-3 text-[9px] uppercase tracking-[0.16em] text-vialto-bright hover:text-white transition-colors"
          >
            Ver empresas →
          </Link>
        )}
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          En prueba
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-vialto-bright tracking-wide">
          {loading ? '—' : stats.enPrueba}
        </span>
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Al día
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : stats.activos}
        </span>
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Suspendidas
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : stats.suspendidos}
        </span>
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Vencidas
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : stats.vencidos}
        </span>
      </div>
    </div>
  );
}

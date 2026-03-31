import type { DashboardMetricCard } from '@/hooks/useTenantDashboardMetrics';

interface TenantOverviewCardsProps {
  loading: boolean;
  cards: DashboardMetricCard[];
}

export function TenantOverviewCards({
  loading,
  cards,
}: TenantOverviewCardsProps) {
  return (
    <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {loading
        ? Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between"
            >
              <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                Cargando
              </span>
              <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
                —
              </span>
              <span className="text-xs text-white/55 leading-snug min-h-4" />
            </div>
          ))
        : cards.map((card) => (
            <div
              key={card.key}
              className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between"
            >
              <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                {card.title}
              </span>
              <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
                {card.value}
              </span>
              <span className="text-xs text-white/55 leading-snug min-h-4">
                {card.hint ?? ''}
              </span>
            </div>
          ))}
    </div>
  );
}

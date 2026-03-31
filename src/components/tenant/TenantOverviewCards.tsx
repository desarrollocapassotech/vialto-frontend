interface TenantOverviewCardsProps {
  loading: boolean;
  subscriptionModel: string;
  billingStatus: string;
  modulesCount: number;
}

export function TenantOverviewCards({
  loading,
  subscriptionModel,
  billingStatus,
  modulesCount,
}: TenantOverviewCardsProps) {
  return (
    <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <div className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Modelo
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : subscriptionModel}
        </span>
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Suscripción
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-vialto-bright tracking-wide">
          {loading ? '—' : billingStatus}
        </span>
      </div>
      <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          Módulos activos
        </span>
        <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
          {loading ? '—' : modulesCount}
        </span>
      </div>
    </div>
  );
}

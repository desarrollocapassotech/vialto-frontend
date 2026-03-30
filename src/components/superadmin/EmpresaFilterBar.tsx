import type { Tenant } from '@/types/api';

type EmpresaFilterBarProps = {
  tenants: Tenant[] | null;
  /** `clerkOrgId` elegido; cadena vacía = todavía no hay empresa (placeholder). */
  value: string;
  onChange: (clerkOrgId: string) => void;
  className?: string;
};

export function EmpresaFilterBar({
  tenants,
  value,
  onChange,
  className = '',
}: EmpresaFilterBarProps) {
  const sorted = [...(tenants ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  );

  return (
    <div className={`flex flex-col gap-1.5 min-w-[min(100%,280px)] max-w-md ${className}`}>
      <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
        Empresa
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/10 bg-white rounded px-3 py-2.5 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
      >
        <option value="" disabled>
          Elegí una empresa…
        </option>
        {sorted.map((t) => (
          <option key={t.clerkOrgId} value={t.clerkOrgId}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

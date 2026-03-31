import { Link } from 'react-router-dom';
import type { TenantModuleCard } from '@/lib/tenantModules';

interface TenantModulesGridProps {
  modules: TenantModuleCard[];
}

export function TenantModulesGrid({ modules }: TenantModulesGridProps) {
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <article
          key={module.code}
          className="border border-black/10 bg-white p-4 shadow-sm"
        >
          <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.15em] text-vialto-charcoal">
            {module.title}
          </h2>
          <p className="mt-2 text-sm text-vialto-steel min-h-[42px]">
            {module.description}
          </p>

          {module.route ? (
            <Link
              to={module.route}
              className="mt-3 inline-block text-sm uppercase tracking-wider text-vialto-fire hover:text-vialto-bright"
            >
              Abrir módulo →
            </Link>
          ) : (
            <p className="mt-3 text-xs uppercase tracking-wider text-vialto-steel/80">
              Disponible en próximas iteraciones
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

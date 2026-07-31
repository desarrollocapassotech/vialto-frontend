// src/pages/ConceptosConfigTenantPage.tsx
import { useAuth } from "@clerk/clerk-react";
import { ConceptosLiquidacionConfigSection } from "@/components/liquidaciones/ConceptosLiquidacionConfigSection";

export function ConceptosConfigTenantPage() {
  const { getToken } = useAuth();

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Configuración de conceptos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Catálogo de conceptos adicionales que se pueden sumar o restar al
        liquidar.
      </p>

      <div className="mt-6">
        <section className="rounded border border-black/10 bg-white p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-vialto-charcoal">
              Conceptos de liquidación
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Administrá los conceptos disponibles para generar y calcular tus
              liquidaciones.
            </p>
          </div>
          <div className="space-y-4">
            <ConceptosLiquidacionConfigSection getToken={() => getToken()} />
          </div>
        </section>
      </div>
    </div>
  );
}

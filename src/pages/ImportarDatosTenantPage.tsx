import { useSearchParams } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { ImportWizard } from "@/components/importacion/ImportWizard";
import { MODULOS_SECUENCIA, type ModuloWizard } from "@/hooks/useImportWizard";

function moduloWizardDesdeQuery(valor: string | null): ModuloWizard | undefined {
  return (MODULOS_SECUENCIA as readonly string[]).includes(valor ?? "")
    ? (valor as ModuloWizard)
    : undefined;
}

export function ImportarDatosTenantPage() {
  const { tenant, loading, error } = useCurrentTenant();
  const [searchParams] = useSearchParams();
  const soloModulo = moduloWizardDesdeQuery(searchParams.get("modulo"));
  const backTo = searchParams.get("volverA") || "/base-de-datos";

  if (loading) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="py-12 text-center text-sm text-red-600">
        No se pudo cargar la información del tenant.
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Importar datos
      </h1>

      <div className="mt-6">
        <ImportWizard
          tenantId={tenant.clerkOrgId}
          tenantModules={tenant.modules}
          backTo={backTo}
          soloModulo={soloModulo}
        />
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { ImportWizard } from "@/components/importacion/ImportWizard";

export function ImportarDatosTenantPage() {
  const { tenant, loading, error } = useCurrentTenant();

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
      <p className="mt-2 max-w-2xl text-sm text-vialto-steel">
        Subí un Excel para cargar clientes, transportes, choferes, vehículos
        y viajes de forma masiva. El proceso se hace por etapas: cada hoja se
        previsualiza y confirma por separado antes de pasar a la siguiente.
      </p>

      <div className="mt-4">
        <Link
          className="text-sm text-vialto-fire hover:text-vialto-bright"
          to="/base-de-datos"
        >
          ← Volver
        </Link>
      </div>

      <div className="mt-6">
        <ImportWizard
          tenantId={tenant.clerkOrgId}
          tenantModules={tenant.modules}
          backTo="/base-de-datos"
        />
      </div>
    </div>
  );
}

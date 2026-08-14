import { useState } from "react";
import { Upload } from "lucide-react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { ImportWizardModal } from "@/components/importacion/ImportWizardModal";

/**
 * Entrada de import para el admin del tenant — sin selector de tenant (a
 * diferencia de TenantsTable.tsx en superadmin, que sí elige uno). Reusa el
 * mismo ImportacionModal como núcleo compartido; el tenant sale siempre de
 * la sesión, nunca de un prop explícito elegible por el usuario.
 */
export function ImportarDatosTenantPage() {
  const { tenant, loading, error } = useCurrentTenant();
  const [open, setOpen] = useState(false);

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
    <div className="flex flex-col items-start gap-4">
      <p className="max-w-2xl text-sm text-vialto-steel">
        Subí un Excel para cargar clientes, transportes, choferes, vehículos
        y viajes de forma masiva. El proceso se hace por etapas: cada hoja se
        previsualiza y confirma por separado antes de pasar a la siguiente.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
      >
        <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
        Importar datos
      </button>

      {open && (
        <ImportWizardModal
          tenantId={tenant.clerkOrgId}
          tenantModules={tenant.modules}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

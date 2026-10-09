import { Landmark } from "lucide-react";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { BreadcrumbExtras } from "@/hooks/useBreadcrumbOverride";

/**
 * "Emisión electrónica vía ARCA" + ambiente de pruebas, en versión sutil y en la línea
 * del breadcrumb (alineado a la derecha). Usado por Facturas y Liquidaciones.
 */
export function ArcaEmisionIndicadores({
  ambiente,
  to,
}: {
  ambiente?: string | null;
  /** Link del indicador de ambiente (solo vistas de tenant, no embebidas en superadmin). */
  to?: string;
}) {
  return (
    <BreadcrumbExtras>
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
        Emisión electrónica vía ARCA
      </span>
      <AmbienteTestBadge ambiente={ambiente} to={to} />
    </BreadcrumbExtras>
  );
}

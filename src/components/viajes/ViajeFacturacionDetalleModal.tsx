import {
  ViewModalShell,
  viewModalBtnGhost,
} from "@/components/ui/ViewModalShell";
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  facturacionLifecycleEstado,
  tooltipFacturacionEstado,
  type FacturacionEstado,
} from "@/lib/viajesIndicadores";
import type { Viaje } from "@/types/api";

/**
 * Solo se muestra cuando el viaje todavía no tiene ninguna factura vinculada
 * (`ViajeFacturacionIndicador` va directo a `FacturaViewModal` si ya existe una).
 */
export function ViajeFacturacionDetalleModal({
  viaje,
  onClose,
}: {
  viaje: Pick<Viaje, "facturacionEstado" | "factura" | "cliente" | "clienteId">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const estado = (viaje.facturacionEstado ?? "sin_facturar") as FacturacionEstado;
  const lifecycle = facturacionLifecycleEstado(estado);

  return (
    <ViewModalShell
      title="Facturación del viaje"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={viewModalBtnGhost}>
          Cerrar
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <span
          className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${facturacionEstadoBadgeClass[lifecycle]}`}
        >
          {facturacionEstadoLabel[lifecycle] ?? estado}
        </span>
        <p className="text-sm text-vialto-charcoal">{tooltipFacturacionEstado(viaje)}</p>
        <p className="text-sm text-vialto-steel/70">
          Todavía no hay ninguna factura vinculada a este viaje.
        </p>
      </div>
    </ViewModalShell>
  );
}

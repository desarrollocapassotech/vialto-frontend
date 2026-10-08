import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { viajePendienteComprobanteCliente } from "@/lib/viajesComprobantes";
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
 * Si el host pasa `onFacturar`, ofrece "Facturar" (mismo flujo que la acción
 * de la fila en la grilla) mientras el viaje siga pendiente de facturar.
 */
export function ViajeFacturacionDetalleModal({
  viaje,
  onClose,
  onFacturar,
}: {
  viaje: Pick<
    Viaje,
    "facturacionEstado" | "factura" | "cliente" | "clienteId" | "clientesViaje" | "etapa"
  >;
  onClose: () => void;
  /** Abre el alta de factura para este viaje. Sin pasar, el modal es solo informativo. */
  onFacturar?: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const estado = (viaje.facturacionEstado ?? "sin_facturar") as FacturacionEstado;
  const lifecycle = facturacionLifecycleEstado(estado);
  const puedeFacturar =
    Boolean(onFacturar) &&
    viaje.etapa?.toLowerCase() !== "cancelado" &&
    viajePendienteComprobanteCliente(viaje);

  return (
    <ViewModalShell
      title="Facturación del viaje"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {puedeFacturar && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onFacturar?.();
              }}
              className={viewModalBtnPrimary}
            >
              Facturar
            </button>
          )}
        </>
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

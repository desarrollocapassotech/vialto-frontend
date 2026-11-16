import { AlertTriangle } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import {
  viajePendienteComprobanteCliente,
  viajeTieneMontoCliente,
} from "@/lib/viajesComprobantes";
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
  viaje: Viaje;
  onClose: () => void;
  /** Abre el alta de factura para este viaje. Sin pasar, el modal es solo informativo. */
  onFacturar?: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const estado = (viaje.facturacionEstado ?? "sin_facturar") as FacturacionEstado;
  const lifecycle = facturacionLifecycleEstado(estado);

  const tienePermisoFacturar = Boolean(onFacturar);
  const esCancelado = viaje.etapa?.toLowerCase() === "cancelado";
  const esFinalizado = viaje.etapa?.toLowerCase() === "finalizado";
  const tieneMontoCliente = viajeTieneMontoCliente(viaje);
  const pendienteFacturar = viajePendienteComprobanteCliente(viaje);

  let motivoBloqueo: string | null = null;
  if (esCancelado) {
    motivoBloqueo = "No se puede facturar porque el viaje está cancelado.";
  } else if (!esFinalizado && !tieneMontoCliente) {
    motivoBloqueo =
      "No se puede facturar: el viaje debe estar en etapa Finalizado y tener cargado el monto del cliente.";
  } else if (!esFinalizado) {
    motivoBloqueo = "Para facturar, el viaje debe estar en etapa Finalizado.";
  } else if (!tieneMontoCliente) {
    motivoBloqueo = "No se puede facturar el viaje: falta cargar el monto del cliente.";
  }

  const listoParaFacturar =
    tienePermisoFacturar &&
    !esCancelado &&
    esFinalizado &&
    tieneMontoCliente &&
    pendienteFacturar;

  return (
    <ViewModalShell
      title="Facturación del viaje"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {tienePermisoFacturar && (
            <button
              type="button"
              disabled={!listoParaFacturar}
              title={motivoBloqueo ?? undefined}
              onClick={() => {
                if (!listoParaFacturar) return;
                onClose();
                onFacturar?.();
              }}
              className={`${viewModalBtnPrimary} disabled:cursor-not-allowed`}
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

        {motivoBloqueo && tienePermisoFacturar && (
          <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{motivoBloqueo}</span>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}

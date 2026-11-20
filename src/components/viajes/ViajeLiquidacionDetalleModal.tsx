import { AlertTriangle } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import {
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
  viajeTieneMontoTransportista,
} from "@/lib/viajesComprobantes";
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import { viajeRequierePagosTransportista } from "@/lib/viajesTransportistaPagos";
import { PagosTransportistaSummary } from "@/components/viajes/PagosTransportistaSummary";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import type { Viaje } from "@/types/api";

/**
 * Solo se muestra cuando el viaje todavía no tiene ninguna liquidación vinculada
 * (`ViajeLiquidacionIndicador` va directo a `LiquidacionViewModal` si ya existe una).
 * Mientras no haya liquidación, mostramos los pagos ya registrados al transportista
 * (si aplica) — es la única forma de saber si algo se le pagó antes de liquidar.
 * Si el host pasa `onLiquidar`, ofrece "Liquidar" (mismo flujo que la acción de
 * la fila en la grilla) mientras el viaje siga pendiente de liquidar.
 */
export function ViajeLiquidacionDetalleModal({
  viaje,
  onClose,
  onRegistrarPago,
  onLiquidar,
}: {
  viaje: Viaje;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
  /** Si se pasa, habilita "+ Registrar pago" en el resumen de pagos al transportista. */
  onRegistrarPago?: () => void;
  /** Abre el alta de liquidación para este viaje. Sin pasar, el modal es solo informativo. */
  onLiquidar?: () => void;
}) {
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;
  const tienePermisoLiquidar =
    Boolean(onLiquidar) && viajeRequiereComprobanteDual(viaje);
  const esCancelado = viaje.etapa?.toLowerCase() === "cancelado";
  const tieneMontoTransportista = viajeTieneMontoTransportista(viaje);
  const pendienteLiquidacion = viajePendienteComprobanteTransportista(viaje);

  let motivoBloqueo: string | null = null;
  if (esCancelado) {
    motivoBloqueo = "No se puede liquidar porque el viaje está cancelado.";
  } else if (!tieneMontoTransportista) {
    motivoBloqueo =
      "No se puede liquidar el viaje: falta cargar el monto del transportista.";
  }

  const listoParaLiquidar =
    tienePermisoLiquidar &&
    !esCancelado &&
    tieneMontoTransportista &&
    pendienteLiquidacion;

  const { isVisible } = useFieldConfig("viajes");

  return (
    <ViewModalShell
      title="Liquidación al transportista"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {tienePermisoLiquidar && (
            <button
              type="button"
              disabled={!listoParaLiquidar}
              title={motivoBloqueo ?? undefined}
              onClick={() => {
                if (!listoParaLiquidar) return;
                onClose();
                onLiquidar?.();
              }}
              className={`${viewModalBtnPrimary} disabled:cursor-not-allowed`}
            >
              Liquidar
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {estado ? (
          <>
            <span
              className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${liquidacionEstadoBadgeClass[estado]}`}
            >
              {liquidacionEstadoLabel[estado] ?? estado}
            </span>
            <p className="text-sm text-vialto-steel/70">
              Todavía no hay ninguna liquidación vinculada a este viaje.
            </p>
            {motivoBloqueo && tienePermisoLiquidar && (
              <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{motivoBloqueo}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <span className="inline-block w-fit rounded-sm border bg-zinc-100 text-zinc-800 border-zinc-300/90 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1">
              No aplica
            </span>
            <p className="text-sm text-vialto-charcoal">
              Este viaje no tiene transporte / porteador o el tenant no tiene
              integración ARCA.
            </p>
          </>
        )}
        {isVisible("detalle_viaje", "pagosTransportista") &&
          viajeRequierePagosTransportista(viaje) && (
          <PagosTransportistaSummary
            viaje={viaje}
            onRegistrarPago={onRegistrarPago}
          />
        )}
      </div>
    </ViewModalShell>
  );
}

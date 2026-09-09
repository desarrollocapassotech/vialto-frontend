import {
  ViewModalShell,
  viewModalBtnGhost,
} from "@/components/ui/ViewModalShell";
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
 */
export function ViajeLiquidacionDetalleModal({
  viaje,
  onClose,
  onRegistrarPago,
}: {
  viaje: Viaje;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
  /** Si se pasa, habilita "+ Registrar pago" en el resumen de pagos al transportista. */
  onRegistrarPago?: () => void;
}) {
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;
  const { isVisible } = useFieldConfig("viajes");

  return (
    <ViewModalShell
      title="Liquidación al transportista"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={viewModalBtnGhost}>
          Cerrar
        </button>
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
          </>
        ) : (
          <>
            <span className="inline-block w-fit rounded-sm border bg-zinc-100 text-zinc-800 border-zinc-300/90 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1">
              No aplica
            </span>
            <p className="text-sm text-vialto-charcoal">
              Este viaje no tiene transportista externo o el tenant no tiene
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

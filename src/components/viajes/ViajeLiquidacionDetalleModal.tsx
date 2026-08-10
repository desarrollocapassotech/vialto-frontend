import {
  ViewModalShell,
  viewModalBtnGhost,
} from "@/components/ui/ViewModalShell";
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import type { Viaje } from "@/types/api";

/**
 * Solo se muestra cuando el viaje todavía no tiene ninguna liquidación vinculada
 * (`ViajeLiquidacionIndicador` va directo a `LiquidacionViewModal` si ya existe una).
 */
export function ViajeLiquidacionDetalleModal({
  viaje,
  onClose,
}: {
  viaje: Pick<Viaje, "liquidacionEstado" | "liquidacionesViaje">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;

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
          <span
            className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${liquidacionEstadoBadgeClass[estado]}`}
          >
            {liquidacionEstadoLabel[estado] ?? estado}
          </span>
        ) : (
          <span className="inline-block w-fit rounded-sm border bg-zinc-100 text-zinc-800 border-zinc-300/90 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1">
            No aplica
          </span>
        )}
        <p className="text-sm text-vialto-charcoal">
          {estado
            ? tooltipLiquidacionEstado(viaje)
            : "Este viaje no tiene transportista externo o el tenant no tiene integración ARCA."}
        </p>
        {estado && (
          <p className="text-sm text-vialto-steel/70">
            Todavía no hay ninguna liquidación vinculada a este viaje.
          </p>
        )}
      </div>
    </ViewModalShell>
  );
}

import { useNavigate } from "react-router-dom";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import type { Viaje } from "@/types/api";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtImporte(importe: number | null | undefined) {
  if (importe == null) return "—";
  return `$ ${importe.toLocaleString("es-AR")}`;
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function ViajeLiquidacionDetalleModal({
  viaje,
  onClose,
  tenantId,
}: {
  viaje: Pick<Viaje, "liquidacionEstado" | "liquidacionesViaje">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const navigate = useNavigate();
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;
  const relevantes = viaje.liquidacionesViaje ?? [];
  const activa = relevantes.find((lv) => lv.liquidacion.estado !== "anulado");
  const elegida = (activa ?? relevantes[relevantes.length - 1])?.liquidacion;

  return (
    <ViewModalShell
      title="Liquidación al transportista"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {elegida && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({ liquidacion: elegida.id });
                if (tenantId) params.set("tenantId", tenantId);
                navigate(`/liquidaciones?${params.toString()}`);
              }}
              className={viewModalBtnPrimary}
            >
              Ir a la liquidación
            </button>
          )}
        </>
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
          {estado ? tooltipLiquidacionEstado(viaje) : "Este viaje no tiene transportista externo o el tenant no tiene integración ARCA."}
        </p>

        {elegida ? (
          <div className={viewModalGridClass}>
            <Campo label="Líquido a pagar" value={fmtImporte(elegida.liquido)} />
            {elegida.ptoVenta != null && (
              <Campo label="Punto de venta" value={elegida.ptoVenta} />
            )}
            {elegida.cbteNro != null && (
              <Campo label="Nº comprobante" value={elegida.cbteNro} />
            )}
            {elegida.cae && <Campo label="CAE" value={elegida.cae} />}
            {elegida.caeFechaVto && (
              <Campo label="Vencimiento CAE" value={fmtDate(elegida.caeFechaVto)} />
            )}
            {elegida.periodoDesde && elegida.periodoHasta && (
              <Campo
                label="Período liquidado"
                value={`${fmtDate(elegida.periodoDesde)} — ${fmtDate(elegida.periodoHasta)}`}
              />
            )}
            {elegida.motivoAnulacion && (
              <Campo label="Motivo de anulación" value={elegida.motivoAnulacion} />
            )}
          </div>
        ) : (
          estado && (
            <p className="text-sm text-vialto-steel/70">
              Todavía no hay ninguna liquidación vinculada a este viaje.
            </p>
          )
        )}
      </div>
    </ViewModalShell>
  );
}

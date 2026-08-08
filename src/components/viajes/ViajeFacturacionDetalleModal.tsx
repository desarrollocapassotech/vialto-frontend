import { useNavigate } from "react-router-dom";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  tooltipFacturacionEstado,
  type FacturacionEstado,
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

function fmtImporte(importe: number | null | undefined, moneda?: string | null) {
  if (importe == null) return "—";
  const prefix = moneda === "USD" ? "USD " : "$ ";
  return `${prefix}${importe.toLocaleString("es-AR")}`;
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function ViajeFacturacionDetalleModal({
  viaje,
  onClose,
  tenantId,
}: {
  viaje: Pick<Viaje, "facturacionEstado" | "factura">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const navigate = useNavigate();
  const estado = (viaje.facturacionEstado ?? "sin_facturar") as FacturacionEstado;
  const factura = viaje.factura;

  return (
    <ViewModalShell
      title="Facturación del viaje"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {factura && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  tenantId ? "/facturacion" : `/facturacion?factura=${factura.id}`,
                  tenantId
                    ? { state: { tenantId, viewFacturaId: factura.id } }
                    : undefined,
                )
              }
              className={viewModalBtnPrimary}
            >
              Ir a la factura
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <span
          className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${facturacionEstadoBadgeClass[estado]}`}
        >
          {facturacionEstadoLabel[estado] ?? estado}
        </span>
        <p className="text-sm text-vialto-charcoal">{tooltipFacturacionEstado(viaje)}</p>

        {factura ? (
          <div className={viewModalGridClass}>
            <Campo label="Número de factura" value={factura.numero} />
            <Campo label="Importe" value={fmtImporte(factura.importe, factura.moneda)} />
            {factura.fechaEmision && (
              <Campo label="Fecha de emisión" value={fmtDate(factura.fechaEmision)} />
            )}
            {factura.ptoVenta != null && (
              <Campo label="Punto de venta" value={factura.ptoVenta} />
            )}
            {factura.cbteNro != null && (
              <Campo label="Nº comprobante" value={factura.cbteNro} />
            )}
            {factura.cae && <Campo label="CAE" value={factura.cae} />}
            {factura.caeFechaVto && (
              <Campo label="Vencimiento CAE" value={fmtDate(factura.caeFechaVto)} />
            )}
          </div>
        ) : (
          <p className="text-sm text-vialto-steel/70">
            Todavía no hay ninguna factura vinculada a este viaje.
          </p>
        )}
      </div>
    </ViewModalShell>
  );
}

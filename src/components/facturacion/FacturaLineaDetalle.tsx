import { DetalleConTooltip, MontoConIvaTooltip } from "@/components/shared/DetalleTooltips";
import { round2 } from "@/lib/liquidacionConceptosIva";
import { filasPdfFactura, type TenantPdfDetalle } from "@/lib/pdfDetalleViaje";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { FacturaLineaDraft } from "./FacturaLineasEditor";

/**
 * Fila de "Detalles del viaje" de una factura, con el mismo formato que la de Liquidaciones:
 * "Viaje #ID" con la fila del PDF de la factura en un tooltip (ver `filasPdfFactura`) y el
 * importe con IVA con su desglose en otro. Las líneas que no son de un solo viaje
 * (tramos, línea única) muestran su descripción.
 */
export function FacturaLineaDetalle({
  linea,
  ivaPctDefault,
  formatMonto,
  tenant,
}: {
  linea: FacturaLineaDraft;
  ivaPctDefault: number;
  formatMonto: (n: number) => string;
  tenant: TenantPdfDetalle;
}) {
  const ivaPct = linea.ivaPct ?? ivaPctDefault;
  const base = round2(linea.importe || 0);
  const v = linea.viaje;

  return (
    <div className="flex items-start justify-between text-sm">
      {v ? (
        <DetalleConTooltip
          label={`Viaje #${numeroVisibleViaje(v)}`}
          filas={filasPdfFactura(linea, ivaPct, tenant)}
        />
      ) : (
        <div className="min-w-0 whitespace-pre-wrap break-words pr-4 text-vialto-charcoal">
          {linea.descripcion || "Sin descripción"}
        </div>
      )}
      <MontoConIvaTooltip base={base} ivaPct={ivaPct} formatMonto={formatMonto} />
    </div>
  );
}

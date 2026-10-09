import { round2 } from "@/lib/liquidacionConceptosIva";
import { DetalleConTooltip, MontoConIvaTooltip } from "@/components/shared/DetalleTooltips";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import { filasPdfLiquidacion, type TenantPdfDetalle } from "@/lib/pdfDetalleViaje";
import type { Viaje } from "@/types/api";

type ViajeMontosPdf = Pick<
  Viaje,
  "precioTransportistaExterno" | "cantidadTransportista" | "precioUnitarioTransportista"
>;

/** Base (sin IVA) del viaje, calculada igual que la fila del PDF. */
function montosViajePdf(v: ViajeMontosPdf) {
  const cantidad = v.cantidadTransportista ?? null;
  const tarifa = v.precioUnitarioTransportista ?? null;
  const base =
    cantidad != null && tarifa != null
      ? round2(cantidad * tarifa)
      : round2(v.precioTransportistaExterno ?? 0);
  return { base };
}

/** Subtotal con IVA del viaje; el tooltip muestra el importe sin y con IVA. */
export function ViajeSubtotalTooltip({
  viaje,
  ivaPct,
  formatMonto,
}: {
  viaje: ViajeMontosPdf;
  ivaPct: number;
  formatMonto: (n: number) => string;
}) {
  const { base } = montosViajePdf(viaje);
  return <MontoConIvaTooltip base={base} ivaPct={ivaPct} formatMonto={formatMonto} />;
}

/**
 * "Viaje #ID" con un tooltip que muestra la misma fila que el viaje tiene en el PDF del
 * CVLP (ver `filasPdfLiquidacion`).
 */
export function ViajeDetallePdfTooltip({
  viaje: v,
  ivaPct,
  tenant,
  unSoloViaje,
  algunoConIdPropio,
}: {
  viaje: Parameters<typeof filasPdfLiquidacion>[0];
  ivaPct: number;
  tenant: TenantPdfDetalle;
  /** El PDF cambia de formato con un solo viaje (sin columna de ID). */
  unSoloViaje: boolean;
  /** Algún viaje de la liquidación tiene ID propio (define el nombre de la columna de ID). */
  algunoConIdPropio: boolean;
}) {
  return (
    <DetalleConTooltip
      label={`Viaje #${numeroVisibleViaje(v)}`}
      filas={filasPdfLiquidacion(v, ivaPct, tenant, { unSoloViaje, algunoConIdPropio })}
    />
  );
}

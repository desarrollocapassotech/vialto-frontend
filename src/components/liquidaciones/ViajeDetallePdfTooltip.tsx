import { fmtLiquidacionMoney } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { round2 } from "@/lib/liquidacionConceptosIva";
import { DetalleConTooltip, MontoConIvaTooltip } from "@/components/shared/DetalleTooltips";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Viaje } from "@/types/api";

type ViajeMontosPdf = Pick<
  Viaje,
  "precioTransportistaExterno" | "cantidadTransportista" | "precioUnitarioTransportista"
>;

/** Base, precio e importe con IVA del viaje, calculados igual que la fila del PDF. */
function montosViajePdf(v: ViajeMontosPdf, ivaPct: number) {
  const cantidad = v.cantidadTransportista ?? null;
  const tarifa = v.precioUnitarioTransportista ?? null;
  const base =
    cantidad != null && tarifa != null
      ? round2(cantidad * tarifa)
      : round2(v.precioTransportistaExterno ?? 0);
  const conIva = round2(base * (1 + (Number(ivaPct) || 0) / 100));
  return { cantidad, precio: tarifa ?? base, base, iva: round2(conIva - base), conIva };
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
  const { base } = montosViajePdf(viaje, ivaPct);
  return <MontoConIvaTooltip base={base} ivaPct={ivaPct} formatMonto={formatMonto} />;
}

/**
 * "Viaje #ID" con un tooltip que muestra el mismo detalle que la fila del viaje
 * en el PDF del CVLP (ver `liquidacion-pdf.service.ts` del backend).
 */
export function ViajeDetallePdfTooltip({
  viaje: v,
  ivaPct,
  idPropio2Habilitado,
  idPropio2Label,
}: {
  viaje: Pick<
    Viaje,
    | "numero"
    | "numeroIdentificacionPersonalizado"
    | "idPropio2"
    | "origen"
    | "destino"
    | "chofer"
    | "precioTransportistaExterno"
    | "cantidadTransportista"
    | "precioUnitarioTransportista"
  >;
  ivaPct: number;
  idPropio2Habilitado: boolean;
  idPropio2Label: string;
}) {
  const { cantidad, precio, base, conIva } = montosViajePdf(v, ivaPct);
  const ruta = [v.origen, v.destino].filter(Boolean).join(" - ");

  const filas: [string, string][] = [
    ["Producto", "Servicios logísticos"],
    ...(idPropio2Habilitado && v.idPropio2?.trim()
      ? [[idPropio2Label, v.idPropio2.trim()] as [string, string]]
      : []),
    ...(ruta ? [["Recorrido", ruta] as [string, string]] : []),
    ...(v.chofer?.nombre ? [["Chofer", v.chofer.nombre.trim()] as [string, string]] : []),
    ["Cantidad", (cantidad ?? 1).toLocaleString("es-AR")],
    ["Precio unitario", fmtLiquidacionMoney(precio)],
    ["Base", fmtLiquidacionMoney(base)],
    ["IVA", `${ivaPct}%`],
    ["Subtotal c/IVA", fmtLiquidacionMoney(conIva)],
  ];

  return <DetalleConTooltip label={`Viaje #${numeroVisibleViaje(v)}`} filas={filas} />;
}

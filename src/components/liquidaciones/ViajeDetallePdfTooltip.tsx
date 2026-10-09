import { fmtLiquidacionMoney } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { round2 } from "@/lib/liquidacionConceptosIva";
import { tooltipPanelClassBelow } from "@/lib/tooltip";
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
  const { base, iva, conIva } = montosViajePdf(viaje, ivaPct);
  return (
    <div className="group relative shrink-0 text-right">
      <span className="cursor-help font-medium tabular-nums text-vialto-charcoal underline decoration-dotted decoration-vialto-steel/60 underline-offset-4">
        {formatMonto(conIva)}
      </span>
      <div className={tooltipPanelClassBelow.replace("left-0", "right-0").replace("w-[min(22rem,calc(100vw-2.5rem))]", "w-max")}>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
          <dt className="text-white/60">Sin IVA</dt>
          <dd className="text-right tabular-nums">{formatMonto(base)}</dd>
          <dt className="text-white/60">IVA {ivaPct}%</dt>
          <dd className="text-right tabular-nums">{formatMonto(iva)}</dd>
          <dt className="text-white/60">Con IVA</dt>
          <dd className="text-right font-medium tabular-nums">{formatMonto(conIva)}</dd>
        </dl>
      </div>
    </div>
  );
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

  return (
    <div className="group relative pr-4">
      <span className="cursor-help text-vialto-charcoal underline decoration-dotted decoration-vialto-steel/60 underline-offset-4">
        Viaje #{numeroVisibleViaje(v)}
      </span>
      <div className={tooltipPanelClassBelow}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {filas.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-white/60">{k}</dt>
              <dd className="tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

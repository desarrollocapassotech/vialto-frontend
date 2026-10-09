import { DetalleConTooltip, MontoConIvaTooltip } from "@/components/shared/DetalleTooltips";
import { round2 } from "@/lib/liquidacionConceptosIva";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { FacturaLineaDraft } from "./FacturaLineasEditor";

/**
 * Fila de "Detalles del viaje" de una factura, con el mismo formato que la de Liquidaciones:
 * "Viaje #ID" con el detalle en un tooltip y el importe con IVA con su desglose en otro.
 * Las líneas que no son de un solo viaje (tramos, línea única) muestran su descripción.
 */
export function FacturaLineaDetalle({
  linea,
  ivaPctDefault,
  formatMonto,
}: {
  linea: FacturaLineaDraft;
  ivaPctDefault: number;
  formatMonto: (n: number) => string;
}) {
  const ivaPct = linea.ivaPct ?? ivaPctDefault;
  const base = round2(linea.importe || 0);
  const v = linea.viaje;
  const descripcion = linea.descripcion || "Sin descripción";

  let izquierda;
  if (v) {
    const ruta = [v.origen, v.destino].filter(Boolean).join(" - ");
    const cantidad = linea.cantidad ?? 1;
    const filas: [string, string][] = [
      ["Detalle", descripcion],
      ...(ruta ? [["Recorrido", ruta] as [string, string]] : []),
      ...(v.chofer?.nombre ? [["Chofer", v.chofer.nombre.trim()] as [string, string]] : []),
      ["Cantidad", cantidad.toLocaleString("es-AR")],
      ["Precio unitario", formatMonto(linea.precioUnitario ?? base)],
      ["Base", formatMonto(base)],
      ["IVA", `${ivaPct}%`],
      ["Subtotal c/IVA", formatMonto(round2(base * (1 + ivaPct / 100)))],
    ];
    izquierda = <DetalleConTooltip label={`Viaje #${numeroVisibleViaje(v)}`} filas={filas} />;
  } else {
    izquierda = (
      <div className="min-w-0 whitespace-pre-wrap break-words pr-4 text-vialto-charcoal">
        {descripcion}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between text-sm">
      {izquierda}
      <MontoConIvaTooltip base={base} ivaPct={ivaPct} formatMonto={formatMonto} />
    </div>
  );
}

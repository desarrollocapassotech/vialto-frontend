/**
 * Filas de detalle de un viaje tal como salen en los PDFs del backend, para los tooltips
 * de "Detalles del viaje" de los modales de Facturas y Liquidaciones. Espejo de:
 * - Factura ARCA: `buildDetalleFlete` + tabla de ítems en
 *   `vialto-backend/.../liquidaciones-arca/factura-pdf.service.ts`.
 * - CVLP: fila de viaje en `vialto-backend/.../liquidaciones-arca/liquidacion-pdf.service.ts`.
 * Si cambia el PDF, actualizar acá también.
 */
import { round2 } from "@/lib/liquidacionConceptosIva";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Tenant, Viaje } from "@/types/api";

export type TenantPdfDetalle = Pick<
  Tenant,
  | "labelIdentificacionPersonalizadaViajes"
  | "idPropio1Habilitado"
  | "idPropio2Habilitado"
  | "idPropio2Label"
  | "unidadCantidadViajes"
> | null | undefined;

/** Mismo formato numérico que `fmtNum` de los PDFs (es-AR, 2 decimales, sin símbolo). */
export function fmtNumPdf(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function unidad(tenant: TenantPdfDetalle): "TN" | "UD" {
  return tenant?.unidadCantidadViajes === "UD" ? "UD" : "TN";
}

function idPropio2(v: Pick<Viaje, "idPropio2">, tenant: TenantPdfDetalle): [string, string] | null {
  const valor = v.idPropio2?.trim();
  if (!tenant?.idPropio2Habilitado || !valor) return null;
  return [tenant.idPropio2Label?.trim() || "ID Propio 2", valor];
}

type ViajeFactura = Pick<
  Viaje,
  "numero" | "numeroIdentificacionPersonalizado" | "idPropio2" | "origen" | "destino" | "productosViaje"
>;

/** Texto de la columna "Detalle" del PDF de factura (sin pasar a mayúsculas). */
export function detalleFleteFactura(v: ViajeFactura, tenant: TenantPdfDetalle): string {
  // El nombre del ID propio solo va si el viaje lo tiene cargado; si no, es el número interno.
  const labelCtg = v.numeroIdentificacionPersonalizado?.trim()
    ? tenant?.labelIdentificacionPersonalizadaViajes?.trim() || "ID propio"
    : "VIAJE";
  const partes = [`FLETE S/${labelCtg}: ${numeroVisibleViaje(v)}`];
  const id2 = idPropio2(v, tenant);
  if (id2) partes.push(`${id2[0]} ${id2[1]}`);
  const ruta: string[] = [];
  if (v.origen) ruta.push(`ORIGEN: ${v.origen}`);
  if (v.destino) ruta.push(`DESTINO: ${v.destino}`);
  if (ruta.length) partes.push(ruta.join(" "));
  let detalle = partes.join(" – ");
  const producto = (v.productosViaje ?? [])
    .map((p) => p.producto?.nombre)
    .filter(Boolean)
    .join(", ");
  if (producto) detalle += ` - PRODUCTO: ${producto}`;
  return detalle;
}

/** Fila del PDF de factura: Detalle, Cantidad, Tarifa, SubTotal, IVA %, SubTotal c/IVA. */
export function filasPdfFactura(
  linea: {
    descripcion: string;
    importe: number;
    cantidad?: number;
    precioUnitario?: number;
    viaje?: ViajeFactura;
  },
  ivaPct: number,
  tenant: TenantPdfDetalle,
): [string, string][] {
  const base = round2(linea.importe || 0);
  const detalle = linea.viaje ? detalleFleteFactura(linea.viaje, tenant) : linea.descripcion;
  const cantidad =
    linea.cantidad != null
      ? linea.viaje
        ? `${fmtNumPdf(linea.cantidad)} ${unidad(tenant)}`
        : fmtNumPdf(linea.cantidad)
      : "1,00";
  return [
    ["Detalle", detalle.toUpperCase()],
    ["Cantidad", cantidad],
    ["Tarifa", fmtNumPdf(linea.precioUnitario ?? base)],
    ["SubTotal", fmtNumPdf(base)],
    ["IVA %", fmtNumPdf(ivaPct)],
    ["SubTotal c/IVA", fmtNumPdf(round2(base * (1 + ivaPct / 100)))],
  ];
}

type ViajeLiquidacion = Pick<
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

/**
 * Fila de un viaje en el PDF del CVLP. Con un solo viaje el PDF no tiene columna de ID y
 * lo pone en la descripción; con varios, la columna se llama como el ID propio de la
 * empresa (si algún viaje lo usa) o "ID de Viaje".
 */
export function filasPdfLiquidacion(
  v: ViajeLiquidacion,
  ivaPct: number,
  tenant: TenantPdfDetalle,
  opts: { unSoloViaje: boolean; algunoConIdPropio: boolean },
): [string, string][] {
  const labelIdPropio = tenant?.labelIdentificacionPersonalizadaViajes?.trim() || "ID propio";
  const usaIdPropio = (tenant?.idPropio1Habilitado ?? true) && opts.algunoConIdPropio;
  const idTexto = (v.numeroIdentificacionPersonalizado ?? v.numero).toString().toUpperCase();

  const desc: string[] = [];
  if (opts.unSoloViaje) {
    const prefijo = usaIdPropio && v.numeroIdentificacionPersonalizado?.trim() ? labelIdPropio : "ID";
    desc.push(`${prefijo}: ${idTexto}`);
  }
  const id2 = idPropio2(v, tenant);
  if (id2) desc.push(`${id2[0]}: ${id2[1]}`);
  const ruta = [v.origen, v.destino].filter(Boolean).join(" - ");
  if (ruta) desc.push(ruta);
  if (v.chofer?.nombre) desc.push(`Chofer: ${v.chofer.nombre.trim()}`);

  const cantidad = v.cantidadTransportista ?? null;
  const tarifa = v.precioUnitarioTransportista ?? null;
  const base =
    cantidad != null && tarifa != null
      ? round2(cantidad * tarifa)
      : round2(v.precioTransportistaExterno ?? 0);

  return [
    ...(opts.unSoloViaje
      ? []
      : [[usaIdPropio ? labelIdPropio : "ID de Viaje", idTexto] as [string, string]]),
    ["Producto", "SERVICIOS LOGISTICOS"],
    ["Descripción", desc.join("\n").toUpperCase()],
    ["Cantidad", cantidad != null ? `${fmtNumPdf(cantidad)} ${unidad(tenant)}` : "1,00"],
    ["Precio", fmtNumPdf(tarifa ?? base)],
    ["SubTotal", fmtNumPdf(base)],
    ["IVA %", fmtNumPdf(ivaPct)],
    ["SubTotal c/IVA", fmtNumPdf(round2(base * (1 + ivaPct / 100)))],
  ];
}

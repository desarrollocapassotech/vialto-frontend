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
import { productoLabels } from "@/lib/productoLabel";
import type { Tenant, Viaje } from "@/types/api";

export type TenantPdfDetalle = Pick<
  Tenant,
  | "labelIdentificacionPersonalizadaViajes"
  | "idPropio1Habilitado"
  | "idPropio2Habilitado"
  | "idPropio2Label"
  | "unidadCantidadViajes"
  | "productoLabel"
  | "productoLabelPlural"
> | null | undefined;

/** Mismo formato numérico que `fmtNum` de los PDFs (es-AR, 2 decimales, sin símbolo). */
export function fmtNumPdf(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Unidad de cantidad de flete del tenant ("TN" por defecto), igual que en los PDFs. */
export function unidadCantidadViajes(
  tenant: Pick<Tenant, "unidadCantidadViajes"> | null | undefined,
): "TN" | "UD" {
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
  if (producto) detalle += ` - ${productoLabels(tenant).singular.toUpperCase()}: ${producto}`;
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
        ? `${fmtNumPdf(linea.cantidad)} ${unidadCantidadViajes(tenant)}`
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
  | "productosViaje"
  | "precioTransportistaExterno"
  | "cantidadTransportista"
  | "precioUnitarioTransportista"
>;

/** Identificación del viaje en el CVLP: "CTG 101…-CP 0-1761" (ID propio + ID propio 2) o "Viaje #N". */
function refViajeCvlp(v: ViajeLiquidacion, tenant: TenantPdfDetalle): string {
  const idPropio = v.numeroIdentificacionPersonalizado?.trim();
  const usaIdPropio = (tenant?.idPropio1Habilitado ?? true) && Boolean(idPropio);
  let ref = usaIdPropio
    ? `${tenant?.labelIdentificacionPersonalizadaViajes?.trim() || "ID propio"} ${idPropio}`
    : `Viaje #${v.numero}`;
  const id2 = idPropio2(v, tenant);
  if (id2) ref += `-${id2[0]} ${id2[1]}`;
  return ref;
}

/**
 * Detalle de la línea de un viaje en el CVLP: "Chofer — CTG 101…-CP 0-1761 — Origen a
 * Destino — Producto". Espejo de `detalleViajeCvlp` en `liquidacion-pdf.service.ts`.
 */
export function detalleViajeCvlp(v: ViajeLiquidacion, tenant: TenantPdfDetalle): string {
  const ruta = [v.origen?.trim(), v.destino?.trim()].filter(Boolean).join(" a ");
  const productos = (v.productosViaje ?? [])
    .map((p) => p.producto?.nombre?.trim())
    .filter(Boolean)
    .join(", ");
  return [v.chofer?.nombre?.trim(), refViajeCvlp(v, tenant), ruta, productos]
    .filter(Boolean)
    .join(" — ");
}

/** Fila de un viaje en el PDF del CVLP (columnas Cantidad | Detalle | Tarifa | IVA % | Importe). */
export function filasPdfLiquidacion(
  v: ViajeLiquidacion,
  ivaPct: number,
  tenant: TenantPdfDetalle,
): [string, string][] {
  const cantidad = v.cantidadTransportista ?? null;
  const tarifa = v.precioUnitarioTransportista ?? null;
  const base =
    cantidad != null && tarifa != null
      ? round2(cantidad * tarifa)
      : round2(v.precioTransportistaExterno ?? 0);

  return [
    ["Cantidad", cantidad != null ? `${fmtNumPdf(cantidad)} ${unidadCantidadViajes(tenant)}` : "1,00"],
    ["Detalle", detalleViajeCvlp(v, tenant)],
    ["Tarifa", fmtNumPdf(tarifa ?? base)],
    ["IVA %", fmtNumPdf(ivaPct)],
    ["Importe", fmtNumPdf(base)],
  ];
}

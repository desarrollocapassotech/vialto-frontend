/**
 * Mapeo AFIP de condición frente al IVA → tipo de comprobante.
 * 1 = IVA Responsable Inscripto → clase A (Factura 1 / CVLP 60)
 * Resto (monotributo, CF, exento, etc.) → clase B (Factura 6 / CVLP 61)
 */

export type CvlpCbteTipo = 60 | 61;
export type FacturaLetra = "a" | "b";
export type FacturaCbteTipo = 1 | 6;
/** Nota de Crédito que anula Factura A (1→3) o Factura B (6→8). */
export type FacturaNcCbteTipo = 3 | 8;

/**
 * CUIT de prueba estándar de AFIP SDK para homologación (ver arca.util.ts en el backend).
 * En homologación el backend lo usa automáticamente en lugar del CUIT real del emisor,
 * sin certificado propio.
 */
export const CUIT_TEST_HOMOLOGACION = "20409378472";

export const ARCA_CBTE_OVERRIDE_WARNING =
  "Este tipo corresponde a la condición frente al IVA de la contraparte. Modificarlo manualmente puede provocar el rechazo del comprobante por parte de ARCA.";

export function isResponsableInscripto(
  condicionIva: number | null | undefined,
): boolean {
  return condicionIva === 1;
}

/** Monotributo, Monotributista Social y Monotributo Trabajador Independiente Promovido. */
const CONDICIONES_IVA_MONOTRIBUTO = new Set([6, 13, 16]);

/**
 * Transportista monotributista: no se le emite Líquido Producto. La liquidación queda
 * manual (`Liquidacion.manual`) con la factura del transportista adjunta, como en una
 * empresa sin ARCA. Espejo de `esCondicionIvaMonotributo` del backend (`arca.util.ts`).
 */
export function esCondicionIvaMonotributo(
  condicionIva: number | null | undefined,
): boolean {
  return condicionIva != null && CONDICIONES_IVA_MONOTRIBUTO.has(condicionIva);
}

/**
 * Si una liquidación puntual va por ARCA (emitir, anular, PDF del CVLP, estados de AFIP).
 * Con la empresa con Líquido Producto pero la liquidación `manual`, se trata como en una
 * empresa sin ARCA (adjuntar comprobante, PDF de liquidación, sin badge de estado AFIP).
 */
export function liquidacionConArca(
  hasArca: boolean,
  liq: { manual?: boolean | null } | null | undefined,
): boolean {
  return hasArca && !liq?.manual;
}

/**
 * Lo mismo para una factura: con la empresa con ARCA pero la factura `manual` (hecha por
 * fuera del sistema) se trata como en una empresa sin ARCA (número, comprobante adjunto,
 * sin emitir ni anular).
 */
export function facturaConArca(
  hasArca: boolean,
  factura: { manual?: boolean | null } | null | undefined,
): boolean {
  return hasArca && !factura?.manual;
}

/**
 * true si la condición IVA del transportista corresponde a un CVLP clase B (061:
 * exento, consumidor final, no categorizado…), que no se emite — ver "Gotchas
 * operativos de ARCA" en vialto-backend/CLAUDE.md. RI recibe 060 y el monotributista
 * va por liquidación manual (`esCondicionIvaMonotributo`), así que ninguno de los dos
 * entra acá. Si la condición IVA todavía no está cargada, no advierte — ese caso ya lo
 * cubre la validación de datos faltantes.
 */
export function cvlpClaseBEsperada(
  condicionIva: number | null | undefined,
): boolean {
  return (
    condicionIva != null &&
    !isResponsableInscripto(condicionIva) &&
    !esCondicionIvaMonotributo(condicionIva)
  );
}

export const CVLP_CLASE_B_WARNING =
  "La condición frente al IVA de este transportista normalmente correspondería a un comprobante Líquido Producto clase B (CVLP 061), pero el sistema emite siempre CVLP 060 (clase A).";

export function facturaLetraFromCondicionIva(
  condicionIva: number | null | undefined,
): FacturaLetra {
  return isResponsableInscripto(condicionIva) ? "a" : "b";
}

export function facturaCbteTipoFromLetra(letra: FacturaLetra): FacturaCbteTipo {
  return letra === "a" ? 1 : 6;
}

export function facturaLetraFromCbteTipo(
  cbteTipo: number | null | undefined,
): FacturaLetra | null {
  if (cbteTipo === 1 || cbteTipo === 3) return "a";
  if (cbteTipo === 6 || cbteTipo === 8) return "b";
  return null;
}

/**
 * Factura A (01) → NC A (03); Factura B (06) → NC B (08).
 * Misma correspondencia de clase A/B que la anulación de CVLP (3/8).
 */
export function facturaNcCbteTipoFromFactura(
  cbteTipo: number | null | undefined,
  condicionIvaCliente?: number | null,
): FacturaNcCbteTipo {
  if (cbteTipo === 1 || cbteTipo === 3) return 3;
  if (cbteTipo === 6 || cbteTipo === 8) return 8;
  return isResponsableInscripto(condicionIvaCliente) ? 3 : 8;
}

export function facturaNcLabel(ncTipo: FacturaNcCbteTipo): string {
  return ncTipo === 3
    ? "Nota de Crédito A (cód. 03)"
    : "Nota de Crédito B (cód. 08)";
}

export function cvlpCbteLabel(cbteTipo: CvlpCbteTipo): string {
  return cbteTipo === 60
    ? "CVLP Tipo 60 (clase A)"
    : "CVLP Tipo 61 (clase B)";
}

/**
 * Comprobante estándar con el que se anula un CVLP autorizado, asociado (CbtesAsoc)
 * al 060/061 original: Nota de Crédito (cód. 3 clase A / 8 clase B) o
 * Nota de Débito (cód. 2 clase A / 7 clase B), a elección del tenant.
 */
export function esNotaDebitoAnulacion(cbteTipo: number | null | undefined): boolean {
  return cbteTipo === 2 || cbteTipo === 7;
}

export function anulacionComprobanteLabel(cbteTipo: number | null | undefined): string {
  return esNotaDebitoAnulacion(cbteTipo) ? "Nota de Débito" : "Nota de Crédito";
}

/**
 * Si una factura se puede editar desde Facturas: solo si nunca entró al circuito de emisión
 * de ARCA (`arcaEstado == null`) — con ARCA eso es el borrador; una factura autorizada,
 * esperando CAE, con error o anulada se corrige anulándola y volviéndola a emitir. Las
 * facturas manuales (empresa sin ARCA) no tienen `arcaEstado` y se siguen editando. Mismo
 * criterio que `assertFacturaEditable` del backend; no depende de saber si la empresa tiene
 * ARCA, así sirve igual desde Viajes, Cuenta corriente o Inicio.
 */
export function facturaEditable(factura: {
  estado: string;
  arcaEstado?: string | null;
}): boolean {
  return factura.arcaEstado == null && factura.estado !== "anulado";
}

/** "0003-00000072" a partir de punto de venta y número de comprobante. */
export function nroComprobante(ptoVenta: number | null | undefined, nro: number): string {
  return `${String(ptoVenta ?? 0).padStart(4, "0")}-${String(nro).padStart(8, "0")}`;
}

export function facturaLetraLabel(letra: FacturaLetra): string {
  return letra === "a" ? "Factura A" : "Factura B";
}

export function condicionIvaLabel(condicionIva: number | null | undefined): string {
  switch (condicionIva) {
    case 1:
      return "IVA Responsable Inscripto";
    case 4:
      return "IVA Sujeto Exento";
    case 5:
      return "Consumidor Final";
    case 6:
      return "Responsable Monotributo";
    case 13:
      return "Monotributista Social";
    case 16:
      return "Monotributo Trabajador Independiente Promovido";
    default:
      return condicionIva != null
        ? `Condición IVA ${condicionIva}`
        : "Condición IVA no cargada";
  }
}

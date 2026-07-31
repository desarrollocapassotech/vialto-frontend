/**
 * Mapeo AFIP de condición frente al IVA → tipo de comprobante.
 * 1 = IVA Responsable Inscripto → clase A (Factura 1 / CVLP 60)
 * Resto (monotributo, CF, exento, etc.) → clase B (Factura 6 / CVLP 61)
 */

export type CvlpCbteTipo = 60 | 61;
export type FacturaLetra = "a" | "b";
export type FacturaCbteTipo = 1 | 6;

export const ARCA_CBTE_OVERRIDE_WARNING =
  "Este tipo corresponde a la condición frente al IVA de la contraparte. Modificarlo manualmente puede provocar el rechazo del comprobante por parte de ARCA.";

export function isResponsableInscripto(
  condicionIva: number | null | undefined,
): boolean {
  return condicionIva === 1;
}

export function cvlpCbteTipoFromCondicionIva(
  condicionIva: number | null | undefined,
): CvlpCbteTipo {
  return isResponsableInscripto(condicionIva) ? 60 : 61;
}

export function facturaLetraFromCondicionIva(
  condicionIva: number | null | undefined,
): FacturaLetra {
  return isResponsableInscripto(condicionIva) ? "a" : "b";
}

export function facturaCbteTipoFromLetra(letra: FacturaLetra): FacturaCbteTipo {
  return letra === "a" ? 1 : 6;
}

export function cvlpCbteLabel(cbteTipo: CvlpCbteTipo): string {
  return cbteTipo === 60
    ? "CVLP Tipo 60 (clase A)"
    : "CVLP Tipo 61 (clase B)";
}

/** Código AFIP de Nota de Crédito asociada a CVLP. */
export const CBTE_TIPO_NC_CVLP = 65 as const;

export function ncCvlpCbteLabel(cbteTipo: number = CBTE_TIPO_NC_CVLP): string {
  return `Nota de Crédito Tipo ${String(cbteTipo).padStart(3, "0")}`;
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
    default:
      return condicionIva != null
        ? `Condición IVA ${condicionIva}`
        : "Condición IVA no cargada";
  }
}

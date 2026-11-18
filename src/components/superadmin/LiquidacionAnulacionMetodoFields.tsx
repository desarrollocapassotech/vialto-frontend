export type LiquidacionAnulacionMetodo = "nota_credito_debito" | "manual";

/**
 * Cómo se anula un comprobante 060 (CVLP) ya emitido para la empresa. Se configura
 * solo desde "Configuración por empresa" → Liquidaciones (`ConfigLiquidacionesSecciones`).
 */
export const LIQUIDACION_ANULACION_METODO_OPCIONES: {
  value: LiquidacionAnulacionMetodo;
  label: string;
  desc: string;
}[] = [
  {
    value: "nota_credito_debito",
    label: "Nota de Crédito/Débito vía ARCA",
    desc: "Comportamiento por defecto: emite un comprobante asociado (NC o ND) a través del web service de AFIP.",
  },
  {
    value: "manual",
    label: "Registro manual (sin ARCA)",
    desc: "La anulación queda en 2 pasos (pendiente → anulada) y se respalda con un comprobante pre-impreso adjunto por el usuario. No se emite nada a ARCA.",
  },
];

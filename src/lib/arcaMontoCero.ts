/**
 * ARCA no admite comprobantes (Factura / CVLP) por $0. Los modales de crear factura y
 * liquidación deshabilitan "Emitir" con este mensaje; el borrador se puede guardar igual.
 */
export const MSG_EMITIR_MONTO_CERO =
  "No se puede emitir un comprobante con monto $0. Revisá los viajes seleccionados y sus importes.";

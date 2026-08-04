/**
 * Aviso antes de emitir: en homologación se usa el CUIT de prueba de AFIP,
 * así que el comprobante que se va a emitir no tiene validez fiscal.
 */
export function AmbienteHomologacionWarning({
  ambiente,
}: {
  ambiente?: string | null;
}) {
  if (ambiente !== "homologacion") return null;
  return (
    <div
      className="rounded border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900"
      role="alert"
    >
      <p className="font-medium">Ambiente de homologación (pruebas)</p>
      <p className="mt-0.5">
        Está seleccionado el ambiente de homologación: el comprobante se va a
        emitir con el CUIT de prueba de AFIP y no va a tener validez fiscal.
        Los CUIT reales de clientes/transportistas no están en el padrón de
        pruebas — AFIP recibe datos de receptor de testing (Factura B → consumidor
        final; Factura A → CUIT 30668346908).
      </p>
    </div>
  );
}

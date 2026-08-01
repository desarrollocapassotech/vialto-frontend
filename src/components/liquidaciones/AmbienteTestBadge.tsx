/**
 * Distintivo visual para comprobantes emitidos en homologación (sin validez fiscal):
 * se usa el CUIT de prueba de AFIP en lugar del CUIT real del emisor.
 */
export function AmbienteTestBadge({
  ambiente,
}: {
  ambiente?: string | null;
}) {
  if (ambiente !== "homologacion") return null;
  return (
    <span
      title="Emitido en homologación con el CUIT de prueba de AFIP — sin validez fiscal."
      className="inline-block rounded border border-amber-300/80 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
    >
      Prueba
    </span>
  );
}

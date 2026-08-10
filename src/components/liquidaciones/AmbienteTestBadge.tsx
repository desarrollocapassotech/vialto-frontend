import { Link } from "react-router-dom";

/**
 * Distintivo visual para comprobantes emitidos en homologación (sin validez fiscal):
 * se usa el CUIT de prueba de AFIP en lugar del CUIT real del emisor.
 */
export function AmbienteTestBadge({
  ambiente,
  to,
}: {
  ambiente?: string | null;
  /** Si se pasa, el badge es clickable y navega ahí (ej. a la config de ARCA). */
  to?: string;
}) {
  if (ambiente !== "homologacion") return null;
  const className =
    "inline-block rounded border border-amber-300/80 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800";
  const title = "Emitido en homologación con el CUIT de prueba de AFIP — sin validez fiscal.";
  if (to) {
    return (
      <Link to={to} title={`${title} Click para ver la configuración de ARCA.`} className={`${className} hover:brightness-95 hover:underline`}>
        Ambiente de pruebas
      </Link>
    );
  }
  return (
    <span title={title} className={className}>
      Ambiente de pruebas
    </span>
  );
}

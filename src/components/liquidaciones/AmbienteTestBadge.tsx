import { Link } from "react-router-dom";

/**
 * Distintivo visual para comprobantes emitidos en homologación (sin validez fiscal):
 * se usa el CUIT de prueba de AFIP en lugar del CUIT real del emisor.
 * Estilo sutil (texto ámbar chico con un punto), igual en grillas, modales y breadcrumb.
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
    "inline-flex items-center gap-1 whitespace-nowrap text-xs font-normal normal-case tracking-normal text-amber-700 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-amber-500 before:content-['']";
  const title = "Emitido en homologación con el CUIT de prueba de AFIP — sin validez fiscal.";
  if (to) {
    return (
      <Link to={to} title={`${title} Click para ver la configuración de ARCA.`} className={`${className} hover:underline`}>
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

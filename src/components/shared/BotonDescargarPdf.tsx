import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Botón de ícono para bajar el PDF de un comprobante con su nombre ("Factura B 00001-00000009.pdf"),
 * al lado de su "Ver …" en el pie de los modales de Facturas y Liquidaciones. "Ver" abre el PDF
 * en una pestaña (URL `blob:`) y el visor del navegador lo descarga con un nombre al azar.
 */
export function BotonDescargarPdf({
  label,
  onClick,
}: {
  label: string;
  onClick: () => Promise<void> | void;
}) {
  const [descargando, setDescargando] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={descargando}
      onClick={async () => {
        setDescargando(true);
        try {
          await onClick();
        } finally {
          setDescargando(false);
        }
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center border border-black/20 text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-60"
    >
      {descargando ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}

import { useState } from "react";

/**
 * Muestra un mensaje de error amigable de ARCA y, si hay detalle técnico
 * (respuesta cruda de AFIP SDK), un botón para ver el error completo y copiarlo.
 */
export function ArcaErrorMessage({
  message,
  detalle,
  className,
  align = "left",
}: {
  message: string;
  detalle?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const texto = detalle ? `${message}\n\n${detalle}` : message;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard no disponible: ignorar */
    }
  }

  return (
    <div
      className={`${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
    >
      <p className="text-red-700">{message}</p>
      {detalle && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] text-red-700 underline hover:text-red-800"
          >
            {open ? "Ocultar error completo" : "Ver error completo"}
          </button>
          {open && (
            <div className="mt-1 text-left">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-red-200 bg-red-50 p-2 text-[11px] leading-snug text-red-900">
                {detalle}
              </pre>
              <button
                type="button"
                onClick={() => void copiar()}
                className="mt-1 text-[11px] text-red-700 underline hover:text-red-800"
              >
                {copiado ? "¡Copiado!" : "Copiar error"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

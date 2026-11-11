import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Botón chico de solo ícono que copia `texto` al portapapeles. Muestra un tilde
 * verde un momento al copiar. No propaga el click (sirve dentro de filas o
 * encabezados clickeables).
 */
export function BotonCopiar({
  texto,
  label = "Copiar",
  className = "",
}: {
  texto: string;
  /** Tooltip / aria-label (ej. "Copiar ID del viaje"). */
  label?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = window.setTimeout(() => setCopiado(false), 1500);
    return () => window.clearTimeout(t);
  }, [copiado]);

  async function copiar(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      /* sin permiso de portapapeles: no hacemos nada */
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void copiar(e)}
      title={copiado ? "Copiado" : label}
      aria-label={copiado ? "Copiado" : label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal ${className}`}
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

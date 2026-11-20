import { createPortal } from "react-dom";
import { VialtoTruckLoader } from "./VialtoTruckLoader";

/**
 * Loader único del sistema: el logo de Vialto con el camión que carga y descarga, y un
 * mensaje que dice QUÉ se está cargando ("Cargando viajes…", "Emitiendo la factura en
 * ARCA…"). Tres formas según dónde va:
 *
 * - `bloque` (default): centrado en el lugar del contenido (una grilla, una sección,
 *   el cuerpo de un modal o de una página). `chico` para modales y secciones angostas.
 * - `modal`: capa que tapa todo el panel del modal y no deja tocar nada (el panel tiene
 *   que ser `relative`). Es lo que usa `BloqueoModal`.
 * - `pantalla`: capa fija sobre toda la pantalla con difuminado blanco; se ve el
 *   contenido detrás (skeletons). Para recargas que bloquean la página entera.
 *
 * Textos chicos ("Cargando…" en un botón, un select o una celda) NO usan esto: el
 * camión no se distingue a ese tamaño.
 */
export function CargandoVialto({
  mensaje,
  variante = "bloque",
  chico = false,
  className = "",
}: {
  mensaje: string;
  variante?: "bloque" | "modal" | "pantalla";
  /** Solo `bloque`: versión compacta para modales y secciones angostas. */
  chico?: boolean;
  className?: string;
}) {
  const contenido = (tamano: string) => (
    <>
      <VialtoTruckLoader className={`${tamano} w-auto`} label={mensaje} />
      <p className="px-6 text-center text-sm font-medium text-vialto-steel">{mensaje}</p>
    </>
  );

  if (variante === "pantalla") {
    return createPortal(
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-0 z-[60] flex animate-[fadeIn_150ms_ease-out] cursor-wait flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[3px] ${className}`}
      >
        {contenido("h-48 drop-shadow-sm")}
      </div>,
      document.body,
    );
  }

  if (variante === "modal") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex animate-[fadeIn_150ms_ease-out] cursor-wait flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px] ${className}`}
      >
        {contenido("h-32")}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-1.5 ${chico ? "py-6" : "py-12"} ${className}`}
    >
      {contenido(chico ? "h-20" : "h-32")}
    </div>
  );
}

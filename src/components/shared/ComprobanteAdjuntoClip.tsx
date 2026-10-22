import { Paperclip } from "lucide-react";

/**
 * Variante muy sutil para registros SIN comprobante: clip casi transparente que se marca
 * al pasar el mouse y abre "Adjuntar comprobante" sin disparar el click de la fila.
 */
export function AdjuntarComprobanteClip({
  onClick,
  conTexto = false,
  titulo = "Adjuntar comprobante",
}: {
  onClick: () => void;
  /** Sin número de comprobante: muestra `titulo` al lado del clip. */
  conTexto?: boolean;
  /** Tooltip y texto (ej. "Agregar documento" en Viajes). */
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={titulo}
      aria-label={titulo}
      className={`inline-flex shrink-0 items-center gap-1 transition-colors hover:text-vialto-fire focus-visible:text-vialto-fire ${
        conTexto
          ? "text-xs font-normal text-vialto-steel/50"
          : "text-vialto-steel/25"
      }`}
    >
      <Paperclip className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      {conTexto && titulo}
    </button>
  );
}

/**
 * Clip chico en grillas (Facturas, Liquidaciones) para los registros con comprobante
 * adjunto (`comprobanteUrl`). Clickeable: abre el comprobante sin disparar el click de
 * la fila.
 */
export function ComprobanteAdjuntoClip({
  onClick,
  conTexto = false,
  tono = "comprobante",
  titulo,
}: {
  onClick: () => void;
  /** Sin número de comprobante: muestra "Ver comprobante" al lado del clip. */
  conTexto?: boolean;
  /**
   * `anulacion`: comprobante que anula al original (nota de crédito/débito, anulación
   * manual), en rojo para distinguirlo cuando hay más de un clip en la celda.
   * `pdf`: PDF que genera Vialto (ej. "PDF de liquidación" sin ARCA), en azul.
   */
  tono?: "comprobante" | "anulacion" | "pdf";
  /** Tooltip; por defecto "Ver comprobante adjunto". */
  titulo?: string;
}) {
  const label = titulo ?? "Ver comprobante adjunto";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 ${
        tono === "anulacion"
          ? "text-red-600/80 hover:text-red-800"
          : tono === "pdf"
            ? "text-sky-700/80 hover:text-sky-900"
            : "text-vialto-steel hover:text-vialto-charcoal"
      } ${conTexto ? "text-xs font-normal" : ""}`}
    >
      <Paperclip className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {conTexto && "Ver comprobante"}
    </button>
  );
}

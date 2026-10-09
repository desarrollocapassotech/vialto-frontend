import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Para secciones (pestañas) cuyos filtros viven en el componente hijo pero el título
 * está en la página: la página deja un `<div ref={setSlot} />` junto al `<h1>` y le
 * pasa el elemento; acá se portalea el botón. Sin slot, se renderiza en el lugar.
 */
export function LimpiarFiltrosPortal({
  slot,
  visible,
  ...props
}: Parameters<typeof LimpiarFiltrosButton>[0] & {
  slot: HTMLElement | null | undefined;
  visible: boolean;
}) {
  if (!visible) return null;
  const boton = <LimpiarFiltrosButton {...props} />;
  return slot ? createPortal(boton, slot) : boton;
}

/**
 * "× Limpiar filtros" sutil, al lado del título del listado (mismo estilo que Viajes).
 * Regla global: toda tabla con filtros lo pone junto al `<h1>`, no entre las acciones.
 */
export function LimpiarFiltrosButton({
  onClick,
  cantidad,
  disabled,
  soloDesktop = false,
}: {
  onClick: () => void;
  /** Cantidad de filtros activos; si se pasa, se muestra entre paréntesis. */
  cantidad?: number;
  disabled?: boolean;
  /** true = oculto en mobile (ahí se limpia desde el sheet de filtros). */
  soloDesktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${soloDesktop ? "hidden lg:inline-flex" : "inline-flex"} h-10 shrink-0 items-center gap-1 px-2 text-xs text-vialto-steel underline-offset-4 transition-colors hover:text-vialto-charcoal hover:underline disabled:pointer-events-none disabled:opacity-50`}
      aria-label={
        cantidad != null
          ? `Limpiar filtros (${cantidad} activo${cantidad !== 1 ? "s" : ""})`
          : "Limpiar filtros"
      }
    >
      <X className="h-3.5 w-3.5" aria-hidden />
      Limpiar filtros{cantidad != null ? ` (${cantidad})` : ""}
    </button>
  );
}

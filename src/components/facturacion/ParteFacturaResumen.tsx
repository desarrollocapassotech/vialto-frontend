import { useRef, type ReactNode } from "react";
import { TooltipsDelegados } from "@/components/ui/TooltipsDelegados";

/**
 * Sección "Emisor"/"Receptor" del preview de factura: solo el nombre a la vista (truncado si
 * no entra); el nombre completo y los datos fiscales (`detalle`, multilínea) van en tooltip.
 */
export function ParteFacturaResumen({
  titulo,
  nombre,
  detalle,
  estado,
}: {
  titulo: string;
  nombre: string | null | undefined;
  detalle?: string;
  /** Línea chica debajo del nombre (ej. estado de la validación contra ARCA). */
  estado?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // El nombre va primero en el tooltip: si es largo, a la vista queda truncado.
  const tooltip = [nombre?.trim(), detalle].filter(Boolean).join("\n");

  return (
    <section ref={ref} className="min-w-0 space-y-1">
      <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
        {titulo}
      </p>
      <p
        className={`inline-block max-w-full truncate align-bottom text-sm text-vialto-charcoal font-medium ${
          detalle ? "cursor-help underline decoration-dotted decoration-vialto-steel/60 underline-offset-4" : ""
        }`}
        title={tooltip || undefined}
      >
        {nombre ?? "—"}
      </p>
      {estado && <div>{estado}</div>}
      <TooltipsDelegados contenedorRef={ref} />
    </section>
  );
}

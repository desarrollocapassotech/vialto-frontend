import { Spinner } from "@/components/ui/Spinner";

/**
 * Capa que tapa TODO el modal con un spinner y un mensaje, y no deja tocar nada debajo.
 * Se usa mientras se carga algo imprescindible y, sobre todo, mientras se emite contra
 * ARCA (factura, nota de crédito/débito, CVLP): no alcanza con deshabilitar el botón de
 * emitir, porque se podía cerrar el modal o cambiar datos a mitad de la emisión.
 *
 * El panel del modal tiene que ser `relative` (la capa es `absolute inset-0`). Cerrar con
 * Escape u overlay mientras está activa lo bloquea cada modal con su propio `busy`.
 */
export function BloqueoModal({ mensaje }: { mensaje: string }) {
  return (
    <div
      className="absolute inset-0 z-30 flex cursor-wait flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      onClick={(e) => e.stopPropagation()}
    >
      <Spinner className="h-8 w-8 text-vialto-charcoal" />
      <p className="px-6 text-center text-sm font-medium text-vialto-charcoal">{mensaje}</p>
    </div>
  );
}

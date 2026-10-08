import { AlertTriangle } from "lucide-react";

/**
 * Aviso de datos faltantes para emitir a ARCA, fijo en el pie del modal (al lado del
 * botón de emitir) para que se vea siempre. Usado por "Nueva factura" y "Nueva liquidación".
 */
export function AvisoFaltantesEmision({
  mensaje,
  hayOcultos,
  onCompletar,
  zumbando,
  onZumbidoEnd,
}: {
  mensaje: string;
  /** true = falta algún campo oculto para la empresa: aviso en rojo y sin botón. */
  hayOcultos: boolean;
  /** Abre el modal para completar los datos. Sin él no se muestra el botón. */
  onCompletar?: () => void;
  zumbando: boolean;
  onZumbidoEnd: () => void;
}) {
  return (
    <div
      role="alert"
      onAnimationEnd={onZumbidoEnd}
      className={`${zumbando ? "aviso-zumbido " : ""}mr-auto flex min-w-0 flex-1 basis-full items-center gap-2 rounded border px-3 py-1.5 text-xs sm:basis-0 ${
        hayOcultos
          ? "border-red-500/40 bg-red-50 text-red-900"
          : "border-amber-400/50 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-medium">
        {mensaje}
        {hayOcultos &&
          " Hay campos ocultos: contactá al administrador para habilitarlos."}
      </p>
      {onCompletar && !hayOcultos && (
        <button
          type="button"
          onClick={onCompletar}
          className="shrink-0 border border-amber-500/60 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wider text-amber-900 hover:bg-amber-100"
        >
          Completar datos
        </button>
      )}
    </div>
  );
}

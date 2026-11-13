/**
 * Aviso de cliente/proveedor sin país y/o ID fiscal, con la confirmación para guardar igual.
 * Se muestra al final del formulario mientras falten esos datos (Base de datos y altas
 * rápidas: `ClienteModal`, `TransportistaModal`).
 */
export function AvisoSinDatosFiscales({
  faltante,
  confirmado,
  onConfirmadoChange,
  entidad = "proveedor",
  error = false,
}: {
  /** Ej. "cuit / cuil" o "país y/o cuit / cuil". */
  faltante: string;
  confirmado: boolean;
  onConfirmadoChange: (v: boolean) => void;
  entidad?: "proveedor" | "cliente";
  /** Se intentó guardar sin tildar la confirmación: borde rojo. */
  error?: boolean;
}) {
  return (
    <div
      className={`space-y-2 border bg-amber-50 px-4 py-3 text-sm text-amber-900 ${
        error ? "border-red-400" : "border-amber-200"
      }`}
    >
      <p>
        Estás guardando el {entidad} sin {faltante} — esto puede afectar la{" "}
        {entidad === "cliente" ? "facturación" : "facturación/liquidaciones"} más adelante si
        no se completa.
      </p>
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => onConfirmadoChange(e.target.checked)}
          className="h-4 w-4 accent-vialto-charcoal"
        />
        Entiendo, guardar igual
      </label>
    </div>
  );
}

/**
 * Aviso de proveedor sin país y/o ID fiscal, con la confirmación para guardar igual. Se
 * muestra al final del formulario y solo después de tocar Guardar con esos datos vacíos.
 */
export function AvisoSinDatosFiscales({
  faltante,
  confirmado,
  onConfirmadoChange,
}: {
  /** Ej. "cuit / cuil" o "país y/o cuit / cuil". */
  faltante: string;
  confirmado: boolean;
  onConfirmadoChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        Estás guardando el proveedor sin {faltante} — esto puede afectar la
        facturación/liquidaciones más adelante si no se completa.
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

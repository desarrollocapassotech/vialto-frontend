export type LiquidacionAnulacionMetodo = "nota_credito_debito" | "manual";

export const LIQUIDACION_ANULACION_METODO_OPCIONES: {
  value: LiquidacionAnulacionMetodo;
  label: string;
  desc: string;
}[] = [
  {
    value: "nota_credito_debito",
    label: "Nota de Crédito/Débito vía ARCA",
    desc: "Comportamiento por defecto: emite un comprobante asociado (NC o ND) a través del web service de AFIP.",
  },
  {
    value: "manual",
    label: "Registro manual (sin ARCA)",
    desc: "La anulación queda en 2 pasos (pendiente → anulada) y se respalda con un comprobante pre-impreso adjunto por el usuario. No se emite nada a ARCA.",
  },
];

/**
 * Radios de "Cómo se anula un comprobante 060 ya emitido para este tenant" —
 * compartido entre el alta/edición de empresa (`TenantForm.tsx`, guardado al
 * enviar el formulario) y "Configuración por empresa" (`CamposEmpresaPage.tsx`,
 * guardado inmediato al tocar). No duplicar este bloque en otra pantalla.
 */
export function LiquidacionAnulacionMetodoRadios({
  value,
  onChange,
  disabled,
}: {
  value: LiquidacionAnulacionMetodo;
  onChange: (value: LiquidacionAnulacionMetodo) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {LIQUIDACION_ANULACION_METODO_OPCIONES.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex items-start gap-2.5 rounded border px-3 py-2.5 text-sm transition-colors ${
              disabled ? "opacity-60" : ""
            } ${
              checked
                ? "border-vialto-fire/50 bg-vialto-fire/5 text-vialto-charcoal"
                : "border-black/10 text-vialto-steel hover:border-black/20"
            }`}
          >
            <input
              type="radio"
              name="liquidacionAnulacionMetodo"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-vialto-fire"
            />
            <span>
              <span className="block font-medium text-vialto-charcoal">
                {opt.label}
              </span>
              <span className="mt-0.5 block text-xs text-vialto-steel">
                {opt.desc}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

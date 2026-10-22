const MOTIVO_LABELS: Record<string, string> = {
  litros_extremo:
    "Cantidad de litros fuera de lo normal. Revisá que esté bien cargada.",
  importe_invalido:
    "El monto está en cero o es inválido. Revisá que esté bien cargado.",
  precio_litro_fuera_de_rango:
    "El precio por litro (monto ÷ litros) no es razonable. Revisá los litros o el monto.",
  km_delta_invalido:
    "El kilometraje no coincide con las cargas anteriores del vehículo. Revisá el km cargado.",
  costo_km_invalido:
    "El costo por km no es razonable. Revisá el monto o el kilometraje.",
};

const MOTIVO_LABEL_DEFAULT =
  "Carga marcada como sospechosa. Revisá los datos cargados.";

// Texto explicativo para tooltips (columna de alerta de la grilla y badges del detalle).
export function motivoSospechaLabel(motivo: string | null): string {
  if (!motivo) return MOTIVO_LABEL_DEFAULT;
  return MOTIVO_LABELS[motivo] ?? MOTIVO_LABEL_DEFAULT;
}

// Etiqueta corta para columnas/listas (los MOTIVO_LABELS de arriba son para tooltips).
const MOTIVO_SHORT_LABELS: Record<string, string> = {
  litros_extremo: "Litros extremos",
  importe_invalido: "Monto inválido",
  precio_litro_fuera_de_rango: "Precio/L fuera de rango",
  km_delta_invalido: "Kilometraje inválido",
  costo_km_invalido: "Costo/km inválido",
};

export function motivoShortLabel(motivo: string | null): string {
  if (!motivo) return "Sospechoso";
  return MOTIVO_SHORT_LABELS[motivo] ?? "Sospechoso";
}

// Campos que cada motivo de sospecha afecta, para resaltar la celda correcta.
const MOTIVO_CAMPOS: Record<string, string[]> = {
  litros_extremo: ["litros"],
  importe_invalido: ["importe"],
  // Ambiguo: el ratio importe/litros da fuera de rango, puede deberse a
  // cualquiera de los dos valores — se marcan ambos, como en costo_km_invalido.
  precio_litro_fuera_de_rango: ["precioPorLitro", "litros", "importe"],
  km_delta_invalido: ["km"],
  costo_km_invalido: ["importe", "km"],
};

export function motivoAfectaCampo(
  motivo: string | null,
  campo: "litros" | "precioPorLitro" | "importe" | "km",
): boolean {
  if (!motivo) return false;
  return MOTIVO_CAMPOS[motivo]?.includes(campo) ?? false;
}

export function SospechaBadge({
  motivo,
  onClick,
}: {
  motivo: string | null;
  /** Si se pasa, el badge se vuelve clickeable (ej. abrir el detalle de la carga). */
  onClick?: () => void;
}) {
  const label = motivoSospechaLabel(motivo);
  const className =
    "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold leading-none text-amber-700";

  if (onClick) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={`${className} hover:bg-amber-200 transition-colors`}
      >
        !
      </button>
    );
  }

  return (
    <span title={label} aria-label={label} className={className}>
      !
    </span>
  );
}

const MOTIVO_LABELS: Record<string, string> = {
  litros_extremo: "Litros marcados como sospechosos (posible error de carga)",
  importe_invalido: "Monto marcado como sospechoso (posible error de carga)",
  precio_litro_fuera_de_rango:
    "Precio por litro marcado como sospechoso (posible error en litros o en el monto)",
  km_delta_invalido:
    "Kilometraje marcado como sospechoso (posible error de carga)",
  costo_km_invalido:
    "Costo por km marcado como sospechoso (posible error en monto o kilometraje)",
};

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
  const label = motivo
    ? (MOTIVO_LABELS[motivo] ?? "Dato marcado como sospechoso")
    : "Dato marcado como sospechoso";
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

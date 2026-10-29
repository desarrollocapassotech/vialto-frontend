import { etiquetaDirOrden, type TipoOrden } from "@/lib/ordenListado";

/** Opciones del menú "Ordenar por". */
export const COMBUSTIBLE_SORT_FIELDS = [
  "fecha_creacion",
  "fecha_carga",
] as const;

/**
 * Orden por columna de la grilla de cargas (click en el título). Lo ordena el backend
 * sobre todas las cargas; espejo de `COMBUSTIBLE_SORT_FIELDS_COLUMNA` del backend.
 */
export const COMBUSTIBLE_SORT_FIELDS_COLUMNA = [
  "chofer",
  "vehiculo",
  "estacion",
  "forma_pago",
  "litros",
  "importe",
] as const;

export type CombustibleSortField =
  | (typeof COMBUSTIBLE_SORT_FIELDS)[number]
  | (typeof COMBUSTIBLE_SORT_FIELDS_COLUMNA)[number];
export type CombustibleSortDir = "asc" | "desc";

export const COMBUSTIBLE_SORT_DEFAULT: {
  sortBy: CombustibleSortField;
  sortDir: CombustibleSortDir;
} = {
  sortBy: "fecha_carga",
  sortDir: "desc",
};

export const COMBUSTIBLE_SORT_LABELS: Record<CombustibleSortField, string> = {
  fecha_creacion: "Fecha de creación",
  fecha_carga: "Fecha de carga",
  chofer: "Conductor",
  vehiculo: "Vehículo",
  estacion: "Estación",
  forma_pago: "Pago",
  litros: "Litros",
  importe: "Monto",
};

/** `sortBy` de la URL validado (un valor desconocido cae al orden por defecto). */
export function parseCombustibleSortField(raw: string | null): CombustibleSortField {
  const todos: readonly string[] = [
    ...COMBUSTIBLE_SORT_FIELDS,
    ...COMBUSTIBLE_SORT_FIELDS_COLUMNA,
  ];
  return raw && todos.includes(raw)
    ? (raw as CombustibleSortField)
    : COMBUSTIBLE_SORT_DEFAULT.sortBy;
}

function esCampoFecha(field: CombustibleSortField): boolean {
  return field === "fecha_creacion" || field === "fecha_carga";
}

/** Tipo de dato de cada orden (tooltip del título y etiqueta del menú). */
export function tipoOrdenCombustible(field: CombustibleSortField): TipoOrden {
  if (esCampoFecha(field)) return "fecha";
  if (field === "litros" || field === "importe") return "numero";
  return "texto";
}

export function etiquetaCombustibleOrdenamiento(
  sortBy: CombustibleSortField,
  sortDir: CombustibleSortDir,
): string {
  const base = COMBUSTIBLE_SORT_LABELS[sortBy];
  return `${base} (${etiquetaDirOrden(tipoOrdenCombustible(sortBy), sortDir)})`;
}

export function etiquetaDirDesc(_field: CombustibleSortField): string {
  return "De nueva a vieja";
}

export function etiquetaDirAsc(_field: CombustibleSortField): string {
  return "De vieja a nueva";
}

export function appendCombustibleSortQuery(
  params: URLSearchParams,
  sortBy: CombustibleSortField,
  sortDir: CombustibleSortDir,
): void {
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
}

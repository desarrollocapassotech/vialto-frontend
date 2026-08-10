import type { Viaje } from "@/types/api";

const TZ_LISTADOS_AR = "America/Argentina/Buenos_Aires";

function fechaSortKeyArgentina(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleString("sv-SE", {
      timeZone: TZ_LISTADOS_AR,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(" ", "T");
}

function compareNullableFechaAr(
  aIso: string | null | undefined,
  bIso: string | null | undefined,
  dir: ViajeSortDir,
  tieBreak: () => number,
): number {
  const keyA = fechaSortKeyArgentina(aIso);
  const keyB = fechaSortKeyArgentina(bIso);
  if (keyA == null && keyB == null) return tieBreak();
  if (keyA == null) return 1;
  if (keyB == null) return -1;
  if (keyA === keyB) return tieBreak();
  const mult = dir === "asc" ? 1 : -1;
  return keyA < keyB ? -mult : mult;
}

/** Ordena en cliente con la misma lógica que el backend (filtro pago transportista). */
export function sortViajesListado(
  items: Viaje[],
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): Viaje[] {
  const tie = (a: Viaje, b: Viaje) => a.id.localeCompare(b.id);
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "fecha_creacion":
        // NOTA: Asumo que la propiedad en el objeto Viaje es createdAt (o la que corresponda en tu API)
        // Si se llama distinto (ej. fechaCreacion), cambialo acá abajo:
        return compareNullableFechaAr(
          (a as any).createdAt,
          (b as any).createdAt,
          sortDir,
          () => tie(a, b),
        );
      case "fecha_carga":
        return compareNullableFechaAr(a.fechaCarga, b.fechaCarga, sortDir, () =>
          tie(a, b),
        );
      case "fecha_descarga":
        return compareNullableFechaAr(
          a.fechaDescarga,
          b.fechaDescarga,
          sortDir,
          () => tie(a, b),
        );
      default:
        return tie(a, b);
    }
  });
}

export const VIAJE_SORT_FIELDS = [
  "fecha_creacion", // <-- NUEVO CAMPO
  "fecha_carga",
  "fecha_descarga",
] as const;

export type ViajeSortField = (typeof VIAJE_SORT_FIELDS)[number];
export type ViajeSortDir = "asc" | "desc";

// <-- DEFAULT ACTUALIZADO A FECHA CREACION Y DESCENDENTE
export const VIAJE_SORT_DEFAULT: {
  sortBy: ViajeSortField;
  sortDir: ViajeSortDir;
} = {
  sortBy: "fecha_creacion",
  sortDir: "desc",
};

export const VIAJE_SORT_LABELS: Record<ViajeSortField, string> = {
  fecha_creacion: "Fecha de creación", // <-- ETIQUETA NUEVA
  fecha_carga: "Fecha de carga",
  fecha_descarga: "Fecha de descarga",
};

export function etiquetaViajeOrdenamiento(
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): string {
  const base = VIAJE_SORT_LABELS[sortBy];
  if (
    sortBy === "fecha_creacion" ||
    sortBy === "fecha_carga" ||
    sortBy === "fecha_descarga"
  ) {
    return sortDir === "asc"
      ? `${base} (de vieja a nueva)`
      : `${base} (de nueva a vieja)`;
  }
  return sortDir === "desc"
    ? `${base} (mayor primero)`
    : `${base} (menor primero)`;
}

function esCampoFecha(field: ViajeSortField): boolean {
  return (
    field === "fecha_creacion" ||
    field === "fecha_carga" ||
    field === "fecha_descarga"
  );
}

export function etiquetaDirDesc(field: ViajeSortField): string {
  return esCampoFecha(field) ? "De nueva a vieja" : "Mayor primero";
}

export function etiquetaDirAsc(field: ViajeSortField): string {
  return esCampoFecha(field) ? "De vieja a nueva" : "Menor primero";
}

export function appendViajeSortQuery(
  params: URLSearchParams,
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): void {
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
}

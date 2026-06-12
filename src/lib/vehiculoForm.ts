import type { Vehiculo } from "@/types/api";

export type VehiculoFormState = {
  patente: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: string;
  nroChasis: string;
  poliza: string;
  vencimientoPoliza: string;
  tara: string;
  precinto: string;
};

/** Valor para `<input type="date">` sin corrimiento por zona horaria. */
export function vehiculoVencimientoPolizaInputValue(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function vehiculoFormStateFromApi(row: Vehiculo): VehiculoFormState {
  const añoVal = row.año ?? row.anio;
  return {
    patente: row.patente ?? "",
    tipo: row.tipo ?? "camion",
    marca: row.marca ?? "",
    modelo: row.modelo ?? "",
    anio: añoVal != null ? String(añoVal) : "",
    nroChasis: row.nroChasis ?? "",
    poliza: row.poliza ?? "",
    vencimientoPoliza: vehiculoVencimientoPolizaInputValue(
      row.vencimientoPoliza,
    ),
    tara: row.tara != null ? String(row.tara) : "",
    precinto: row.precinto ?? "",
  };
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalTara(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Cuerpo POST alineado con CreateVehiculoDto del backend.
 * No incluye `transportistaId`: la pertenencia queda sin asignar (null) hasta nueva lógica de vinculación.
 */
export function vehiculoCreatePayloadFromForm(
  form: VehiculoFormState,
): Record<string, unknown> {
  return {
    patente: form.patente.trim().toUpperCase(),
    tipo: form.tipo,
    marca: form.marca.trim() || null,
    modelo: form.modelo.trim() || null,
    anio: parseOptionalInt(form.anio),
    nroChasis: form.nroChasis.trim() || null,
    poliza: form.poliza.trim() || null,
    vencimientoPoliza: form.vencimientoPoliza.trim() || null,
    tara: parseOptionalTara(form.tara),
    precinto: form.precinto.trim() || null,
  };
}

/** Cuerpo PATCH alineado con UpdateVehiculoDto del backend. */
export function vehiculoWritePayloadFromForm(
  form: VehiculoFormState,
): Record<string, unknown> {
  return vehiculoCreatePayloadFromForm(form);
}

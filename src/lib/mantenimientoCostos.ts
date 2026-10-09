import { parseCurrencyAr } from "@/lib/currencyMask";

/** Línea de costo libre del formulario: descripción + importe (texto con máscara es-AR). */
export interface LineaCosto {
  key: string;
  descripcion: string;
  importe: string;
}

let secuencia = 0;
export function nuevaLineaCosto(descripcion = "", importe = ""): LineaCosto {
  secuencia += 1;
  return { key: `l${secuencia}`, descripcion, importe };
}

export function totalLineas(lineas: LineaCosto[]): number {
  return Math.round(lineas.reduce((s, l) => s + (parseCurrencyAr(l.importe) ?? 0), 0) * 100) / 100;
}

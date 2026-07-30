export const FORMA_PAGO_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
};

// Debe coincidir exactamente con la lista de la app del chofer
// (vialto-combustible/src/components/NewLoadForm.tsx). Si se agrega o
// renombra una estación ahí, replicar el cambio acá.
export const SERVICE_STATIONS = [
  "YPF",
  "GOTTIG",
  "AGRO",
  "AXION",
  "LA PAZ",
  "OTRA",
] as const;

export const TIPO_VEHICULO_LABELS: Record<string, string> = {
  tractor: "Tractor",
  semirremolque: "Semirremolque",
  camion: "Camión",
  utilitario: "Utilitario",
  otro: "Otro",
};

export function fmtFormaPago(v: string | null) {
  if (!v) return "—";
  return FORMA_PAGO_LABELS[v] ?? v;
}

export function fmtTipoVehiculo(tipo: string): string {
  return TIPO_VEHICULO_LABELS[tipo] ?? tipo;
}

// precioPorLitro = montoTotal / litros, redondeado al entero más cercano
// (sin decimales: más claro para el usuario que un valor con centavos).
// Devuelve "" si falta algún dato o litros es 0 (evita NaN/Infinity).
export function computePrecioPorLitro(
  litrosRaw: string,
  importeRaw: string,
): string {
  const litros = Number(litrosRaw);
  const importe = Number(importeRaw);
  if (!litrosRaw || !importeRaw || !(litros > 0) || isNaN(importe)) return "";
  return String(Math.round(importe / litros));
}

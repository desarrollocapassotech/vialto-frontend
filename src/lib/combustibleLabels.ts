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

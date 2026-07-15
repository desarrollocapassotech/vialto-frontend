export const FORMA_PAGO_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
};

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

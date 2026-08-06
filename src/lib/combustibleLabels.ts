export const FORMA_PAGO_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  cuenta_corriente: "Cuenta Corriente",
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

// COMB-07-T5: el mensaje de CombustibleSyncErrorLog puede venir de dos fuentes muy
// distintas. Si el backend rechazó la carga por una regla de negocio (km inconsistente,
// vehículo no encontrado, etc.), ya llega en español y listo para mostrar. Pero si lo que
// falló fue la validación de forma del payload (class-validator, ValidationPipe de Nest),
// llega en inglés y técnico — ej. "patente should not be empty" — porque nunca fue pensado
// para mostrarse a un usuario. Acá se traducen los patrones conocidos de esa segunda
// fuente; cualquier mensaje que no matchee ese formato se asume que ya es un mensaje de
// negocio en español y se muestra tal cual, sin tocarlo.
const CAMPO_CARGA_LABELS: Record<string, string> = {
  patente: "Patente",
  vehiculoId: "Vehículo",
  choferId: "Conductor",
  estacion: "Estación",
  litros: "Litros",
  precioPorLitro: "Precio por litro",
  importe: "Monto",
  km: "Kilometraje",
  formaPago: "Forma de pago",
  fecha: "Fecha",
  fotoTacometro: "Foto del tacómetro",
  fotoTicket: "Foto del ticket",
};

const REGLAS_TRADUCCION_VALIDACION: {
  patron: RegExp;
  render: (label: string) => string;
}[] = [
  {
    patron: /^(\w+) should not be empty$/,
    render: (label) => `Falta un dato: ${label}.`,
  },
  {
    patron: /^(\w+) must be a number conforming to the specified constraints$/,
    render: (label) => `${label} debe ser un número válido.`,
  },
  {
    patron: /^(\w+) must be a string$/,
    render: (label) => `${label} tiene un formato inválido.`,
  },
  {
    patron: /^(\w+) must be a valid ISO 8601 date string$/,
    render: (label) => `${label} debe ser una fecha válida.`,
  },
];

function traducirFragmentoValidacion(fragmento: string): string | null {
  const texto = fragmento.trim();
  for (const regla of REGLAS_TRADUCCION_VALIDACION) {
    const match = texto.match(regla.patron);
    if (match) {
      const campo = match[1];
      return regla.render(CAMPO_CARGA_LABELS[campo] ?? campo);
    }
  }
  return null;
}

export function fmtMensajeErrorSincronizacion(mensaje: string): string {
  if (!mensaje?.trim()) return "Error de sincronización sin detalle.";
  // El backend une varios mensajes de validación con "," (String() sobre el array que
  // devuelve Nest); si CADA fragmento matchea un patrón técnico conocido, se traducen y
  // se juntan. Si algún fragmento no matchea, se asume que el mensaje completo ya es una
  // oración de negocio en español y se devuelve sin modificar.
  const fragmentos = mensaje
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const traducidos = fragmentos.map(traducirFragmentoValidacion);
  if (traducidos.every((t): t is string => t !== null)) {
    return traducidos.join(" ");
  }
  return mensaje;
}

// Etiqueta corta para la columna "Tipo" de la tabla (el mensaje completo, que puede ser
// largo, va en el modal de detalle vía fmtMensajeErrorSincronizacion). Reconoce los mismos
// mensajes de negocio conocidos del backend (combustible.service.ts); ante uno nuevo o no
// reconocido, cae a una etiqueta genérica en vez de truncar el texto a lo bruto.
const REGLAS_MOTIVO_CORTO: { patron: RegExp; label: string }[] = [
  { patron: /should not be empty|must be a (number|string)|must be a valid ISO/, label: "Datos incompletos" },
  { patron: /^El importe ingresado/, label: "Importe inconsistente" },
  { patron: /^El kilometraje ingresado/, label: "Kilometraje inconsistente" },
  { patron: /^No se encontró el vehículo/, label: "Vehículo no encontrado" },
];

export function motivoCortoErrorSincronizacion(mensaje: string): string {
  const texto = mensaje?.trim();
  if (!texto) return "Error de sincronización";
  const regla = REGLAS_MOTIVO_CORTO.find((r) => r.patron.test(texto));
  return regla?.label ?? "Error de sincronización";
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

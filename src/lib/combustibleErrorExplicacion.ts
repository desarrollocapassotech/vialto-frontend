import type { CombustibleErrorSincronizacion } from "@/types/combustibleDashboard";
import { fmtMensajeErrorSincronizacion } from "@/lib/combustibleLabels";

/**
 * Explicación en palabras simples de un error de la app de choferes, para el admin del
 * tenant (pestaña Alertas del dashboard de combustible). El backend guarda el mensaje
 * técnico tal cual (CombustibleSyncErrorLog.mensaje); acá se reconocen los mensajes
 * conocidos de combustible.service.ts / chofer-auth y se arma: un título corto para la
 * tabla, qué pasó, en qué estado quedó la carga y qué hacer.
 *
 * Si se agrega un mensaje de rechazo nuevo en el backend, sumar su regla acá: los que no
 * se reconocen caen a una explicación genérica que muestra el motivo original.
 */
export type ExplicacionErrorChofer = {
  /** Etiqueta corta para la columna "Tipo". */
  titulo: string;
  /** Qué pasó, en una o dos oraciones. */
  quePaso: string;
  /** En qué estado quedó la carga (¿se perdió? ¿sigue en el celular?). */
  estado: string;
  /** Pasos sugeridos para resolverlo. */
  queHacer: string[];
};

const fmtKm = (km: number | string) => `${Number(km).toLocaleString("es-AR")} km`;

function fmtFechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : null;
}

function estadoSegunOrigen(origen: string | undefined, conductor: string): string {
  switch (origen) {
    case undefined:
    case "sincronizacion_offline":
      return `La carga NO quedó registrada en el sistema. Sigue guardada en el celular de ${conductor}, marcada con error, hasta que la corrija y la vuelva a enviar (o la borre). Esta alerta desaparece sola cuando se reenvía bien.`;
    case "carga":
      return `La carga NO quedó registrada. ${conductor} vio el error en la app en ese momento y pudo haberla corregido y reenviado.`;
    case "edicion_carga":
      return "El cambio no se guardó: la carga sigue como estaba antes.";
    case "foto":
      return "La foto no se guardó.";
    case "login":
    case "sesion":
      return `${conductor} no pudo entrar a la app.`;
    default:
      return "La operación no se completó.";
  }
}

type Contexto = {
  e: CombustibleErrorSincronizacion;
  conductor: string;
  fechaCarga: string | null;
  /** true = la carga quedó en la cola offline del celular (se corrige y reenvía desde ahí);
   *  false = se rechazó con conexión y no quedó guardada en ningún lado (hay que rehacerla). */
  enCola: boolean;
};

type Regla = {
  patron: RegExp;
  explicar: (m: RegExpMatchArray, ctx: Contexto) => Omit<ExplicacionErrorChofer, "estado">;
};

/** Cómo vuelve a mandar la carga el conductor, según si quedó en el celular o no (frase en minúscula, para encadenar). */
const pedirReenvio = ({ enCola }: Contexto, queCorregir = "el dato") =>
  enCola
    ? `pedile al conductor que abra la carga marcada con error en la app, corrija ${queCorregir} y la reenvíe.`
    : `pedile al conductor que vuelva a hacer la carga corrigiendo ${queCorregir}.`;

const REGLAS: Regla[] = [
  {
    // combustible.service.ts#assertKmNoRetroceso — km menor que el anterior
    patron:
      /^El kilometraje ingresado \((\d+) km\) es inconsistente: no puede ser inferior (a la corrección de kilometraje|al de la carga anterior)\D+(\d{2}\/\d{2}\/\d{4}) \((\d+) km\)/,
    explicar: ([, km, tipo, fecha, ref], ctx) => {
      const { conductor } = ctx;
      const esCorreccion = tipo.startsWith("a la corrección");
      return {
        titulo: "Km menor al anterior",
        quePaso: esCorreccion
          ? `${conductor} informó ${fmtKm(km)}, pero el ${fecha} alguien corrigió a mano el kilometraje de este vehículo a ${fmtKm(ref)}. El cuentakilómetros no puede ir para atrás, así que el sistema rechazó la carga.`
          : `${conductor} informó ${fmtKm(km)}, pero en la carga del ${fecha} este vehículo ya marcaba ${fmtKm(ref)}. El cuentakilómetros no puede ir para atrás, así que el sistema rechazó la carga.`,
        queHacer: [
          "Confirmá con el conductor cuántos km marcaba el tablero (si sacó foto del tacómetro, revisala).",
          esCorreccion
            ? `Si la corrección manual del ${fecha} estaba mal, volvé a corregir el km del vehículo desde Combustible → Asignación de vehículos → "Editar km".`
            : `Si la carga del ${fecha} tenía el km mal, corregila primero.`,
          `Si el conductor se equivocó al escribir el km: ${pedirReenvio(ctx, "el km")}`,
        ],
      };
    },
  },
  {
    // combustible.service.ts#assertKmNoRetroceso — km mayor que el siguiente
    patron:
      /^El kilometraje ingresado \((\d+) km\) es inconsistente: no puede ser superior (a la corrección de kilometraje|al de una carga posterior)\D+(\d{2}\/\d{2}\/\d{4}) \((\d+) km\)/,
    explicar: ([, km, tipo, fecha, ref], ctx) => {
      const { conductor, fechaCarga } = ctx;
      const esCorreccion = tipo.startsWith("a la corrección");
      const cuando = fechaCarga ? `con fecha ${fechaCarga}` : "";
      return {
        titulo: "Km mayor al de una fecha posterior",
        quePaso: esCorreccion
          ? `${conductor} informó ${fmtKm(km)} en una carga ${cuando}, pero el ${fecha} (después) alguien corrigió a mano el kilometraje de este vehículo a ${fmtKm(ref)}, que es menos. No puede haber más km antes que después, así que el sistema rechazó la carga.`
          : `${conductor} informó ${fmtKm(km)} en una carga ${cuando}, pero ya hay una carga posterior, del ${fecha}, con ${fmtKm(ref)}, que es menos. No puede haber más km antes que después, así que el sistema rechazó la carga.`,
        queHacer: [
          "Lo más común: el conductor eligió mal la fecha de la carga, o se equivocó al escribir el km. Confirmalo con él (o con la foto del tacómetro).",
          esCorreccion
            ? `Si la corrección manual del ${fecha} estaba mal, volvé a corregir el km del vehículo desde Combustible → Asignación de vehículos → "Editar km".`
            : `Si la que está mal es la carga del ${fecha}, corregila primero.`,
          `Cuando esté resuelto, ${pedirReenvio(ctx, "la fecha o el km")}`,
        ],
      };
    },
  },
  {
    patron: /^El importe ingresado \((\$[\d.,]+)\) no coincide con el cálculo de litros x precio por litro \((\$[\d.,]+)\)/,
    explicar: ([, importe, esperado], ctx) => ({
      titulo: "Monto no coincide",
      quePaso: `${ctx.conductor} cargó un monto total de ${importe}, pero los litros por el precio por litro que informó dan ${esperado}. La diferencia es demasiado grande, así que alguno de los tres números está mal escrito.`,
      queHacer: [
        "Compará litros, precio por litro y monto con el ticket (si sacó foto del ticket, revisala).",
        `Cuando esté resuelto, ${pedirReenvio(ctx, "el número que esté mal")}`,
      ],
    }),
  },
  {
    patron: /^No se encontró el vehículo con patente "([^"]+)"/,
    explicar: ([, patente], ctx) => ({
      titulo: "Patente no registrada",
      quePaso: `${ctx.conductor} cargó combustible para la patente ${patente}, pero esa patente no está dada de alta en la flota de la empresa.`,
      queHacer: [
        ctx.enCola
          ? `Si es un vehículo nuevo, dalo de alta en Vehículos con la patente ${patente}. Después el conductor puede reenviar la carga desde la app sin cambiar nada.`
          : `Si es un vehículo nuevo, dalo de alta en Vehículos con la patente ${patente} y pedile al conductor que vuelva a hacer la carga.`,
        `Si la patente está mal escrita: ${pedirReenvio(ctx, "la patente")}`,
      ],
    }),
  },
  {
    patron: /^La foto del (tacómetro|ticket) ya está guardada/,
    explicar: ([, cual]) => ({
      titulo: "Foto ya guardada",
      quePaso: `El conductor intentó reemplazar la foto del ${cual}, pero una vez guardada no se puede cambiar.`,
      queHacer: ["No hace falta hacer nada: la carga conserva la foto original."],
    }),
  },
  {
    patron: /^Carga no encontrada/,
    explicar: () => ({
      titulo: "Carga inexistente",
      quePaso: "El conductor intentó modificar una carga que ya no existe (probablemente fue eliminada desde el panel).",
      queHacer: ["Si la carga se borró por error, pedile al conductor que la cargue de nuevo."],
    }),
  },
  {
    patron: /^Solo podés editar tus propias cargas/,
    explicar: () => ({
      titulo: "Carga de otro conductor",
      quePaso: "El conductor intentó modificar una carga que registró otro conductor. La app solo permite editar las propias.",
      queHacer: ["Si hay que corregir esa carga, hacelo desde el panel."],
    }),
  },
  {
    patron: /^(Vehículo|Chofer) inválido/,
    explicar: ([, cual]) => ({
      titulo: `${cual} inexistente`,
      quePaso: `La carga hace referencia a un ${cual.toLowerCase()} que ya no existe en la empresa (puede haber sido eliminado).`,
      queHacer: ["Revisá que el vehículo y el conductor sigan dados de alta."],
    }),
  },
  {
    patron: /^Se requiere una imagen|File too large|Unexpected field/i,
    explicar: () => ({
      titulo: "Foto no se pudo subir",
      quePaso: "La foto no llegó bien al sistema (vacía, demasiado pesada —más de 10 MB— o con un formato que no se reconoce).",
      queHacer: ["Pedile al conductor que vuelva a sacar la foto. Si sigue fallando, avisá a soporte."],
    }),
  },
  {
    patron: /^PIN incorrecto/,
    explicar: (_m, { conductor }) => ({
      titulo: "PIN incorrecto",
      quePaso: `Alguien intentó entrar a la app con el DNI de ${conductor} y un PIN equivocado.`,
      queHacer: ["Si el conductor no recuerda su PIN, asignale uno nuevo desde Choferes."],
    }),
  },
  {
    patron: /^El chofer no tiene PIN configurado/,
    explicar: (_m, { conductor }) => ({
      titulo: "Sin PIN configurado",
      quePaso: `${conductor} intentó entrar a la app, pero todavía no tiene un PIN asignado, así que no puede iniciar sesión.`,
      queHacer: ["Asignale un PIN desde Choferes y pasáselo al conductor."],
    }),
  },
  {
    patron: /desactivado/,
    explicar: (_m, { conductor }) => ({
      titulo: "Conductor desactivado",
      quePaso: `${conductor} intentó usar la app, pero su usuario está desactivado en la empresa.`,
      queHacer: ["Si debería poder cargar, reactivalo desde Choferes."],
    }),
  },
  {
    patron: /^Sesión vencida/,
    explicar: () => ({
      titulo: "Sesión vencida",
      quePaso: "La sesión del conductor en la app venció (dura 30 días). Tiene que volver a entrar con su DNI y PIN.",
      queHacer: ["No hace falta hacer nada; si el conductor no recuerda su PIN, asignale uno nuevo desde Choferes."],
    }),
  },
  {
    patron: /^Error interno/,
    explicar: () => ({
      titulo: "Falla del sistema",
      quePaso: "El sistema tuvo un error interno al procesar el pedido del conductor. No fue un error del conductor.",
      queHacer: ["Avisá a soporte de Vialto con la fecha y el conductor de esta alerta."],
    }),
  },
];

const MOTIVO_POR_ORIGEN: Record<string, string> = {
  sincronizacion_offline: "Carga no sincronizada",
  carga: "Carga rechazada",
  edicion_carga: "Edición rechazada",
  eliminacion_carga: "Eliminación rechazada",
  foto: "Foto rechazada",
  consulta: "Error en la app",
  login: "No pudo entrar a la app",
  sesion: "No pudo entrar a la app",
};

/** Mensajes de validación de forma (class-validator), traducidos por fmtMensajeErrorSincronizacion. */
function explicarValidacion(
  mensaje: string,
  ctx: Contexto,
): Omit<ExplicacionErrorChofer, "estado"> | null {
  if (!/should not be empty|must be a (number|string|valid ISO)/.test(mensaje)) return null;
  const traducido = fmtMensajeErrorSincronizacion(mensaje);
  return {
    titulo: "Datos incompletos",
    quePaso: `La carga llegó al sistema con datos faltantes o inválidos: ${traducido}`,
    queHacer: [
      `P${pedirReenvio(ctx, "los datos faltantes").slice(1)}`,
      "Si el conductor dice que completó todo, puede ser una versión vieja de la app: que la cierre y la vuelva a abrir.",
    ],
  };
}

export function explicarErrorChofer(e: CombustibleErrorSincronizacion): ExplicacionErrorChofer {
  const conductor = e.choferNombre && e.choferNombre !== "—" ? e.choferNombre.trim() : "El conductor";
  const enCola = !e.origen || e.origen === "sincronizacion_offline";
  const ctx: Contexto = { e, conductor, fechaCarga: fmtFechaCorta(e.fechaCarga), enCola };
  const mensaje = e.mensaje?.trim() ?? "";
  const estado = estadoSegunOrigen(e.origen, conductor);

  for (const regla of REGLAS) {
    const m = mensaje.match(regla.patron);
    if (m) return { ...regla.explicar(m, ctx), estado };
  }
  const validacion = explicarValidacion(mensaje, ctx);
  if (validacion) return { ...validacion, estado };

  return {
    titulo: MOTIVO_POR_ORIGEN[e.origen ?? "sincronizacion_offline"] ?? "Error en la app",
    quePaso: mensaje
      ? `El sistema rechazó la operación con este motivo: «${fmtMensajeErrorSincronizacion(mensaje)}».`
      : "El sistema rechazó la operación sin indicar un motivo.",
    estado,
    queHacer: [
      "Consultá con el conductor qué estaba intentando hacer.",
      "Si no se entiende el motivo, avisá a soporte de Vialto con la fecha y el conductor de esta alerta.",
    ],
  };
}

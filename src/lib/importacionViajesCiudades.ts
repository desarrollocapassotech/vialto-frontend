import { resolverEtiquetaCiudadCatalogo } from "@/lib/ciudades";
import type {
  ImportCiudadAdvertencia,
  ImportPreviewResult,
  ImportPreviewViaje,
} from "@/types/api";

export type CiudadNormalizadaConfirm = {
  fila: number;
  origen?: string | null;
  destino?: string | null;
};

type CambioCampo = NonNullable<ImportPreviewViaje["cambios"]>[number];

/**
 * Sincroniza el diff de "Ver cambios" con el valor final de ciudad ya
 * resuelto (canónico o elegido a mano) — el diff se computó en el backend
 * con el texto crudo del Excel, así que sin este ajuste seguiría mostrando
 * la ortografía original en vez de la corregida. Si el valor final termina
 * siendo igual al actual en base, el campo deja de ser un cambio real.
 */
function sincronizarCambioCiudad(
  cambios: CambioCampo[] | undefined,
  campoLabel: "Origen" | "Destino",
  valorFinal: string,
): CambioCampo[] | undefined {
  if (!cambios) return cambios;
  const idx = cambios.findIndex((c) => c.campo === campoLabel);
  if (idx === -1) return cambios;
  if (cambios[idx].antes === valorFinal) {
    return cambios.filter((_, i) => i !== idx);
  }
  if (cambios[idx].despues === valorFinal) return cambios;
  const next = [...cambios];
  next[idx] = { ...next[idx], despues: valorFinal };
  return next;
}

/** Aplica la elección de ciudad de una fila al preview: pisa el valor y saca la advertencia de esa fila+campo. */
export function aplicarEleccionCiudad(
  preview: ImportPreviewResult,
  fila: number,
  campo: "origen" | "destino",
  valor: string,
): ImportPreviewResult {
  const campoLabel = campo === "origen" ? "Origen" : "Destino";
  const viajes = preview.viajes?.map((v) =>
    v.fila === fila
      ? {
          ...v,
          [campo]: valor,
          advertenciasCiudad: v.advertenciasCiudad?.filter(
            (a) => a.campo !== campo,
          ),
          cambios: sincronizarCambioCiudad(v.cambios, campoLabel, valor),
        }
      : v,
  );
  const advertenciasCiudad = preview.advertenciasCiudad?.filter(
    (a) => !(a.fila === fila && a.campo === campo),
  );
  return {
    ...preview,
    viajes,
    advertenciasCiudad,
    totalAdvertenciasCiudad: advertenciasCiudad?.length ?? 0,
  };
}

const CONCURRENCY = 4;

async function resolverCampoCached(
  value: string | null | undefined,
  cache: Map<
    string,
    Awaited<ReturnType<typeof resolverEtiquetaCiudadCatalogo>>
  >,
  signal?: AbortSignal,
) {
  if (value == null || !value.trim()) {
    return { original: null, canonica: null, advertencia: null };
  }
  const key = value.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const result = await resolverEtiquetaCiudadCatalogo(value, signal);
  cache.set(key, result);
  return result;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

export async function enriquecerPreviewImportacionViajes(
  preview: ImportPreviewResult,
  signal?: AbortSignal,
): Promise<{
  preview: ImportPreviewResult;
  ciudadesNormalizadas: CiudadNormalizadaConfirm[];
}> {
  const viajes = preview.viajes ?? [];
  if (viajes.length === 0) {
    return { preview, ciudadesNormalizadas: [] };
  }

  const cache = new Map<
    string,
    Awaited<ReturnType<typeof resolverEtiquetaCiudadCatalogo>>
  >();
  const ciudadesNormalizadas: CiudadNormalizadaConfirm[] = [];
  const detalleAdvertencias: ImportCiudadAdvertencia[] = [];

  const enriched = await mapWithConcurrency(
    viajes,
    CONCURRENCY,
    async (viaje) => {
      const advertenciasCiudad: ImportCiudadAdvertencia[] = [];
      let origen = viaje.origen;
      let destino = viaje.destino;
      const patch: CiudadNormalizadaConfirm = { fila: viaje.fila };

      for (const campo of ["origen", "destino"] as const) {
        const raw = viaje[campo];
        const resolved = await resolverCampoCached(raw, cache, signal);
        if (!resolved.original) continue;

        const finalValue = resolved.canonica ?? resolved.original;
        if (campo === "origen") origen = finalValue;
        else destino = finalValue;

        patch[campo] = finalValue;

        if (resolved.advertencia) {
          advertenciasCiudad.push({
            fila: viaje.fila,
            campo,
            valor: resolved.original,
            mensaje: resolved.advertencia,
          });
          detalleAdvertencias.push({
            fila: viaje.fila,
            campo,
            valor: resolved.original,
            mensaje: resolved.advertencia,
          });
        }
      }

      if (patch.origen !== undefined || patch.destino !== undefined) {
        ciudadesNormalizadas.push(patch);
      }

      let cambios = viaje.cambios;
      if (patch.origen !== undefined) {
        cambios = sincronizarCambioCiudad(cambios, "Origen", origen ?? "");
      }
      if (patch.destino !== undefined) {
        cambios = sincronizarCambioCiudad(cambios, "Destino", destino ?? "");
      }

      const row: ImportPreviewViaje = {
        ...viaje,
        origen,
        destino,
        cambios,
        ...(advertenciasCiudad.length > 0 ? { advertenciasCiudad } : {}),
      };
      return row;
    },
  );

  return {
    preview: {
      ...preview,
      viajes: enriched,
      advertenciasCiudad:
        detalleAdvertencias.length > 0 ? detalleAdvertencias : undefined,
      totalAdvertenciasCiudad: detalleAdvertencias.length,
    },
    ciudadesNormalizadas,
  };
}

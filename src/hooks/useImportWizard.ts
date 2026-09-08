import { useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import {
  aplicarEleccionCiudad,
  enriquecerPreviewImportacionViajes,
  type CiudadNormalizadaConfirm,
} from "@/lib/importacionViajesCiudades";
import type {
  ImportPreviewResult,
  ImportLog,
  ImportLiquidacionPreviewGrupo,
  ImportFacturaClientePreviewGrupo,
} from "@/types/api";

/** Orden fijo de dependencia: cada módulo puede referenciar a los anteriores. */
export const MODULOS_SECUENCIA = [
  "clientes",
  "transportistas",
  "choferes",
  "vehiculos",
  "viajes",
] as const;
export type ModuloWizard = (typeof MODULOS_SECUENCIA)[number];

type Fase =
  | "upload"
  | "modulo"
  | "post-liquidaciones"
  | "post-facturas"
  | "terminado";

export interface EtapaCompletada {
  modulo: ModuloWizard;
  log: ImportLog;
}

/**
 * Orquesta el import por etapas: sube el archivo una sola vez y llama
 * preview/confirm una vez por módulo, en orden de dependencia, reusando el
 * mismo mecanismo que ya existe (una ImportSession por módulo) — no hace
 * falta ninguna sesión nueva "encadenada" en el backend. Al terminar Viajes,
 * ofrece (opcional, con su propio preview) generar liquidaciones borrador y
 * facturar a clientes.
 */
export function useImportWizard(
  tenantId: string,
  modulosDisponibles: ModuloWizard[],
  getToken: () => Promise<string | null>,
) {
  const secuencia = MODULOS_SECUENCIA.filter((m) =>
    modulosDisponibles.includes(m),
  );

  const [fase, setFase] = useState<Fase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [moduloIndex, setModuloIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [validandoCiudades, setValidandoCiudades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const ciudadesNormalizadasRef = useRef<CiudadNormalizadaConfirm[]>([]);
  const ciudadesAbortRef = useRef<AbortController | null>(null);
  const filasExcluidasRef = useRef<Set<number>>(new Set());
  /** Elecciones manuales de ciudad (fila:campo → valor), sobreviven a un "reintentar" (ej. después de crear entidades faltantes). */
  const eleccionesManualesRef = useRef<Map<string, string>>(new Map());
  const [etapasCompletadas, setEtapasCompletadas] = useState<
    EtapaCompletada[]
  >([]);
  const [viajeIdsCreados, setViajeIdsCreados] = useState<string[]>([]);

  const [liquidacionesPreview, setLiquidacionesPreview] = useState<
    ImportLiquidacionPreviewGrupo[] | null
  >(null);
  const [liquidacionesCreadas, setLiquidacionesCreadas] = useState<
    unknown[] | null
  >(null);
  const [facturasPreview, setFacturasPreview] = useState<
    ImportFacturaClientePreviewGrupo[] | null
  >(null);
  const [facturasCreadas, setFacturasCreadas] = useState<unknown[] | null>(
    null,
  );

  const moduloActual: ModuloWizard | null = secuencia[moduloIndex] ?? null;

  function startFile(f: File) {
    setFile(f);
    setError(null);
    setFase("modulo");
    void previewModuloActual(f, 0);
  }

  /** Núcleo del preview de un módulo, sin tocar correcciones/exclusiones ya hechas — lo usa tanto el cambio de módulo como "reintentar". */
  async function ejecutarPreviewModulo(f: File, idx: number) {
    const modulo = secuencia[idx];
    if (!modulo) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const data = await apiJson<ImportPreviewResult>(
        `/api/importaciones/preview?modulo=${encodeURIComponent(modulo)}&tenantId=${encodeURIComponent(tenantId)}`,
        getToken,
        { method: "POST", body: form },
      );

      let previewResult = data;
      if (modulo === "viajes" && (previewResult.viajes?.length ?? 0) > 0) {
        setValidandoCiudades(true);
        ciudadesAbortRef.current?.abort();
        const ac = new AbortController();
        ciudadesAbortRef.current = ac;
        try {
          const enriched = await enriquecerPreviewImportacionViajes(
            previewResult,
            ac.signal,
          );
          previewResult = enriched.preview;
          ciudadesNormalizadasRef.current = enriched.ciudadesNormalizadas;
        } finally {
          setValidandoCiudades(false);
        }

        // Reaplica elecciones manuales de antes de este preview (ej. si esto
        // es un "reintentar" después de crear entidades faltantes) — el
        // enriquecimiento recién hecho no las conoce, recalcula de cero.
        for (const [key, valor] of eleccionesManualesRef.current) {
          const [filaStr, campo] = key.split(":");
          previewResult = aplicarEleccionCiudad(
            previewResult,
            Number(filaStr),
            campo as "origen" | "destino",
            valor,
          );
          const idxCiudad = ciudadesNormalizadasRef.current.findIndex(
            (c) => c.fila === Number(filaStr),
          );
          if (idxCiudad >= 0) {
            ciudadesNormalizadasRef.current[idxCiudad] = {
              ...ciudadesNormalizadasRef.current[idxCiudad],
              [campo]: valor,
            };
          } else {
            ciudadesNormalizadasRef.current.push({
              fila: Number(filaStr),
              [campo]: valor,
            });
          }
        }

        // Reaplica filas excluidas de antes de este preview, por la misma razón.
        if (filasExcluidasRef.current.size > 0) {
          const viajesIgnorados = (previewResult.viajes ?? []).filter((v) =>
            filasExcluidasRef.current.has(v.fila),
          );
          const nuevasIgnoradas = viajesIgnorados.filter((v) => v.nuevo).length;
          const actualizadasIgnoradas = viajesIgnorados.length - nuevasIgnoradas;
          previewResult = {
            ...previewResult,
            viajes: previewResult.viajes?.filter(
              (v) => !filasExcluidasRef.current.has(v.fila),
            ),
            advertenciasCiudad: previewResult.advertenciasCiudad?.filter(
              (a) => !filasExcluidasRef.current.has(a.fila),
            ),
          };
          previewResult.totalAdvertenciasCiudad =
            previewResult.advertenciasCiudad?.length ?? 0;
          previewResult.exitosas = Math.max(
            0,
            previewResult.exitosas - filasExcluidasRef.current.size,
          );
          if (previewResult.entidadesNuevas != null) {
            previewResult.entidadesNuevas = Math.max(
              0,
              previewResult.entidadesNuevas - nuevasIgnoradas,
            );
          }
          if (previewResult.entidadesActualizadas != null) {
            previewResult.entidadesActualizadas = Math.max(
              0,
              previewResult.entidadesActualizadas - actualizadasIgnoradas,
            );
          }
        }
      }

      setPreview(previewResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  }

  /** Transición a un módulo (nuevo o siguiente): arranca sin correcciones/exclusiones previas. */
  async function previewModuloActual(f: File, idx: number) {
    ciudadesNormalizadasRef.current = [];
    filasExcluidasRef.current = new Set();
    eleccionesManualesRef.current = new Map();
    await ejecutarPreviewModulo(f, idx);
  }

  /** El usuario eligió la ciudad correcta para una fila con advertencia — se aplica en preview y en la confirmación. */
  function elegirCiudad(
    fila: number,
    campo: "origen" | "destino",
    valor: string,
  ) {
    eleccionesManualesRef.current.set(`${fila}:${campo}`, valor);

    const idx = ciudadesNormalizadasRef.current.findIndex((c) => c.fila === fila);
    if (idx >= 0) {
      ciudadesNormalizadasRef.current[idx] = {
        ...ciudadesNormalizadasRef.current[idx],
        [campo]: valor,
      };
    } else {
      ciudadesNormalizadasRef.current.push({ fila, [campo]: valor });
    }

    setPreview((prev) => (prev ? aplicarEleccionCiudad(prev, fila, campo, valor) : prev));
  }

  /** El usuario decidió no importar esta fila (ej. destino multidestino que no resuelve a una sola ciudad). */
  function ignorarFila(fila: number) {
    filasExcluidasRef.current.add(fila);
    ciudadesNormalizadasRef.current = ciudadesNormalizadasRef.current.filter(
      (c) => c.fila !== fila,
    );

    setPreview((prev) => {
      if (!prev) return prev;
      const viajeIgnorado = prev.viajes?.find((v) => v.fila === fila);
      if (!viajeIgnorado) return prev;
      const viajes = prev.viajes?.filter((v) => v.fila !== fila);
      const advertenciasCiudad = prev.advertenciasCiudad?.filter(
        (a) => a.fila !== fila,
      );
      return {
        ...prev,
        viajes,
        advertenciasCiudad,
        totalAdvertenciasCiudad: advertenciasCiudad?.length ?? 0,
        exitosas: Math.max(0, prev.exitosas - 1),
        // Mantiene el desglose "N nuevas · M a actualizar" en sync con lo que
        // realmente se va a importar — si no se descuenta acá, ignorar una
        // fila que actualizaba deja el contador de actualizaciones inflado.
        entidadesNuevas:
          prev.entidadesNuevas != null
            ? Math.max(0, prev.entidadesNuevas - (viajeIgnorado.nuevo ? 1 : 0))
            : prev.entidadesNuevas,
        entidadesActualizadas:
          prev.entidadesActualizadas != null
            ? Math.max(
                0,
                prev.entidadesActualizadas - (viajeIgnorado.nuevo ? 0 : 1),
              )
            : prev.entidadesActualizadas,
      };
    });
  }

  /** Saltea el módulo actual sin confirmarlo (ej. sin template configurado, o a propósito sin esa hoja). */
  function saltearModuloActual() {
    void avanzarModulo();
  }

  /** Vuelve a previsualizar el módulo actual sin perder correcciones ya hechas — se usa después de crear entidades faltantes. */
  async function reintentarPreview() {
    if (file) await ejecutarPreviewModulo(file, moduloIndex);
  }

  /** Crea vehículos faltantes confirmados desde el panel de previsualización y reintenta. */
  async function crearVehiculosFaltantes(
    items: { patente: string; tipo: string }[],
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{
        creados: number;
        errores: { patente: string; error: string }[];
      }>("/api/importaciones/entidades-faltantes/vehiculos", getToken, {
        method: "POST",
        body: JSON.stringify({ tenantId, items }),
      });
      if (res.errores.length > 0) {
        setError(res.errores.map((e) => `${e.patente}: ${e.error}`).join(" · "));
      }
      if (res.creados > 0) await reintentarPreview();
      return res;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron crear los vehículos.",
      );
      throw e;
    } finally {
      setLoading(false);
    }
  }

  /** Crea entidades faltantes que solo necesitan nombre (clientes/transportistas/choferes/productos) y reintenta. */
  async function crearEntidadesFaltantesSimple(
    modelo: string,
    valores: string[],
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{
        creados: number;
        errores: { valor: string; error: string }[];
      }>(
        `/api/importaciones/entidades-faltantes/${encodeURIComponent(modelo)}`,
        getToken,
        { method: "POST", body: JSON.stringify({ tenantId, valores }) },
      );
      if (res.errores.length > 0) {
        setError(res.errores.map((e) => `${e.valor}: ${e.error}`).join(" · "));
      }
      if (res.creados > 0) await reintentarPreview();
      return res;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron crear los registros.",
      );
      throw e;
    } finally {
      setLoading(false);
    }
  }

  /**
   * `viajeIdsCreadosOverride` existe porque `confirmarModuloActual` llama a
   * esta función en el mismo tick en que recién hizo `setViajeIdsCreados` —
   * el estado todavía no se actualizó (closure vieja), así que sin este
   * parámetro `avanzarModulo` lee el `viajeIdsCreados` de ANTES de confirmar
   * Viajes (vacío en la primera pasada) y salta directo a "terminado" en vez
   * de "post-liquidaciones", aunque la importación de Viajes haya creado o
   * actualizado filas. Bug real encontrado en QA (NyM): con viajes
   * actualizados con éxito, el wizard se salteaba Liquidaciones y Facturas
   * igual, mostrándolas como "hechas" en el stepper sin haber pasado por ahí.
   */
  async function avanzarModulo(viajeIdsCreadosOverride?: string[]) {
    setPreview(null);
    setError(null);
    const nextIdx = moduloIndex + 1;
    if (nextIdx >= secuencia.length) {
      const idsCreados = viajeIdsCreadosOverride ?? viajeIdsCreados;
      setFase(idsCreados.length > 0 ? "post-liquidaciones" : "terminado");
      return;
    }
    setModuloIndex(nextIdx);
    if (file) await previewModuloActual(file, nextIdx);
  }

  async function confirmarModuloActual(
    confirmarCamposFaltantes?: boolean,
    confirmarFacturasDuplicadas?: boolean,
    decisionesCampoUnicoDuplicado?: { fila: number; accion: "ignorar" | "actualizar" }[],
  ) {
    if (!preview || !moduloActual) return;
    setLoading(true);
    setError(null);
    try {
      const body: {
        sessionId: string;
        tenantId: string;
        ciudadesNormalizadas?: CiudadNormalizadaConfirm[];
        filasExcluidas?: number[];
        confirmarCamposFaltantes?: boolean;
        confirmarFacturasDuplicadas?: boolean;
        decisionesCampoUnicoDuplicado?: { fila: number; accion: "ignorar" | "actualizar" }[];
      } = {
        sessionId: preview.sessionId,
        tenantId,
      };
      if (moduloActual === "viajes" && ciudadesNormalizadasRef.current.length > 0) {
        body.ciudadesNormalizadas = ciudadesNormalizadasRef.current;
      }
      if (moduloActual === "viajes" && filasExcluidasRef.current.size > 0) {
        body.filasExcluidas = [...filasExcluidasRef.current];
      }
      if (confirmarCamposFaltantes) {
        body.confirmarCamposFaltantes = true;
      }
      if (confirmarFacturasDuplicadas) {
        body.confirmarFacturasDuplicadas = true;
      }
      if (decisionesCampoUnicoDuplicado?.length) {
        body.decisionesCampoUnicoDuplicado = decisionesCampoUnicoDuplicado;
      }
      const log = await apiJson<ImportLog>("/api/importaciones/confirm", getToken, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setEtapasCompletadas((prev) => [...prev, { modulo: moduloActual, log }]);
      let viajeIdsRecienCreados: string[] | undefined;
      if (moduloActual === "viajes") {
        viajeIdsRecienCreados = log.detalles
          .filter((d) => d.estado === "ok" && d.id)
          .map((d) => d.id as string);
        setViajeIdsCreados(viajeIdsRecienCreados);
      }
      await avanzarModulo(viajeIdsRecienCreados);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al confirmar la importación",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Etapa opcional: liquidaciones borrador ──────────────────────────────

  async function pedirPreviewLiquidaciones() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ImportLiquidacionPreviewGrupo[]>(
        "/api/importaciones/liquidaciones/preview",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, tenantId }),
        },
      );
      setLiquidacionesPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al previsualizar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarLiquidaciones() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<unknown[]>(
        "/api/importaciones/liquidaciones/confirm",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, tenantId }),
        },
      );
      setLiquidacionesCreadas(data);
      setFase("post-facturas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar liquidaciones");
    } finally {
      setLoading(false);
    }
  }

  function saltearLiquidaciones() {
    setLiquidacionesPreview(null);
    setFase("post-facturas");
  }

  // ── Etapa opcional: facturar a clientes ─────────────────────────────────

  async function pedirPreviewFacturas() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ImportFacturaClientePreviewGrupo[]>(
        "/api/importaciones/facturas-clientes/preview",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, tenantId }),
        },
      );
      setFacturasPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al previsualizar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarFacturas(numerosPorCliente?: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<unknown[]>(
        "/api/importaciones/facturas-clientes/confirm",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, numerosPorCliente, tenantId }),
        },
      );
      setFacturasCreadas(data);
      setFase("terminado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al facturar");
    } finally {
      setLoading(false);
    }
  }

  function saltearFacturas() {
    setFacturasPreview(null);
    setFase("terminado");
  }

  function reset() {
    ciudadesAbortRef.current?.abort();
    ciudadesNormalizadasRef.current = [];
    filasExcluidasRef.current = new Set();
    eleccionesManualesRef.current = new Map();
    setFase("upload");
    setFile(null);
    setModuloIndex(0);
    setError(null);
    setPreview(null);
    setValidandoCiudades(false);
    setEtapasCompletadas([]);
    setViajeIdsCreados([]);
    setLiquidacionesPreview(null);
    setLiquidacionesCreadas(null);
    setFacturasPreview(null);
    setFacturasCreadas(null);
  }

  return {
    fase,
    secuencia,
    moduloActual,
    moduloIndex,
    loading,
    validandoCiudades,
    error,
    preview,
    etapasCompletadas,
    viajeIdsCreados,
    liquidacionesPreview,
    liquidacionesCreadas,
    facturasPreview,
    facturasCreadas,
    startFile,
    confirmarModuloActual,
    saltearModuloActual,
    reintentarPreview,
    crearVehiculosFaltantes,
    crearEntidadesFaltantesSimple,
    elegirCiudad,
    ignorarFila,
    pedirPreviewLiquidaciones,
    confirmarLiquidaciones,
    saltearLiquidaciones,
    pedirPreviewFacturas,
    confirmarFacturas,
    saltearFacturas,
    reset,
  };
}

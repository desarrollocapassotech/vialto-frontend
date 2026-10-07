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
  ImportLiquidacionesPreviewRespuesta,
  ImportFacturaClientePreviewGrupo,
  ImportFacturasClientesPreviewRespuesta,
  ImportDeteccionHoja,
  ImportDeteccionHojas,
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

/** Hoja del Excel elegida para un módulo (detectada o resuelta por el usuario). */
export interface AsignacionHoja {
  modulo: ModuloWizard;
  hoja: string;
  filas: number;
}

/**
 * Lo que la detección no pudo resolver sola: hojas encontradas sin las
 * columnas obligatorias, hojas que encajan en más de un módulo y hojas que no
 * se parecen a ninguno. Mientras no sea null, el wizard sigue en "upload"
 * mostrando esta revisión.
 */
export interface RevisionArchivo {
  /** Hojas listas para importar (se importan al continuar). */
  listas: AsignacionHoja[];
  /** Encontradas por nombre pero sin columnas obligatorias: no se importan. */
  conFaltantes: ImportDeteccionHoja[];
  /** El usuario elige a qué módulo corresponden (o no importarlas). */
  ambiguas: { hoja: string; filas: number; candidatos: ModuloWizard[] }[];
  /** Hojas con datos que no se parecen a ningún módulo: solo se informan. */
  noReconocidas: { hoja: string; filas: number }[];
}

export interface EtapaCompletada {
  modulo: ModuloWizard;
  log: ImportLog;
}

/**
 * Orquesta el import por etapas. Primero detecta qué módulos trae el Excel
 * (`POST detectar-hojas`, por nombre de hoja o encabezados) y arma la
 * secuencia solo con esos; después llama preview/confirm una vez por módulo,
 * en orden de dependencia, reusando el
 * mismo mecanismo que ya existe (una ImportSession por módulo) — no hace
 * falta ninguna sesión nueva "encadenada" en el backend. Al terminar Viajes,
 * ofrece (opcional, con su propio preview) generar liquidaciones borrador y
 * facturar a clientes.
 */
export function useImportWizard(
  tenantId: string,
  /** Módulos que la empresa puede importar (ej. sin Transportes si es solo flota propia). */
  modulosPermitidos: ModuloWizard[],
  getToken: () => Promise<string | null>,
) {
  /** Hojas detectadas (o elegidas) para importar, en orden de dependencia. */
  const [detectados, setDetectados] = useState<AsignacionHoja[]>([]);
  /** Detectados que el usuario marcó "no importar" antes de llegar a su paso. */
  const [omitidos, setOmitidos] = useState<Set<ModuloWizard>>(new Set());
  /**
   * Módulos que se pasaron con "Continuar" porque todas sus filas ya estaban
   * cargadas igual (`continuarSinCambios`): no se confirmaron (no hay nada que
   * escribir), pero cuentan como hechos, no como omitidos.
   */
  const [sinCambiosModulos, setSinCambiosModulos] = useState<Set<ModuloWizard>>(
    new Set(),
  );
  const [revision, setRevision] = useState<RevisionArchivo | null>(null);
  // Copia sincrónica de la secuencia y de la hoja de cada módulo: la primera
  // vista previa se pide en el mismo ciclo en que se fija la secuencia, antes
  // de que el state se re-renderice.
  const secuenciaRef = useRef<ModuloWizard[]>([]);
  const hojaPorModuloRef = useRef<Partial<Record<ModuloWizard, string>>>({});
  const secuencia = detectados
    .map((d) => d.modulo)
    .filter((m) => !omitidos.has(m));

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
  const [liquidacionesOmitidasUsdCount, setLiquidacionesOmitidasUsdCount] =
    useState<number>(0);
  const [liquidacionesCreadas, setLiquidacionesCreadas] = useState<
    unknown[] | null
  >(null);
  const [facturasPreview, setFacturasPreview] = useState<
    ImportFacturaClientePreviewGrupo[] | null
  >(null);
  const [facturasOmitidasUsdCount, setFacturasOmitidasUsdCount] =
    useState<number>(0);
  const [facturasCreadas, setFacturasCreadas] = useState<unknown[] | null>(
    null,
  );

  const moduloActual: ModuloWizard | null = secuencia[moduloIndex] ?? null;

  /** Sube el Excel, detecta qué módulos trae y, si no hay nada que resolver, arranca. */
  async function startFile(f: File) {
    setFile(f);
    setError(null);
    setRevision(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const det = await apiJson<ImportDeteccionHojas>(
        `/api/importaciones/detectar-hojas?tenantId=${encodeURIComponent(tenantId)}`,
        getToken,
        { method: "POST", body: form },
      );
      const permitido = (m: string): m is ModuloWizard =>
        modulosPermitidos.includes(m as ModuloWizard);
      const listas: AsignacionHoja[] = det.hojas
        .filter((h) => permitido(h.modulo) && h.faltantes.length === 0)
        .map((h) => ({ modulo: h.modulo as ModuloWizard, hoja: h.hoja, filas: h.filas }));
      const conFaltantes = det.hojas.filter(
        (h) => permitido(h.modulo) && h.faltantes.length > 0,
      );
      const ambiguas = det.sinIdentificar
        .map((s) => ({
          hoja: s.hoja,
          filas: s.filas,
          candidatos: s.candidatos.filter(
            (c): c is ModuloWizard =>
              permitido(c) && !listas.some((l) => l.modulo === c),
          ),
        }))
        .filter((s) => s.candidatos.length > 0);
      const noReconocidas = det.sinIdentificar
        .filter((s) => !ambiguas.some((a) => a.hoja === s.hoja))
        .map(({ hoja, filas }) => ({ hoja, filas }));

      if (conFaltantes.length === 0 && ambiguas.length === 0 && listas.length > 0) {
        await iniciarImportacion(listas, f);
        return;
      }
      setRevision({ listas, conFaltantes, ambiguas, noReconocidas });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el archivo.");
    } finally {
      setLoading(false);
    }
  }

  /** Arranca la secuencia con las hojas elegidas (detectadas y/o resueltas en la revisión). */
  async function iniciarImportacion(asignaciones: AsignacionHoja[], f: File | null = file) {
    if (!f) return;
    const ordenadas = MODULOS_SECUENCIA.flatMap((m) =>
      asignaciones.filter((a) => a.modulo === m).slice(0, 1),
    );
    if (ordenadas.length === 0) return;
    secuenciaRef.current = ordenadas.map((a) => a.modulo);
    hojaPorModuloRef.current = Object.fromEntries(
      ordenadas.map((a) => [a.modulo, a.hoja]),
    );
    setDetectados(ordenadas);
    setOmitidos(new Set());
    setSinCambiosModulos(new Set());
    setRevision(null);
    setModuloIndex(0);
    setFase("modulo");
    // Con await (no fire-and-forget): si no, el `finally` del que llama apaga
    // `loading` mientras el preview todavía está en curso y el paso del
    // módulo queda en blanco, sin spinner, hasta que llega la respuesta.
    setLoading(true);
    try {
      await previewModuloActual(f, 0);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Marca (o desmarca) un módulo detectado como "no importar" antes de llegar
   * a su paso — evita pedir su vista previa solo para saltearlo. Solo vale
   * para pasos que todavía no empezaron.
   */
  function omitirModulo(modulo: ModuloWizard, omitir: boolean) {
    const actual = secuenciaRef.current[moduloIndex];
    const posActual = detectados.findIndex((d) => d.modulo === actual);
    const pos = detectados.findIndex((d) => d.modulo === modulo);
    if (pos < 0 || (fase === "modulo" && pos <= posActual)) return;
    const next = new Set(omitidos);
    if (omitir) next.add(modulo);
    else next.delete(modulo);
    setOmitidos(next);
    secuenciaRef.current = detectados
      .map((d) => d.modulo)
      .filter((m) => !next.has(m));
  }

  /** Núcleo del preview de un módulo, sin tocar correcciones/exclusiones ya hechas — lo usa tanto el cambio de módulo como "reintentar". */
  async function ejecutarPreviewModulo(f: File, idx: number) {
    const modulo = secuenciaRef.current[idx];
    if (!modulo) return;
    const hoja = hojaPorModuloRef.current[modulo];
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const data = await apiJson<ImportPreviewResult>(
        `/api/importaciones/preview?modulo=${encodeURIComponent(modulo)}&tenantId=${encodeURIComponent(tenantId)}${hoja ? `&hoja=${encodeURIComponent(hoja)}` : ""}`,
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
          const prevViaje = previewResult?.viajes?.find((v) => v.fila === Number(filaStr));
          const filasAActualizar = prevViaje?.filasAgrupadas ?? [Number(filaStr)];
          for (const f of filasAActualizar) {
            const idxCiudad = ciudadesNormalizadasRef.current.findIndex(
              (c) => c.fila === f,
            );
            if (idxCiudad >= 0) {
              ciudadesNormalizadasRef.current[idxCiudad] = {
                ...ciudadesNormalizadasRef.current[idxCiudad],
                [campo]: valor,
              };
            } else {
              ciudadesNormalizadasRef.current.push({
                fila: f,
                [campo]: valor,
              });
            }
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

    const prevViaje = preview?.viajes?.find((v) => v.fila === fila);
    const filasAActualizar = prevViaje?.filasAgrupadas ?? [fila];

    for (const f of filasAActualizar) {
      const idx = ciudadesNormalizadasRef.current.findIndex((c) => c.fila === f);
      if (idx >= 0) {
        ciudadesNormalizadasRef.current[idx] = {
          ...ciudadesNormalizadasRef.current[idx],
          [campo]: valor,
        };
      } else {
        ciudadesNormalizadasRef.current.push({ fila: f, [campo]: valor });
      }
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

  /** Todas las filas del módulo ya están cargadas igual: avanza sin confirmar, pero el paso queda como hecho. */
  function continuarSinCambios() {
    if (moduloActual) {
      setSinCambiosModulos((prev) => new Set(prev).add(moduloActual));
    }
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
    if (nextIdx >= secuenciaRef.current.length) {
      const idsCreados = viajeIdsCreadosOverride ?? viajeIdsCreados;
      setFase(idsCreados.length > 0 ? "post-liquidaciones" : "terminado");
      return;
    }
    setModuloIndex(nextIdx);
    if (file) await previewModuloActual(file, nextIdx);
  }

  async function confirmarModuloActual(
    confirmarCamposFaltantes?: boolean,
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
        viajeIdsRecienCreados = Array.from(new Set(log.detalles
          .filter((d) => d.estado === "ok" && d.id)
          .map((d) => d.id as string)));
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
      const data = await apiJson<
        ImportLiquidacionesPreviewRespuesta | ImportLiquidacionPreviewGrupo[]
      >(
        "/api/importaciones/liquidaciones/preview",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, tenantId }),
        },
      );
      if (Array.isArray(data)) {
        setLiquidacionesPreview(data);
        setLiquidacionesOmitidasUsdCount(0);
      } else {
        setLiquidacionesPreview(data.grupos ?? []);
        setLiquidacionesOmitidasUsdCount(data.viajesOmitidosUsdCount ?? 0);
      }
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
      const data = await apiJson<
        ImportFacturasClientesPreviewRespuesta | ImportFacturaClientePreviewGrupo[]
      >(
        "/api/importaciones/facturas-clientes/preview",
        getToken,
        {
          method: "POST",
          body: JSON.stringify({ viajeIds: viajeIdsCreados, tenantId }),
        },
      );
      if (Array.isArray(data)) {
        setFacturasPreview(data);
        setFacturasOmitidasUsdCount(0);
      } else {
        setFacturasPreview(data.grupos ?? []);
        setFacturasOmitidasUsdCount(data.viajesOmitidosUsdCount ?? 0);
      }
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
      setError(e instanceof Error ? e.message : "Error al facturar a clientes");
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
    eleccionesManualesRef.current.clear();
    setFase("upload");
    setFile(null);
    setModuloIndex(0);
    setDetectados([]);
    setOmitidos(new Set());
    setSinCambiosModulos(new Set());
    setRevision(null);
    secuenciaRef.current = [];
    hojaPorModuloRef.current = {};
    setError(null);
    setPreview(null);
    setValidandoCiudades(false);
    setEtapasCompletadas([]);
    setViajeIdsCreados([]);
    setLiquidacionesPreview(null);
    setLiquidacionesOmitidasUsdCount(0);
    setLiquidacionesCreadas(null);
    setFacturasPreview(null);
    setFacturasOmitidasUsdCount(0);
    setFacturasCreadas(null);
  }

  return {
    file,
    fase,
    secuencia,
    detectados,
    omitidos,
    sinCambiosModulos,
    revision,
    moduloActual,
    moduloIndex,
    loading,
    validandoCiudades,
    error,
    setError,
    preview,
    etapasCompletadas,
    viajeIdsCreados,
    liquidacionesPreview,
    liquidacionesOmitidasUsdCount,
    liquidacionesCreadas,
    facturasPreview,
    facturasOmitidasUsdCount,
    facturasCreadas,
    startFile,
    iniciarImportacion,
    omitirModulo,
    confirmarModuloActual,
    saltearModuloActual,
    continuarSinCambios,
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

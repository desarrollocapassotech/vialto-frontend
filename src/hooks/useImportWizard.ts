import { useState } from "react";
import { apiJson } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
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

  async function previewModuloActual(f: File, idx: number) {
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
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  }

  /** Saltea el módulo actual sin confirmarlo (ej. sin template configurado, o a propósito sin esa hoja). */
  function saltearModuloActual() {
    avanzarModulo();
  }

  function avanzarModulo() {
    setPreview(null);
    setError(null);
    const nextIdx = moduloIndex + 1;
    if (nextIdx >= secuencia.length) {
      setFase(viajeIdsCreados.length > 0 ? "post-liquidaciones" : "terminado");
      return;
    }
    setModuloIndex(nextIdx);
    if (file) void previewModuloActual(file, nextIdx);
  }

  async function confirmarModuloActual() {
    if (!preview || !moduloActual) return;
    setLoading(true);
    setError(null);
    try {
      const log = await apiJson<ImportLog>("/api/importaciones/confirm", getToken, {
        method: "POST",
        body: JSON.stringify({ sessionId: preview.sessionId, tenantId }),
      });
      setEtapasCompletadas((prev) => [...prev, { modulo: moduloActual, log }]);
      if (moduloActual === "viajes") {
        const ids = log.detalles
          .filter((d) => d.estado === "ok" && d.id)
          .map((d) => d.id as string);
        setViajeIdsCreados(ids);
      }
      avanzarModulo();
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
    setFase("upload");
    setFile(null);
    setModuloIndex(0);
    setError(null);
    setPreview(null);
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
    pedirPreviewLiquidaciones,
    confirmarLiquidaciones,
    saltearLiquidaciones,
    pedirPreviewFacturas,
    confirmarFacturas,
    saltearFacturas,
    reset,
  };
}

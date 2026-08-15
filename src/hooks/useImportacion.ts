import { useRef, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import {
  aplicarEleccionCiudad,
  enriquecerPreviewImportacionViajes,
  type CiudadNormalizadaConfirm,
} from "@/lib/importacionViajesCiudades";
import type { ImportLog, ImportPreviewResult } from "@/types/api";

type Step = "upload" | "preview" | "result";

export function useImportacion(
  tenantId: string,
  getToken: () => Promise<string | null>,
) {
  const [step, setStep] = useState<Step>("upload");
  const [modulo, setModulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validandoCiudades, setValidandoCiudades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [log, setLog] = useState<ImportLog | null>(null);
  const ciudadesNormalizadasRef = useRef<CiudadNormalizadaConfirm[]>([]);
  const ciudadesAbortRef = useRef<AbortController | null>(null);
  const filasExcluidasRef = useRef<Set<number>>(new Set());
  /** Elecciones manuales de ciudad (fila:campo → valor), sobreviven a un "reintentar" (ej. después de crear entidades faltantes). */
  const eleccionesManualesRef = useRef<Map<string, string>>(new Map());

  /** Núcleo del preview, sin tocar las correcciones/exclusiones ya hechas — lo usan tanto el preview inicial como "reintentar". */
  async function ejecutarPreview() {
    if (!file || !modulo) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await apiFetch(
        `/api/importaciones/preview?modulo=${encodeURIComponent(modulo)}&tenantId=${encodeURIComponent(tenantId)}`,
        getToken,
        { method: "POST", body: form },
      );

      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : undefined;

      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : res.statusText;
        throw new Error(msg);
      }

      let previewResult = data as ImportPreviewResult;

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
      }

      // Reaplica elecciones manuales de ciudad de antes de este preview (ej.
      // si esto es un "reintentar" después de crear entidades faltantes) —
      // el enriquecimiento recién hecho no las conoce, recalcula de cero.
      for (const [key, valor] of eleccionesManualesRef.current) {
        const [filaStr, campo] = key.split(":");
        previewResult = aplicarEleccionCiudad(
          previewResult,
          Number(filaStr),
          campo as "origen" | "destino",
          valor,
        );
        const idx = ciudadesNormalizadasRef.current.findIndex(
          (c) => c.fila === Number(filaStr),
        );
        if (idx >= 0) {
          ciudadesNormalizadasRef.current[idx] = {
            ...ciudadesNormalizadasRef.current[idx],
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
      }

      setPreview(previewResult);
      setStep("preview");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  }

  async function submitPreview() {
    ciudadesNormalizadasRef.current = [];
    filasExcluidasRef.current = new Set();
    eleccionesManualesRef.current = new Map();
    await ejecutarPreview();
  }

  /** Vuelve a previsualizar sin perder las correcciones ya hechas — se usa después de crear entidades faltantes. */
  function reintentarPreview() {
    void ejecutarPreview();
  }

  async function confirm() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const body: {
        sessionId: string;
        tenantId: string;
        ciudadesNormalizadas?: CiudadNormalizadaConfirm[];
        filasExcluidas?: number[];
      } = {
        sessionId: preview.sessionId,
        tenantId,
      };

      if (
        preview.modulo === "viajes" &&
        ciudadesNormalizadasRef.current.length > 0
      ) {
        body.ciudadesNormalizadas = ciudadesNormalizadasRef.current;
      }

      if (filasExcluidasRef.current.size > 0) {
        body.filasExcluidas = [...filasExcluidasRef.current];
      }

      const result = await apiJson<ImportLog>(
        "/api/importaciones/confirm",
        getToken,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      setLog(result);
      setStep("result");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al confirmar la importación",
      );
    } finally {
      setLoading(false);
    }
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
      };
    });
  }

  function reset() {
    ciudadesAbortRef.current?.abort();
    ciudadesNormalizadasRef.current = [];
    filasExcluidasRef.current = new Set();
    eleccionesManualesRef.current = new Map();
    setStep("upload");
    setModulo("");
    setFile(null);
    setError(null);
    setPreview(null);
    setLog(null);
    setValidandoCiudades(false);
  }

  return {
    step,
    modulo,
    setModulo,
    file,
    setFile,
    loading,
    validandoCiudades,
    error,
    preview,
    log,
    submitPreview,
    reintentarPreview,
    confirm,
    elegirCiudad,
    ignorarFila,
    reset,
  };
}

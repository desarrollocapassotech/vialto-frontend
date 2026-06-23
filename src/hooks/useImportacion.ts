import { useRef, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import {
  enriquecerPreviewImportacionViajes,
  type CiudadNormalizadaConfirm,
} from '@/lib/importacionViajesCiudades';
import type { ImportLog, ImportPreviewResult } from '@/types/api';

type Step = 'upload' | 'preview' | 'result';

export function useImportacion(
  tenantId: string,
  getToken: () => Promise<string | null>,
) {
  const [step, setStep] = useState<Step>('upload');
  const [modulo, setModulo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validandoCiudades, setValidandoCiudades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [log, setLog] = useState<ImportLog | null>(null);
  const ciudadesNormalizadasRef = useRef<CiudadNormalizadaConfirm[]>([]);
  const ciudadesAbortRef = useRef<AbortController | null>(null);

  async function submitPreview() {
    if (!file || !modulo) return;
    setLoading(true);
    setError(null);
    ciudadesNormalizadasRef.current = [];
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await apiFetch(
        `/api/importaciones/preview?modulo=${encodeURIComponent(modulo)}&tenantId=${encodeURIComponent(tenantId)}`,
        getToken,
        { method: 'POST', body: form },
      );

      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : undefined;

      if (!res.ok) {
        const msg =
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : res.statusText;
        throw new Error(msg);
      }

      let previewResult = data as ImportPreviewResult;

      if (modulo === 'viajes' && (previewResult.viajes?.length ?? 0) > 0) {
        setValidandoCiudades(true);
        ciudadesAbortRef.current?.abort();
        const ac = new AbortController();
        ciudadesAbortRef.current = ac;
        try {
          const enriched = await enriquecerPreviewImportacionViajes(previewResult, ac.signal);
          previewResult = enriched.preview;
          ciudadesNormalizadasRef.current = enriched.ciudadesNormalizadas;
        } finally {
          setValidandoCiudades(false);
        }
      }

      setPreview(previewResult);
      setStep('preview');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
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
      } = {
        sessionId: preview.sessionId,
        tenantId,
      };

      if (preview.modulo === 'viajes' && ciudadesNormalizadasRef.current.length > 0) {
        body.ciudadesNormalizadas = ciudadesNormalizadasRef.current;
      }

      const result = await apiJson<ImportLog>(
        '/api/importaciones/confirm',
        getToken,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setLog(result);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la importación');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    ciudadesAbortRef.current?.abort();
    ciudadesNormalizadasRef.current = [];
    setStep('upload');
    setModulo('');
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
    confirm,
    reset,
  };
}

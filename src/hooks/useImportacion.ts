import { useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
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
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [log, setLog] = useState<ImportLog | null>(null);

  async function submitPreview() {
    if (!file || !modulo) return;
    setLoading(true);
    setError(null);
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

      setPreview(data as ImportPreviewResult);
      setStep('preview');
    } catch (e) {
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
      const result = await apiJson<ImportLog>(
        '/api/importaciones/confirm',
        getToken,
        {
          method: 'POST',
          body: JSON.stringify({ sessionId: preview.sessionId, tenantId }),
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
    setStep('upload');
    setModulo('');
    setFile(null);
    setError(null);
    setPreview(null);
    setLog(null);
  }

  return {
    step,
    modulo,
    setModulo,
    file,
    setFile,
    loading,
    error,
    preview,
    log,
    submitPreview,
    confirm,
    reset,
  };
}

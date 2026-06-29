import type { MicCrtExportPayload } from '@/types/micCrtDocumento';

function storageKey(viajeId: string) {
  return `vialto-mic-crt-borrador:${viajeId}`;
}

export function loadMicCrtBorrador(viajeId: string): MicCrtExportPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(viajeId));
    if (!raw) return null;
    return JSON.parse(raw) as MicCrtExportPayload;
  } catch {
    return null;
  }
}

export function saveMicCrtBorrador(viajeId: string, payload: MicCrtExportPayload): void {
  try {
    localStorage.setItem(storageKey(viajeId), JSON.stringify(payload));
  } catch {
    /* quota / modo privado */
  }
}

export function clearMicCrtBorrador(viajeId: string): void {
  try {
    localStorage.removeItem(storageKey(viajeId));
  } catch {
    /* silencioso */
  }
}

import { useCallback, useRef } from "react";
import { formatNumeroComprobanteManual } from "@/lib/comprobanteManual";
import { leerComprobanteArca, type ComprobanteLeido } from "@/lib/leerComprobanteArca";
import { useToast } from "@/lib/toast";

type Opciones = {
  /**
   * Número que hay hoy en el formulario ("" si está vacío). Se lee DESPUÉS de leer el archivo
   * (puede tardar), así que tiene que devolver el valor vigente (estado en un ref).
   */
  numeroActual: () => string;
  /** Completa el formulario con lo leído (`numero` ya formateado, ej. "A 0003-00000094"). */
  aplicar: (leido: ComprobanteLeido, numero: string) => void;
  /** false = ya no corresponde (cambiaron el archivo, tildaron "Comprobante interno"…). */
  vigente?: () => boolean;
};

/**
 * Autocompletar el número de comprobante al adjuntar una factura de ARCA (nov 2026): lee el
 * PDF/QR con `leerComprobanteArca` y, si el número está vacío o lo había completado este
 * mismo hook con un archivo anterior, lo completa y avisa con un toast. Nunca pisa lo que
 * escribió el usuario. Si no reconoce el archivo, no hace nada.
 *
 * Uso: `const autocompletar = useAutocompletarNumeroComprobante();` y en el `onFileChange`
 * del adjunto, `if (file) void autocompletar(file, { numeroActual, aplicar, vigente })`.
 */
export function useAutocompletarNumeroComprobante() {
  const { showToast } = useToast();
  const ultimoCompletadoRef = useRef<string | null>(null);

  return useCallback(
    async (file: File, { numeroActual, aplicar, vigente }: Opciones) => {
      const leido = await leerComprobanteArca(file);
      if (!leido || (vigente && !vigente())) return;
      const actual = numeroActual().trim();
      if (actual && actual !== ultimoCompletadoRef.current) return;
      const numero = formatNumeroComprobanteManual(leido.cbteTipo, leido.ptoVenta, leido.cbteNro);
      aplicar(leido, numero);
      ultimoCompletadoRef.current = numero;
      showToast(`Número de comprobante completado desde el archivo: ${numero}`, "success");
    },
    [showToast],
  );
}

/**
 * `numeroActual` para los campos por separado (tipo + punto de venta + número): "" si no se
 * cargó punto de venta ni número; si está a medio cargar, un texto que nunca coincide con uno
 * autocompletado (así no se pisa).
 */
export function numeroActualComprobanteManual(
  cbte: { ptoVenta: string; cbteNro: string; cbteTipo: string },
  numeroCompleto: string,
): string {
  if (!cbte.ptoVenta.trim() && !cbte.cbteNro.trim()) return "";
  return numeroCompleto || `parcial:${cbte.cbteTipo}:${cbte.ptoVenta}:${cbte.cbteNro}`;
}

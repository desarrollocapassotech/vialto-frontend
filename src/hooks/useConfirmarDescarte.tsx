import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { registrarGuardiaDescarte } from '@/lib/descarteModal';

/**
 * Cierre protegido para modales con formulario.
 *
 * - `solicitarCierre` va en ×, Cancelar y Escape: si el usuario cargó algo,
 *   pide confirmación antes de cerrar; si no tocó nada, cierra directo.
 * - El click afuera del modal no cierra ni pregunta: el overlay no llama a nada.
 * - Para cerrar sin preguntar (tras guardar con éxito) se sigue usando onClose.
 * - Renderizar `dialogo` dentro del modal.
 * - `marcarGuardado()` resetea el estado si el modal sigue abierto tras guardar.
 * - `activo`: para modales que quedan montados cerrados (prop `open`); cada
 *   apertura arranca sin cambios.
 */
export function useConfirmarDescarte(onClose: () => void, activo = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const modificadoRef = useRef(false);
  const confirmandoRef = useRef(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!activo) return;
    modificadoRef.current = false;
    return registrarGuardiaDescarte({
      marcar: () => {
        modificadoRef.current = true;
      },
    });
  }, [activo]);

  useEffect(() => {
    if (activo) return;
    confirmandoRef.current = false;
    setConfirmando(false);
  }, [activo]);

  const solicitarCierre = useCallback(() => {
    if (confirmandoRef.current) return;
    if (!modificadoRef.current) {
      onCloseRef.current();
      return;
    }
    confirmandoRef.current = true;
    setConfirmando(true);
  }, []);

  const marcarGuardado = useCallback(() => {
    modificadoRef.current = false;
  }, []);

  /** Cambios que no pasan por un input de este modal (ej. alta rápida anidada). */
  const marcarModificado = useCallback(() => {
    modificadoRef.current = true;
  }, []);

  const cerrarConfirmacion = useCallback(() => {
    confirmandoRef.current = false;
    setConfirmando(false);
  }, []);

  // Sin portal a propósito: se dibuja en la misma capa (stacking context) que el modal,
  // así queda encima aunque el modal viva en un contenedor con z-index alto (grilla de Viajes).
  const dialogo = confirmando ? (
    <ConfirmDialog
      open
      title="¿Descartar lo cargado?"
      message="Si cerrás, se va a perder todo lo que cargaste en este formulario."
      confirmLabel="Descartar y cerrar"
      cancelLabel="Seguir editando"
      tone="danger"
      onCancel={cerrarConfirmacion}
      onConfirm={() => {
        cerrarConfirmacion();
        onCloseRef.current();
      }}
    />
  ) : null;

  return { solicitarCierre, marcarGuardado, marcarModificado, dialogo };
}

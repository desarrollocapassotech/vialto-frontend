/**
 * Detección de "el usuario cargó algo" en modales con formulario.
 *
 * Cada modal con `useConfirmarDescarte` registra una guardia. Mientras haya
 * alguna, se escuchan `input`/`change` en todo el documento y se marca como
 * modificada la guardia de arriba (el modal visible). Así no hace falta
 * calcular a mano el "dirty" de cada formulario.
 *
 * - Controles custom que eligen con click (sin evento nativo) llaman
 *   `marcarModalModificado()` al elegir.
 * - Inputs que no son dato del formulario (buscadores de un select) llevan
 *   `data-descarte-ignorar` y no cuentan.
 */

type Guardia = { marcar: () => void };

const pila: Guardia[] = [];

function onCambio(e: Event) {
  const t = e.target;
  if (t instanceof Element && t.closest('[data-descarte-ignorar]')) return;
  pila[pila.length - 1]?.marcar();
}

export function registrarGuardiaDescarte(g: Guardia): () => void {
  if (pila.length === 0) {
    document.addEventListener('input', onCambio, true);
    document.addEventListener('change', onCambio, true);
  }
  pila.push(g);
  return () => {
    const i = pila.lastIndexOf(g);
    if (i >= 0) pila.splice(i, 1);
    if (pila.length === 0) {
      document.removeEventListener('input', onCambio, true);
      document.removeEventListener('change', onCambio, true);
    }
  };
}

/** Marca como modificado el modal visible (si tiene guardia). */
export function marcarModalModificado() {
  pila[pila.length - 1]?.marcar();
}

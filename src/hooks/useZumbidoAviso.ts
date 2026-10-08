import { useCallback, useState } from "react";

/**
 * Zumbido de un aviso (clase `aviso-zumbido` de index.css) al intentar una acción bloqueada
 * por él. Si ya estaba zumbando, se quita la clase y se vuelve a poner en el próximo frame
 * para reiniciar la animación. `terminar` va en el `onAnimationEnd` del aviso.
 */
export function useZumbidoAviso() {
  const [zumbando, setZumbando] = useState(false);
  const disparar = useCallback(() => {
    setZumbando(false);
    requestAnimationFrame(() => setZumbando(true));
  }, []);
  const terminar = useCallback(() => setZumbando(false), []);
  return { zumbando, disparar, terminar };
}

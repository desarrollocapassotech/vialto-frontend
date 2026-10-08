import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

/** Estilo del tooltip oscuro de la app (mismo que el menú lateral colapsado). */
export const tooltipFlotanteClass =
  'pointer-events-none fixed z-[200] rounded-md bg-vialto-charcoal px-3.5 py-2 font-[family-name:var(--font-ui)] text-sm font-medium tracking-wide text-white shadow-lg';

type Estado = { label: string; top: number; left: number; abajo: boolean } | null;

const MARGEN_PX = 8;

/**
 * Reemplaza los tooltips nativos (`title`) de todo lo que esté dentro de `contenedorRef`
 * por el tooltip oscuro de la app. Delegado: no hace falta tocar cada celda, cualquier
 * elemento con `title` adentro del contenedor lo usa automáticamente.
 *
 * Al pasar el mouse, el `title` se mueve a `data-tooltip` para que el navegador no
 * muestre además el nativo.
 */
export function TooltipsDelegados({
  contenedorRef,
}: {
  contenedorRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const [tip, setTip] = useState<Estado>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    let actual: HTMLElement | null = null;

    function objetivo(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      const el = target.closest<HTMLElement>('[title], [data-tooltip]');
      return el && contenedor!.contains(el) ? el : null;
    }

    function mostrar(el: HTMLElement) {
      const title = el.getAttribute('title');
      if (title !== null) {
        el.setAttribute('data-tooltip', title);
        el.removeAttribute('title');
      }
      const label = el.getAttribute('data-tooltip')?.trim();
      if (!label) {
        setTip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const abajo = r.top < 56;
      setTip({
        label,
        top: abajo ? r.bottom + MARGEN_PX : r.top - MARGEN_PX,
        left: r.left + r.width / 2,
        abajo,
      });
    }

    function onOver(e: MouseEvent) {
      const el = objetivo(e.target);
      if (el === actual) return;
      actual = el;
      if (el) mostrar(el);
      else setTip(null);
    }

    function ocultar() {
      actual = null;
      setTip(null);
    }

    function onOut(e: MouseEvent) {
      if (!actual) return;
      const destino = e.relatedTarget;
      if (destino instanceof Node && actual.contains(destino)) return;
      ocultar();
    }

    contenedor.addEventListener('mouseover', onOver);
    contenedor.addEventListener('mouseout', onOut);
    contenedor.addEventListener('mousedown', ocultar);
    window.addEventListener('scroll', ocultar, true);
    return () => {
      contenedor.removeEventListener('mouseover', onOver);
      contenedor.removeEventListener('mouseout', onOut);
      contenedor.removeEventListener('mousedown', ocultar);
      window.removeEventListener('scroll', ocultar, true);
    };
  }, [contenedorRef]);

  // Que no se salga de la pantalla por los costados (ej. columna de acciones, a la derecha).
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    const min = MARGEN_PX + w / 2;
    const max = window.innerWidth - MARGEN_PX - w / 2;
    el.style.left = `${Math.min(Math.max(tip.left, min), max)}px`;
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className={`${tooltipFlotanteClass} max-w-xs whitespace-pre-line text-center`}
      style={{
        top: tip.top,
        left: tip.left,
        transform: `translate(-50%, ${tip.abajo ? '0' : '-100%'})`,
      }}
    >
      {tip.label}
    </div>,
    document.body,
  );
}

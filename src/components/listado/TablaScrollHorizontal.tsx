import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  /** Clases del contenedor con scroll (ej. `listadoTablaWrapperClass`). */
  scrollClassName: string;
  /** Clases del contenedor externo (ej. visibilidad por breakpoint). */
  className?: string;
  children: ReactNode;
};

/**
 * Contenedor con scroll horizontal que, si la tabla no entra, muestra a cada lado
 * (solo donde queda contenido oculto) una sombra y una flecha que desplaza la tabla.
 */
export function TablaScrollHorizontal({ scrollClassName, className = '', children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hayIzquierda, setHayIzquierda] = useState(false);
  const [hayDerecha, setHayDerecha] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function medir() {
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      // Tolerancia de 1px por redondeos de subpíxeles.
      setHayIzquierda(el.scrollLeft > 1);
      setHayDerecha(max - el.scrollLeft > 1);
    }
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', medir);
      ro.disconnect();
    };
  }, []);

  function desplazar(sentido: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.6, behavior: 'smooth' });
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollRef} className={scrollClassName}>
        {children}
      </div>
      <IndicadorLado lado="izquierda" visible={hayIzquierda} onClick={() => desplazar(-1)} />
      <IndicadorLado lado="derecha" visible={hayDerecha} onClick={() => desplazar(1)} />
    </div>
  );
}

function IndicadorLado({
  lado,
  visible,
  onClick,
}: {
  lado: 'izquierda' | 'derecha';
  visible: boolean;
  onClick: () => void;
}) {
  const izq = lado === 'izquierda';
  const Icon = izq ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-y-0 ${izq ? 'left-0' : 'right-0'} z-10 w-10 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${izq ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-black/15 to-transparent`}
    >
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        onClick={onClick}
        aria-label={izq ? 'Ver columnas a la izquierda' : 'Ver columnas a la derecha'}
        // A la altura del encabezado, para que siempre quede a la vista al entrar a la tabla.
        className={`${visible ? 'pointer-events-auto' : ''} absolute top-2 ${
          izq ? 'left-1' : 'right-1'
        } inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-vialto-charcoal shadow-md hover:bg-vialto-mist`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

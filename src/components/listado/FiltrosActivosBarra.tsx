import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { FiltrosActivosContext, setSlotLimpiarFiltros, type FiltroActivo } from "./filtrosActivos";

type FiltroGuardado = Omit<FiltroActivo, "quitar">;

/**
 * Provee el registro de filtros activos de una grilla y dibuja, arriba de ella, un badge
 * por filtro aplicado ("Cliente: Agnone ×"). Tocar la ✕ quita ese filtro. Lo monta
 * `ListadoDatos`; `barra` es la fila de badges (vacía = no ocupa lugar).
 */
export function FiltrosActivosProvider({
  children,
}: {
  children: (barra: ReactNode) => ReactNode;
}) {
  const [filtros, setFiltros] = useState<FiltroGuardado[]>([]);
  const quitadores = useRef(new Map<string, () => void>());

  const registrar = useCallback(
    (id: string, filtro: Omit<FiltroActivo, "id" | "quitar"> | null) => {
      setFiltros((prev) => {
        const sin = prev.filter((f) => f.id !== id);
        if (!filtro) return sin.length === prev.length ? prev : sin;
        const i = prev.findIndex((f) => f.id === id);
        const nuevo = { id, ...filtro };
        if (i === -1) return [...prev, nuevo];
        const actual = prev[i];
        if (actual.titulo === nuevo.titulo && actual.valor === nuevo.valor) return prev;
        const copia = [...prev];
        copia[i] = nuevo;
        return copia;
      });
    },
    [],
  );

  const ctx = useMemo(() => ({ registrar, quitadores }), [registrar]);

  // Lugar de "Limpiar filtros" (ver `setSlotLimpiarFiltros`).
  const slotPrevio = useRef<HTMLElement | null>(null);
  const slotRef = useCallback((el: HTMLSpanElement | null) => {
    if (el) setSlotLimpiarFiltros(el);
    else setSlotLimpiarFiltros(null, slotPrevio.current);
    slotPrevio.current = el;
  }, []);

  // Siempre montada: al final queda el lugar donde se dibuja "Limpiar filtros" de la página.
  // Sin badges ni botón no ocupa lugar (el margen solo aparece si hay algún botón adentro).
  const barra = (
      <div
        className="flex flex-wrap items-center gap-2 [&:has(button)]:mb-3"
        aria-label="Filtros aplicados"
      >
        {filtros.map((f) => (
          <span
            key={f.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-vialto-fire/30 bg-vialto-fire/[0.06] py-1 pl-3 pr-1 text-xs text-vialto-charcoal"
          >
            {/* Solo lo aplicado ("Sin facturar"); el nombre del filtro va en el tooltip. */}
            <span className="truncate font-medium" title={f.titulo}>
              {f.valor ?? f.titulo}
            </span>
            <button
              type="button"
              onClick={() => quitadores.current.get(f.id)?.()}
              aria-label={`Quitar filtro: ${f.valor ?? f.titulo}`}
              title="Quitar filtro"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-vialto-steel transition-colors hover:bg-vialto-fire hover:text-white"
            >
              <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        ))}
        <span ref={slotRef} className="contents" />
      </div>
  );

  return <FiltrosActivosContext.Provider value={ctx}>{children(barra)}</FiltrosActivosContext.Provider>;
}

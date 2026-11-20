import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";

/*
 * Lugar para "Limpiar filtros" al final de la fila de badges. Lo deja la barra de la
 * grilla en pantalla y `LimpiarFiltrosButton` se dibuja ahí (con el handler de su página,
 * que limpia todos sus filtros). Sin grilla en pantalla, el botón queda donde está.
 */
let slotLimpiar: HTMLElement | null = null;
const suscriptores = new Set<() => void>();

export function setSlotLimpiarFiltros(el: HTMLElement | null, anterior?: HTMLElement | null) {
  // Al desmontar, solo se borra si sigue siendo el mismo (otra grilla pudo haberlo tomado).
  if (el === null && anterior !== undefined && slotLimpiar !== anterior) return;
  slotLimpiar = el;
  suscriptores.forEach((fn) => fn());
}

export function useSlotLimpiarFiltros(): HTMLElement | null {
  return useSyncExternalStore(
    (fn) => {
      suscriptores.add(fn);
      return () => suscriptores.delete(fn);
    },
    () => slotLimpiar,
    () => null,
  );
}
import { fmtDateUtc } from "@/lib/fmtDateUtc";

/**
 * Registro de filtros aplicados de una grilla, para la fila de badges que los muestra y
 * deja quitarlos (`FiltrosActivosBarra`). Cada encabezado con filtro
 * (`ViajesListadoHeaderFiltro`) se anota solo mientras está activo; `ListadoDatos` provee
 * el registro y dibuja los badges, así toda grilla los tiene sin código por pantalla.
 */

export type FiltroActivo = {
  id: string;
  /** Nombre de la columna/filtro ("Cliente"). */
  titulo: string;
  /** Lo aplicado en palabras ("Agnone Group"); null = solo se muestra el título. */
  valor: string | null;
  quitar: () => void;
};

type Registro = {
  registrar: (id: string, filtro: Omit<FiltroActivo, "id" | "quitar"> | null) => void;
  /** Quitar con la función del último render (no se re-registra en cada render). */
  quitadores: React.MutableRefObject<Map<string, () => void>>;
};

export const FiltrosActivosContext = createContext<Registro | null>(null);

/** Anota (o saca) un filtro activo en la grilla que lo contiene. Sin provider, no hace nada. */
export function useRegistrarFiltroActivo(
  id: string,
  filtro: { titulo: string; valor: string | null } | null,
  quitar: (() => void) | undefined,
) {
  const ctx = useContext(FiltrosActivosContext);
  const activo = filtro != null && quitar != null;
  const titulo = filtro?.titulo ?? "";
  const valor = filtro?.valor ?? null;
  const quitarRef = useRef(quitar);
  quitarRef.current = quitar;

  useEffect(() => {
    if (!ctx) return;
    if (activo) ctx.quitadores.current.set(id, () => quitarRef.current?.());
    ctx.registrar(id, activo ? { titulo, valor } : null);
    return () => {
      ctx.quitadores.current.delete(id);
      ctx.registrar(id, null);
    };
  }, [ctx, id, activo, titulo, valor]);
}

const ES_ID = /^(c[a-z0-9]{15,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(org|user)_[A-Za-z0-9]+)$/i;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Texto para el badge a partir de la "firma" del filtro (`filterSignature`): texto
 * buscado tal cual, códigos sin guiones bajos ("en_curso" → "en curso"), rangos de fecha
 * formateados. Ids y combinaciones raras → null (el badge muestra solo el título; la
 * pantalla puede pasar `valor` al encabezado para mostrar el nombre).
 */
export function valorLegibleDeFirma(firma: string | undefined): string | null {
  const s = firma?.trim();
  if (!s) return null;
  if (s.includes("|")) {
    const partes = s.split("|").map((p) => p.trim());
    // "desde|hasta" (alguno puede venir vacío).
    if (partes.length === 2 && partes.every((p) => !p || ES_FECHA.test(p))) {
      return textoRangoFechas(partes[0], partes[1]);
    }
    return null;
  }
  if (ES_FECHA.test(s)) return fmtDateUtc(s);
  if (ES_ID.test(s)) return null;
  return textoCodigo(s);
}

/** Etiqueta de la opción elegida en un select (`{ value, label }`); null si no está. */
export function etiquetaDeOpcion(
  opciones: readonly { value: string; label: string }[],
  valor: string | null | undefined,
): string | null {
  if (!valor) return null;
  return opciones.find((o) => o.value === valor)?.label ?? null;
}

/** "en_curso" → "En curso"; textos largos se recortan. */
export function textoCodigo(s: string): string {
  const legible = s.replace(/_/g, " ").trim();
  const conMayus = legible.charAt(0).toUpperCase() + legible.slice(1);
  return conMayus.length > 40 ? `${conMayus.slice(0, 39)}…` : conMayus;
}

/** "01/10/2026 – 15/10/2026", "Desde 01/10/2026", "Hasta 15/10/2026" o null. */
export function textoRangoFechas(desde?: string | null, hasta?: string | null): string | null {
  const d = desde?.trim() ? fmtDateUtc(desde) : "";
  const h = hasta?.trim() ? fmtDateUtc(hasta) : "";
  if (d && h) return `${d} – ${h}`;
  if (d) return `Desde ${d}`;
  if (h) return `Hasta ${h}`;
  return null;
}

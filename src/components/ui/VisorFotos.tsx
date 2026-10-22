import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export type FotoVisor = { url: string; titulo: string };

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_PASO = 0.5;
const ZOOM_DOBLE_CLICK = 2.5;

type Punto = { x: number; y: number };

function limitarZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Visor de fotos en pantalla completa: flechas (y ←/→) para pasar de foto, zoom con
 * rueda, botones, doble click o pellizco, y arrastre para mover la foto ampliada.
 * Esc cierra. Para fotos (tacómetro, ticket); los comprobantes siguen abriéndose en
 * pestaña nueva con `abrirAdjuntoEnPestana`.
 */
export function VisorFotos({
  fotos,
  indiceInicial = 0,
  onClose,
}: {
  fotos: FotoVisor[];
  indiceInicial?: number;
  onClose: () => void;
}) {
  useLockBodyScroll(true);
  const [indice, setIndice] = useState(indiceInicial);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Punto>({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Punteros activos: uno = arrastre, dos = pellizco.
  const punteros = useRef(new Map<number, Punto>());
  const ultimoPunto = useRef<Punto | null>(null);
  const distanciaPellizco = useRef<number | null>(null);
  // Para cerrar con click en el fondo: el pointer capture hace que el `click` llegue
  // siempre al contenedor, así que recordamos dónde arrancó y si hubo arrastre.
  const inicioEnFondo = useRef<Punto | null>(null);

  const foto = fotos[indice];
  const hayVarias = fotos.length > 1;

  const resetVista = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const irA = useCallback(
    (nuevo: number) => {
      const destino = (nuevo + fotos.length) % fotos.length;
      if (!hayVarias || destino === indice) return;
      setIndice(destino);
      resetVista();
      setCargando(true);
    },
    [fotos.length, hayVarias, indice, resetVista],
  );

  const cambiarZoom = useCallback((nuevo: number) => {
    const z = limitarZoom(nuevo);
    setZoom(z);
    if (z === 1) setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    // En `window` y en captura: el visor se abre sobre otro modal que también cierra con
    // Esc (escuchando en `document`); cortamos acá para que cierre solo el visor.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") irA(indice + 1);
      else if (e.key === "ArrowLeft") irA(indice - 1);
      else if (e.key === "+" || e.key === "=") cambiarZoom(zoom + ZOOM_PASO);
      else if (e.key === "-") cambiarZoom(zoom - ZOOM_PASO);
      else if (e.key === "0") resetVista();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cambiarZoom, indice, irA, onClose, resetVista, zoom]);

  function onWheel(e: ReactWheelEvent) {
    cambiarZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  function onPointerDown(e: ReactPointerEvent) {
    inicioEnFondo.current =
      e.target === e.currentTarget ? { x: e.clientX, y: e.clientY } : null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      ultimoPunto.current = { x: e.clientX, y: e.clientY };
      setArrastrando(true);
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      distanciaPellizco.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2 && distanciaPellizco.current) {
      const [a, b] = [...punteros.current.values()];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      cambiarZoom(zoom * (distancia / distanciaPellizco.current));
      distanciaPellizco.current = distancia;
      return;
    }

    if (zoom > 1 && ultimoPunto.current) {
      const dx = e.clientX - ultimoPunto.current.x;
      const dy = e.clientY - ultimoPunto.current.y;
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    }
    ultimoPunto.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: ReactPointerEvent) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) distanciaPellizco.current = null;
    if (punteros.current.size === 0) {
      ultimoPunto.current = null;
      setArrastrando(false);
    } else {
      const [restante] = [...punteros.current.values()];
      ultimoPunto.current = restante;
    }
  }

  if (!foto) return null;

  const botonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none";

  const visor = (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={foto.titulo}
    >
      {/* Barra superior: título + contador a la izquierda, controles a la derecha. */}
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider">
            {foto.titulo}
          </p>
          {hayVarias && (
            <p className="text-xs text-white/60">
              {indice + 1} de {fotos.length}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => cambiarZoom(zoom - ZOOM_PASO)}
          disabled={zoom <= ZOOM_MIN}
          className={botonClass}
          aria-label="Alejar"
          title="Alejar (−)"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-white/70">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => cambiarZoom(zoom + ZOOM_PASO)}
          disabled={zoom >= ZOOM_MAX}
          className={botonClass}
          aria-label="Acercar"
          title="Acercar (+)"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={resetVista}
          disabled={zoom === 1}
          className={botonClass}
          aria-label="Restablecer zoom"
          title="Restablecer (0)"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <a
          href={foto.url}
          target="_blank"
          rel="noopener noreferrer"
          className={botonClass}
          aria-label="Abrir en pestaña nueva"
          title="Abrir en pestaña nueva"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className={botonClass}
          aria-label="Cerrar"
          title="Cerrar (Esc)"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Área de la foto: click en el fondo (sin zoom) cierra. */}
      <div
        className={`relative flex-1 overflow-hidden touch-none ${
          zoom > 1 ? (arrastrando ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        }`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          const inicio = inicioEnFondo.current;
          inicioEnFondo.current = null;
          if (!inicio || zoom !== 1) return;
          if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 5) onClose();
        }}
        onDoubleClick={() => cambiarZoom(zoom > 1 ? 1 : ZOOM_DOBLE_CLICK)}
      >
        {cargando && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
            Cargando…
          </p>
        )}
        <img
          key={foto.url}
          src={foto.url}
          alt={foto.titulo}
          draggable={false}
          onLoad={() => setCargando(false)}
          onError={() => setCargando(false)}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: arrastrando ? "none" : "transform 150ms ease-out",
          }}
        />

        {hayVarias && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                irA(indice - 1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Foto anterior"
              title="Anterior (←)"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                irA(indice + 1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Foto siguiente"
              title="Siguiente (→)"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      {/* Miniaturas para saltar directo a una foto. */}
      {hayVarias && (
        <div className="flex justify-center gap-2 px-4 py-3">
          {fotos.map((f, i) => (
            <button
              key={f.url}
              type="button"
              onClick={() => irA(i)}
              className={`h-14 w-20 overflow-hidden rounded border-2 transition-opacity ${
                i === indice ? "border-vialto-fire opacity-100" : "border-transparent opacity-50 hover:opacity-80"
              }`}
              aria-label={`Ver ${f.titulo}`}
              aria-current={i === indice}
            >
              <img src={f.url} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(visor, document.body) : visor;
}

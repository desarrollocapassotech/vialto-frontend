import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;

const ZOOM_BTN =
  'inline-flex h-8 w-8 items-center justify-center border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-40 disabled:cursor-not-allowed';

export function AdjuntoImagenZoomView({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const clampScale = useCallback((value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)), []);

  function applyScale(next: number) {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped === MIN_SCALE) setOffset({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    applyScale(scale + delta);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (scale <= MIN_SCALE) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handlePointerUp(e: React.PointerEvent) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-black/5 bg-vialto-mist/30 px-3 py-2">
        <button
          type="button"
          title="Alejar"
          aria-label="Alejar"
          disabled={scale <= MIN_SCALE}
          onClick={() => applyScale(scale - ZOOM_STEP)}
          className={ZOOM_BTN}
        >
          <ZoomOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <span className="min-w-[3.5rem] text-center text-xs uppercase tracking-wider text-vialto-steel">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          title="Acercar"
          aria-label="Acercar"
          disabled={scale >= MAX_SCALE}
          onClick={() => applyScale(scale + ZOOM_STEP)}
          className={ZOOM_BTN}
        >
          <ZoomIn className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          title="Restablecer zoom"
          aria-label="Restablecer zoom"
          disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
          onClick={() => {
            setScale(MIN_SCALE);
            setOffset({ x: 0, y: 0 });
          }}
          className="inline-flex h-8 items-center gap-1 px-2 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Restablecer
        </button>
      </div>

      <div
        className={[
          'relative min-h-0 flex-1 overflow-hidden bg-neutral-100 touch-none',
          scale > MIN_SCALE ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        ].join(' ')}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
            className="max-h-full max-w-full select-none object-contain"
          />
        </div>
      </div>
    </div>
  );

}

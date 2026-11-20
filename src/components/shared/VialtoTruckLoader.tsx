import { useEffect, useState } from "react";

/**
 * Loader con el logo de Vialto: la V negra, la barra naranja del "7" y la ruta negra
 * que sube en curva sobre la banda naranja que termina en la flecha. Un camión entra por la ruta, frena a mitad de camino, descarga
 * una caja gris, carga una naranja y sigue hasta la punta de la flecha.
 *
 * Animado con SMIL (`animateMotion` sigue la curva de la ruta y gira el camión con
 * ella; anda igual en Chrome, Firefox y Safari). Todas las animaciones comparten
 * `DUR` y arrancan juntas, así quedan sincronizadas. Con "reducir movimiento"
 * activado en el sistema se dibuja quieto (camión parado en la ruta).
 */

const DUR = "3.8s";
/*
 * Geometría calcada del logo (viewBox 172×142). La ruta es un relleno, no un trazo,
 * para que se angoste al subir como en el logo; RUTA_CENTRO es su eje (por donde
 * va el camión y la línea punteada).
 */
const V = "6,40 31.5,38.5 58,101 47,124";
const BARRA_7 = "61,40.5 110,38.5 96,61 58,61";
const RUTA = "M 55 136 C 57 100, 82 60, 146 19 L 151 28 C 100 59, 80 99, 79 136 Z";
const RUTA_CENTRO = "M 67 136 C 69 99.5, 91 59.5, 148.5 23.5";
/** El borde derecho de la banda arranca en la muesca del ala derecha de la flecha. */
const BANDA = "M 85 136 C 88 104, 102 76, 120 52 L 139 53 C 128 74, 114 104, 107 136 Z";
/** Punta de flecha sin muesca a la izquierda: el ala queda unida a la banda (la ruta pasa por encima). */
const FLECHA = "167,5 103,17 113,40 120,52 139,53 151,68";

function usePrefiereMenosMovimiento(): boolean {
  const [reducir, setReducir] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReducir(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reducir;
}

/** Repetición infinita, todas con la misma duración. */
const loop = { dur: DUR, repeatCount: "indefinite" } as const;

export function VialtoTruckLoader({
  className = "h-24 w-auto",
  label = "Cargando",
}: {
  className?: string;
  /** Texto para lectores de pantalla. */
  label?: string;
}) {
  const quieto = usePrefiereMenosMovimiento();

  return (
    <svg viewBox="0 0 172 142" className={className} role="img" aria-label={label}>
      {/* V: barra negra que se angosta en punta abajo */}
      <polygon points={V} className="fill-vialto-charcoal" />
      {/* Barra naranja del "7", a la derecha de la V */}
      <polygon points={BARRA_7} className="fill-vialto-fire" />

      {/* Banda naranja + punta de flecha: se ilumina cuando llega el camión */}
      <g strokeLinejoin="round" strokeWidth="1.5" className="fill-vialto-fire stroke-vialto-fire">
        {!quieto && (
          <animate attributeName="opacity" values="1;1;0.5;1" keyTimes="0;0.82;0.9;1" {...loop} />
        )}
        <path d={BANDA} />
        <polygon points={FLECHA} />
      </g>

      {/* Ruta negra (más angosta arriba) con filo blanco que la separa de lo naranja */}
      <path d={RUTA} strokeLinejoin="round" strokeWidth="1.6" paintOrder="stroke" className="fill-vialto-charcoal stroke-white" />
      <path d={RUTA_CENTRO} fill="none" strokeWidth="1.6" strokeDasharray="5 5" strokeLinecap="round" className="stroke-white" />

      {/* Camión (mira hacia +x; animateMotion lo gira con la curva) */}
      <g transform={quieto ? "translate(92 72) rotate(-55)" : undefined}>
        {!quieto && (
          <>
            <animateMotion
              path={RUTA_CENTRO}
              rotate="auto"
              calcMode="linear"
              keyPoints="0;0.55;0.55;1"
              keyTimes="0;0.3;0.66;1"
              {...loop}
            />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.92;1" {...loop} />
          </>
        )}
        {/* Escala del camión respecto de la ruta del logo */}
        <g transform="scale(1.15)">

        {/* Caja que se descarga (gris): sube y desaparece */}
        <rect x="-13" y="-17" width="10" height="10" rx="1.2" className="fill-neutral-500 stroke-white" strokeWidth="0.8">
          {!quieto && (
            <>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;0 0;0 -16;0 -16;0 0"
                keyTimes="0;0.34;0.46;0.99;1"
                {...loop}
              />
              <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.34;0.46;0.99;1" {...loop} />
            </>
          )}
        </rect>

        {/* Caja que se carga (naranja): aparece arriba y baja al acoplado */}
        {!quieto && (
          <rect x="-13" y="-17" width="10" height="10" rx="1.2" className="fill-vialto-bright stroke-white" strokeWidth="0.8" opacity="0">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -16;0 -16;0 0;0 0;0 -16"
              keyTimes="0;0.5;0.62;0.99;1"
              {...loop}
            />
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.5;0.54;0.99;1" {...loop} />
          </rect>
        )}

        {/* Acoplado */}
        <rect x="-16" y="-7" width="20" height="11" rx="1.5" className="fill-white stroke-vialto-charcoal" strokeWidth="0.8" />
        {/* Cabina con ventanilla */}
        <path d="M 5 4 V -3 Q 5 -5 7 -5 H 11 L 14 -1 V 4 Z" className="fill-vialto-fire" />
        <rect x="8.5" y="-3.6" width="3" height="2.6" rx="0.5" className="fill-white" />
        {/* Ruedas */}
        {[-11, -3, 10].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="5.5" r="2.4" className="fill-vialto-charcoal stroke-white" strokeWidth="0.7" />
            <circle cx={cx} cy="5.5" r="0.8" className="fill-white" />
          </g>
        ))}
        </g>
      </g>
    </svg>
  );
}

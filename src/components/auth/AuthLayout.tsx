import type { ReactNode } from "react";
import { Fuel, Receipt, Truck, type LucideIcon } from "lucide-react";

const BENEFICIOS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  { icon: Truck, titulo: "Viajes bajo control", texto: "Cada viaje, de la carga a la liquidación del transportista." },
  { icon: Receipt, titulo: "Facturación con ARCA", texto: "Facturas, liquidaciones y cuenta corriente en un solo lugar." },
  { icon: Fuel, titulo: "Flota al día", texto: "Combustible, mantenimiento y vencimientos sin planillas." },
];

/**
 * Pantalla de ingreso / registro: panel de marca oscuro a la izquierda (logo, titular,
 * beneficios y una ruta que avanza, como la del logo) y el formulario a la derecha sobre
 * fondo claro. En mobile queda solo el formulario con el logo arriba. Esquinas rectas,
 * como el resto del sistema.
 */
export function AuthLayout({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  /** Debajo del formulario (ej. "¿No tenés cuenta? Crear cuenta"). */
  pie?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-vialto-mist lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <PanelMarca />

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <img
            src="/vialto-software-black-removebg.png"
            alt="Vialto Software"
            className="mx-auto mb-8 h-24 w-auto lg:hidden"
          />

          <div className="border-t-4 border-vialto-fire bg-white p-6 shadow-[0_18px_50px_-20px_rgba(26,26,26,0.35)] sm:p-8">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
              {titulo}
            </h1>
            {subtitulo && <p className="mt-1 text-sm text-vialto-steel">{subtitulo}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {pie && <div className="mt-6 text-center text-sm text-vialto-steel">{pie}</div>}
        </div>
      </main>
    </div>
  );
}

function PanelMarca() {
  return (
    <aside className="relative hidden overflow-hidden bg-vialto-charcoal lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <RutaDecorativa />
      {/* Oscurece la zona del texto para que la ruta nunca le quite legibilidad. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-vialto-charcoal via-vialto-charcoal/85 to-transparent"
        aria-hidden
      />

      <img
        src="/vialto-software-white-removebg.png"
        alt="Vialto Software"
        className="relative h-28 w-auto self-start"
      />

      <div className="relative max-w-lg">
        <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.3em] text-vialto-fire">
          Software para transporte y logística
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-6xl leading-[0.95] tracking-wide text-white xl:text-7xl">
          Tu operación,
          <br />
          en una sola ruta.
        </h2>

        <ul className="mt-10 grid gap-5">
          {BENEFICIOS.map((b) => (
            <li key={b.titulo} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-vialto-fire/40 bg-vialto-fire/10 text-vialto-fire">
                <b.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <span>
                <span className="block font-[family-name:var(--font-ui)] text-base font-semibold uppercase tracking-wider text-white">
                  {b.titulo}
                </span>
                <span className="block text-sm text-white/55">{b.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/35">© {new Date().getFullYear()} Vialto Software</p>
    </aside>
  );
}

/** Ruta en curva con línea punteada que avanza (se queda quieta con "reducir movimiento"). */
function RutaDecorativa() {
  // Sube por la mitad derecha del panel, lejos del titular y los beneficios (a la izquierda).
  const ruta = "M 520 780 C 600 600, 680 460, 820 330 S 1000 120, 1080 -40";
  return (
    <svg
      viewBox="0 0 1000 720"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Trama de fondo apenas visible */}
      <defs>
        <pattern id="auth-trama" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="white" strokeOpacity="0.035" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-trama)" />

      {/* Banda naranja a la derecha de la ruta, como en el logo */}
      <path d={ruta} fill="none" stroke="#e8470a" strokeOpacity="0.18" strokeWidth="150" transform="translate(70 40)" />
      {/* Ruta */}
      <path d={ruta} fill="none" stroke="#2e2e2e" strokeWidth="110" />
      <path d={ruta} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="112" />
      {/* Línea punteada central que avanza */}
      <path
        d={ruta}
        fill="none"
        stroke="#e8470a"
        strokeOpacity="0.85"
        strokeWidth="5"
        strokeDasharray="28 26"
        className="motion-safe:animate-[ruta-avance_2.4s_linear_infinite]"
      />
    </svg>
  );
}

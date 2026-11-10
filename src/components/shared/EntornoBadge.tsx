import { useEffect, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";

/**
 * Aviso de entorno que no es producción (Clerk de pruebas): un solo badge amarillo
 * y llamativo en la barra superior ("Pruebas · Local" / "Pruebas · QA"). Al hacer
 * click abre el detalle: rama de Neon, Clerk y backend (con la URL de la API).
 * En producción no se muestra.
 */
export function EntornoBadge({
  backend,
  apiUrl,
  clerkEnv,
  neonBranch,
}: {
  /** "LOCAL" o "QA". */
  backend: string;
  apiUrl?: string;
  clerkEnv: string;
  neonBranch?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Es un menú: se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const filas: { label: string; valor: string }[] = [
    { label: "Backend", valor: backend },
    ...(apiUrl ? [{ label: "API", valor: apiUrl }] : []),
    { label: "Base de datos (Neon)", valor: neonBranch || "—" },
    { label: "Autenticación", valor: clerkEnv },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Ver detalle del entorno"
        className="flex items-center gap-1.5 rounded-sm border-2 border-yellow-200 bg-yellow-400 px-2.5 py-1 font-[family-name:var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.12em] text-black shadow-[0_0_12px_rgba(250,204,21,0.6)] hover:bg-yellow-300"
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
        </span>
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        Pruebas · {backend}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Detalle del entorno"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-yellow-300 bg-white p-3 text-left shadow-xl"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
            Entorno de pruebas
          </p>
          <p className="mt-1 text-xs text-vialto-steel">
            No es producción: los datos no son reales.
          </p>
          <dl className="mt-3 space-y-2">
            {filas.map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] uppercase tracking-[0.15em] text-vialto-steel">
                  {f.label}
                </dt>
                <dd className="break-all text-sm font-medium text-vialto-charcoal">{f.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

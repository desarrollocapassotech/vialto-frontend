import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Download, FileSpreadsheet, Upload } from "lucide-react";

const botonClass =
  "inline-flex h-10 items-center gap-1.5 px-4 bg-white border border-black/15 text-sm uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none";

/**
 * Importar / Exportar de la cabecera de una grilla. Si la empresa puede importar
 * (`importarTo`), los dos van juntos en un solo botón con desplegable; si no, queda
 * solo el botón "Exportar" de siempre.
 */
export function ImportarExportarMenu({
  importarTo,
  onExportar,
  exportarDisabled,
  exportando,
}: {
  /** Ruta del asistente de importación; sin ella no se ofrece importar. */
  importarTo?: string;
  onExportar: () => void;
  exportarDisabled?: boolean;
  /** Se está generando el archivo: muestra "Generando…". */
  exportando?: boolean;
}) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  if (!importarTo) {
    return (
      <button type="button" onClick={onExportar} disabled={exportarDisabled || exportando} className={botonClass}>
        <Download className="h-4 w-4" aria-hidden />
        {exportando ? "Generando…" : "Exportar"}
      </button>
    );
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-vialto-charcoal transition-colors hover:bg-vialto-mist/80 disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={exportando}
        className={botonClass}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        {exportando ? "Generando…" : "Importar / Exportar"}
        <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-full overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setAbierto(false);
              navigate(importarTo);
            }}
          >
            <Upload className="h-4 w-4 text-vialto-steel" aria-hidden />
            Importar desde Excel
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={exportarDisabled}
            onClick={() => {
              setAbierto(false);
              onExportar();
            }}
          >
            <Download className="h-4 w-4 text-vialto-steel" aria-hidden />
            Exportar a Excel
          </button>
        </div>
      )}
    </div>
  );
}

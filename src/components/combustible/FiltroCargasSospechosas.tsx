import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { FiltroRapidoChip } from "@/components/listado/FiltroRapidoChip";
import { FiltrosRapidosBoton } from "@/components/listado/FiltrosRapidos";

export type PeriodoSospechosas = "todas" | "este_mes" | "mes_anterior" | "ultimos_3_meses";

export const PERIODOS_SOSPECHOSAS: { id: PeriodoSospechosas; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "este_mes", label: "Este mes" },
  { id: "mes_anterior", label: "Mes anterior" },
  { id: "ultimos_3_meses", label: "Últimos 3 meses" },
];

/** Cantidad de cargas sospechosas por período (con el resto de los filtros), del backend. */
export type ConteoSospechosas = Record<PeriodoSospechosas, number>;

/**
 * Filtro rápido de Combustible: embudo al lado del título (palpita si hay cargas
 * sospechosas este mes) + chip "Cargas sospechosas" que despliega el período. Tocar el
 * período activo, o "Quitar filtro", lo apaga.
 */
export function FiltroCargasSospechosas({
  value,
  onChange,
  conteos,
}: {
  value: PeriodoSospechosas | "";
  onChange: (value: PeriodoSospechosas | "") => void;
  conteos?: ConteoSospechosas;
}) {
  const [abierto, setAbierto] = useState(value !== "");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuAbierto]);

  const activo = PERIODOS_SOSPECHOSAS.find((p) => p.id === value);
  const label = activo ? `Cargas sospechosas · ${activo.label}` : "Cargas sospechosas";
  // Sin período elegido, el chip muestra las de este mes (lo que hace palpitar el embudo).
  const count = conteos?.[activo?.id ?? "este_mes"];

  function elegir(id: PeriodoSospechosas | "") {
    onChange(id);
    setMenuAbierto(false);
  }

  return (
    <>
      <FiltrosRapidosBoton
        abierto={abierto}
        onToggle={() => setAbierto((v) => !v)}
        cantidadActivos={value !== "" ? 1 : 0}
        pendientes={[{ label: "Cargas sospechosas este mes", count: conteos?.este_mes }]}
      />

      {abierto && (
        <div className="relative" ref={menuRef}>
          <FiltroRapidoChip
            label={label}
            active={value !== ""}
            count={count}
            desplegable={{ abierto: menuAbierto }}
            onClick={() => setMenuAbierto((v) => !v)}
          />

          {menuAbierto && (
            <div
              role="menu"
              className="absolute left-0 z-20 mt-1 min-w-[220px] border border-black/15 bg-white shadow-lg"
            >
              {PERIODOS_SOSPECHOSAS.map((p) => {
                const seleccionado = value === p.id;
                return (
                  <button
                    key={p.id}
                    role="menuitemradio"
                    aria-checked={seleccionado}
                    type="button"
                    onClick={() => elegir(seleccionado ? "" : p.id)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-vialto-charcoal hover:bg-vialto-mist/80 transition-colors"
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 text-vialto-fire ${seleccionado ? "" : "invisible"}`}
                      aria-hidden
                    />
                    <span className="flex-1">{p.label}</span>
                    {conteos && (
                      <span className="text-xs tabular-nums text-vialto-steel">{conteos[p.id]}</span>
                    )}
                  </button>
                );
              })}
              {value !== "" && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => elegir("")}
                  className="flex w-full items-center px-4 py-2.5 text-left text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors border-t border-black/10"
                >
                  Quitar filtro
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

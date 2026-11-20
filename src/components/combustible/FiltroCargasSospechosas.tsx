import { useEffect, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { FiltroRapidoChip, FiltrosRapidosIcono } from "@/components/listado/FiltroRapidoChip";

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
 * Filtro rápido de Combustible: cápsula siempre visible (embudo tenue adentro, como el
 * dashboard) con el chip "Cargas sospechosas" que despliega el período. Tocar el
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
      {/* Misma cápsula que FiltrosRapidosGrupo, sin overflow (recortaría el menú desplegable). */}
        <div className="relative flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1 shadow-sm" ref={menuRef}>
          <FiltrosRapidosIcono />
          <FiltroRapidoChip
            label={label}
            icon={TriangleAlert}
            active={value !== ""}
            count={count}
            desplegable={{ abierto: menuAbierto }}
            onClick={() => setMenuAbierto((v) => !v)}
          />

          {menuAbierto && (
            <div
              role="menu"
              className="absolute left-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
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
    </>
  );
}

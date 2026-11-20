import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";

export type ConfigNavItem = { id: string; label: string; icon: LucideIcon };
export type ConfigNavGrupo = {
  id: string;
  label: string;
  items: ConfigNavItem[];
};

/**
 * Menú de secciones de "Configuración por empresa": mismo estilo que Base de datos
 * (`BaseDeDatosPage`). Desktop: lista vertical agrupada a la izquierda. Mobile:
 * botón "Sección" + `SelectorOpcionesSheet`.
 */
export function ConfigSeccionesNav({
  grupos,
  activo,
  onElegir,
}: {
  grupos: ConfigNavGrupo[];
  activo: string;
  onElegir: (id: string) => void;
}) {
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const grupasConItems = grupos.filter((g) => g.items.length > 0);
  const actual = grupasConItems
    .flatMap((g) => g.items)
    .find((i) => i.id === activo);
  const IconoActual = actual?.icon;

  const opciones: SelectorOpcion[] = grupasConItems.flatMap((g) =>
    g.items.map((i) => ({
      id: i.id,
      label: i.label,
      trailing: (
        <span className="text-[10px] uppercase tracking-[0.15em] text-vialto-steel/70">
          {g.label}
        </span>
      ),
    })),
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetAbierto}
          className={selectorTriggerClass}
        >
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Sección
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {IconoActual && (
              <IconoActual
                className="h-4 w-4 shrink-0 text-vialto-steel"
                strokeWidth={1.75}
                aria-hidden
              />
            )}
            <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
              {actual?.label ?? ""}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-vialto-steel"
              strokeWidth={2}
              aria-hidden
            />
          </span>
        </button>
        <SelectorOpcionesSheet
          open={sheetAbierto}
          onClose={() => setSheetAbierto(false)}
          title="Elegir sección"
          options={opciones}
          activeId={activo}
          onSelect={(id) => {
            onElegir(id);
            setSheetAbierto(false);
          }}
        />
      </div>

      <nav
        className="hidden w-60 shrink-0 flex-col gap-0.5 border-r border-black/10 pr-3 lg:sticky lg:top-4 lg:flex"
        aria-label="Secciones de configuración"
      >
        {grupasConItems.map((grupo) => (
          <div key={grupo.id} className="mb-3 flex flex-col gap-0.5 last:mb-0">
            <p className="px-3 pb-1 pt-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel/70">
              {grupo.label}
            </p>
            {grupo.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onElegir(item.id)}
                aria-current={activo === item.id ? "page" : undefined}
                className={[
                  "flex w-full items-center gap-2.5 rounded-sm border-l-2 px-3 py-2.5 text-left font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  activo === item.id
                    ? "border-l-vialto-fire bg-vialto-mist text-vialto-charcoal"
                    : "border-l-transparent text-vialto-steel hover:bg-black/[0.04] hover:text-vialto-charcoal",
                ].join(" ")}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

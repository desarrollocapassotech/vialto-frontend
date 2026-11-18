import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CircleHelp, Search } from "lucide-react";
import { useToast } from "@/lib/toast";

/**
 * Piezas visuales de "Configuración por empresa" (superadmin). Todas las pestañas
 * se arman igual: `ConfigSeccion` (bloque con título) + `ConfigFila` (nombre, ícono
 * de ayuda con tooltip y el control a la derecha). La ayuda va en el tooltip, nunca
 * como texto suelto debajo del nombre.
 *
 * El tooltip lo dibuja `TooltipsDelegados` (montado en la página) a partir del `title`.
 */

export const configInputClass =
  "h-9 w-full border border-black/15 bg-white px-3 text-sm text-vialto-charcoal disabled:opacity-50 focus:outline-none focus:border-vialto-fire";

export const configSelectClass =
  "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal disabled:opacity-50 focus:outline-none focus:border-vialto-fire";

/** Charcoal = prendido, gris = apagado. */
export function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      onClick={onChange}
      aria-checked={checked}
      aria-label={label}
      className={[
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-vialto-charcoal" : "bg-black/15",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export function AyudaIcono({ texto }: { texto: string }) {
  return (
    <button
      type="button"
      title={texto}
      aria-label={texto}
      className="inline-flex shrink-0 cursor-help text-vialto-steel/60 transition-colors hover:text-vialto-charcoal"
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

// --- Búsqueda -------------------------------------------------------------

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const BusquedaContext = createContext("");

/** Envuelve el contenido de una pestaña y filtra sus filas por `busqueda`. */
export function ConfigBusquedaProvider({
  busqueda,
  children,
}: {
  busqueda: string;
  children: ReactNode;
}) {
  const q = normalizar(busqueda);
  return (
    <BusquedaContext.Provider value={q}>
      <div className={q ? "config-cuerpo config-buscando" : "config-cuerpo"}>
        {children}
        <p className="config-sin-resultados py-10 text-center text-sm text-vialto-steel">
          Nada coincide con “{busqueda.trim()}” en esta pestaña.
        </p>
      </div>
    </BusquedaContext.Provider>
  );
}

export function ConfigBuscador({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vialto-steel"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${configInputClass} pl-9`}
      />
    </label>
  );
}

// --- Layout ---------------------------------------------------------------

export function ConfigSeccion({
  titulo,
  acciones,
  barra,
  columnas,
  children,
}: {
  titulo: string;
  /** Controles chicos a la derecha del título (ej. "Historial"). */
  acciones?: ReactNode;
  /** Franja de controles arriba de las filas (ej. selector de formulario). */
  barra?: ReactNode;
  /** Filas en dos columnas desde md (listas largas de switches). */
  columnas?: boolean;
  children: ReactNode;
}) {
  const q = useContext(BusquedaContext);
  // Si el título coincide con la búsqueda, se muestra la sección entera.
  const tituloCoincide = !!q && normalizar(titulo).includes(q);
  return (
    <section className="config-seccion overflow-hidden border border-black/10 bg-white">
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-black/10 bg-vialto-mist/60 px-4 py-2">
        <h3 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[0.18em] text-vialto-steel">
          {titulo}
        </h3>
        {acciones}
      </header>
      {barra && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-black/10 px-4 py-2.5">
          {barra}
        </div>
      )}
      <BusquedaContext.Provider value={tituloCoincide ? "" : q}>
        <div
          className={
            columnas
              ? "-mb-px grid md:grid-cols-2 [&>*]:border-b [&>*]:border-black/[0.06] md:[&>*:nth-child(odd)]:border-r"
              : "divide-y divide-black/[0.06]"
          }
        >
          {children}
        </div>
      </BusquedaContext.Provider>
    </section>
  );
}

export function ConfigFila({
  label,
  ayuda,
  aviso,
  palabrasClave,
  apilado,
  children,
}: {
  label: string;
  /** Texto de ayuda: va en el tooltip del ícono "?". */
  ayuda?: string;
  /** Mensaje corto según el estado (ej. por qué el switch está bloqueado). */
  aviso?: string | null;
  /** Términos extra para el buscador. */
  palabrasClave?: string;
  /** Control debajo del nombre, a todo el ancho (listas, chips). */
  apilado?: boolean;
  children: ReactNode;
}) {
  const q = useContext(BusquedaContext);
  if (q) {
    const texto = normalizar(`${label} ${ayuda ?? ""} ${palabrasClave ?? ""}`);
    if (!texto.includes(q)) return null;
  }
  return (
    <div
      data-config-fila
      className={
        apilado
          ? "flex flex-col gap-2 px-4 py-3"
          : "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5"
      }
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-vialto-charcoal">
          <span>{label}</span>
          {ayuda && <AyudaIcono texto={ayuda} />}
        </div>
        {aviso && <p className="mt-0.5 text-xs text-amber-800/90">{aviso}</p>}
      </div>
      <div
        className={
          apilado
            ? "w-full"
            : "flex w-full items-center justify-end gap-3 sm:w-auto"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Ancho fijo para inputs/selects dentro de una fila. */
export function ConfigControl({ children }: { children: ReactNode }) {
  return <div className="w-full sm:w-64">{children}</div>;
}

/** Input de texto que guarda al salir del campo (o con Enter) si cambió. */
export function ConfigTextoInput({
  valor,
  onGuardar,
  placeholder,
  disabled,
  maxLength,
  ariaLabel,
  type = "text",
  validar,
}: {
  valor: string;
  onGuardar: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  ariaLabel: string;
  type?: "text" | "number";
  /** Devuelve un mensaje si el valor no sirve: se avisa y se vuelve al guardado. */
  validar?: (v: string) => string | null;
}) {
  const [draft, setDraft] = useState(valor);
  const { showToast } = useToast();
  useEffect(() => setDraft(valor), [valor]);
  return (
    <input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (v === valor) return;
        const error = validar?.(v);
        if (error) {
          showToast(error, "error");
          setDraft(valor);
          return;
        }
        onGuardar(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={configInputClass}
    />
  );
}

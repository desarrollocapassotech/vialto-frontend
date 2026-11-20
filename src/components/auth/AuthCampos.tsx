import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, type LucideIcon } from "lucide-react";

const inputClass =
  "h-12 w-full border border-black/15 bg-white pl-11 pr-3 text-sm text-vialto-charcoal placeholder:text-vialto-steel/50 transition-colors focus:border-vialto-fire focus:outline-none focus:ring-2 focus:ring-vialto-fire/15";

/** Campo de las pantallas de ingreso/registro: etiqueta, ícono a la izquierda y el input. */
export function AuthCampo({
  label,
  icon: Icon,
  derecha,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  /** Algo al final del input (ej. el ojo de la contraseña). */
  derecha?: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel">
        {label}
      </span>
      <span className="relative block">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-vialto-steel/60"
          aria-hidden
        />
        <input {...input} className={`${inputClass} ${derecha ? "pr-12" : ""} ${className}`} />
        {derecha && <span className="absolute right-1 top-1/2 -translate-y-1/2">{derecha}</span>}
      </span>
    </label>
  );
}

/** Contraseña con el ojo para mostrarla u ocultarla. */
export function AuthCampoPassword(
  props: Omit<Parameters<typeof AuthCampo>[0], "type" | "derecha">,
) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthCampo
      {...props}
      type={visible ? "text" : "password"}
      derecha={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="flex h-10 w-10 items-center justify-center text-vialto-steel/70 transition-colors hover:text-vialto-charcoal"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

/** Botón principal naranja, a todo el ancho, con flecha (spinner mientras carga). */
export function AuthBotonPrincipal({
  children,
  cargando,
}: {
  children: ReactNode;
  cargando: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="group mt-2 inline-flex h-12 w-full items-center justify-center gap-2 bg-vialto-fire font-[family-name:var(--font-ui)] text-base font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-vialto-bright disabled:cursor-wait disabled:opacity-70"
    >
      {children}
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
      )}
    </button>
  );
}

/** "Continuar con Google". */
export function AuthBotonGoogle({
  children,
  onClick,
  cargando,
}: {
  children: ReactNode;
  onClick: () => void;
  cargando: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className="inline-flex h-12 w-full items-center justify-center gap-3 border border-black/15 bg-white text-sm font-medium text-vialto-charcoal transition-colors hover:border-black/30 hover:bg-vialto-mist disabled:cursor-wait disabled:opacity-70"
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin text-vialto-steel" aria-hidden />
      ) : (
        <img src="/google-logo.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
      )}
      {children}
    </button>
  );
}

export function AuthSeparador({ texto }: { texto: string }) {
  return (
    <div className="my-6 flex items-center gap-3 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel/70">
      <span className="h-px flex-1 bg-black/10" />
      <span>{texto}</span>
      <span className="h-px flex-1 bg-black/10" />
    </div>
  );
}

export function AuthAviso({ tipo, children }: { tipo: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`mb-5 border-l-4 px-3 py-2.5 text-sm ${
        tipo === "error"
          ? "border-red-500 bg-red-50 text-red-800"
          : "border-amber-500 bg-amber-50 text-amber-900"
      }`}
    >
      {children}
    </p>
  );
}

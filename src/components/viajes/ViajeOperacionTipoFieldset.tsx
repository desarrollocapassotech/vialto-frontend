import type { ReactNode } from "react";

export type ViajeOperacionModo = "propio" | "externo";

const legendClass =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";

type Props = {
  // 1. Permitimos que 'modo' pueda ser null o undefined para el estado inicial/vacío
  modo?: ViajeOperacionModo | null;
  onModoChange: (modo: ViajeOperacionModo) => void;
  externoContent: ReactNode;
  propioContent: ReactNode;
  /** id único por instancia para agrupar radios (evita colisiones en la misma página) */
  groupName?: string;
  className?: string;
  /**
   * false = la empresa no usa ese tipo de flota (ver `useTipoFlotaVisible`).
   * La opción igual se muestra si es el modo actual del viaje, para que un
   * viaje cargado antes del cambio de configuración se pueda corregir.
   */
  externoVisible?: boolean;
  propioVisible?: boolean;
};

export function ViajeOperacionTipoFieldset({
  modo,
  onModoChange,
  externoContent,
  propioContent,
  groupName = "viaje-operacion-tipo",
  className,
  externoVisible = true,
  propioVisible = true,
}: Props) {
  const mostrarExterno = externoVisible || modo === "externo";
  const mostrarPropio = propioVisible || modo === "propio";
  // Con una sola opción no hay nada que elegir: sin título ni radio, solo el
  // contenido de ese tipo de flota.
  const mostrarSelector = mostrarExterno && mostrarPropio;
  return (
    <fieldset
      className={
        className ??
        "min-w-0 space-y-3 border-0 p-0 md:col-span-2 lg:col-span-3 [&:disabled]:opacity-60"
      }
    >
      {mostrarSelector && (
        <legend className={`${legendClass} mb-2`}>Tipo de flota</legend>
      )}
      <div className={mostrarSelector ? "flex flex-wrap gap-4 sm:gap-6" : "hidden"}>
        {mostrarExterno && (
          <label className="flex cursor-pointer items-center gap-2 text-base text-vialto-charcoal">
            <input
              type="radio"
              name={groupName}
              className="h-4 w-4 accent-vialto-charcoal"
              // Se marcará solo si 'modo' es estrictamente 'externo'
              checked={modo === "externo"}
              onChange={() => onModoChange("externo")}
            />
            <span>Transporte externo</span>
          </label>
        )}
        {mostrarPropio && (
          <label className="flex cursor-pointer items-center gap-2 text-base text-vialto-charcoal">
            <input
              type="radio"
              name={groupName}
              className="h-4 w-4 accent-vialto-charcoal"
              // Se marcará solo si 'modo' es estrictamente 'propio'
              checked={modo === "propio"}
              onChange={() => onModoChange("propio")}
            />
            <span>Flota propia</span>
          </label>
        )}
      </div>
      {modo === "externo" && !externoVisible && (
        <p className="text-xs text-amber-800/90">
          La empresa no trabaja con transporte externo. Cambiá este viaje a
          flota propia si corresponde.
        </p>
      )}
      {modo === "propio" && !propioVisible && (
        <p className="text-xs text-amber-800/90">
          La empresa no trabaja con flota propia. Cambiá este viaje a transporte
          externo si corresponde.
        </p>
      )}
      <div className="pt-1">
        {/* 2. Reemplazamos el ternario por condiciones lógicas exactas */}
        {modo === "externo" && externoContent}
        {modo === "propio" && propioContent}
      </div>
    </fieldset>
  );
}

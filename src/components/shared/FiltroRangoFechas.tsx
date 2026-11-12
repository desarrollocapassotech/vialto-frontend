import { useEffect, useState } from "react";
import { useViajesFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";

interface FiltroRangoFechasProps {
  desde: string;
  hasta: string;
  onAplicar: (desde: string, hasta: string) => void;
  desdeLabel?: string;
  hastaLabel?: string;
  className?: string;
}

export function FiltroRangoFechas({
  desde,
  hasta,
  onAplicar,
  desdeLabel = "Desde",
  hastaLabel = "Hasta",
  className = "",
}: FiltroRangoFechasProps) {
  const [localDesde, setLocalDesde] = useState(desde);
  const [localHasta, setLocalHasta] = useState(hasta);
  const filtroContext = useViajesFiltro();

  useEffect(() => {
    setLocalDesde(desde);
  }, [desde]);

  useEffect(() => {
    setLocalHasta(hasta);
  }, [hasta]);

  const rangoInvalido = Boolean(
    localDesde && localHasta && localDesde > localHasta,
  );

  function handleAplicar() {
    if (rangoInvalido) return;
    onAplicar(localDesde, localHasta);
    filtroContext?.cerrar();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAplicar();
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
        {desdeLabel}
        <input
          type="date"
          value={localDesde}
          max={localHasta || undefined}
          onChange={(e) => setLocalDesde(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
        {hastaLabel}
        <input
          type="date"
          value={localHasta}
          min={localDesde || undefined}
          onChange={(e) => setLocalHasta(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
        />
      </label>
      {rangoInvalido && (
        <span className="text-[11px] leading-tight text-red-600">
          La fecha Desde no puede ser posterior a Hasta.
        </span>
      )}
      <button
        type="button"
        disabled={rangoInvalido}
        onClick={handleAplicar}
        className="mt-1 flex h-8 w-full items-center justify-center rounded-sm bg-vialto-fire font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-vialto-fire/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Aplicar
      </button>
    </div>
  );
}


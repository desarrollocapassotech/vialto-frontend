import { Spinner } from "@/components/ui/Spinner";
import type { useArcaPadron } from "@/hooks/useArcaPadron";

type Props = Pick<
  ReturnType<typeof useArcaPadron>,
  "estado" | "puedeValidar" | "consultar" | "hayDiferencias" | "aplicarDatos"
>;

const linkClass =
  "text-xs font-medium uppercase tracking-wider text-vialto-charcoal underline underline-offset-2 hover:text-vialto-graphite";

/** Resultado de la validación del CUIT contra ARCA, debajo del campo CUIT (ver useArcaPadron). */
export function ArcaPadronStatus({ estado, puedeValidar, consultar, hayDiferencias, aplicarDatos }: Props) {
  if (estado.status === "idle") {
    return puedeValidar ? (
      <button type="button" className={`${linkClass} justify-self-start`} onClick={() => void consultar()}>
        Validar CUIT con ARCA
      </button>
    ) : null;
  }

  if (estado.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-vialto-steel">
        <Spinner className="h-3.5 w-3.5" /> Consultando ARCA…
      </p>
    );
  }

  if (estado.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-black/10 bg-vialto-mist/40 px-3 py-2 text-sm text-vialto-steel">
        <span>No se pudo validar con ARCA: {estado.message}</span>
        <button type="button" className={linkClass} onClick={() => void consultar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const { data } = estado;

  if (data.estado === "no_encontrado" || data.estado === "inactivo") {
    return (
      <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {data.estado === "no_encontrado"
          ? "Este CUIT no existe en ARCA. Revisá que esté bien escrito."
          : `Este CUIT figura INACTIVO en ARCA${data.nombre ? ` (${data.nombre})` : ""}. Revisá que sea el correcto.`}
      </div>
    );
  }

  const conObservaciones = data.estado === "con_observaciones";
  return (
    <div
      className={`space-y-1 border px-3 py-2 text-sm ${
        conObservaciones
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <p className="font-medium">
        {conObservaciones ? "CUIT válido en ARCA, con observaciones" : "✓ CUIT validado en ARCA"}
        {data.nombre ? ` — ${data.nombre}` : ""}
      </p>
      {data.domicilio && <p>{data.domicilio}</p>}
      {data.observaciones.map((o) => (
        <p key={o}>{o}</p>
      ))}
      {hayDiferencias && (
        <button type="button" className={linkClass} onClick={aplicarDatos}>
          Usar datos de ARCA
        </button>
      )}
    </div>
  );
}

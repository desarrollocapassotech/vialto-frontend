import type { useArcaPadron } from "@/hooks/useArcaPadron";

type Props = Pick<ReturnType<typeof useArcaPadron>, "estado" | "consultar">;

const linkClass =
  "text-xs font-medium uppercase tracking-wider text-vialto-charcoal underline underline-offset-2 hover:text-vialto-graphite";

/**
 * Aviso de la validación del CUIT contra ARCA, debajo del campo CUIT (ver useArcaPadron).
 * La consulta y el autocompletado corren en segundo plano: solo se muestra algo si hubo
 * un error o una advertencia (CUIT inexistente, inactivo o con observaciones).
 */
export function ArcaPadronStatus({ estado, consultar }: Props) {
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

  if (estado.status !== "ok") return null;
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

  if (data.estado !== "con_observaciones") return null;
  return (
    <div className="space-y-1 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-medium">CUIT válido en ARCA, con observaciones</p>
      {data.observaciones.map((o) => (
        <p key={o}>{o}</p>
      ))}
    </div>
  );
}

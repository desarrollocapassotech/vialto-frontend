import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import {
  PAISES_SOPORTADOS,
  inferirPaisDesdeUbicacion,
  type PaisCodigo,
} from "@/lib/ciudades";
import type { ImportCiudadAdvertencia } from "@/types/api";

type OcurrenciaAdvertencia = { fila: number; campo: "origen" | "destino" };

type GrupoAdvertencia = {
  valor: string;
  mensaje: string;
  ocurrencias: OcurrenciaAdvertencia[];
};

/**
 * Varias filas suelen compartir el mismo texto sin resolver (ej. la misma
 * ciudad mal tipeada repetida en 6 filas de origen) — se agrupan por mensaje
 * para mostrar el texto una sola vez en vez de repetirlo por fila, con un
 * único buscador de ciudad cuya elección se aplica a todas las ocurrencias
 * del grupo de una vez.
 */
function agruparAdvertencias(
  advertencias: ImportCiudadAdvertencia[],
): GrupoAdvertencia[] {
  const grupos = new Map<string, GrupoAdvertencia>();
  for (const a of advertencias) {
    const existente = grupos.get(a.mensaje);
    if (existente) {
      existente.ocurrencias.push({ fila: a.fila, campo: a.campo });
    } else {
      grupos.set(a.mensaje, {
        valor: a.valor,
        mensaje: a.mensaje,
        ocurrencias: [{ fila: a.fila, campo: a.campo }],
      });
    }
  }
  return [...grupos.values()];
}

/**
 * Deja elegir la ciudad correcta para cada grupo de filas con advertencia
 * (ambigua o no reconocida) en vez de solo avisar — la elección se aplica al
 * toque en la previsualización y viaja en `ciudadesNormalizadas` al
 * confirmar. El país se infiere del texto como punto de partida (heurística
 * de palabras clave), pero es editable: la heurística no reconoce
 * abreviaturas como "UY", así que a veces hay que corregirla a mano.
 * También se puede excluir directamente una fila (ej. multidestino tipo
 * "PARANA+RAFAELA+CORDOBA", que nunca va a matchear una sola ciudad) — a
 * diferencia de elegir una ciudad, esto hace que esa fila NO se importe.
 */
export function CiudadAdvertenciasPanel({
  advertencias,
  onElegir,
  onIgnorarFila,
}: {
  advertencias: ImportCiudadAdvertencia[];
  onElegir: (fila: number, campo: "origen" | "destino", valor: string) => void;
  onIgnorarFila: (fila: number) => void;
}) {
  const [paisPorGrupo, setPaisPorGrupo] = useState<Record<string, PaisCodigo>>(
    {},
  );
  const [valorCopiado, setValorCopiado] = useState<string | null>(null);

  const grupos = useMemo(() => agruparAdvertencias(advertencias), [advertencias]);

  if (advertencias.length === 0) return null;

  async function copiarValor(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setValorCopiado(valor);
      setTimeout(
        () => setValorCopiado((prev) => (prev === valor ? null : prev)),
        1500,
      );
    } catch {
      // Portapapeles no disponible (permisos del navegador) — no bloquea el flujo.
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">
        Ciudades a confirmar ({advertencias.length})
      </p>
      <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
        {grupos.map((g) => {
          const pais = paisPorGrupo[g.mensaje] ?? inferirPaisDesdeUbicacion(g.valor);
          const filasUnicas = [...new Set(g.ocurrencias.map((o) => o.fila))];
          return (
            <div key={g.mensaje} className="space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                <div className="text-[11px] text-amber-900 sm:w-56 shrink-0">
                  <span className="font-medium">
                    {g.ocurrencias.map((o, idx) => (
                      <span key={`${o.fila}-${o.campo}`}>
                        {idx > 0 && ", "}
                        Fila {o.fila} · {o.campo === "origen" ? "Origen" : "Destino"}
                      </span>
                    ))}
                  </span>
                  <br />
                  {g.mensaje}{" "}
                  <button
                    type="button"
                    onClick={() => copiarValor(g.valor)}
                    className="inline-flex items-center gap-1 font-medium text-amber-800 underline decoration-dotted hover:text-amber-950"
                    title="Copiar el texto de la ciudad para buscarla en el listado"
                  >
                    {valorCopiado === g.valor ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copiar "{g.valor}"
                  </button>
                </div>
                <select
                  value={pais}
                  onChange={(e) =>
                    setPaisPorGrupo((prev) => ({
                      ...prev,
                      [g.mensaje]: e.target.value as PaisCodigo,
                    }))
                  }
                  className="h-8 shrink-0 border border-black/20 bg-white px-1 text-xs"
                  aria-label="País"
                >
                  {PAISES_SOPORTADOS.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
                <CiudadCombobox
                  pais={pais}
                  value=""
                  onChange={(valor) => {
                    for (const o of g.ocurrencias) onElegir(o.fila, o.campo, valor);
                  }}
                  placeholder={`Elegí la ciudad correcta para "${g.valor}"…`}
                  inputClassName="h-8 w-full border border-black/20 bg-white px-2 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {filasUnicas.map((fila) => (
                  <button
                    key={fila}
                    type="button"
                    onClick={() => onIgnorarFila(fila)}
                    className="h-8 border border-black/20 bg-white px-2 text-xs text-vialto-steel hover:bg-black/[0.04]"
                    title="No corresponde a una sola ciudad (ej. multidestino) — esta fila no se va a importar."
                  >
                    No importar fila {fila}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

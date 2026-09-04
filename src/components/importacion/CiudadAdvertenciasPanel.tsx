import { useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
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

/** El mensaje ya trae el valor citado al inicio (`"X" no coincide con...`) — se saca para no repetirlo dos veces si el valor ya se muestra como título del grupo. */
function explicacionSinValor(mensaje: string, valor: string): string {
  const prefijo = `"${valor}" `;
  return mensaje.startsWith(prefijo) ? mensaje.slice(prefijo.length) : mensaje;
}

const excludeButtonClass =
  "inline-flex h-7 items-center gap-1 rounded border border-black/15 bg-white px-2 text-[11px] text-vialto-steel hover:bg-black/[0.04]";

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
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">
        Ciudades a confirmar ({advertencias.length})
      </p>
      <div className="space-y-3">
        {grupos.map((g) => {
          const pais = paisPorGrupo[g.mensaje] ?? inferirPaisDesdeUbicacion(g.valor);
          const filasUnicas = [...new Set(g.ocurrencias.map((o) => o.fila))];
          const explicacion = explicacionSinValor(g.mensaje, g.valor);

          return (
            <div
              key={g.mensaje}
              className="overflow-hidden rounded-lg border border-amber-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200 bg-amber-100/70 px-4 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-amber-950">
                      "{g.valor}"
                    </p>
                    <button
                      type="button"
                      onClick={() => copiarValor(g.valor)}
                      className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-50"
                      title="Copiar el texto de la ciudad para buscarla en el listado"
                    >
                      {valorCopiado === g.valor ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copiar
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800">{explicacion}</p>
                </div>
                <span className="shrink-0 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  {filasUnicas.length} fila{filasUnicas.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3 bg-amber-50/60 px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {g.ocurrencias.map((o) => (
                    <span
                      key={`${o.fila}-${o.campo}`}
                      className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                    >
                      Fila {o.fila} · {o.campo === "origen" ? "Origen" : "Destino"}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={pais}
                    onChange={(e) =>
                      setPaisPorGrupo((prev) => ({
                        ...prev,
                        [g.mensaje]: e.target.value as PaisCodigo,
                      }))
                    }
                    className="h-9 shrink-0 border border-black/20 bg-white px-2 text-sm sm:w-40"
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
                    className="min-w-0 flex-1"
                    inputClassName="h-9 w-full border border-black/20 bg-white px-2 text-sm"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Excluir del import (no corresponde a una sola ciudad)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {filasUnicas.map((fila) => (
                      <button
                        key={fila}
                        type="button"
                        onClick={() => onIgnorarFila(fila)}
                        className={excludeButtonClass}
                        title="No corresponde a una sola ciudad (ej. multidestino) — esta fila no se va a importar."
                      >
                        <X className="h-3 w-3" />
                        Fila {fila}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

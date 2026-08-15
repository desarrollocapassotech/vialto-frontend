import { useState } from "react";
import { CiudadCombobox } from "@/components/forms/CiudadCombobox";
import {
  PAISES_SOPORTADOS,
  inferirPaisDesdeUbicacion,
  type PaisCodigo,
} from "@/lib/ciudades";
import type { ImportCiudadAdvertencia } from "@/types/api";

/**
 * Deja elegir la ciudad correcta para cada fila con advertencia (ambigua o
 * no reconocida) en vez de solo avisar — la elección se aplica al toque en
 * la previsualización y viaja en `ciudadesNormalizadas` al confirmar.
 * El país se infiere del texto como punto de partida (heurística de
 * palabras clave), pero es editable: la heurística no reconoce abreviaturas
 * como "UY", así que a veces hay que corregirla a mano.
 * También se puede excluir directamente la fila (ej. multidestino tipo
 * "PARANA+RAFAELA+CORDOBA", que nunca va a matchear una sola ciudad) — a
 * diferencia de elegir una ciudad, esto hace que la fila NO se importe.
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
  const [paisPorFila, setPaisPorFila] = useState<Record<string, PaisCodigo>>(
    {},
  );

  if (advertencias.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">
        Ciudades a confirmar ({advertencias.length})
      </p>
      <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
        {advertencias.map((a, i) => {
          const key = `${a.fila}-${a.campo}`;
          const pais = paisPorFila[key] ?? inferirPaisDesdeUbicacion(a.valor);
          return (
            <div
              key={`${key}-${i}`}
              className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2"
            >
              <div className="text-[11px] text-amber-900 sm:w-56 shrink-0">
                <span className="font-medium">
                  Fila {a.fila} · {a.campo === "origen" ? "Origen" : "Destino"}
                </span>
                <br />
                {a.mensaje}
              </div>
              <select
                value={pais}
                onChange={(e) =>
                  setPaisPorFila((prev) => ({
                    ...prev,
                    [key]: e.target.value as PaisCodigo,
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
                onChange={(valor) => onElegir(a.fila, a.campo, valor)}
                placeholder={`Elegí la ciudad correcta para "${a.valor}"…`}
                inputClassName="h-8 w-full border border-black/20 bg-white px-2 text-xs"
              />
              <button
                type="button"
                onClick={() => onIgnorarFila(a.fila)}
                className="h-8 shrink-0 border border-black/20 bg-white px-2 text-xs text-vialto-steel hover:bg-black/[0.04]"
                title="No corresponde a una sola ciudad (ej. multidestino) — esta fila no se va a importar."
              >
                No importar esta fila
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

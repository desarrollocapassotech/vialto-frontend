import type { ViajeClienteDraft } from "@/lib/viajesClientes";
import type { Cliente } from "@/types/api";

interface Props {
  clientesRows: ViajeClienteDraft[];
  clientes: Cliente[];
}

/** Resumen de los clientes cargados en el paso 1, mostrado arriba de los pasos siguientes (mismo patrón que el resumen de Cliente/Depósito del wizard de Ingresos de stock). */
export function ViajeCreateResumenClientes({ clientesRows, clientes }: Props) {
  const filas = clientesRows.filter((r) => r.clienteId.trim());
  if (filas.length === 0) return null;

  return (
    <div className="bg-vialto-mist/40 border border-black/10 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {filas.map((row, i) => {
        const nombre = clientes.find((c) => c.id === row.clienteId)?.nombre;
        return (
          <span key={row.clienteId} className="flex items-center gap-x-3">
            <span className="font-medium text-vialto-charcoal">{nombre || "—"}</span>
            {i < filas.length - 1 && (
              <span className="text-black/20" aria-hidden>
                |
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

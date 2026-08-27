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
    <div className="bg-vialto-mist/40 border border-black/10 rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {filas.map((row, i) => {
        const nombre = clientes.find((c) => c.id === row.clienteId)?.nombre;
        return (
          <span key={row.clienteId}>
            <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">
              {filas.length > 1 ? `Cliente ${i + 1}` : "Cliente"}
            </span>
            <span className="font-medium text-vialto-charcoal">{nombre || "—"}</span>
          </span>
        );
      })}
    </div>
  );
}

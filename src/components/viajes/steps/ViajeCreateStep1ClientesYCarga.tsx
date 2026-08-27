import { Button } from "@/components/ui/Button";
import { ViajeClientesFieldset } from "@/components/viajes/ViajeClientesFieldset";
import { emptyClienteRow, type ViajeClienteDraft } from "@/lib/viajesClientes";
import type { OpcionProducto } from "@/lib/productosViaje";
import type { Cliente, Pais, Producto } from "@/types/api";

const fieldLabelClass =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";

interface Props {
  clientesRows: ViajeClienteDraft[];
  onClientesRowsChange: (rows: ViajeClienteDraft[]) => void;
  clientesRowErrors: Record<number, string>;
  clientes: Cliente[];
  desgloseActivo: boolean;
  mostrarProductos: boolean;
  paises: Pais[];
  paisesLoading: boolean;
  onNuevoPaisOrigen: (clienteIndex: number) => void;
  onNuevoPaisDestino: (clienteIndex: number, destinoIndex: number) => void;
  onNuevoCliente: (clienteIndex: number) => void;
  opcionesProducto: OpcionProducto[];
  getToken: () => Promise<string | null>;
  onProductoCreado: (p: Producto) => void;

  error: string | null;
  onContinuar: () => void;
}

export function ViajeCreateStep1ClientesYCarga({
  clientesRows,
  onClientesRowsChange,
  clientesRowErrors,
  clientes,
  desgloseActivo,
  mostrarProductos,
  paises,
  paisesLoading,
  onNuevoPaisOrigen,
  onNuevoPaisDestino,
  onNuevoCliente,
  opcionesProducto,
  getToken,
  onProductoCreado,
  error,
  onContinuar,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Clientes del viaje</span>
        <ViajeClientesFieldset
          rows={clientesRows}
          onChange={onClientesRowsChange}
          clientes={clientes}
          rowErrors={clientesRowErrors}
          desgloseActivo={desgloseActivo}
          mostrarProductos={mostrarProductos}
          paises={paises}
          paisesLoading={paisesLoading}
          onNuevoPaisOrigen={onNuevoPaisOrigen}
          onNuevoPaisDestino={onNuevoPaisDestino}
          onNuevoCliente={onNuevoCliente}
          opcionesProducto={opcionesProducto}
          getToken={getToken}
          onProductoCreado={onProductoCreado}
          minRows={1}
          labelPrefix="Cliente"
        />
        <button
          type="button"
          onClick={() => onClientesRowsChange([...clientesRows, emptyClienteRow()])}
          className="mt-1 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist self-start"
        >
          + Agregar cliente
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="pt-2 flex justify-end">
        <Button type="button" onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

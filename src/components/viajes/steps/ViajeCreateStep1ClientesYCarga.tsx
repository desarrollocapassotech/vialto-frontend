import { Button } from "@/components/ui/Button";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { ViajeClientesFieldset } from "@/components/viajes/ViajeClientesFieldset";
import {
  emptyClienteRow,
  type CampoClienteFaltante,
  type ViajeClienteDraft,
} from "@/lib/viajesClientes";
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
  paisFijo?: Pais | null;
  /** `Tenant.recomendacionCiudadesHabilitada`: false = origen/destinos en texto libre. */
  sugerenciasCiudad?: boolean;
  /** "Toneladas" o "Cantidad" según `Tenant.unidadCantidadViajes`. */
  labelCantidad?: string;
  /** Antes de agregar un cliente: false = hay tarjetas incompletas (el host muestra el aviso). */
  puedeAgregarCliente?: () => boolean;
  /** Campos que faltan por tarjeta: se marcan en rojo (ver `faltantesPorFila`). */
  camposFaltantes?: Record<number, CampoClienteFaltante[]>;

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
  paisFijo = null,
  sugerenciasCiudad = true,
  labelCantidad,
  puedeAgregarCliente,
  camposFaltantes,
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
          paisFijo={paisFijo}
          sugerenciasCiudad={sugerenciasCiudad}
          labelCantidad={labelCantidad}
          camposFaltantes={camposFaltantes}
          ocultarTextoError
        />
        <button
          type="button"
          onClick={() => {
            // No se suma otra tarjeta mientras haya alguna incompleta: el host avisa qué falta.
            if (puedeAgregarCliente && !puedeAgregarCliente()) return;
            onClientesRowsChange([...clientesRows, emptyClienteRow()]);
          }}
          className="mt-2 w-full rounded-md border-2 border-dashed border-black/20 py-3 text-sm font-medium uppercase tracking-wider text-vialto-steel hover:border-vialto-fire hover:bg-vialto-fire/5 hover:text-vialto-fire"
        >
          + Agregar cliente
        </button>
      </div>

      {/* Mismo aviso que el pie de los modales: rojo, a la izquierda del botón, zumba. */}
      <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
        <ErrorPieModal error={error} />
        <Button type="button" onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

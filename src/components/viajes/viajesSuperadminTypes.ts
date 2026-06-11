import type { ViajeMonedaCodigo } from '@/lib/currencyMask';
import type { PaisCodigo } from '@/lib/ciudades';
import type { ViajeOperacionModo } from '@/components/viajes/ViajeOperacionTipoFieldset';
import type { ViajeVehiculoRowDraft } from '@/components/viajes/ViajeVehiculosLista';
import type { ViajeDestinoRowDraft } from '@/lib/viajesDestinos';
import type { ViajeProductoItem } from '@/lib/productosViaje';

export type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  /** Solo en modo externo: chofer del transportista tercero (opcional). */
  choferExternoId: string;
  paisOrigen: PaisCodigo;
  origen: string;
  destinosRows: ViajeDestinoRowDraft[];
  /** `YYYY-MM-DD` */
  fechaCarga: string;
  /** `HH:mm` o vacío (opcional). */
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  productoItems: ViajeProductoItem[];
  detalleCarga: string;
  observaciones: string;
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
};


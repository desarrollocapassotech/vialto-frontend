import type { ViajeMonedaCodigo } from '@/lib/currencyMask';
import type { PaisCodigo } from '@/lib/ciudades';
import type { ViajeOperacionModo } from '@/components/viajes/ViajeOperacionTipoFieldset';
import type { ViajeVehiculoRowDraft } from '@/components/viajes/ViajeVehiculosLista';
import type { ConEmpresa, Viaje } from '@/types/api';

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
  /** Solo en modo externo: vehículo del transportista tercero (opcional). */
  vehiculoExternoId: string;
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  /** `YYYY-MM-DD` */
  fechaCarga: string;
  /** `HH:mm` o vacío (opcional). */
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  detalleCarga: string;
  observaciones: string;
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
};

export type KmLitrosPrompt =
  | { kind: 'quick'; viaje: ConEmpresa<Viaje>; nuevoEstado: string }
  | { kind: 'save'; viajeId: string }
  | { kind: 'estado-draft'; nextEstado: string };

export type SaveInlineKmOpts = {
  skipKmLitrosPrompt?: boolean;
  kmRecorridos?: number;
  litrosConsumidos?: number;
};

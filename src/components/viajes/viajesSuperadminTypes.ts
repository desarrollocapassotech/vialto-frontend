import type { PaisCodigo } from '@/lib/ciudades';
import type { ViajeOperacionModo } from '@/components/viajes/ViajeOperacionTipoFieldset';
import type { ConEmpresa, Viaje } from '@/types/api';

export type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculoId: string;
  patenteTractor: string;
  patenteSemirremolque: string;
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  fechaCarga: string;
  fechaDescarga: string;
  mercaderia: string;
  observaciones: string;
  monto: string;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  documentacionCsv: string;
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

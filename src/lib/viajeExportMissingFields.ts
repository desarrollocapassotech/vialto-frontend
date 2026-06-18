import type { Chofer, Viaje, Vehiculo } from '@/types/api';
import { apiJson } from '@/lib/api';

export type ViajeExportFieldDef = {
  key: string;
  type: 'text' | 'date' | 'number' | 'chofer-select' | 'vehiculo-select';
};

export type ViajeExportMissingGroup = { fields: string[]; entityId?: string };

export const VIAJE_EXPORT_TRANSPORTISTA_FIELDS: Record<string, ViajeExportFieldDef> = {
  CUIT: { key: 'idFiscal', type: 'text' },
  'N° PAUT': { key: 'paut', type: 'text' },
  'Permiso Internacional': { key: 'permisoInternacional', type: 'text' },
  'Vencimiento del Permiso Internacional': { key: 'fechaVencimientoPermiso', type: 'date' },
  Domicilio: { key: 'domicilio', type: 'text' },
  País: { key: 'pais', type: 'text' },
};

export const VIAJE_EXPORT_CHOFER_FIELDS: Record<string, ViajeExportFieldDef> = {
  Nombre: { key: 'nombre', type: 'text' },
  DNI: { key: 'dni', type: 'text' },
  CUIT: { key: 'cuit', type: 'text' },
};

export const VIAJE_EXPORT_VIAJE_FIELDS: Record<string, ViajeExportFieldDef> = {
  Origen: { key: 'origen', type: 'text' },
  Destino: { key: 'destino', type: 'text' },
  'Detalle de carga': { key: 'detalleCarga', type: 'text' },
  'Chofer asignado': { key: 'choferId', type: 'chofer-select' },
  'Vehículo asignado': { key: 'vehiculoIds', type: 'vehiculo-select' },
};

export const VIAJE_EXPORT_VEHICULO_FIELDS: Record<string, ViajeExportFieldDef> = {
  Marca: { key: 'marca', type: 'text' },
  Modelo: { key: 'modelo', type: 'text' },
  Año: { key: 'anio', type: 'number' },
  'N° Chasis': { key: 'nroChasis', type: 'text' },
  'Póliza de seguro': { key: 'poliza', type: 'text' },
  'Vencimiento de póliza': { key: 'vencimientoPoliza', type: 'date' },
  Tara: { key: 'tara', type: 'number' },
  Precinto: { key: 'precinto', type: 'text' },
};

export const VIAJE_EXPORT_EDITABLE_GROUPS: Record<
  string,
  { fields: Record<string, ViajeExportFieldDef>; apiModule: string }
> = {
  Viaje: { fields: VIAJE_EXPORT_VIAJE_FIELDS, apiModule: 'viajes' },
  Transportista: { fields: VIAJE_EXPORT_TRANSPORTISTA_FIELDS, apiModule: 'transportistas' },
  Chofer: { fields: VIAJE_EXPORT_CHOFER_FIELDS, apiModule: 'choferes' },
  Camión: { fields: VIAJE_EXPORT_VEHICULO_FIELDS, apiModule: 'vehiculos' },
  Semirremolque: { fields: VIAJE_EXPORT_VEHICULO_FIELDS, apiModule: 'vehiculos' },
};

export function entityNameFromViaje(viaje: Viaje, group: string, entityId: string): string | null {
  if (group === 'Transportista' && viaje.transportista?.id === entityId) {
    return viaje.transportista.nombre.trim() || null;
  }
  if (group === 'Chofer' && (viaje.chofer?.id === entityId || viaje.choferId === entityId)) {
    return viaje.chofer?.nombre?.trim() || null;
  }
  const vehiculo = viaje.vehiculosViaje?.find((vv) => vv.vehiculoId === entityId)?.vehiculo;
  if ((group === 'Camión' || group === 'Semirremolque') && vehiculo?.patente) {
    return vehiculo.patente.trim();
  }
  return null;
}

export function viajeTieneVehiculoAsignado(viaje: Pick<Viaje, 'vehiculosViaje'>): boolean {
  return (viaje.vehiculosViaje ?? []).some((vv) => vv.vehiculoId?.trim());
}

/** Requisitos mínimos del viaje antes de abrir el formulario MIC/CRT. */
export function missingGroupsMicCrtDesdeViaje(viaje: Viaje): Record<string, ViajeExportMissingGroup> | null {
  const groups: Record<string, ViajeExportMissingGroup> = {};
  const viajeFields: string[] = [];

  if (!viaje.choferId?.trim()) viajeFields.push('Chofer asignado');
  if (!viajeTieneVehiculoAsignado(viaje)) viajeFields.push('Vehículo asignado');
  if (viajeFields.length > 0) {
    groups.Viaje = { fields: viajeFields, entityId: viaje.id };
  }

  const choferId = viaje.choferId?.trim();
  if (choferId && viaje.chofer && !viaje.chofer.dni?.trim()) {
    groups.Chofer = { fields: ['DNI'], entityId: choferId };
  }

  return Object.keys(groups).length > 0 ? groups : null;
}

export function mensajeBloqueoMicCrt(groups: Record<string, ViajeExportMissingGroup>): string {
  const items: string[] = [];
  for (const [group, entry] of Object.entries(groups)) {
    for (const field of entry.fields) {
      if (group === 'Viaje' && field === 'Chofer asignado') items.push('chofer asignado al viaje');
      else if (group === 'Viaje' && field === 'Vehículo asignado') items.push('vehículo asignado al viaje');
      else if (group === 'Chofer' && field === 'DNI') items.push('DNI del chofer');
      else items.push(`${group}: ${field}`);
    }
  }
  const uniq = [...new Set(items)];
  return `No podés generar este documento hasta completar: ${uniq.join(', ')}.`;
}

export function hasEditableViajeExportGroups(
  groups: Record<string, ViajeExportMissingGroup> | null | undefined,
): boolean {
  if (!groups) return false;
  return Object.entries(groups).some(([g, entry]) => {
    const config = VIAJE_EXPORT_EDITABLE_GROUPS[g];
    if (!config || !entry.entityId) return false;
    return entry.fields.some((label) => label in config.fields);
  });
}

export async function guardarViajeExportMissingFields(opts: {
  groups: Record<string, ViajeExportMissingGroup>;
  fieldValues: Record<string, string>;
  patchEntityUrl: (apiModule: string, entityId: string) => string;
  getToken: () => Promise<string | null>;
}): Promise<void> {
  const { groups, fieldValues, patchEntityUrl, getToken } = opts;

  for (const [group, config] of Object.entries(VIAJE_EXPORT_EDITABLE_GROUPS)) {
    const entry = groups[group];
    if (!entry?.fields.length || !entry.entityId) continue;
    const body: Record<string, string | number | string[]> = {};
    for (const label of entry.fields) {
      const def = config.fields[label];
      if (!def) continue;
      const raw = fieldValues[`${group}/${label}`]?.trim();
      if (!raw) continue;
      if (def.type === 'vehiculo-select') {
        body[def.key] = [raw];
      } else if (def.type === 'number') {
        const n = Number(raw.replace(',', '.'));
        if (Number.isFinite(n)) body[def.key] = n;
      } else {
        body[def.key] = raw;
      }
    }
    if (Object.keys(body).length > 0) {
      await apiJson(patchEntityUrl(config.apiModule, entry.entityId), getToken, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    }
  }
}

export function resolveEntityNames(
  viaje: Viaje,
  groups: Record<string, ViajeExportMissingGroup>,
  choferesList: Chofer[],
  vehiculosList: Vehiculo[],
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [group, entry] of Object.entries(groups)) {
    if (!entry.entityId) continue;
    const entityId = entry.entityId;
    if (names[entityId]) continue;
    const fromViaje = entityNameFromViaje(viaje, group, entityId);
    if (fromViaje) {
      names[entityId] = fromViaje;
      continue;
    }
    const chofer = choferesList.find((c) => c.id === entityId);
    if (chofer?.nombre?.trim()) {
      names[entityId] = chofer.nombre.trim();
      continue;
    }
    const vehiculo = vehiculosList.find((v) => v.id === entityId);
    if (vehiculo?.patente?.trim()) {
      names[entityId] = vehiculo.patente.trim();
    }
  }
  return names;
}

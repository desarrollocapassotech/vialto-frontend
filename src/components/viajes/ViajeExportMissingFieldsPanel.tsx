import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { Chofer, Viaje, Vehiculo } from '@/types/api';
import {
  VIAJE_EXPORT_EDITABLE_GROUPS,
  entityNameFromViaje,
  guardarViajeExportMissingFields,
  hasEditableViajeExportGroups,
  resolveEntityNames,
  type ViajeExportFieldDef,
  type ViajeExportMissingGroup,
} from '@/lib/viajeExportMissingFields';
import { apiJson } from '@/lib/api';

type Props = {
  viaje: Viaje;
  message: string;
  groups: Record<string, ViajeExportMissingGroup>;
  tenantId?: string;
  disabled?: boolean;
  saveLabel?: string;
  onSaved: () => void | Promise<void>;
};

function renderField(
  group: string,
  label: string,
  def: ViajeExportFieldDef,
  fieldValues: Record<string, string>,
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  choferesList: Chofer[],
  vehiculosList: Vehiculo[],
  ocupado: boolean,
) {
  const key = `${group}/${label}`;
  const value = fieldValues[key] ?? '';
  const onChange = (val: string) => setFieldValues((prev) => ({ ...prev, [key]: val }));
  const inputClass =
    'border border-red-300 bg-white px-2 py-1 text-xs text-vialto-charcoal focus:outline-none focus:border-red-500 disabled:opacity-50';

  if (def.type === 'chofer-select') {
    return (
      <label key={label} className="grid gap-0.5">
        <span className="text-[10px] text-red-700">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={ocupado} className={inputClass}>
          <option value="">— Seleccionar chofer —</option>
          {choferesList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.dni ? ` · ${c.dni}` : ''}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (def.type === 'vehiculo-select') {
    return (
      <label key={label} className="grid gap-0.5">
        <span className="text-[10px] text-red-700">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={ocupado} className={inputClass}>
          <option value="">— Seleccionar vehículo —</option>
          {vehiculosList.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
              {v.tipo ? ` (${v.tipo})` : ''}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label key={label} className="grid gap-0.5">
      <span className="text-[10px] text-red-700">{label}</span>
      <input
        type={def.type === 'number' ? 'text' : def.type}
        inputMode={def.type === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={ocupado}
        className={inputClass}
      />
    </label>
  );
}

export function ViajeExportMissingFieldsPanel({
  viaje,
  message,
  groups,
  tenantId,
  disabled = false,
  saveLabel = 'Guardar y reintentar',
  onSaved,
}: Props) {
  const { getToken } = useAuth();
  const tid = tenantId?.trim() ?? '';
  const platform = Boolean(tid);

  function maestroListUrl(kind: 'choferes' | 'vehiculos') {
    if (platform) return `/api/platform/${kind}?tenantId=${encodeURIComponent(tid)}`;
    return `/api/${kind}`;
  }

  function patchEntityUrl(apiModule: string, entityId: string) {
    if (platform) {
      return `/api/platform/${apiModule}/${encodeURIComponent(entityId)}?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/${apiModule}/${encodeURIComponent(entityId)}`;
  }

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [choferesList, setChoferesList] = useState<Chofer[]>([]);
  const [vehiculosList, setVehiculosList] = useState<Vehiculo[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  const ocupado = disabled || guardando;
  const editable = hasEditableViajeExportGroups(groups);

  useEffect(() => {
    setFieldValues({});
    setSaveError(null);
  }, [groups]);

  useEffect(() => {
    const allFields = Object.values(groups).flatMap((g) => g.fields);
    if (allFields.includes('Chofer asignado') && choferesList.length === 0) {
      void apiJson<Chofer[]>(maestroListUrl('choferes'), getToken).then(setChoferesList).catch(() => {});
    }
    if (allFields.includes('Vehículo asignado') && vehiculosList.length === 0) {
      void apiJson<Vehiculo[]>(maestroListUrl('vehiculos'), getToken).then(setVehiculosList).catch(() => {});
    }
  }, [groups, tid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const names = resolveEntityNames(viaje, groups, choferesList, vehiculosList);
      for (const [group, entry] of Object.entries(groups)) {
        if (!entry.entityId || names[entry.entityId]) continue;
        const config = VIAJE_EXPORT_EDITABLE_GROUPS[group];
        if (!config || group === 'Viaje') continue;
        try {
          const row = await apiJson<{ nombre?: string; patente?: string }>(
            patchEntityUrl(config.apiModule, entry.entityId),
            getToken,
          );
          const label = row.nombre?.trim() || row.patente?.trim();
          if (label) names[entry.entityId] = label;
        } catch {
          /* silencioso */
        }
      }
      if (!cancelled) setEntityNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [groups, viaje, choferesList, vehiculosList, tid]);

  async function guardar() {
    setGuardando(true);
    setSaveError(null);
    try {
      await guardarViajeExportMissingFields({
        groups,
        fieldValues,
        patchEntityUrl,
        getToken,
      });
      setFieldValues({});
      await onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar los datos.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
      <p className="font-semibold">{message}</p>

      <div className="mt-3 space-y-3">
        {Object.entries(groups).map(([group, entry]) => {
          const config = VIAJE_EXPORT_EDITABLE_GROUPS[group];
          const entityLabel = entry.entityId ? entityNames[entry.entityId] : undefined;
          return (
            <div key={group}>
              <p className="mb-1 font-semibold uppercase tracking-wide text-[10px] text-red-600">{group}</p>
              {entityLabel && (
                <p className="mb-2 text-xs font-medium text-red-900">
                  Completar datos faltantes para: {entityLabel}
                </p>
              )}
              {config && entry.entityId ? (
                <div className="space-y-1.5">
                  {entry.fields.map((label) => {
                    const def = config.fields[label];
                    if (!def) {
                      return (
                        <p key={label} className="flex items-start gap-1.5">
                          <span className="mt-px text-red-400">·</span>
                          <span>{label}</span>
                        </p>
                      );
                    }
                    return renderField(
                      group,
                      label,
                      def,
                      fieldValues,
                      setFieldValues,
                      choferesList,
                      vehiculosList,
                      ocupado,
                    );
                  })}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {entry.fields.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="mt-px text-red-400">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {editable && (
          <div className="pt-1">
            {saveError && <p className="mb-1.5 text-red-700">{saveError}</p>}
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={ocupado}
              className="inline-flex items-center gap-2 border border-red-400 bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando && <Spinner className="h-3.5 w-3.5 text-red-800" />}
              {guardando ? 'Guardando…' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { entityNameFromViaje };

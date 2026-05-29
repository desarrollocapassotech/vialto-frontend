import { useAuth } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import type { Viaje, Chofer, Vehiculo } from '@/types/api';
import { viajePermiteGenerarMicCrt } from '@/lib/viajesEstados';
import { viajeUsaFlotaPropia } from '@/lib/viajesGananciaBruta';
import { apiFetch, apiJson } from '@/lib/api';
import { MicCrtExportModal } from '@/components/viajes/MicCrtExportModal';

type Props = {
  viaje: Viaje;
  onClose: () => void;
  tenantId?: string;
};

type FieldDef = { key: string; type: 'text' | 'date' | 'number' | 'chofer-select' | 'vehiculo-select' };
type MissingGroup = { fields: string[]; entityId?: string };
type DescargaError = { message: string; groups?: Record<string, MissingGroup>; endpoint: string; filename: string };

const TRANSPORTISTA_FIELDS: Record<string, FieldDef> = {
  'CUIT':                                   { key: 'idFiscal',                type: 'text' },
  'N° PAUT':                                { key: 'paut',                    type: 'text' },
  'Permiso Internacional':                   { key: 'permisoInternacional',    type: 'text' },
  'Vencimiento del Permiso Internacional':   { key: 'fechaVencimientoPermiso', type: 'date' },
  'Domicilio':                               { key: 'domicilio',               type: 'text' },
  'País':                                    { key: 'pais',                    type: 'text' },
};

const CHOFER_FIELDS: Record<string, FieldDef> = {
  'Nombre': { key: 'nombre', type: 'text' },
  'DNI':    { key: 'dni',    type: 'text' },
  'CUIT':   { key: 'cuit',   type: 'text' },
};

const VIAJE_FIELDS: Record<string, FieldDef> = {
  'Origen':            { key: 'origen',       type: 'text'            },
  'Destino':           { key: 'destino',      type: 'text'            },
  'Detalle de carga':  { key: 'detalleCarga', type: 'text'            },
  'Chofer asignado':   { key: 'choferId',     type: 'chofer-select'   },
  'Vehículo asignado': { key: 'vehiculoIds',  type: 'vehiculo-select' },
};

const VEHICULO_FIELDS: Record<string, FieldDef> = {
  'Marca':                { key: 'marca',             type: 'text'   },
  'Modelo':               { key: 'modelo',            type: 'text'   },
  'Año':                  { key: 'anio',              type: 'number' },
  'N° Chasis':            { key: 'nroChasis',         type: 'text'   },
  'Póliza de seguro':     { key: 'poliza',            type: 'text'   },
  'Vencimiento de póliza':{ key: 'vencimientoPoliza', type: 'date'   },
  'Tara':                 { key: 'tara',              type: 'number' },
  'Precinto':             { key: 'precinto',          type: 'text'   },
};

const EDITABLE_GROUPS: Record<string, { fields: Record<string, FieldDef>; apiModule: string }> = {
  'Viaje':         { fields: VIAJE_FIELDS,          apiModule: 'viajes'         },
  'Transportista': { fields: TRANSPORTISTA_FIELDS,  apiModule: 'transportistas' },
  'Chofer':        { fields: CHOFER_FIELDS,         apiModule: 'choferes'       },
  'Camión':        { fields: VEHICULO_FIELDS,       apiModule: 'vehiculos'      },
  'Semirremolque': { fields: VEHICULO_FIELDS,       apiModule: 'vehiculos'      },
};

function entityNameFromViaje(viaje: Viaje, group: string, entityId: string): string | null {
  if (group === 'Transportista' && viaje.transportista?.id === entityId) {
    return viaje.transportista.nombre.trim() || null;
  }
  const vehiculo = viaje.vehiculosViaje?.find((vv) => vv.vehiculoId === entityId)?.vehiculo;
  if ((group === 'Camión' || group === 'Semirremolque') && vehiculo?.patente) {
    return vehiculo.patente.trim();
  }
  return null;
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ExportarViajeModal({ viaje, onClose, tenantId }: Props) {
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

  function viajePdfUrl(suffix: 'paut' | 'mic-crt') {
    if (platform) {
      return `/api/platform/viajes/${encodeURIComponent(viaje.id)}/${suffix}?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/viajes/${encodeURIComponent(viaje.id)}/${suffix}`;
  }
  const [generandoPaut, setGenerandoPaut] = useState(false);
  const [micCrtAbierto, setMicCrtAbierto] = useState(false);
  const [error, setError] = useState<DescargaError | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [choferesList, setChoferesList] = useState<Chofer[]>([]);
  const [vehiculosList, setVehiculosList] = useState<Vehiculo[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  const permiteMicCrt = viajePermiteGenerarMicCrt(viaje.estado);
  /** PAUT solo aplica a viajes con transportista externo (no flota propia). */
  const permitePaut = !viajeUsaFlotaPropia(viaje);
  const ocupado = generandoPaut || guardando;

  useEffect(() => {
    if (!error?.groups) return;
    const allFields = Object.values(error.groups).flatMap((g) => g.fields);
    if (allFields.includes('Chofer asignado') && choferesList.length === 0) {
      void apiJson<Chofer[]>(maestroListUrl('choferes'), getToken).then(setChoferesList).catch(() => {});
    }
    if (allFields.includes('Vehículo asignado') && vehiculosList.length === 0) {
      void apiJson<Vehiculo[]>(maestroListUrl('vehiculos'), getToken).then(setVehiculosList).catch(() => {});
    }
  }, [error, tid]);

  useEffect(() => {
    if (!error?.groups) {
      setEntityNames({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const names: Record<string, string> = {};
      for (const [group, entry] of Object.entries(error.groups!)) {
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
          continue;
        }

        const config = EDITABLE_GROUPS[group];
        if (!config || group === 'Viaje') continue;

        try {
          const row = await apiJson<{ nombre?: string; patente?: string }>(
            patchEntityUrl(config.apiModule, entityId),
            getToken,
          );
          const label = row.nombre?.trim() || row.patente?.trim();
          if (label) names[entityId] = label;
        } catch {
          /* silencioso — se muestra solo el nombre del grupo */
        }
      }
      if (!cancelled) setEntityNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [error?.groups, viaje, choferesList, vehiculosList, tid]);

  async function descargarPdf(endpoint: string, filename: string): Promise<DescargaError | null> {
    try {
      const res = await apiFetch(endpoint, getToken, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string; missingGroups?: Record<string, MissingGroup> };
        return { message: data.message ?? 'No se pudo generar el documento', groups: data.missingGroups, endpoint, filename };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return null;
    } catch (e) {
      return { message: e instanceof Error ? e.message : 'Error de red al generar el documento.', endpoint, filename };
    }
  }

  async function ejecutarDescarga(endpoint: string, filename: string, setGenerando: (v: boolean) => void) {
    setError(null);
    setFieldValues({});
    setSaveError(null);
    setGenerando(true);
    const err = await descargarPdf(endpoint, filename);
    setGenerando(false);
    if (err) setError(err);
  }

  async function guardarYReintentar() {
    if (!error?.groups) return;
    const { endpoint, filename } = error;

    setGuardando(true);
    setSaveError(null);
    let ok = false;

    try {
      for (const [group, config] of Object.entries(EDITABLE_GROUPS)) {
        const entry = error.groups[group];
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
      ok = true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar los datos.');
    } finally {
      setGuardando(false);
    }

    if (!ok) return;

    const setGenerando = setGenerandoPaut;
    setError(null);
    setFieldValues({});
    setGenerando(true);
    const retryErr = await descargarPdf(endpoint, filename);
    setGenerando(false);
    if (retryErr) setError(retryErr);
  }

  const hasEditableGroups = !!error?.groups &&
    Object.entries(error.groups).some(([g, entry]) => {
      const config = EDITABLE_GROUPS[g];
      if (!config || !entry.entityId) return false;
      return entry.fields.some((label) => label in config.fields);
    });

  function renderField(group: string, label: string, def: FieldDef) {
    const key = `${group}/${label}`;
    const value = fieldValues[key] ?? '';
    const onChange = (val: string) => setFieldValues((prev) => ({ ...prev, [key]: val }));
    const inputClass = 'border border-red-300 bg-white px-2 py-1 text-xs text-vialto-charcoal focus:outline-none focus:border-red-500 disabled:opacity-50';

    if (def.type === 'chofer-select') {
      return (
        <label key={label} className="grid gap-0.5">
          <span className="text-[10px] text-red-700">{label}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={ocupado}
            className={inputClass}
          >
            <option value="">— Seleccionar chofer —</option>
            {choferesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.dni ? ` · ${c.dni}` : ''}
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
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={ocupado}
            className={inputClass}
          >
            <option value="">— Seleccionar vehículo —</option>
            {vehiculosList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.patente}{v.tipo ? ` (${v.tipo})` : ''}
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

  return (
    <>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exportar-title"
    >
      <div className="w-full max-w-sm border border-black/15 bg-white p-5 shadow-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="exportar-title" className="text-sm font-semibold text-vialto-charcoal">
              Exportar
            </h2>
            <p className="mt-0.5 text-xs text-vialto-steel">Viaje #{viaje.numero}</p>
            {(viaje.origen || viaje.destino) && (
              <p className="mt-1 text-xs text-vialto-steel">
                {[viaje.origen, viaje.destino].filter(Boolean).join(' → ')}
              </p>
            )}
            {(viaje.fechaCarga || viaje.fechaDescarga) && (
              <p className="mt-0.5 text-xs text-vialto-steel">
                {fmtFecha(viaje.fechaCarga)}
                {viaje.fechaCarga && viaje.fechaDescarga && ' – '}
                {fmtFecha(viaje.fechaDescarga)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={ocupado}
            className="shrink-0 text-vialto-steel hover:text-vialto-charcoal disabled:opacity-40"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {permitePaut ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                void ejecutarDescarga(
                  viajePdfUrl('paut'),
                  `PAUT-${viaje.numero}.pdf`,
                  setGenerandoPaut,
                )
              }
              className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-medium text-vialto-charcoal">
                {generandoPaut ? 'Generando…' : 'PAUT'}
              </span>
              {!generandoPaut && <span className="text-xs text-vialto-steel">↓ PDF</span>}
            </button>
          ) : null}

          <button
            type="button"
            disabled={ocupado || !permiteMicCrt}
            onClick={() => setMicCrtAbierto(true)}
            className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
            title={!permiteMicCrt ? 'No disponible para viajes cancelados' : undefined}
          >
            <span className="text-sm font-medium text-vialto-charcoal">MIC/CRT</span>
            <span className="text-xs text-vialto-steel">
              {permiteMicCrt ? 'Formulario' : 'No disponible'}
            </span>
          </button>
        </div>

        {error && (
          <div className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p className="font-semibold">{error.message}</p>

            {error.groups && Object.keys(error.groups).length > 0 && (
              <div className="mt-3 space-y-3">
                {Object.entries(error.groups).map(([group, entry]) => {
                  const config = EDITABLE_GROUPS[group];
                  const entityLabel = entry.entityId ? entityNames[entry.entityId] : undefined;
                  return (
                    <div key={group}>
                      <p className="mb-1 font-semibold uppercase tracking-wide text-[10px] text-red-600">
                        {group}
                      </p>
                      {entityLabel && (
                        <p className="mb-2 text-xs font-medium text-red-900">
                          Completar datos faltantes para: {entityLabel}
                        </p>
                      )}
                      {config && entry.entityId ? (
                        <div className="space-y-1.5">
                          {entry.fields.map((label) => {
                            const def = config.fields[label];
                            if (!def) return (
                              <p key={label} className="flex items-start gap-1.5">
                                <span className="mt-px text-red-400">·</span><span>{label}</span>
                              </p>
                            );
                            return renderField(group, label, def);
                          })}
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {entry.fields.map((f) => (
                            <li key={f} className="flex items-start gap-1.5">
                              <span className="mt-px text-red-400">·</span>
                              <span>{f} — editá el viaje para asignar</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {hasEditableGroups && (
                  <div className="pt-1">
                    {saveError && <p className="mb-1.5 text-red-700">{saveError}</p>}
                    <button
                      type="button"
                      onClick={() => void guardarYReintentar()}
                      disabled={ocupado}
                      className="border border-red-400 bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {guardando ? 'Guardando…' : 'Guardar y reintentar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={ocupado}
            onClick={onClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>

    {micCrtAbierto && (
      <MicCrtExportModal
        viaje={viaje}
        tenantId={tenantId}
        onClose={() => setMicCrtAbierto(false)}
      />
    )}
    </>
  );
}

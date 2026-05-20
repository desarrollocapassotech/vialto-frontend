import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Viaje } from '@/types/api';
import type { MicCrtActor, MicCrtExportPayload, MicCrtPrefillResponse } from '@/types/micCrtDocumento';
import { normalizeMicCrtPayload, TIPOS_BULTOS_MIC } from '@/types/micCrtDocumento';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiFetch, apiJson } from '@/lib/api';
import type { PaisCodigo } from '@/lib/ciudades';
import type { ViajeMonedaCodigo } from '@/lib/currencyMask';

type Props = {
  viaje: Viaje;
  onClose: () => void;
  tenantId?: string;
  onGenerated?: () => void;
};

type MissingGroup = { fields: string[]; entityId?: string };

const inputClass =
  'w-full border border-black/15 bg-white px-2 py-1.5 text-xs text-vialto-charcoal focus:outline-none focus:border-vialto-charcoal disabled:opacity-50';
const labelClass = 'text-[10px] uppercase tracking-wide text-vialto-steel';

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-0.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ActorBlock({
  title,
  actor,
  onChange,
  disabled,
}: {
  title: string;
  actor: MicCrtActor;
  onChange: (a: MicCrtActor) => void;
  disabled: boolean;
}) {
  const set = (key: keyof MicCrtActor, val: string) => onChange({ ...actor, [key]: val });
  return (
    <fieldset className="border border-black/10 p-3">
      <legend className="px-1 text-xs font-semibold text-vialto-charcoal">{title}</legend>
      <FormGrid>
        <Field label="Razón social *">
          <input className={inputClass} value={actor.razonSocial} disabled={disabled}
            onChange={(e) => set('razonSocial', e.target.value)} />
        </Field>
        <Field label="CUIT / RUT *">
          <input className={inputClass} value={actor.idFiscal} disabled={disabled}
            onChange={(e) => set('idFiscal', e.target.value)} />
        </Field>
        <Field label="Calle *">
          <input className={inputClass} value={actor.calle} disabled={disabled}
            onChange={(e) => set('calle', e.target.value)} />
        </Field>
        <Field label="Número *">
          <input className={inputClass} value={actor.numero} disabled={disabled}
            onChange={(e) => set('numero', e.target.value)} />
        </Field>
        <Field label="Ciudad *">
          <input className={inputClass} value={actor.ciudad} disabled={disabled}
            onChange={(e) => set('ciudad', e.target.value)} />
        </Field>
        <Field label="País *">
          <PaisUbicacionSelect
            value={(actor.pais?.trim() || 'AR') as PaisCodigo}
            onChange={(p) => set('pais', p)}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </FormGrid>
    </fieldset>
  );
}

function validateForm(f: MicCrtExportPayload): string | null {
  if (!f.micNumero.trim()) return 'Indicá el N° de MIC.';
  if (!f.crtNumero.trim()) return 'Indicá el N° de CRT.';
  if (!f.fechaEmision.trim()) return 'Indicá la fecha de emisión.';
  for (const [label, actor] of [
    ['Remitente', f.remitente],
    ['Destinatario', f.destinatario],
    ['Consignatario', f.consignatario],
  ] as const) {
    if (!actor.razonSocial.trim()) return `${label}: razón social obligatoria.`;
    if (!actor.idFiscal.trim()) return `${label}: CUIT/RUT obligatorio.`;
    if (!actor.calle.trim()) return `${label}: indicá la calle.`;
    if (!actor.ciudad.trim()) return `${label}: indicá la ciudad.`;
    if (!actor.pais.trim()) return `${label}: indicá el país.`;
  }
  if (!f.ncm.trim()) return 'Indicá el NCM.';
  if (f.bultos <= 0) return 'La cantidad de bultos debe ser mayor a 0.';
  if (!f.tipoBultos.trim()) return 'Seleccioná el tipo de bultos.';
  if (f.pesoBrutoKg <= 0) return 'El peso bruto debe ser mayor a 0.';
  if (f.valorFot <= 0) return 'El valor FOT debe ser mayor a 0.';
  if (!f.aduanaPartida.trim() || !f.aduanaDestino.trim()) return 'Completá aduanas de partida y destino.';
  return null;
}

export function MicCrtExportModal({ viaje, onClose, tenantId, onGenerated }: Props) {
  const { getToken } = useAuth();
  const tid = tenantId?.trim() ?? '';
  const platform = Boolean(tid);

  function prefillUrl() {
    if (platform) {
      return `/api/platform/viajes/${encodeURIComponent(viaje.id)}/documento-aduanero?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/viajes/${encodeURIComponent(viaje.id)}/documento-aduanero`;
  }

  function pdfUrl() {
    if (platform) {
      return `/api/platform/viajes/${encodeURIComponent(viaje.id)}/mic-crt?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/viajes/${encodeURIComponent(viaje.id)}/mic-crt`;
  }

  const [form, setForm] = useState<MicCrtExportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingGroups, setMissingGroups] = useState<Record<string, MissingGroup> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<MicCrtPrefillResponse>(prefillUrl(), getToken);
        if (!cancelled) setForm(normalizeMicCrtPayload(data.prefill, data.operativo));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el formulario.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viaje.id, tid]);

  function patch<K extends keyof MicCrtExportPayload>(key: K, value: MicCrtExportPayload[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function generarPdf() {
    if (!form) return;
    const normalized = normalizeMicCrtPayload(form);
    setForm(normalized);
    const validation = validateForm(normalized);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setMissingGroups(null);
    setGenerando(true);
    try {
      const res = await apiFetch(pdfUrl(), getToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as {
          message?: string;
          missingGroups?: Record<string, MissingGroup>;
        };
        setMissingGroups(data.missingGroups ?? null);
        setError(data.message ?? 'No se pudo generar el PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIC-CRT-${viaje.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onGenerated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red al generar el PDF.');
    } finally {
      setGenerando(false);
    }
  }

  const ocupado = loading || generando;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-crt-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-black/15 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-4 py-3">
          <div>
            <h2 id="mic-crt-title" className="text-sm font-semibold text-vialto-charcoal">
              Documento aduanero MIC / CRT
            </h2>
            <p className="mt-0.5 text-xs text-vialto-steel">Viaje #{viaje.numero}</p>
          </div>
          <button type="button" onClick={onClose} disabled={ocupado}
            className="text-vialto-steel hover:text-vialto-charcoal disabled:opacity-40" aria-label="Cerrar">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && <p className="text-xs text-vialto-steel">Cargando datos…</p>}

          {form && !loading && (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">1 · Identificación</h3>
                <FormGrid>
                  <Field label="Fecha de emisión *">
                    <input type="date" className={inputClass} value={form.fechaEmision} disabled={ocupado}
                      onChange={(e) => patch('fechaEmision', e.target.value)} />
                  </Field>
                  <Field label="N° MIC *">
                    <input className={inputClass} value={form.micNumero} disabled={ocupado}
                      onChange={(e) => patch('micNumero', e.target.value)} placeholder="Número aduanero" />
                  </Field>
                  <Field label="N° CRT *">
                    <input className={inputClass} value={form.crtNumero} disabled={ocupado}
                      onChange={(e) => patch('crtNumero', e.target.value)} />
                  </Field>
                  <Field label="Moneda documento">
                    <MonedaSelect value={(form.monedaDocumento ?? form.monedaFot) as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaDocumento', m)} disabled={ocupado} />
                  </Field>
                </FormGrid>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">2 · Actores</h3>
                <div className="space-y-3">
                  <ActorBlock title="Remitente" actor={form.remitente} disabled={ocupado}
                    onChange={(a) => patch('remitente', a)} />
                  <ActorBlock title="Destinatario" actor={form.destinatario} disabled={ocupado}
                    onChange={(a) => patch('destinatario', a)} />
                  <ActorBlock title="Consignatario" actor={form.consignatario} disabled={ocupado}
                    onChange={(a) => patch('consignatario', a)} />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">3 · Detalle aduanero</h3>
                <FormGrid>
                  <Field label="NCM *">
                    <input className={inputClass} value={form.ncm} disabled={ocupado}
                      onChange={(e) => patch('ncm', e.target.value)} />
                  </Field>
                  <Field label="Cantidad de bultos *">
                    <input type="number" min={0} className={inputClass} value={form.bultos || ''} disabled={ocupado}
                      onChange={(e) => patch('bultos', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="Tipo de bultos *">
                    <select className={inputClass} value={form.tipoBultos} disabled={ocupado}
                      onChange={(e) => patch('tipoBultos', e.target.value)}>
                      {TIPOS_BULTOS_MIC.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Peso bruto total (kg) *">
                    <input type="number" min={0} step="0.01" className={inputClass} value={form.pesoBrutoKg || ''} disabled={ocupado}
                      onChange={(e) => patch('pesoBrutoKg', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="Volumen (m³)">
                    <input type="number" min={0} step="0.01" className={inputClass}
                      value={form.volumenM3 ?? ''} disabled={ocupado}
                      onChange={(e) => patch('volumenM3', e.target.value ? Number(e.target.value) : undefined)} />
                  </Field>
                  <Field label="Descripción mercaderías">
                    <textarea className={`${inputClass} min-h-[60px]`} value={form.descripcionMercaderias ?? ''} disabled={ocupado}
                      onChange={(e) => patch('descripcionMercaderias', e.target.value)} />
                  </Field>
                </FormGrid>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">4 · Valores comerciales</h3>
                <FormGrid>
                  <Field label="Valor FOT *">
                    <input type="number" min={0} step="0.01" className={inputClass} value={form.valorFot || ''} disabled={ocupado}
                      onChange={(e) => patch('valorFot', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="Moneda FOT">
                    <MonedaSelect value={form.monedaFot as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaFot', m)} disabled={ocupado} />
                  </Field>
                  <Field label="Flete internacional *">
                    <input type="number" min={0} step="0.01" className={inputClass} value={form.flete || ''} disabled={ocupado}
                      onChange={(e) => patch('flete', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label="Moneda flete">
                    <MonedaSelect value={form.monedaFlete as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaFlete', m)} disabled={ocupado} />
                  </Field>
                  <Field label="Seguro (USD)">
                    <input type="number" min={0} step="0.01" className={inputClass}
                      value={form.seguroUsd ?? ''} disabled={ocupado}
                      onChange={(e) => patch('seguroUsd', e.target.value ? Number(e.target.value) : undefined)} />
                  </Field>
                  <Field label="Condición de pago flete *">
                    <select className={inputClass} value={form.condicionPago} disabled={ocupado}
                      onChange={(e) => patch('condicionPago', e.target.value as 'origen' | 'destino')}>
                      <option value="origen">Origen (Remitente)</option>
                      <option value="destino">Destino (Destinatario)</option>
                    </select>
                  </Field>
                </FormGrid>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">5 · Anexos y aduanas</h3>
                <FormGrid>
                  <Field label="Aduana / lugar partida *">
                    <input className={inputClass} value={form.aduanaPartida} disabled={ocupado}
                      onChange={(e) => patch('aduanaPartida', e.target.value)} />
                  </Field>
                  <Field label="Aduana destino *">
                    <input className={inputClass} value={form.aduanaDestino} disabled={ocupado}
                      onChange={(e) => patch('aduanaDestino', e.target.value)} />
                  </Field>
                  <Field label="Documentos anexos">
                    <input className={inputClass} value={form.documentosAnexos ?? ''} disabled={ocupado}
                      onChange={(e) => patch('documentosAnexos', e.target.value)} />
                  </Field>
                  <Field label="N° precintos">
                    <input className={inputClass} value={form.precintos ?? ''} disabled={ocupado}
                      onChange={(e) => patch('precintos', e.target.value)} />
                  </Field>
                  <Field label="Carta de porte">
                    <input className={inputClass} value={form.cartaPorte ?? ''} disabled={ocupado}
                      onChange={(e) => patch('cartaPorte', e.target.value)} />
                  </Field>
                  <Field label="Ruta / plazo DTA">
                    <input className={inputClass} value={form.ruta ?? ''} disabled={ocupado}
                      onChange={(e) => patch('ruta', e.target.value)} />
                  </Field>
                  <Field label="Domicilio porteador">
                    <input className={inputClass} value={form.porteadorDomicilio ?? ''} disabled={ocupado}
                      onChange={(e) => patch('porteadorDomicilio', e.target.value)} />
                  </Field>
                  <Field label="País porteador">
                    <PaisUbicacionSelect
                      value={(form.porteadorPais || 'AR') as PaisCodigo}
                      onChange={(p) => patch('porteadorPais', p)}
                      disabled={ocupado}
                      className={inputClass}
                    />
                  </Field>
                </FormGrid>

                <fieldset className="mt-3 border border-black/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-vialto-charcoal">Semirremolque (opcional)</legend>
                  <FormGrid>
                    <Field label="Propietario">
                      <input className={inputClass} value={form.semirremolque?.propietario ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, propietario: e.target.value })} />
                    </Field>
                    <Field label="CUIT propietario">
                      <input className={inputClass} value={form.semirremolque?.idFiscal ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, idFiscal: e.target.value })} />
                    </Field>
                    <Field label="Patente">
                      <input className={inputClass} value={form.semirremolque?.patente ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, patente: e.target.value })} />
                    </Field>
                    <Field label="Marca">
                      <input className={inputClass} value={form.semirremolque?.marca ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, marca: e.target.value })} />
                    </Field>
                    <Field label="Año">
                      <input type="number" className={inputClass} value={form.semirremolque?.anio ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', {
                          ...form.semirremolque,
                          anio: e.target.value ? Number(e.target.value) : undefined,
                        })} />
                    </Field>
                    <Field label="Capacidad arrastre (t)">
                      <input type="number" min={0} step="0.1" className={inputClass}
                        value={form.semirremolque?.capacidadArrastreT ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', {
                          ...form.semirremolque,
                          capacidadArrastreT: e.target.value ? Number(e.target.value) : undefined,
                        })} />
                    </Field>
                  </FormGrid>
                </fieldset>
              </section>
            </>
          )}

          {error && (
            <div className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p>{error}</p>
              {missingGroups && (
                <ul className="mt-2 space-y-1">
                  {Object.entries(missingGroups).map(([g, entry]) => (
                    <li key={g}>
                      <span className="font-semibold">{g}:</span> {entry.fields.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-4 py-3">
          <button type="button" disabled={ocupado} onClick={onClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" disabled={ocupado || !form} onClick={() => void generarPdf()}
            className="text-xs uppercase tracking-wider px-3 py-1.5 bg-vialto-charcoal text-white hover:bg-black disabled:opacity-50">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

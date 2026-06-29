import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Viaje } from '@/types/api';
import type { MicCrtActor, MicCrtExportPayload, MicCrtPrefillResponse } from '@/types/micCrtDocumento';
import {
  labelCampo,
  labelCampoCrt,
  MIC_CRT_LEGAL_DISCLAIMER,
} from '@/lib/micCrtFieldLabels';
import {
  micCrtExportBodyForApi,
  normalizeMicCrtPayload,
  TIPOS_BULTOS_MIC,
  validateMicCrtForm,
} from '@/types/micCrtDocumento';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiFetch, apiJson } from '@/lib/api';
import { clearMicCrtBorrador, loadMicCrtBorrador, saveMicCrtBorrador } from '@/lib/micCrtBorrador';
import { formatMicCrtExportError } from '@/lib/micCrtFriendlyError';
import { hasEditableViajeExportGroups, type ViajeExportMissingGroup } from '@/lib/viajeExportMissingFields';
import { ViajeExportMissingFieldsPanel } from '@/components/viajes/ViajeExportMissingFieldsPanel';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import type { PaisCodigo } from '@/lib/ciudades';
import type { ViajeMonedaCodigo } from '@/lib/currencyMask';

type Props = {
  viaje: Viaje;
  onClose: () => void;
  tenantId?: string;
  onGenerated?: () => void;
  onViajeUpdated?: () => void | Promise<void>;
};

const inputClass =
  'box-border min-w-0 max-w-full w-full border border-black/15 bg-white px-2 py-1.5 text-xs text-vialto-charcoal focus:outline-none focus:border-vialto-charcoal disabled:opacity-50';
const dateInputClass = `${inputClass} max-w-full appearance-none`;
const labelClass = 'break-words text-[10px] uppercase tracking-wide text-vialto-steel';

function micCrtInputClass(fieldError?: string) {
  return fieldError ? inputClass.replace('border-black/15', 'border-red-400') : inputClass;
}

function micCrtDateInputClass(fieldError?: string) {
  return fieldError ? dateInputClass.replace('border-black/15', 'border-red-400') : dateInputClass;
}

/** Solo dígitos y un separador decimal (`.` o `,`), máx. 2 decimales. */
function sanitizeMicCrtMontoInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const sepIdx = cleaned.search(/[.,]/);
  if (sepIdx === -1) return cleaned;
  const intPart = cleaned.slice(0, sepIdx).replace(/[.,]/g, '');
  const sep = cleaned[sepIdx] ?? '.';
  const decPart = cleaned.slice(sepIdx + 1).replace(/[.,]/g, '').slice(0, 2);
  return `${intPart}${sep}${decPart}`;
}

function parseMicCrtMontoInput(raw: string): number | undefined {
  const s = sanitizeMicCrtMontoInput(raw).trim();
  if (!s || s === '.' || s === ',') return undefined;
  if (/[.,]$/.test(s)) return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

function micCrtMontoInputText(value: number | undefined): string {
  return value != null && !Number.isNaN(value) ? String(value) : '';
}

function MicCrtMontoInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const externalRef = useRef(value);
  const [text, setText] = useState(() => micCrtMontoInputText(value));

  useEffect(() => {
    if (externalRef.current !== value) {
      externalRef.current = value;
      setText(micCrtMontoInputText(value));
    }
  }, [value]);

  function applyInput(next: string) {
    setText(next);
    const parsed = parseMicCrtMontoInput(next);
    externalRef.current = parsed;
    onChange(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`${inputClass} tabular-nums`}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) e.preventDefault();
        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const pasted = sanitizeMicCrtMontoInput(e.clipboardData.getData('text'));
        applyInput(sanitizeMicCrtMontoInput(text + pasted));
      }}
      onChange={(e) => applyInput(sanitizeMicCrtMontoInput(e.target.value))}
    />
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-2 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string;
}) {
  const isRequired = label.endsWith(' *');
  const labelText = isRequired ? label.slice(0, -2) : label;
  return (
    <label className={`grid min-w-0 gap-0.5 ${className ?? ''}`}>
      <span className={labelClass}>
        {labelText}
        {isRequired && <span className="text-red-500"> *</span>}
      </span>
      {children}
      <CrudFieldError message={error} />
    </label>
  );
}

function MicCrtLegalDisclaimer({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={`rounded border border-amber-300/90 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 leading-relaxed ${className ?? ''}`}
    >
      <p className="font-semibold uppercase tracking-wide text-[10px] text-amber-900">
        Atención
      </p>
      <p className="mt-1">{MIC_CRT_LEGAL_DISCLAIMER}</p>
      <p className="mt-1.5 text-amber-900/85">
        Los números entre paréntesis en cada etiqueta corresponden al formulario MIC/DTA impreso
        (se indica CRT cuando aplica a la carta de porte).
      </p>
    </div>
  );
}

function ActorBlock({
  title,
  actor,
  onChange,
  disabled,
  prefix,
  fieldErrors,
}: {
  title: string;
  actor: MicCrtActor;
  onChange: (a: MicCrtActor) => void;
  disabled: boolean;
  prefix: 'remitente' | 'destinatario' | 'consignatario';
  fieldErrors: Record<string, string>;
}) {
  const set = (key: keyof MicCrtActor, val: string) => onChange({ ...actor, [key]: val });
  const err = (key: keyof MicCrtActor) => fieldErrors[`${prefix}.${key}`];
  return (
    <fieldset className="min-w-0 border border-black/10 p-3">
      <legend className="px-1 text-xs font-semibold text-vialto-charcoal">{title}</legend>
      <FormGrid>
        <Field label="Razón social *" error={err('razonSocial')}>
          <input className={micCrtInputClass(err('razonSocial'))} value={actor.razonSocial} disabled={disabled}
            onChange={(e) => set('razonSocial', e.target.value)} />
        </Field>
        <Field label="CUIT / RUT *" error={err('idFiscal')}>
          <input className={micCrtInputClass(err('idFiscal'))} value={actor.idFiscal} disabled={disabled}
            onChange={(e) => set('idFiscal', e.target.value)} />
        </Field>
        <Field label="Calle *" error={err('calle')}>
          <input className={micCrtInputClass(err('calle'))} value={actor.calle} disabled={disabled}
            onChange={(e) => set('calle', e.target.value)} />
        </Field>
        <Field label="Número de domicilio">
          <input className={inputClass} value={actor.numero} disabled={disabled}
            onChange={(e) => set('numero', e.target.value)} />
        </Field>
        <Field label="Ciudad *" error={err('ciudad')}>
          <input className={micCrtInputClass(err('ciudad'))} value={actor.ciudad} disabled={disabled}
            onChange={(e) => set('ciudad', e.target.value)} />
        </Field>
        <Field label="País *" error={err('pais')}>
          <PaisUbicacionSelect
            value={(actor.pais?.trim() || 'AR') as PaisCodigo}
            onChange={(p) => set('pais', p)}
            disabled={disabled}
            className={micCrtInputClass(err('pais'))}
          />
        </Field>
      </FormGrid>
    </fieldset>
  );
}

function mergeMicCrtConBorrador(
  prefill: MicCrtExportPayload,
  operativo: MicCrtPrefillResponse['operativo'],
  borrador: MicCrtExportPayload | null,
): MicCrtExportPayload {
  const base = normalizeMicCrtPayload(prefill, operativo);
  if (!borrador) return base;
  return normalizeMicCrtPayload({ ...base, ...borrador }, operativo);
}

export function MicCrtExportModal({ viaje, onClose, tenantId, onGenerated, onViajeUpdated }: Props) {
  const { getToken } = useAuth();
  const tid = tenantId?.trim() ?? '';
  const platform = Boolean(tid);
  const [viajeLocal, setViajeLocal] = useState(viaje);

  useEffect(() => {
    setViajeLocal(viaje);
  }, [viaje]);

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
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);
  const [borradorGuardado, setBorradorGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [missingGroups, setMissingGroups] = useState<Record<string, ViajeExportMissingGroup> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setMissingGroups(null);
      try {
        const data = await apiJson<MicCrtPrefillResponse>(prefillUrl(), getToken);
        const borrador = loadMicCrtBorrador(viaje.id);
        if (!cancelled) {
          setForm(mergeMicCrtConBorrador(data.prefill, data.operativo, borrador));
          setBorradorGuardado(Boolean(borrador));
        }
      } catch (e) {
        if (!cancelled) {
          const raw =
            e && typeof e === 'object' && 'message' in e
              ? (e as { message: unknown }).message
              : e instanceof Error
                ? e.message
                : null;
          setError(formatMicCrtExportError(raw));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viaje.id, tid]);

  function patch<K extends keyof MicCrtExportPayload>(key: K, value: MicCrtExportPayload[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setBorradorGuardado(false);
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      const keyStr = String(key);
      for (const k of Object.keys(next)) {
        if (k === keyStr || k.startsWith(`${keyStr}.`)) delete next[k];
      }
      return next;
    });
  }

  function guardarBorrador() {
    if (!form) return;
    setGuardandoBorrador(true);
    try {
      saveMicCrtBorrador(viaje.id, normalizeMicCrtPayload(form));
      setBorradorGuardado(true);
      setError(null);
    } finally {
      setGuardandoBorrador(false);
    }
  }

  async function generarPdf() {
    if (!form) return;
    const normalized = normalizeMicCrtPayload(form);
    setForm(normalized);
    const validation = validateMicCrtForm(normalized);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      setError('Completá los campos obligatorios marcados.');
      return;
    }
    setFieldErrors({});
    setError(null);
    setMissingGroups(null);
    setGenerando(true);
    try {
      const res = await apiFetch(pdfUrl(), getToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(micCrtExportBodyForApi(normalized)),
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as {
          message?: string | string[];
          missingGroups?: Record<string, ViajeExportMissingGroup>;
        };
        const groups = data.missingGroups ?? null;
        setMissingGroups(groups && hasEditableViajeExportGroups(groups) ? groups : null);
        setError(formatMicCrtExportError(data.message, groups));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIC-CRT-${viaje.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      clearMicCrtBorrador(viaje.id);
      onGenerated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red al generar el PDF.');
    } finally {
      setGenerando(false);
    }
  }

  async function corregirDatosYReintentar() {
    setMissingGroups(null);
    setError(null);
    if (onViajeUpdated) await onViajeUpdated();
    void generarPdf();
  }

  const ocupado = loading || generando || guardandoBorrador;

  useLockBodyScroll(true);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center overflow-hidden overscroll-none bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-crt-title"
    >
      <div className="relative flex h-full max-h-[100dvh] w-full min-w-0 max-w-[min(48rem,calc(100vw-1rem))] flex-col overflow-hidden border-0 bg-white shadow-lg sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15">
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-3">
          <div className="min-w-0">
            <h2 id="mic-crt-title" className="text-sm font-semibold text-vialto-charcoal">
              Documento aduanero MIC / CRT
            </h2>
            <p className="mt-0.5 text-xs text-vialto-steel">Viaje #{viaje.numero}</p>
          </div>
          <button type="button" onClick={onClose} disabled={ocupado}
            className="text-vialto-steel hover:text-vialto-charcoal disabled:opacity-40" aria-label="Cerrar">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3">
          {loading && <p className="text-xs text-vialto-steel">Cargando datos…</p>}

          {form && !loading && <MicCrtLegalDisclaimer />}

          {form && !loading && (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">1 · Identificación</h3>
                <FormGrid>
                  <Field label={`${labelCampo('Fecha de emisión', 6)} *`} error={fieldErrors.fechaEmision}>
                    <input type="date" className={micCrtDateInputClass(fieldErrors.fechaEmision)} value={form.fechaEmision} disabled={ocupado}
                      onChange={(e) => patch('fechaEmision', e.target.value)} />
                  </Field>
                  <Field label={`${labelCampo('N° MIC', 4)} *`} error={fieldErrors.micNumero}>
                    <input className={micCrtInputClass(fieldErrors.micNumero)} value={form.micNumero} disabled={ocupado}
                      onChange={(e) => patch('micNumero', e.target.value)} placeholder="Número aduanero" />
                  </Field>
                  <Field label={`${labelCampoCrt('N° CRT', 2)} *`} error={fieldErrors.crtNumero}>
                    <input className={micCrtInputClass(fieldErrors.crtNumero)} value={form.crtNumero} disabled={ocupado}
                      onChange={(e) => patch('crtNumero', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('Moneda documento', 25)}>
                    <MonedaSelect value={(form.monedaDocumento ?? form.monedaFot) as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaDocumento', m)} disabled={ocupado} />
                  </Field>
                </FormGrid>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">2 · Actores</h3>
                <div className="space-y-3">
                  <ActorBlock title={labelCampo('Remitente', 33)} actor={form.remitente} disabled={ocupado}
                    prefix="remitente" fieldErrors={fieldErrors}
                    onChange={(a) => patch('remitente', a)} />
                  <ActorBlock title={labelCampo('Destinatario', 34)} actor={form.destinatario} disabled={ocupado}
                    prefix="destinatario" fieldErrors={fieldErrors}
                    onChange={(a) => patch('destinatario', a)} />
                  <ActorBlock title={labelCampo('Consignatario', 35)} actor={form.consignatario} disabled={ocupado}
                    prefix="consignatario" fieldErrors={fieldErrors}
                    onChange={(a) => patch('consignatario', a)} />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">3 · Detalle aduanero</h3>
                <FormGrid>
                  <Field label={labelCampo('NCM', 38)}>
                    <input className={inputClass} value={form.ncm} disabled={ocupado}
                      placeholder="Opcional"
                      onChange={(e) => patch('ncm', e.target.value)} />
                  </Field>
                  <Field label={`${labelCampo('Cantidad de bultos', 31)} *`} error={fieldErrors.bultos}>
                    <input type="number" min={0} className={micCrtInputClass(fieldErrors.bultos)} value={form.bultos || ''} disabled={ocupado}
                      onChange={(e) => patch('bultos', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label={`${labelCampo('Tipo de bultos', 30)} *`} error={fieldErrors.tipoBultos}>
                    <select className={micCrtInputClass(fieldErrors.tipoBultos)} value={form.tipoBultos} disabled={ocupado}
                      onChange={(e) => patch('tipoBultos', e.target.value)}>
                      {TIPOS_BULTOS_MIC.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`${labelCampo('Peso bruto total (kg)', 32)} *`} error={fieldErrors.pesoBrutoKg}>
                    <input type="number" min={0} step="0.01" className={micCrtInputClass(fieldErrors.pesoBrutoKg)} value={form.pesoBrutoKg || ''} disabled={ocupado}
                      onChange={(e) => patch('pesoBrutoKg', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label={labelCampoCrt('Volumen (m³)', 13)}>
                    <input type="number" min={0} step="0.01" className={inputClass}
                      value={form.volumenM3 ?? ''} disabled={ocupado}
                      onChange={(e) => patch('volumenM3', e.target.value ? Number(e.target.value) : undefined)} />
                  </Field>
                  <Field label={labelCampo('Descripción mercaderías', 38)}>
                    <textarea className={`${inputClass} min-h-[60px]`} value={form.descripcionMercaderias ?? ''} disabled={ocupado}
                      onChange={(e) => patch('descripcionMercaderias', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('Origen comercial', 26)}>
                    <input
                      className={inputClass}
                      value={form.origenComercial ?? ''}
                      disabled={ocupado}
                      placeholder="Ej: Planta Rosario, depósito central..."
                      onChange={(e) => patch('origenComercial', e.target.value)}
                    />
                  </Field>
                </FormGrid>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-vialto-charcoal">4 · Valores comerciales</h3>
                <FormGrid>
                  <Field label={`${labelCampo('Valor FOT', 27)} *`} error={fieldErrors.valorFot}>
                    <input type="number" min={0} step="0.01" className={micCrtInputClass(fieldErrors.valorFot)} value={form.valorFot || ''} disabled={ocupado}
                      onChange={(e) => patch('valorFot', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label={labelCampo('Moneda FOT', 27)}>
                    <MonedaSelect value={form.monedaFot as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaFot', m)} disabled={ocupado} />
                  </Field>
                  <Field label={`${labelCampo('Flete internacional', 28)} *`}>
                    <input type="number" min={0} step="0.01" className={inputClass} value={form.flete || ''} disabled={ocupado}
                      onChange={(e) => patch('flete', Number(e.target.value) || 0)} />
                  </Field>
                  <Field label={labelCampo('Moneda flete', 28)}>
                    <MonedaSelect value={form.monedaFlete as ViajeMonedaCodigo}
                      onChange={(m) => patch('monedaFlete', m)} disabled={ocupado} />
                  </Field>
                  <Field label={labelCampo('Seguro (USD)', 29)}>
                    <input type="number" min={0} step="0.01" className={inputClass}
                      value={form.seguroUsd ?? ''} disabled={ocupado}
                      onChange={(e) => patch('seguroUsd', e.target.value ? Number(e.target.value) : undefined)} />
                  </Field>
                  <Field label={`${labelCampoCrt('Condición de pago flete', 15)} *`}>
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
                <fieldset className="mb-3 min-w-0 border border-black/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-vialto-charcoal">
                    {labelCampo('Partida', 7)}
                  </legend>
                  <FormGrid>
                    <Field label={`${labelCampo('Ciudad / lugar de partida', 7)} *`} error={fieldErrors.aduanaPartida}>
                      <input
                        className={micCrtInputClass(fieldErrors.aduanaPartida)}
                        value={form.aduanaPartida}
                        disabled={ocupado}
                        placeholder="Ej. Buenos Aires"
                        onChange={(e) => patch('aduanaPartida', e.target.value)}
                      />
                    </Field>
                    <Field label={labelCampo('País de partida', 7)}>
                      <PaisUbicacionSelect
                        value={(form.partidaPais?.trim() || '') as PaisCodigo | ''}
                        onChange={(p) => patch('partidaPais', p)}
                        placeholder="Seleccioná un país"
                        disabled={ocupado}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={labelCampo('Aduana específica', 7)}>
                      <input
                        className={inputClass}
                        value={form.aduanaEspecificaPartida ?? ''}
                        disabled={ocupado}
                        placeholder="Ej. AFIP Puerto Seco"
                        onChange={(e) => patch('aduanaEspecificaPartida', e.target.value)}
                      />
                    </Field>
                    <Field label={labelCampo('Código / lugar operativo', 24)}>
                      <input
                        className={inputClass}
                        value={form.codigoLugarOperativoPartida ?? ''}
                        disabled={ocupado}
                        placeholder="Ej. 1234"
                        onChange={(e) => patch('codigoLugarOperativoPartida', e.target.value)}
                      />
                    </Field>
                  </FormGrid>
                </fieldset>
                <FormGrid>
                  <Field label={`${labelCampo('Aduana destino', 8)} *`} error={fieldErrors.aduanaDestino}>
                    <input className={micCrtInputClass(fieldErrors.aduanaDestino)} value={form.aduanaDestino} disabled={ocupado}
                      onChange={(e) => patch('aduanaDestino', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('Documentos anexos', 36)}>
                    <input className={inputClass} value={form.documentosAnexos ?? ''} disabled={ocupado}
                      onChange={(e) => patch('documentosAnexos', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('N° precintos', 37)}>
                    <input className={inputClass} value={form.precintos ?? ''} disabled={ocupado}
                      onChange={(e) => patch('precintos', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('Carta de porte', 23)}>
                    <input className={inputClass} value={form.cartaPorte ?? ''} disabled={ocupado}
                      onChange={(e) => patch('cartaPorte', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('Ruta / plazo DTA', 40)} className="sm:col-span-2">
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
                      value={form.ruta ?? ''}
                      disabled={ocupado}
                      rows={5}
                      placeholder={'Tramo / ruta (una línea por tramo)\nAduana y plazos\nConductores'}
                      onChange={(e) => patch('ruta', e.target.value)}
                    />
                  </Field>
                  <Field label={labelCampo('Domicilio porteador', 1)}>
                    <input className={inputClass} value={form.porteadorDomicilio ?? ''} disabled={ocupado}
                      onChange={(e) => patch('porteadorDomicilio', e.target.value)} />
                  </Field>
                  <Field label={labelCampo('País porteador', 1)}>
                    <PaisUbicacionSelect
                      value={(form.porteadorPais || 'AR') as PaisCodigo}
                      onChange={(p) => patch('porteadorPais', p)}
                      disabled={ocupado}
                      className={inputClass}
                    />
                  </Field>
                </FormGrid>

                <fieldset className="mt-3 min-w-0 border border-black/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-vialto-charcoal">
                    CRT · 2.ª hoja
                  </legend>
                  <div className="grid gap-3">
                    <Field label={labelCampoCrt('Porteadores sucesivos', 10)}>
                      <textarea
                        className={`${inputClass} min-h-[72px]`}
                        value={form.porteadoresSucesivos ?? ''}
                        disabled={ocupado}
                        placeholder="Ej: Transportes XYZ S.A. — CUIT 30-12345678-9, domicilio..."
                        onChange={(e) => patch('porteadoresSucesivos', e.target.value)}
                      />
                    </Field>
                    <Field label={labelCampoCrt('Instrucciones sobre formalidades de aduana', 18)}>
                      <textarea
                        className={`${inputClass} min-h-[56px]`}
                        value={form.instruccionesFormalidadesAduana ?? ''}
                        disabled={ocupado}
                        placeholder="Ej: N, S, o detalle de formalidades aduaneras..."
                        onChange={(e) => patch('instruccionesFormalidadesAduana', e.target.value)}
                      />
                    </Field>
                    <FormGrid>
                      <Field label={labelCampoCrt('Monto flete externo', 19)}>
                        <MicCrtMontoInput
                          value={form.montoFleteExterno}
                          disabled={ocupado}
                          placeholder="Ej. mismo valor que flete internacional"
                          onChange={(v) => patch('montoFleteExterno', v)}
                        />
                      </Field>
                      <Field label={labelCampoCrt('Moneda flete externo', 19)}>
                        <MonedaSelect
                          value={(form.monedaFleteExterno ?? form.monedaFlete) as ViajeMonedaCodigo}
                          onChange={(m) => patch('monedaFleteExterno', m)}
                          disabled={ocupado}
                        />
                      </Field>
                    </FormGrid>
                    <FormGrid>
                      <Field label={labelCampoCrt('Reembolso contra entrega', 20)}>
                        <MicCrtMontoInput
                          value={form.montoReembolsoContraEntrega}
                          disabled={ocupado}
                          placeholder="Ej. 0 si no aplica"
                          onChange={(v) => patch('montoReembolsoContraEntrega', v)}
                        />
                      </Field>
                      <Field label={labelCampoCrt('Moneda reembolso', 20)}>
                        <MonedaSelect
                          value={
                            (form.monedaReembolsoContraEntrega ?? form.monedaFot) as ViajeMonedaCodigo
                          }
                          onChange={(m) => patch('monedaReembolsoContraEntrega', m)}
                          disabled={ocupado}
                        />
                      </Field>
                    </FormGrid>
                    <Field label={labelCampoCrt('Declaraciones y observaciones', 22)}>
                      <textarea
                        className={`${inputClass} min-h-[72px]`}
                        value={form.declaracionesObservaciones ?? ''}
                        disabled={ocupado}
                        placeholder="Ej. declaraciones del remitente, observaciones del viaje..."
                        onChange={(e) => patch('declaracionesObservaciones', e.target.value)}
                      />
                    </Field>
                  </div>
                </fieldset>

                <fieldset className="mt-3 min-w-0 border border-black/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-vialto-charcoal">
                    Semirremolque (Campos 13–15, opcional)
                  </legend>
                  <FormGrid>
                    <Field label={labelCampo('Propietario remolque', 13)}>
                      <input className={inputClass} value={form.semirremolque?.propietario ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, propietario: e.target.value })} />
                    </Field>
                    <Field label="CUIT propietario">
                      <input className={inputClass} value={form.semirremolque?.idFiscal ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, idFiscal: e.target.value })} />
                    </Field>
                    <Field label={labelCampo('Patente remolque', 13)}>
                      <input className={inputClass} value={form.semirremolque?.patente ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, patente: e.target.value })} />
                    </Field>
                    <Field label={labelCampo('Marca remolque', 13)}>
                      <input className={inputClass} value={form.semirremolque?.marca ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', { ...form.semirremolque, marca: e.target.value })} />
                    </Field>
                    <Field label={labelCampo('Año camión', 14)}>
                      <input type="number" className={inputClass} value={form.semirremolque?.anio ?? ''} disabled={ocupado}
                        onChange={(e) => patch('semirremolque', {
                          ...form.semirremolque,
                          anio: e.target.value ? Number(e.target.value) : undefined,
                        })} />
                    </Field>
                    <Field label={labelCampo('Capacidad arrastre (t)', 15)}>
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

          {missingGroups ? (
            <ViajeExportMissingFieldsPanel
              viaje={viajeLocal}
              tenantId={tenantId}
              message={error ?? 'Completá los datos faltantes para generar el documento.'}
              groups={missingGroups}
              disabled={ocupado}
              onSaved={() => void corregirDatosYReintentar()}
            />
          ) : error ? (
            <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 leading-snug">
              <p>{error}</p>
            </div>
          ) : null}

          {borradorGuardado && !error && (
            <p className="text-xs text-vialto-steel">
              Borrador guardado en este dispositivo. Podés cerrar y continuar más tarde.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-black/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <button type="button" disabled={ocupado} onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50 sm:w-auto">
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado || !form}
            onClick={guardarBorrador}
            className="inline-flex min-h-11 w-full items-center justify-center text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50 sm:w-auto"
          >
            {guardandoBorrador ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button type="button" disabled={ocupado || !form} onClick={() => void generarPdf()}
            className="inline-flex min-h-11 w-full items-center justify-center text-xs uppercase tracking-wider px-3 py-1.5 bg-vialto-charcoal text-white hover:bg-black disabled:opacity-50 sm:w-auto">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

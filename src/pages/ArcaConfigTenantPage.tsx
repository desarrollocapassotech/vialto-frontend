import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { useToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/Spinner';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { ArcaConfig } from '@/types/api';

const CONDICION_IVA = [
  { value: '1', label: 'IVA Responsable Inscripto' },
  { value: '6', label: 'Responsable Monotributo' },
  { value: '4', label: 'IVA Sujeto Exento' },
  { value: '5', label: 'Consumidor Final' },
  { value: '3', label: 'IVA no Responsable' },
  { value: '7', label: 'Sujeto no Categorizado' },
];

function isoToArcaDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function arcaDateToIso(arca: string) {
  if (!arca) return '';
  const [d, m, y] = arca.split('/');
  if (!y) return '';
  return `${y}-${m}-${d}`;
}

function fmtDate(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

type FormValues = {
  cuitEmisor: string;
  razonSocial: string;
  domicilioEmisor: string;
  condicionIvaEmisor: string;
  ingBrutos: string;
  inicActEmisor: string;
  ptoVentaCvlp: string;
  ptoVentaFactura: string;
  ambiente: 'homologacion' | 'produccion';
  comisionPctDefault: string;
  comisionPctAlt: string;
  ivaGastosAdmin: string;
  certPem: string;
  keyPem: string;
};

const EMPTY: FormValues = {
  cuitEmisor: '',
  razonSocial: '',
  domicilioEmisor: '',
  condicionIvaEmisor: '',
  ingBrutos: '',
  inicActEmisor: '',
  ptoVentaCvlp: '1',
  ptoVentaFactura: '1',
  ambiente: 'homologacion',
  comisionPctDefault: '8',
  comisionPctAlt: '7',
  ivaGastosAdmin: '21',
  certPem: '',
  keyPem: '',
};

function configToForm(c: ArcaConfig): FormValues {
  return {
    cuitEmisor: c.cuitEmisor,
    razonSocial: c.razonSocial ?? '',
    domicilioEmisor: c.domicilioEmisor ?? '',
    condicionIvaEmisor: c.condicionIvaEmisor ?? '',
    ingBrutos: c.ingBrutos ?? '',
    inicActEmisor: arcaDateToIso(c.inicActEmisor ?? ''),
    ptoVentaCvlp: String(c.ptoVentaCvlp),
    ptoVentaFactura: String(c.ptoVentaFactura),
    ambiente: c.ambiente,
    comisionPctDefault: String(c.comisionPctDefault),
    comisionPctAlt: String(c.comisionPctAlt),
    ivaGastosAdmin: String(c.ivaGastosAdmin),
    certPem: '',
    keyPem: '',
  };
}

const inputClass =
  'h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35';

const labelClass =
  'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel';

export function ArcaConfigTenantPage() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [existing, setExisting] = useState<ArcaConfig | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    void (async () => {
      try {
        const config = await apiJson<ArcaConfig | null>(
          '/api/integracion-arca/config',
          () => getToken(),
        );
        if (!cancelled) {
          if (config) {
            setExisting(config);
            setValues(configToForm(config));
          }
        }
      } catch {
        // sin config previa
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.cuitEmisor.trim()) {
      setFieldErrors({ cuitEmisor: 'El CUIT emisor es obligatorio.' });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const body = {
        cuitEmisor: values.cuitEmisor.trim(),
        razonSocial: values.razonSocial.trim() || undefined,
        domicilioEmisor: values.domicilioEmisor.trim() || undefined,
        condicionIvaEmisor: values.condicionIvaEmisor.trim() || undefined,
        ingBrutos: values.ingBrutos.trim() || undefined,
        inicActEmisor: values.inicActEmisor ? isoToArcaDate(values.inicActEmisor) : undefined,
        ptoVentaCvlp: Number(values.ptoVentaCvlp),
        ptoVentaFactura: Number(values.ptoVentaFactura),
        ambiente: values.ambiente,
        comisionPctDefault: Number(values.comisionPctDefault),
        comisionPctAlt: Number(values.comisionPctAlt),
        ivaGastosAdmin: Number(values.ivaGastosAdmin),
        certPem: values.certPem.trim() || undefined,
        keyPem: values.keyPem.trim() || undefined,
      };
      const config = await apiJson<ArcaConfig>(
        '/api/integracion-arca/config',
        () => getToken(),
        { method: 'POST', body: JSON.stringify(body) },
      );
      setExisting(config);
      setValues(configToForm(config));
      showToast('Configuración guardada correctamente.');
    } catch (e) {
      setError(friendlyError(e, 'arca'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Configuración ARCA / AFIP
      </h1>
      <p className="mt-2 text-vialto-steel">
        Datos de emisión electrónica para comprobantes CVLP y facturas A/B.
      </p>

      {initialLoading ? (
        <p className="mt-8 text-sm text-vialto-steel">Cargando configuración…</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-5">
          {existing && (
            <div className="rounded border border-black/10 bg-white px-4 py-3 text-sm text-vialto-charcoal">
              <span className="font-medium">Configurado</span> — última actualización:{' '}
              {fmtDate(existing.updatedAt)} · ambiente:{' '}
              <span
                className={`font-medium ${existing.ambiente === 'produccion' ? 'text-red-700' : 'text-amber-700'}`}
              >
                {existing.ambiente === 'produccion' ? 'Producción' : 'Homologación (testing)'}
              </span>
            </div>
          )}

          {error && (
            <div className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="razonSocial" className={labelClass}>Razón Social</label>
            <input
              id="razonSocial"
              type="text"
              value={values.razonSocial}
              onChange={(e) => set('razonSocial', e.target.value)}
              placeholder="Ej: Transportes Del Sur S.R.L."
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="domicilioEmisor" className={labelClass}>Domicilio del Emisor</label>
            <input
              id="domicilioEmisor"
              type="text"
              value={values.domicilioEmisor}
              onChange={(e) => set('domicilioEmisor', e.target.value)}
              placeholder="Ej: San Martín 1234, Paraná, Entre Ríos"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cuitEmisor" className={labelClass}>
                CUIT Emisor <span className="text-red-500">*</span>
              </label>
              <input
                id="cuitEmisor"
                type="text"
                value={values.cuitEmisor}
                onChange={(e) => set('cuitEmisor', e.target.value)}
                placeholder="Ej: 30-71234567-8"
                className={`${inputClass} ${fieldErrors.cuitEmisor ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.cuitEmisor} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="condicionIva" className={labelClass}>Condición frente al IVA</label>
              <select
                id="condicionIva"
                value={values.condicionIvaEmisor}
                onChange={(e) => set('condicionIvaEmisor', e.target.value)}
                className={inputClass}
              >
                <option value="">— Sin especificar —</option>
                {CONDICION_IVA.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ingBrutos" className={labelClass}>Ing. Brutos</label>
              <input
                id="ingBrutos"
                type="text"
                value={values.ingBrutos}
                onChange={(e) => set('ingBrutos', e.target.value)}
                placeholder="Ej: CM-30712345678"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inicActEmisor" className={labelClass}>Inicio de Actividades</label>
              <input
                id="inicActEmisor"
                type="date"
                value={values.inicActEmisor}
                onChange={(e) => set('inicActEmisor', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ptoVentaCvlp" className={labelClass}>Pto. Venta CVLP</label>
              <input
                id="ptoVentaCvlp"
                type="number"
                value={values.ptoVentaCvlp}
                onChange={(e) => set('ptoVentaCvlp', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ptoVentaFactura" className={labelClass}>Pto. Venta Factura A/B</label>
              <input
                id="ptoVentaFactura"
                type="number"
                value={values.ptoVentaFactura}
                onChange={(e) => set('ptoVentaFactura', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ambiente" className={labelClass}>Ambiente</label>
            <select
              id="ambiente"
              value={values.ambiente}
              onChange={(e) => set('ambiente', e.target.value as FormValues['ambiente'])}
              className={inputClass}
            >
              <option value="homologacion">Homologación (testing)</option>
              <option value="produccion">Producción</option>
            </select>
            {values.ambiente === 'produccion' && (
              <p className="text-xs text-red-700">
                Los comprobantes emitidos en producción son reales y tienen validez fiscal ante AFIP.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="comisionPctDefault" className={labelClass}>Comisión default (%)</label>
              <input
                id="comisionPctDefault"
                type="number"
                value={values.comisionPctDefault}
                onChange={(e) => set('comisionPctDefault', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="comisionPctAlt" className={labelClass}>Comisión alternativa (%)</label>
              <input
                id="comisionPctAlt"
                type="number"
                value={values.comisionPctAlt}
                onChange={(e) => set('comisionPctAlt', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ivaGastosAdmin" className={labelClass}>IVA sobre neto (%)</label>
            <input
              id="ivaGastosAdmin"
              type="number"
              value={values.ivaGastosAdmin}
              onChange={(e) => set('ivaGastosAdmin', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="border-t border-black/10 pt-5 space-y-4">
            <div>
              <p className={labelClass}>Certificado y clave privada</p>
              <p className="text-xs text-vialto-steel mt-1">
                Archivos PEM generados en AFIP y vinculados al servicio WSFE. Dejá vacío para conservar el valor actual.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="certPem" className={labelClass}>
                Certificado digital (.crt / .pem)
                {existing?.certConfigurado && <span className="ml-2 normal-case text-green-700">● configurado</span>}
              </label>
              <textarea
                id="certPem"
                rows={5}
                value={values.certPem}
                onChange={(e) => set('certPem', e.target.value)}
                placeholder={existing?.certConfigurado ? 'Pegá aquí para reemplazar el certificado actual.' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                className="rounded border border-black/10 bg-white px-3 py-2 text-xs font-mono text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 resize-y"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="keyPem" className={labelClass}>
                Clave privada (.key / .pem)
                {existing?.keyConfigurado && <span className="ml-2 normal-case text-green-700">● configurada</span>}
              </label>
              <textarea
                id="keyPem"
                rows={5}
                value={values.keyPem}
                onChange={(e) => set('keyPem', e.target.value)}
                placeholder={existing?.keyConfigurado ? 'Pegá aquí para reemplazar la clave actual.' : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                className="rounded border border-black/10 bg-white px-3 py-2 text-xs font-mono text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 resize-y"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 rounded bg-vialto-fire px-6 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-bright disabled:opacity-50"
          >
            {loading && <Spinner />}
            {loading ? 'Guardando…' : existing ? 'Guardar cambios' : 'Guardar configuración'}
          </button>
        </form>
      )}
    </div>
  );
}

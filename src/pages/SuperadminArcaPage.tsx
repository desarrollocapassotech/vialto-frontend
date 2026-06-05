import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/Spinner';
import { ListadoCard } from '@/components/listado/ListadoCard';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson, apiFetch } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from '@/lib/listadoTabla';
import type { ArcaConfig, ArcaLog, Liquidacion } from '@/types/api';

// ── Helpers visuales ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_cae: 'Pendiente CAE',
  autorizado: 'Autorizado',
  error: 'Error',
  anulado: 'Anulado',
};

const ESTADO_CLASS: Record<string, string> = {
  borrador: 'bg-vialto-steel/15 text-vialto-steel',
  pendiente_cae: 'bg-amber-100 text-amber-800',
  autorizado: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  anulado: 'bg-slate-100 text-slate-600',
};

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});
const fmt = (n: number) => ars.format(n);
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

// ── Condición IVA emisor (AFIP standard codes) ───────────────────────────────

const CONDICION_IVA_EMISOR = [
  { value: '1', label: 'IVA Responsable Inscripto' },
  { value: '6', label: 'Responsable Monotributo' },
  { value: '4', label: 'IVA Sujeto Exento' },
  { value: '5', label: 'Consumidor Final' },
  { value: '3', label: 'IVA no Responsable' },
  { value: '7', label: 'Sujeto no Categorizado' },
];

// Helpers para la fecha (UI ↔ ARCA format)
function isoToArcaDate(iso: string): string {
  // "YYYY-MM-DD" → "DD/MM/YYYY"
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function arcaDateToIso(arca: string): string {
  // "DD/MM/YYYY" → "YYYY-MM-DD"
  if (!arca) return '';
  const [d, m, y] = arca.split('/');
  if (!y) return '';
  return `${y}-${m}-${d}`;
}

// ── ConfigTab ────────────────────────────────────────────────────────────────

type ConfigFormValues = {
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
};

const EMPTY_FORM: ConfigFormValues = {
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
};

function configToForm(c: ArcaConfig): ConfigFormValues {
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
  };
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
    />
  );
}

function ConfigTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [existing, setExisting] = useState<ArcaConfig | null>(null);
  const [values, setValues] = useState<ConfigFormValues>(EMPTY_FORM);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    (async () => {
      try {
        const config = await apiJson<ArcaConfig | null>(
          `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) {
          if (config) {
            setExisting(config);
            setValues(configToForm(config));
          } else {
            setExisting(null);
            setValues(EMPTY_FORM);
          }
        }
      } catch {
        // 404 = no config todavía
        if (!cancelled) {
          setExisting(null);
          setValues(EMPTY_FORM);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

  function set<K extends keyof ConfigFormValues>(key: K, value: ConfigFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.cuitEmisor.trim()) {
      setError('El CUIT emisor es obligatorio.');
      return;
    }
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
      };

      const config = await apiJson<ArcaConfig>(
        `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
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

  if (initialLoading) {
    return <p className="mt-4 text-sm text-vialto-steel">Cargando configuración…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-5">
      {existing && (
        <div className="rounded border border-black/10 bg-white px-4 py-3 text-sm text-vialto-charcoal">
          <span className="font-medium">Configurado</span> — última actualización:{' '}
          {fmtDate(existing.updatedAt)} · ambiente:{' '}
          <span
            className={`font-medium ${
              existing.ambiente === 'produccion' ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            {existing.ambiente === 'produccion' ? 'Producción' : 'Homologación (testing)'}
          </span>
        </div>
      )}

      {error && (
        <div
          className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}


      {/* Datos del emisor */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="razonSocial">Razón Social</FieldLabel>
        <TextInput
          id="razonSocial"
          value={values.razonSocial}
          onChange={(v) => set('razonSocial', v)}
          placeholder="Ej: NyM Logística S.R.L."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="domicilioEmisor">Domicilio del Emisor</FieldLabel>
        <TextInput
          id="domicilioEmisor"
          value={values.domicilioEmisor}
          onChange={(v) => set('domicilioEmisor', v)}
          placeholder="Ej: Av. Siempreviva 742, CABA"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cuitEmisor">CUIT Emisor</FieldLabel>
          <TextInput
            id="cuitEmisor"
            value={values.cuitEmisor}
            onChange={(v) => set('cuitEmisor', v)}
            placeholder="20XXXXXXXXXXX"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="condicionIvaEmisor">Condición frente al IVA</FieldLabel>
          <select
            id="condicionIvaEmisor"
            value={values.condicionIvaEmisor}
            onChange={(e) => set('condicionIvaEmisor', e.target.value)}
            className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
          >
            <option value="">— Sin especificar —</option>
            {CONDICION_IVA_EMISOR.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ingBrutos">Ing. Brutos</FieldLabel>
          <TextInput
            id="ingBrutos"
            value={values.ingBrutos}
            onChange={(v) => set('ingBrutos', v)}
            placeholder="Ej: CM 20XXXXXXXXX3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inicActEmisor">Inicio de Actividades</FieldLabel>
          <input
            id="inicActEmisor"
            type="date"
            value={values.inicActEmisor}
            onChange={(e) => set('inicActEmisor', e.target.value)}
            className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
          />
        </div>
      </div>

      {/* Puntos de venta */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ptoVentaCvlp">Pto. Venta CVLP</FieldLabel>
          <TextInput
            id="ptoVentaCvlp"
            type="number"
            value={values.ptoVentaCvlp}
            onChange={(v) => set('ptoVentaCvlp', v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ptoVentaFactura">Pto. Venta Factura A/B</FieldLabel>
          <TextInput
            id="ptoVentaFactura"
            type="number"
            value={values.ptoVentaFactura}
            onChange={(v) => set('ptoVentaFactura', v)}
          />
        </div>
      </div>

      {/* Ambiente */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Ambiente</FieldLabel>
        <select
          value={values.ambiente}
          onChange={(e) => set('ambiente', e.target.value as ConfigFormValues['ambiente'])}
          className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
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

      {/* Comisiones */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="comisionPctDefault">Comisión default (%)</FieldLabel>
          <TextInput
            id="comisionPctDefault"
            type="number"
            value={values.comisionPctDefault}
            onChange={(v) => set('comisionPctDefault', v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="comisionPctAlt">Comisión alternativa (%)</FieldLabel>
          <TextInput
            id="comisionPctAlt"
            type="number"
            value={values.comisionPctAlt}
            onChange={(v) => set('comisionPctAlt', v)}
          />
        </div>
      </div>

      {/* Gastos administrativos */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="ivaGastosAdmin">IVA sobre neto (%)</FieldLabel>
        <TextInput
          id="ivaGastosAdmin"
          type="number"
          value={values.ivaGastosAdmin}
          onChange={(v) => set('ivaGastosAdmin', v)}
        />
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
  );
}

// ── LiquidacionesTab ──────────────────────────────────────────────────────────

function LiquidacionesTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<Liquidacion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emitting, setEmitting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiJson<Liquidacion[]>(
      `/api/platform/arca/liquidaciones?tenantId=${encodeURIComponent(tenantId)}`,
      () => getToken(),
    )
      .then(setItems)
      .catch((e) => setError(friendlyError(e, 'arca')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function emitir(id: string) {
    setEmitting(id);
    setActionError(null);
    try {
      await apiJson<Liquidacion>(
        `/api/platform/arca/liquidaciones/${id}/emitir?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: 'POST' },
      );
      load();
    } catch (e) {
      setActionError(friendlyError(e, 'arca'));
    } finally {
      setEmitting(null);
    }
  }

  async function descargarPdf(id: string) {
    setDownloading(id);
    setActionError(null);
    try {
      const res = await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/pdf?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error('Error al descargar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidacion-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionError(friendlyError(e, 'arca'));
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-vialto-steel">Cargando liquidaciones…</p>;
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <div className="mt-6 space-y-3">
      {actionError && (
        <div
          className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {actionError}
        </div>
      )}

      <ListadoDatos
        columns={[
          {
            id: 'periodo',
            header: 'Período',
            primary: true,
            cell: (liq) => `${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'viajes',
            header: 'Vj.',
            cell: (liq) => liq.cantViajes,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: 'bruto',
            header: 'Bruto',
            cell: (liq) => fmt(liq.bruto),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: 'comision',
            header: 'Comisión',
            cell: (liq) => fmt(liq.comision),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-vialto-steel`,
          },
          {
            id: 'liquido',
            header: 'Líquido',
            cell: (liq) => fmt(liq.liquido),
            tdClassName: `${listadoTablaTdClass} text-right font-medium tabular-nums`,
          },
          {
            id: 'cae',
            header: 'CAE',
            cell: (liq) => liq.cae ?? '—',
            tdClassName: `${listadoTablaTdClass} font-mono text-xs text-vialto-steel`,
          },
          {
            id: 'estado',
            header: 'Estado',
            cell: (liq) => (
              <>
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ''}`}
                >
                  {ESTADO_LABEL[liq.estado] ?? liq.estado}
                </span>
                {liq.arcaError && (
                  <p
                    className="mt-0.5 max-w-[180px] truncate text-xs text-red-600"
                    title={liq.arcaError}
                  >
                    {liq.arcaError}
                  </p>
                )}
              </>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={items ?? []}
        rowKey={(liq) => liq.id}
        emptyMessage="No hay liquidaciones para esta empresa."
        renderActions={(liq) => (
          <>
            {(liq.estado === 'borrador' ||
              liq.estado === 'pendiente_cae' ||
              liq.estado === 'error') && (
              <button
                type="button"
                disabled={emitting === liq.id}
                onClick={() => emitir(liq.id)}
                className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright`}
              >
                {emitting === liq.id ? 'Emitiendo…' : 'Emitir'}
              </button>
            )}
            <button
              type="button"
              disabled={downloading === liq.id}
              onClick={() => descargarPdf(liq.id)}
              className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal`}
            >
              {downloading === liq.id ? '…' : 'PDF'}
            </button>
          </>
        )}
        actionsHeader="Acciones"
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => (
          <ListadoCard
            primary={`${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`}
            fields={[
              { label: 'Viajes', value: liq.cantViajes },
              { label: 'Bruto', value: fmt(liq.bruto) },
              { label: 'Comisión', value: fmt(liq.comision) },
              { label: 'Líquido', value: fmt(liq.liquido) },
              { label: 'CAE', value: liq.cae ?? '—' },
              {
                label: 'Estado',
                value: (
                  <>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ''}`}
                    >
                      {ESTADO_LABEL[liq.estado] ?? liq.estado}
                    </span>
                    {liq.arcaError && (
                      <p className="mt-0.5 truncate text-xs text-red-600" title={liq.arcaError}>
                        {liq.arcaError}
                      </p>
                    )}
                  </>
                ),
              },
            ]}
            actions={
              <>
                {(liq.estado === 'borrador' ||
                  liq.estado === 'pendiente_cae' ||
                  liq.estado === 'error') && (
                  <button
                    type="button"
                    disabled={emitting === liq.id}
                    onClick={() => emitir(liq.id)}
                    className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright`}
                  >
                    {emitting === liq.id ? 'Emitiendo…' : 'Emitir'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={downloading === liq.id}
                  onClick={() => descargarPdf(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal`}
                >
                  {downloading === liq.id ? '…' : 'PDF'}
                </button>
              </>
            }
          />
        )}
      />
    </div>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────────

function LogsTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<ArcaLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiJson<ArcaLog[]>(
      `/api/platform/arca/logs?tenantId=${encodeURIComponent(tenantId)}`,
      () => getToken(),
    )
      .then(setLogs)
      .catch((e) => setError(friendlyError(e, 'arca')))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <p className="mt-6 text-sm text-vialto-steel">Cargando logs…</p>;
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <ListadoDatos
      className="mt-6"
      columns={[
        {
          id: 'fecha',
          header: 'Fecha',
          primary: true,
          cell: (log) => fmtTs(log.createdAt),
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: 'method',
          header: 'Método',
          cell: (log) => (
            <span className="font-mono text-xs text-vialto-charcoal">{log.method}</span>
          ),
          tdClassName: listadoTablaTdClass,
        },
        {
          id: 'ambiente',
          header: 'Ambiente',
          cell: (log) => log.ambiente,
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: 'http',
          header: 'HTTP',
          cell: (log) => log.httpStatus ?? '—',
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: 'ms',
          header: 'ms',
          cell: (log) => log.durationMs,
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: 'resultado',
          header: 'Resultado',
          cell: (log) =>
            log.exitoso ? (
              <span className="font-medium text-green-700">OK</span>
            ) : (
              <span className="text-red-600" title={log.error ?? ''}>
                {log.error ? 'Error' : 'Fallido'}
              </span>
            ),
          tdClassName: listadoTablaTdClass,
        },
      ]}
      rows={logs ?? []}
      rowKey={(log) => log.id}
      emptyMessage="No hay logs registrados para esta empresa."
      renderMobileCard={(log) => (
        <ListadoCard
          primary={fmtTs(log.createdAt)}
          fields={[
            { label: 'Método', value: <span className="font-mono">{log.method}</span> },
            { label: 'Ambiente', value: log.ambiente },
            { label: 'HTTP', value: log.httpStatus ?? '—' },
            { label: 'ms', value: log.durationMs },
            {
              label: 'Resultado',
              value: log.exitoso ? (
                <span className="font-medium text-green-700">OK</span>
              ) : (
                <span className="text-red-600">{log.error ?? 'Fallido'}</span>
              ),
            },
          ]}
        />
      )}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'config' | 'liquidaciones' | 'logs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'config', label: 'Configuración' },
  { id: 'liquidaciones', label: 'Liquidaciones' },
  { id: 'logs', label: 'Logs de auditoría' },
];

export function SuperadminArcaPage() {
  const tenants = useTenantsList();
  const [tenantId, setTenantId] = useState('');
  const [tab, setTab] = useState<Tab>('config');

  function handleTenantChange(next: string) {
    setTenantId(next);
    setTab('config');
  }

  return (
    <SuperadminOnly>
      <div className="max-w-5xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          ARCA / AFIP
        </h1>
        <p className="mt-2 text-vialto-steel">
          Configuración de emisión electrónica y liquidaciones CVLP por empresa.
        </p>

        <div className="mt-6">
          <EmpresaFilterBar tenants={tenants} value={tenantId} onChange={handleTenantChange} />
        </div>

        {!tenantId && (
          <p className="mt-6 text-sm text-vialto-steel">
            Seleccioná una empresa para gestionar su configuración ARCA.
          </p>
        )}

        {tenantId && (
          <>
            <div className="mt-8 flex gap-0.5 border-b border-black/10">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={[
                    'px-4 py-2.5 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors',
                    tab === t.id
                      ? 'border-vialto-fire font-semibold text-vialto-charcoal'
                      : 'border-transparent text-vialto-steel hover:text-vialto-charcoal',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'config' && <ConfigTab key={`cfg-${tenantId}`} tenantId={tenantId} />}
            {tab === 'liquidaciones' && (
              <LiquidacionesTab key={`liq-${tenantId}`} tenantId={tenantId} />
            )}
            {tab === 'logs' && <LogsTab key={`log-${tenantId}`} tenantId={tenantId} />}
          </>
        )}
      </div>
    </SuperadminOnly>
  );
}

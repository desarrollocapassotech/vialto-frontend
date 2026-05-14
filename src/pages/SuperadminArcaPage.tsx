import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
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

// ── ConfigTab ────────────────────────────────────────────────────────────────

type ConfigFormValues = {
  cuitEmisor: string;
  ptoVentaCvlp: string;
  ptoVentaFactura: string;
  ambiente: 'homologacion' | 'produccion';
  comisionPctDefault: string;
  comisionPctAlt: string;
  gastosAdminPorViaje: string;
  ivaGastosAdmin: string;
};

const EMPTY_FORM: ConfigFormValues = {
  cuitEmisor: '',
  ptoVentaCvlp: '1',
  ptoVentaFactura: '1',
  ambiente: 'homologacion',
  comisionPctDefault: '8',
  comisionPctAlt: '7',
  gastosAdminPorViaje: '0',
  ivaGastosAdmin: '21',
};

function configToForm(c: ArcaConfig): ConfigFormValues {
  return {
    cuitEmisor: c.cuitEmisor,
    ptoVentaCvlp: String(c.ptoVentaCvlp),
    ptoVentaFactura: String(c.ptoVentaFactura),
    ambiente: c.ambiente,
    comisionPctDefault: String(c.comisionPctDefault),
    comisionPctAlt: String(c.comisionPctAlt),
    gastosAdminPorViaje: String(c.gastosAdminPorViaje),
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
  const [existing, setExisting] = useState<ArcaConfig | null>(null);
  const [values, setValues] = useState<ConfigFormValues>(EMPTY_FORM);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    setSuccess(false);
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
    setSuccess(false);
    try {
      const body = {
        cuitEmisor: values.cuitEmisor.trim(),
        ptoVentaCvlp: Number(values.ptoVentaCvlp),
        ptoVentaFactura: Number(values.ptoVentaFactura),
        ambiente: values.ambiente,
        comisionPctDefault: Number(values.comisionPctDefault),
        comisionPctAlt: Number(values.comisionPctAlt),
        gastosAdminPorViaje: Number(values.gastosAdminPorViaje),
        ivaGastosAdmin: Number(values.ivaGastosAdmin),
      };

      const config = await apiJson<ArcaConfig>(
        `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: 'POST', body: JSON.stringify(body) },
      );
      setExisting(config);
      setValues(configToForm(config));
      setSuccess(true);
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

      {success && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
          Configuración guardada correctamente.
        </div>
      )}

      {/* CUIT */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="cuitEmisor">CUIT Emisor</FieldLabel>
        <TextInput
          id="cuitEmisor"
          value={values.cuitEmisor}
          onChange={(v) => set('cuitEmisor', v)}
          placeholder="20XXXXXXXXXXX"
        />
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
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="gastosAdminPorViaje">Gastos admin por viaje ($)</FieldLabel>
          <TextInput
            id="gastosAdminPorViaje"
            type="number"
            value={values.gastosAdminPorViaje}
            onChange={(v) => set('gastosAdminPorViaje', v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ivaGastosAdmin">IVA sobre neto (%)</FieldLabel>
          <TextInput
            id="ivaGastosAdmin"
            type="number"
            value={values.ivaGastosAdmin}
            onChange={(v) => set('ivaGastosAdmin', v)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="h-10 rounded bg-vialto-fire px-6 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-bright disabled:opacity-50"
      >
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

      {!items?.length ? (
        <p className="text-sm text-vialto-steel">No hay liquidaciones para esta empresa.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-black/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/8 bg-vialto-mist/70">
                {['Período', 'Vj.', 'Bruto', 'Comisión', 'Líquido', 'CAE', 'Estado', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel ${h === '' || h === 'Vj.' || h === 'Bruto' || h === 'Comisión' || h === 'Líquido' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((liq) => (
                <tr key={liq.id} className="border-b border-black/5 hover:bg-vialto-mist/40">
                  <td className="px-3 py-2.5 text-vialto-charcoal">
                    {fmtDate(liq.periodoDesde)} – {fmtDate(liq.periodoHasta)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-vialto-charcoal">
                    {liq.cantViajes}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-vialto-charcoal">
                    {fmt(liq.bruto)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-vialto-steel">
                    {fmt(liq.comision)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-vialto-charcoal">
                    {fmt(liq.liquido)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-vialto-steel">
                    {liq.cae ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
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
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(liq.estado === 'borrador' ||
                      liq.estado === 'pendiente_cae' ||
                      liq.estado === 'error') && (
                      <button
                        type="button"
                        disabled={emitting === liq.id}
                        onClick={() => emitir(liq.id)}
                        className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-fire hover:text-vialto-bright disabled:opacity-50"
                      >
                        {emitting === liq.id ? 'Emitiendo…' : 'Emitir'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  if (!logs?.length)
    return (
      <p className="mt-6 text-sm text-vialto-steel">
        No hay logs registrados para esta empresa.
      </p>
    );

  return (
    <div className="mt-6 overflow-x-auto rounded border border-black/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/8 bg-vialto-mist/70">
            {['Fecha', 'Método', 'Ambiente', 'HTTP', 'ms', 'Resultado'].map((h) => (
              <th
                key={h}
                className={`px-3 py-2.5 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel ${h === 'HTTP' || h === 'ms' ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-black/5 hover:bg-vialto-mist/40">
              <td className="px-3 py-2 text-xs text-vialto-steel">{fmtTs(log.createdAt)}</td>
              <td className="px-3 py-2 font-mono text-xs text-vialto-charcoal">{log.method}</td>
              <td className="px-3 py-2 text-xs text-vialto-steel">{log.ambiente}</td>
              <td className="px-3 py-2 text-right tabular-nums text-xs text-vialto-steel">
                {log.httpStatus ?? '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs text-vialto-steel">
                {log.durationMs}
              </td>
              <td className="px-3 py-2 text-xs">
                {log.exitoso ? (
                  <span className="font-medium text-green-700">OK</span>
                ) : (
                  <span className="text-red-600" title={log.error ?? ''}>
                    {log.error ? 'Error' : 'Fallido'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

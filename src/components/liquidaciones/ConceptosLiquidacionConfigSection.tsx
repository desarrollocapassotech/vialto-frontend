import { useCallback, useEffect, useState } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel } from '@/components/crud/CrudFields';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { ALICUOTAS_IVA_AFIP_LABEL, esAlicuotaIvaAfip } from '@/lib/liquidacionConceptosIva';
import { useToast } from '@/lib/toast';
import { tooltipPanelClass } from '@/lib/tooltip';
import type { ConceptoLiquidacion, ConceptoLiquidacionSigno } from '@/types/api';

const inputClass =
  'h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35';

const SIGNO_OPTIONS: { value: ConceptoLiquidacionSigno; label: string }[] = [
  { value: 'favor', label: 'Sumar' },
  { value: 'contra', label: 'Restar' },
];

function signoLabel(s: ConceptoLiquidacionSigno) {
  return s === 'favor' ? 'Sumar' : 'Restar';
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FormState = {
  nombre: string;
  signo: ConceptoLiquidacionSigno;
  ivaPct: string;
  monto: string;
  cantidad: string;
  cantidadIgualViajes: boolean;
  bloqueado: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: '',
  signo: 'favor',
  ivaPct: '21',
  monto: '',
  cantidad: '1',
  cantidadIgualViajes: false,
  bloqueado: false,
};

export function ConceptosLiquidacionConfigSection({
  getToken,
  tenantId,
}: {
  getToken: () => Promise<string | null>;
  /** Presente = vista superadmin sobre una empresa elegida (pega contra /api/platform/...). */
  tenantId?: string;
}) {
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());
  const tid = tenantId?.trim() ?? '';
  const baseUrl = platform
    ? `/api/platform/arca/conceptos-liquidacion`
    : '/api/integracion-arca/conceptos-liquidacion';
  const listUrl = platform
    ? `${baseUrl}?tenantId=${encodeURIComponent(tid)}`
    : baseUrl;
  function itemUrl(id: string) {
    const path = `${baseUrl}/${encodeURIComponent(id)}`;
    return platform ? `${path}?tenantId=${encodeURIComponent(tid)}` : path;
  }
  const [items, setItems] = useState<ConceptoLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [eliminando, setEliminando] = useState<ConceptoLiquidacion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ConceptoLiquidacion[]>(
        listUrl,
        () => getToken(),
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(friendlyError(e, 'arca'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setShowForm(true);
  }

  function openEdit(c: ConceptoLiquidacion) {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre,
      signo: c.signo,
      ivaPct: String(c.ivaPct),
      monto: c.monto != null ? String(c.monto) : '',
      cantidad: String(c.cantidad ?? 1),
      cantidadIgualViajes: c.cantidadIgualViajes ?? false,
      bloqueado: c.bloqueado ?? false,
    });
    setFieldErrors({});
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'Ingresá el nombre.';
    if (!form.signo) errs.signo = 'Seleccioná sumar o restar.';
    const iva = Number(form.ivaPct);
    if (form.ivaPct.trim() === '' || !esAlicuotaIvaAfip(iva)) {
      errs.ivaPct = `Usá ${ALICUOTAS_IVA_AFIP_LABEL}.`;
    }
    if (form.monto.trim() !== '') {
      const m = Number(form.monto);
      if (Number.isNaN(m) || m < 0) {
        errs.monto = 'Ingresá un monto válido (0 o mayor).';
      }
    }
    if (!form.cantidadIgualViajes && form.cantidad.trim() !== '') {
      const q = Number(form.cantidad);
      if (Number.isNaN(q) || q <= 0) {
        errs.cantidad = 'Ingresá una cantidad mayor a 0.';
      }
    }
    return errs;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const body = {
        nombre: form.nombre.trim(),
        signo: form.signo,
        ivaPct: Number(form.ivaPct),
        monto: form.monto.trim() !== '' ? Number(form.monto) : null,
        cantidad:
          !form.cantidadIgualViajes && form.cantidad.trim() !== ''
            ? Number(form.cantidad)
            : 1,
        cantidadIgualViajes: form.cantidadIgualViajes,
        bloqueado: form.bloqueado,
      };
      if (editingId) {
        await apiJson<ConceptoLiquidacion>(
          itemUrl(editingId),
          () => getToken(),
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        showToast('Concepto actualizado.');
      } else {
        await apiJson<ConceptoLiquidacion>(
          listUrl,
          () => getToken(),
          { method: 'POST', body: JSON.stringify(body) },
        );
        showToast('Concepto creado.');
      }
      cancelForm();
      await load();
    } catch (err) {
      setError(friendlyError(err, 'arca'));
    } finally {
      setSaving(false);
    }
  }

  /** Solo para conceptos desactivados antes de que existiera "Eliminar". */
  async function activar(c: ConceptoLiquidacion) {
    setSaving(true);
    setError(null);
    try {
      await apiJson<ConceptoLiquidacion>(
        itemUrl(c.id),
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ activo: true }) },
      );
      showToast('Concepto activado.');
      await load();
    } catch (err) {
      setError(friendlyError(err, 'arca'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(itemUrl(eliminando.id), () => getToken(), { method: 'DELETE' });
      showToast('Concepto eliminado.');
      if (editingId === eliminando.id) cancelForm();
      setEliminando(null);
      await load();
    } catch (err) {
      setEliminando(null);
      setError(friendlyError(err, 'arca'));
    } finally {
      setSaving(false);
    }
  }

  const hayInactivos = items.some((c) => !c.activo);
  const montoUnitarioForm = form.monto.trim() !== '' ? Number(form.monto) : null;
  const cantidadForm = form.cantidad.trim() !== '' ? Number(form.cantidad) : 1;
  const montoTotalForm =
    montoUnitarioForm != null && Number.isFinite(montoUnitarioForm) && Number.isFinite(cantidadForm)
      ? Math.round(montoUnitarioForm * cantidadForm * 100) / 100
      : null;

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-charcoal hover:text-vialto-fire"
          >
            + Nuevo concepto
          </button>
        </div>
      )}

      {error && (
        <div className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4 border border-black/10 bg-vialto-mist/40 p-4">
          <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel">
            {editingId ? 'Editar concepto' : 'Nuevo concepto'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 sm:col-span-1">
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                disabled={saving}
                className={`${inputClass} ${fieldErrors.nombre ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.nombre} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Operación</CrudFieldLabel>
              <select
                value={form.signo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signo: e.target.value as ConceptoLiquidacionSigno }))
                }
                disabled={saving}
                className={`${inputClass} ${fieldErrors.signo ? 'border-red-400' : ''}`}
              >
                {SIGNO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <CrudFieldError message={fieldErrors.signo} />
            </label>
            <label className="grid gap-1.5">
              <div className="flex items-center gap-1.5">
                <CrudFieldLabel required>IVA (%)</CrudFieldLabel>
                <div className="group relative -mt-0.5 flex cursor-help items-center text-vialto-steel hover:text-vialto-charcoal">
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] font-bold"
                    aria-hidden="true"
                  >
                    ?
                  </span>
                  <div className={`${tooltipPanelClass} w-48 font-[family-name:var(--font-ui)]`}>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/70">
                      Alícuotas válidas AFIP:
                    </p>
                    <ul className="list-inside list-disc text-sm font-sans tracking-tight">
                      <li>0%</li>
                      <li>2,5%</li>
                      <li>5%</li>
                      <li>10,5%</li>
                      <li>21%</li>
                      <li>27%</li>
                    </ul>
                  </div>
                </div>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.ivaPct}
                onChange={(e) => setForm((f) => ({ ...f, ivaPct: e.target.value }))}
                disabled={saving}
                className={`${inputClass} ${fieldErrors.ivaPct ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.ivaPct} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <CrudFieldLabel>Monto base unitario</CrudFieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                disabled={saving}
                className={`${inputClass} ${fieldErrors.monto ? 'border-red-400' : ''}`}
                placeholder="Ej: 3500"
              />
              <CrudFieldError message={fieldErrors.monto} />
            </label>
            <div className="grid gap-1.5 content-start">
              <CrudFieldLabel>Cantidad</CrudFieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cantidadIgualViajes ? '' : form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                disabled={saving || form.cantidadIgualViajes}
                placeholder={form.cantidadIgualViajes ? 'Cantidad de viajes' : '1'}
                className={`${inputClass} disabled:bg-vialto-mist/60 ${fieldErrors.cantidad ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.cantidad} />
              <label className="flex items-center gap-2 text-xs text-vialto-steel">
                <input
                  type="checkbox"
                  checked={form.cantidadIgualViajes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cantidadIgualViajes: e.target.checked }))
                  }
                  disabled={saving}
                  className="h-4 w-4 rounded border-black/20 text-vialto-fire focus:ring-vialto-fire/35"
                />
                Igual a la cantidad de viajes
              </label>
            </div>
            <div className="grid gap-1.5 content-start">
              <CrudFieldLabel>Monto total base</CrudFieldLabel>
              <div className="flex h-10 items-center rounded border border-black/10 bg-vialto-mist/60 px-3 text-sm tabular-nums text-vialto-charcoal">
                {montoTotalForm == null
                  ? '-'
                  : form.cantidadIgualViajes
                    ? `${fmtMoney(montoUnitarioForm ?? 0)} × viajes`
                    : fmtMoney(montoTotalForm)}
              </div>
              <span className="text-xs leading-snug text-vialto-steel">
                Monto unitario × cantidad.
              </span>
            </div>
          </div>
          <div className="grid gap-4">
            <label className="flex items-start gap-2.5 self-start">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  checked={form.bloqueado}
                  onChange={(e) => setForm((f) => ({ ...f, bloqueado: e.target.checked }))}
                  disabled={saving}
                  className="h-4 w-4 rounded border-black/20 text-vialto-fire focus:ring-vialto-fire/35"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <CrudFieldLabel>Bloqueado (Autocarga)</CrudFieldLabel>
                <span className="text-xs leading-snug text-vialto-steel">
                  Si se marca, se añadirá automáticamente a las liquidaciones nuevas.
                </span>
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={cancelForm}
              className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? 'Guardando…' : editingId ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-vialto-steel">Cargando conceptos…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-vialto-steel">No hay conceptos configurados.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist/50">
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Nombre
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Operación
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  IVA
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Monto unitario
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Cantidad
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Monto total
                </th>
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                  Auto
                </th>
                {hayInactivos && (
                  <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal">
                    Estado
                  </th>
                )}
                <th className="px-3 py-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel font-normal text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0">
                  <td className="px-3 py-2.5 text-vialto-charcoal">{c.nombre}</td>
                  <td className="px-3 py-2.5 text-vialto-steel">{signoLabel(c.signo)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-vialto-charcoal">{c.ivaPct}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-vialto-charcoal">
                    {c.monto != null ? fmtMoney(c.monto) : '-'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-vialto-charcoal">
                    {c.cantidadIgualViajes ? (
                      <span title="Igual a la cantidad de viajes de la liquidación">
                        🔒 Viajes
                      </span>
                    ) : (
                      (c.cantidad ?? 1).toLocaleString('es-AR')
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-vialto-charcoal">
                    {c.monto == null
                      ? '-'
                      : c.cantidadIgualViajes
                        ? `${fmtMoney(c.monto)} × viajes`
                        : fmtMoney(Math.round(c.monto * (c.cantidad ?? 1) * 100) / 100)}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.bloqueado ? <span title="Se añade automáticamente">🔒</span> : '-'}
                  </td>
                  {hayInactivos && (
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          c.activo
                            ? 'text-xs text-emerald-700'
                            : 'text-xs text-vialto-steel'
                        }
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openEdit(c)}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
                      >
                        Editar
                      </button>
                      {!c.activo && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void activar(c)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setEliminando(c)}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={eliminando != null}
        title="Eliminar concepto"
        message={`¿Eliminar "${eliminando?.nombre ?? ''}"? Las liquidaciones que ya lo usan no cambian.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={saving}
        onConfirm={confirmarEliminar}
        onCancel={() => setEliminando(null)}
      />
    </div>
  );
}

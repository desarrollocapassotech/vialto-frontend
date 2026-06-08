import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { Presentacion } from '@/types/api';

type FormState = { nombre: string; activo: boolean };

export function PresentacionesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [rows, setRows] = useState<Presentacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ nombre: '', activo: true });

  const editing = rows?.find((r) => r.id === editingId) ?? null;
  const baseUrl = '/api/platform/stock/presentaciones';
  const qs = filtroEmpresa ? `?tenantId=${encodeURIComponent(filtroEmpresa)}` : '';

  const load = useCallback(async () => {
    if (!filtroEmpresa) return;
    const data = await apiJson<Presentacion[]>(`${baseUrl}${qs}`, () => getToken());
    setRows(data);
  }, [baseUrl, qs, filtroEmpresa, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'plataforma'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load, filtroEmpresa]);

  useEffect(() => {
    if (!isFormOpen) {
      setEditingId(null);
      return;
    }
    if (editing) {
      setForm({ nombre: editing.nombre, activo: editing.activo });
      return;
    }
    setForm({ nombre: '', activo: true });
  }, [editing, isFormOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filtroEmpresa) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { nombre: form.nombre.trim(), activo: form.activo };
      if (editingId) {
        await apiJson<Presentacion>(
          `${baseUrl}/${encodeURIComponent(editingId)}${qs}`,
          () => getToken(),
          { method: 'PATCH', body: JSON.stringify(payload) },
        );
      } else {
        await apiJson<Presentacion>(`${baseUrl}${qs}`, () => getToken(), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await load();
      setIsFormOpen(false);
      setEditingId(null);
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(row: Presentacion) {
    if (!filtroEmpresa || !window.confirm(`¿Eliminar la presentación "${row.nombre}"?`)) return;
    setError(null);
    try {
      await apiJson(`${baseUrl}/${encodeURIComponent(row.id)}${qs}`, () => getToken(), {
        method: 'DELETE',
      });
      await load();
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    }
  }

  return (
    <div className="w-full">
      <div className="mt-6">
        <EmpresaFilterBar tenants={tenants} value={filtroEmpresa} onChange={onChangeTenant} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={!filtroEmpresa}
          onClick={() => {
            setEditingId(null);
            setIsFormOpen(true);
          }}
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50"
        >
          Nueva presentación
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {!filtroEmpresa && (
        <p className="mt-8 text-sm text-vialto-steel">Elegí una empresa para ver sus presentaciones.</p>
      )}

      {filtroEmpresa && (
        <ListadoDatos
          className="mt-4"
          columns={[
            {
              id: 'nombre',
              header: 'Nombre',
              primary: true,
              cell: (row) => row.nombre,
              tdClassName: `${listadoTablaTdClass} font-medium`,
            },
            {
              id: 'estado',
              header: 'Estado',
              cell: (row) => (row.activo ? 'Activa' : 'Inactiva'),
              tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
            },
          ]}
          rows={error ? [] : rows}
          rowKey={(row) => row.id}
          emptyMessage={
            error
              ? 'No se pudieron cargar las presentaciones.'
              : 'No hay presentaciones para esta empresa.'
          }
          loadingMessage="Cargando…"
          renderActions={(row) => (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingId(row.id);
                  setIsFormOpen(true);
                }}
                className={listadoTablaAccionClass}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void eliminar(row)}
                className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
              >
                Eliminar
              </button>
            </>
          )}
        />
      )}

      {isFormOpen && filtroEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide mb-4">
              {editingId ? 'Editar presentación' : 'Nueva presentación'}
            </h2>
            <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
              Nombre <span className="text-red-500">*</span>
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="h-9 border border-black/15 px-2 text-sm normal-case tracking-normal"
                required
                autoFocus
              />
            </label>
            {editingId && (
              <label className="mt-3 flex items-center gap-2 text-sm text-vialto-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="h-4 w-4"
                />
                Activa
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsFormOpen(false)}
                className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
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
        <div className="mt-4 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && !error && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-vialto-steel">
                    Cargando…
                  </td>
                </tr>
              )}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-vialto-steel">
                    No hay presentaciones para esta empresa.
                  </td>
                </tr>
              )}
              {rows?.map((row) => (
                <tr key={row.id} className="border-b border-black/5 hover:bg-vialto-mist/80">
                  <td className="px-4 py-3 font-medium">{row.nombre}</td>
                  <td className="px-4 py-3 text-vialto-steel">{row.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(row.id);
                        setIsFormOpen(true);
                      }}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void eliminar(row)}
                      className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              Nombre *
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

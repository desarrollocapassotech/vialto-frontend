import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Deposito } from '@/types/api';

type DepositoFormState = {
  nombre: string;
  direccion: string;
  activo: boolean;
};

export function DepositosPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [depositos, setDepositos] = useState<Deposito[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDepositoId, setEditingDepositoId] = useState<string | null>(null);
  const [form, setForm] = useState<DepositoFormState>({
    nombre: '',
    direccion: '',
    activo: true,
  });

  const editarDeposito = useMemo(
    () => depositos?.find((d) => d.id === editingDepositoId) ?? null,
    [depositos, editingDepositoId],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await apiJson<Deposito[]>('/api/stock/depositos', () => getToken());
        if (!cancelled) {
          setDepositos(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDepositos(null);
          setError(friendlyError(e, 'stock'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isFormOpen) {
      setEditingDepositoId(null);
      return;
    }

    if (editarDeposito) {
      setForm({
        nombre: editarDeposito.nombre,
        direccion: editarDeposito.descripcion ?? '',
        activo: editarDeposito.activo,
      });
      return;
    }

    setForm({ nombre: '', direccion: '', activo: true });
  }, [editarDeposito, isFormOpen]);

  async function refresh() {
    try {
      const data = await apiJson<Deposito[]>('/api/stock/depositos', () => getToken());
      setDepositos(data);
      setError(null);
    } catch (e) {
      setDepositos(null);
      setError(friendlyError(e, 'stock'));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !isSignedIn) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || undefined,
        activo: form.activo,
      };

      if (editingDepositoId) {
        await apiJson<Deposito>(
          `/api/stock/depositos/${editingDepositoId}`,
          () => getToken(),
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiJson<Deposito>('/api/stock/depositos', () => getToken(), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await refresh();
      setIsFormOpen(false);
      setEditingDepositoId(null);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  function openCreateForm() {
    setEditingDepositoId(null);
    setIsFormOpen(true);
  }

  function openEditForm(deposito: Deposito) {
    setEditingDepositoId(deposito.id);
    setIsFormOpen(true);
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
            Depósitos
          </h1>
          <p className="mt-2 text-vialto-steel">
            Almancená y administrá los puntos de depósito para tu stock.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Nuevo depósito
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Dirección</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {depositos === null && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {depositos !== null && depositos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  Todavía no tenés depósitos cargados.
                </td>
              </tr>
            )}
            {depositos?.map((deposito) => (
              <tr key={deposito.id} className="border-b border-black/5 hover:bg-vialto-mist/80">
                <td className="px-4 py-3 font-medium">{deposito.nombre}</td>
                <td className="px-4 py-3 text-vialto-steel">{deposito.descripcion ?? '—'}</td>
                <td className="px-4 py-3 text-vialto-steel">
                  {deposito.activo ? 'Sí' : 'No'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEditForm(deposito)}
                    className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="mt-8 rounded border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">
            {editingDepositoId ? 'Editar depósito' : 'Nuevo depósito'}
          </h2>
          <p className="mt-1 text-sm text-vialto-steel">
            {editingDepositoId
              ? 'Actualizá los datos del depósito.'
              : 'Cargá un depósito para aplicar stock.'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-vialto-charcoal">
                Nombre
              </label>
              <input
                value={form.nombre}
                onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                className="mt-2 w-full rounded border border-black/10 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-vialto-charcoal">
                Dirección
              </label>
              <input
                value={form.direccion}
                onChange={(event) => setForm((current) => ({ ...current, direccion: event.target.value }))}
                className="mt-2 w-full rounded border border-black/10 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-vialto-charcoal">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(event) => setForm((current) => ({ ...current, activo: event.target.checked }))}
                />
                Activo
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingDepositoId(null);
                  setError(null);
                }}
                className="inline-flex h-10 items-center px-4 border border-black/10 text-sm uppercase tracking-wider hover:bg-vialto-mist"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

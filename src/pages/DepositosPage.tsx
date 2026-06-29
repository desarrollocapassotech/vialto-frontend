import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

    if (!form.nombre.trim()) {
      setFieldErrors({ nombre: 'Ingresá el nombre del depósito.' });
      return;
    }
    setFieldErrors({});
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
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Depósitos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Almancená y administrá los puntos de depósito para tu stock.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-10 w-fit max-w-full shrink-0 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Nuevo depósito
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (deposito) => deposito.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: 'direccion',
            header: 'Dirección',
            cell: (deposito) => deposito.descripcion ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'activo',
            header: 'Activo',
            cell: (deposito) => (deposito.activo ? 'Sí' : 'No'),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : depositos}
        rowKey={(deposito) => deposito.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los depósitos.'
            : 'Todavía no tenés depósitos cargados.'
        }
        loadingMessage="Cargando…"
        renderActions={(deposito) => (
          <button
            type="button"
            onClick={() => openEditForm(deposito)}
            className={listadoTablaAccionClass}
          >
            Editar
          </button>
        )}
      />

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
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nombre}
                onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                className={`mt-2 w-full rounded border px-3 py-2 text-sm ${fieldErrors.nombre ? 'border-red-400' : 'border-black/10'}`}
              />
              <CrudFieldError message={fieldErrors.nombre} />
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
                  setFieldErrors({});
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

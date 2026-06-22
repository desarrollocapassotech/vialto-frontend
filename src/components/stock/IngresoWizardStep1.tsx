import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import type { Cliente, Deposito } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export function IngresoWizardStep1({
  clientes,
  clienteId,
  onClienteChange,
  clientesLoading,
  depositos,
  depositoId,
  onDepositoChange,
  fieldErrors,
  onNuevoCliente,
  onContinuar,
}: {
  clientes: Cliente[];
  clienteId: string;
  onClienteChange: (id: string) => void;
  clientesLoading: boolean;
  depositos: Deposito[];
  depositoId: string;
  onDepositoChange: (id: string) => void;
  fieldErrors: Record<string, string>;
  onNuevoCliente: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-black/10 p-6 space-y-6">
        <div>
          <p className="text-sm text-vialto-steel">
            Identificá el ingreso: ¿de qué empresa son los productos y a qué depósito entran?
          </p>
        </div>

        <div className="space-y-1">
          <label className={LABEL}>
            Empresa / Cliente <span className="text-red-500">*</span>
          </label>
          <ClienteSearchSelect
            clientes={clientes}
            value={clienteId}
            onChange={onClienteChange}
            loading={clientesLoading}
            inputClassName={INPUT}
            onNuevo={onNuevoCliente}
          />
          <CrudFieldError message={fieldErrors.clienteId} />
        </div>

        <div className="space-y-1">
          <label className={LABEL}>
            Depósito <span className="text-red-500">*</span>
          </label>
          <select
            value={depositoId}
            onChange={(e) => onDepositoChange(e.target.value)}
            className={`h-9 w-full border bg-white px-2 text-sm ${
              fieldErrors.depositoId ? 'border-red-400' : 'border-black/15'
            }`}
          >
            <option value="">Elegí un depósito…</option>
            {depositos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <CrudFieldError message={fieldErrors.depositoId} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinuar}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-vialto-charcoal text-white text-sm font-semibold rounded hover:bg-vialto-charcoal/90 transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
